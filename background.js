import { initializeStorage, getSettings, getRules, isPaused, updateSettings } from './src/storage.js';
import { isValidTabUrl, getBaseDomain, debounce } from './src/utils.js';
import { matchRules } from './src/rules.js';

// Debounced organizer to prevent hitting API rate limits during bulk actions
const debouncedOrganize = debounce(organizeTabs, 500);

// Keep track of active collapse timeouts per window to prevent jumpiness
const collapseTimeouts = {};

/**
 * Initializes the extension
 */
chrome.runtime.onInstalled.addListener(async () => {
  await initializeStorage();
  await updateSettings({ pausedUntil: 0 });
  debouncedOrganize();
});

// Re-organize on startup as well
chrome.runtime.onStartup.addListener(async () => {
  await initializeStorage();
  const settings = await getSettings();
  if (settings.pausedUntil === 'restart') {
    await updateSettings({ pausedUntil: 0 });
  }
  debouncedOrganize();
});

// Monitor Tab Events
chrome.tabs.onCreated.addListener(() => {
  debouncedOrganize();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only trigger organize if the URL has changed (navigation)
  if (changeInfo.url) {
    debouncedOrganize();
  }
  
  // Trigger auto collapse if active tab's group status might have changed
  if (tab.active && (changeInfo.url || changeInfo.groupId !== undefined)) {
    triggerAutoCollapse(tab.windowId);
  }
});

chrome.tabs.onRemoved.addListener(() => {
  debouncedOrganize();
});

// Trigger Auto-Collapse on Tab Activation
chrome.tabs.onActivated.addListener((activeInfo) => {
  triggerAutoCollapse(activeInfo.windowId);
});

// Listen for messages from Popup UI (e.g. settings changes, manual grouping)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'settingsChanged' || message.action === 'rulesChanged') {
    debouncedOrganize();
    sendResponse({ status: 'ok' });
  } else if (message.action === 'groupNow') {
    organizeTabs().then(() => {
      sendResponse({ status: 'ok' });
    });
    return true; // Keep message channel open for async response
  }
});

/**
 * Core Auto-Grouping logic
 */
let isOrganizing = false;
async function organizeTabs() {
  if (isOrganizing) return;
  
  // Check if paused or disabled
  const settings = await getSettings();
  if (!settings.enabled || await isPaused()) {
    return;
  }

  isOrganizing = true;

  try {
    const rules = await getRules();
    const minTabs = settings.minTabsForDomain || 2;

    // Get all windows
    const windows = await chrome.windows.getAll({ populate: true });

    for (const win of windows) {
      const windowId = win.id;
      const tabs = win.tabs || [];

      // 1. Filter out pinned tabs and invalid URLs
      const validTabs = tabs.filter(t => !t.pinned && isValidTabUrl(t.url));

      // 2. Count occurrences of base domains in this window (excluding those matching custom rules)
      const domainCounts = {};
      const tabGroupTargets = []; // [{ tab, targetTitle, targetColor, isAutoDomain, domain }]

      for (const tab of validTabs) {
        const matchedRule = matchRules(tab.url, rules);
        
        if (matchedRule) {
          tabGroupTargets.push({
            tab,
            targetTitle: matchedRule.name,
            targetColor: matchedRule.color,
            isAutoDomain: false
          });
        } else {
          const domain = getBaseDomain(tab.url);
          if (domain) {
            domainCounts[domain] = (domainCounts[domain] || 0) + 1;
            tabGroupTargets.push({
              tab,
              targetTitle: domain,
              targetColor: 'grey', // default color for auto domains
              isAutoDomain: true,
              domain
            });
          } else {
            tabGroupTargets.push({
              tab,
              targetTitle: null,
              targetColor: null,
              isAutoDomain: false
            });
          }
        }
      }

      // 3. Apply min-tab threshold for domain grouping and route singletons to common group
      for (const target of tabGroupTargets) {
        if (target.isAutoDomain) {
          const count = domainCounts[target.domain] || 0;
          if (count < minTabs) {
            target.targetTitle = null;
            target.targetColor = null;
          }
        }

        // If the tab remains ungrouped, route it to the common group if enabled
        if (target.targetTitle === null && settings.groupSingletons) {
          target.targetTitle = settings.commonGroupName || "Common";
          target.targetColor = settings.commonGroupColor || "grey";
        }
      }

      // 4. Fetch native groups in this window
      const nativeGroups = await chrome.tabGroups.query({ windowId });
      const nativeGroupsMap = {};
      for (const g of nativeGroups) {
        nativeGroupsMap[g.id] = g;
      }

      // 5. Identify regrouping actions
      const groupsToSync = {}; // { [title]: { color, tabIds: [] } }
      const tabsToUngroup = [];

      for (const target of tabGroupTargets) {
        const { tab, targetTitle, targetColor } = target;
        const currentGroupId = tab.groupId;

        if (targetTitle === null) {
          if (currentGroupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
            tabsToUngroup.push(tab.id);
          }
        } else {
          const currentGroup = nativeGroupsMap[currentGroupId];
          if (currentGroup && currentGroup.title === targetTitle) {
            // Already in correct group. Update color if mismatch
            if (currentGroup.color !== targetColor) {
              try {
                await chrome.tabGroups.update(currentGroupId, { color: targetColor });
              } catch (err) {
                console.warn(`Failed to update color for group ${currentGroupId}:`, err);
              }
            }
          } else {
            // Needs grouping
            if (!groupsToSync[targetTitle]) {
              groupsToSync[targetTitle] = {
                color: targetColor,
                tabIds: []
              };
            }
            groupsToSync[targetTitle].tabIds.push(tab.id);
          }
        }
      }

      // 6. Execute Ungrouping
      if (tabsToUngroup.length > 0) {
        try {
          await chrome.tabs.ungroup(tabsToUngroup);
        } catch (err) {
          console.warn("Failed to ungroup tabs:", err);
        }
      }

      // 7. Execute Grouping
      for (const [title, groupInfo] of Object.entries(groupsToSync)) {
        const { color, tabIds } = groupInfo;
        if (tabIds.length === 0) continue;

        // Find existing group with this title in this window
        const existingGroup = nativeGroups.find(g => g.title === title);

        try {
          if (existingGroup) {
            await chrome.tabs.group({ tabIds, groupId: existingGroup.id });
            if (existingGroup.color !== color) {
              await chrome.tabGroups.update(existingGroup.id, { color });
            }
          } else {
            const newGroupId = await chrome.tabs.group({ tabIds });
            await chrome.tabGroups.update(newGroupId, { title, color });
          }
        } catch (err) {
          console.error(`Failed to sync group "${title}":`, err);
        }
      }

      // 8. Merge any duplicate groups with the same title in this window
      // (can happen from race conditions or window merges)
      try {
        const freshGroups = await chrome.tabGroups.query({ windowId });
        const seenTitles = {};
        for (const g of freshGroups) {
          const key = (g.title || '').trim();
          if (!key) continue;
          if (seenTitles[key] !== undefined) {
            // Duplicate — move all its tabs into the primary group
            const dupTabs = await chrome.tabs.query({ groupId: g.id, windowId });
            if (dupTabs.length > 0) {
              await chrome.tabs.group({
                tabIds: dupTabs.map(t => t.id),
                groupId: seenTitles[key]
              });
            }
          } else {
            seenTitles[key] = g.id;
          }
        }
      } catch (mergeErr) {
        console.warn('Dedup merge failed:', mergeErr);
      }
    }
  } catch (error) {
    console.error("Error organizing tabs:", error);
  } finally {
    isOrganizing = false;
  }
}

/**
 * Collapses inactive tab groups and expands active group in active window
 */
function triggerAutoCollapse(windowId) {
  if (collapseTimeouts[windowId]) {
    clearTimeout(collapseTimeouts[windowId]);
  }

  collapseTimeouts[windowId] = setTimeout(async () => {
    try {
      const settings = await getSettings();
      if (!settings.enabled || !settings.autoCollapse || await isPaused()) {
        return;
      }

      // Get the active tab in this window
      const [activeTab] = await chrome.tabs.query({ active: true, windowId });
      if (!activeTab) return;

      const activeGroupId = activeTab.groupId;

      // Get all groups in this window
      const groups = await chrome.tabGroups.query({ windowId });

      for (const group of groups) {
        const shouldCollapse = group.id !== activeGroupId;
        if (group.collapsed !== shouldCollapse) {
          try {
            await chrome.tabGroups.update(group.id, { collapsed: shouldCollapse });
          } catch (err) {
            console.warn(`Failed to update collapse state for group ${group.id}:`, err);
          }
        }
      }
    } catch (e) {
      console.error("Error in auto collapse execution:", e);
    } finally {
      delete collapseTimeouts[windowId];
    }
  }, 250);
}
