import { getSettings, updateSettings, getRules, saveRules, isPaused } from '../src/storage.js';
import { getBaseDomain } from '../src/utils.js';

document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
});

async function initDashboard() {
  const totalTabsCount = document.getElementById('totalTabsCount');
  const activeGroupsCount = document.getElementById('activeGroupsCount');
  const statusBadge = document.getElementById('statusBadge');
  const autoGroupToggle = document.getElementById('autoGroupToggle');
  const autoCollapseToggle = document.getElementById('autoCollapseToggle');
  const groupSingletonsToggle = document.getElementById('groupSingletonsToggle');
  const minTabsSlider = document.getElementById('minTabsSlider');
  const minTabsValueDisplay = document.getElementById('minTabsValueDisplay');
  const pauseDurationSelect = document.getElementById('pauseDurationSelect');
  const groupNowButton = document.getElementById('groupNowButton');

  // Drawer Toggle Elements
  const settingsGearBtn = document.getElementById('settingsGearBtn');
  const settingsDrawer = document.getElementById('settingsDrawer');

  // Unified Add Rule button
  const showAddRuleCardBtn = document.getElementById('showAddRuleCardBtn');

  // Load Settings
  const settings = await getSettings();
  const paused = await isPaused();

  // Initialize Toggles and inputs
  autoGroupToggle.checked = settings.enabled;
  autoCollapseToggle.checked = settings.autoCollapse;
  groupSingletonsToggle.checked = settings.groupSingletons !== false;
  minTabsSlider.value = settings.minTabsForDomain || 2;
  minTabsValueDisplay.textContent = settings.minTabsForDomain || 2;

  // Set Pause dropdown value
  updatePauseDropdown(settings.pausedUntil, paused);
  updateStatus(settings.enabled, paused);

  // Load Stats and Groups
  await refreshStatsAndGroups();

  // Settings Gear toggle listener
  settingsGearBtn.addEventListener('click', () => {
    settingsGearBtn.classList.toggle('active');
    settingsDrawer.classList.toggle('hidden');
  });

  // Show Add Rule Inline Card
  showAddRuleCardBtn.addEventListener('click', () => {
    openAddRuleForm();
  });

  // Event Listeners for settings
  autoGroupToggle.addEventListener('change', async () => {
    const enabled = autoGroupToggle.checked;
    const currentSettings = await updateSettings({ enabled });
    const isCurrentlyPaused = await isPaused();
    updateStatus(enabled, isCurrentlyPaused);
    chrome.runtime.sendMessage({ action: 'settingsChanged' });
  });

  autoCollapseToggle.addEventListener('change', async () => {
    const autoCollapse = autoCollapseToggle.checked;
    await updateSettings({ autoCollapse });
    chrome.runtime.sendMessage({ action: 'settingsChanged' });
  });

  groupSingletonsToggle.addEventListener('change', async () => {
    const groupSingletons = groupSingletonsToggle.checked;
    await updateSettings({ groupSingletons });
    chrome.runtime.sendMessage({ action: 'settingsChanged' });
  });

  minTabsSlider.addEventListener('input', () => {
    minTabsValueDisplay.textContent = minTabsSlider.value;
  });

  minTabsSlider.addEventListener('change', async () => {
    const minTabsForDomain = parseInt(minTabsSlider.value, 10);
    await updateSettings({ minTabsForDomain });
    chrome.runtime.sendMessage({ action: 'settingsChanged' });
  });

  pauseDurationSelect.addEventListener('change', async () => {
    const value = pauseDurationSelect.value;
    let pausedUntil = 0;

    if (value === 'restart') {
      pausedUntil = 'restart';
    } else if (value !== '0') {
      const minutes = parseInt(value, 10);
      pausedUntil = Date.now() + minutes * 60 * 1000;
    }

    const currentSettings = await updateSettings({ pausedUntil });
    const isCurrentlyPaused = await isPaused();
    updateStatus(currentSettings.enabled, isCurrentlyPaused);
    
    // Remove custom paused option if user changes value
    const customOpt = pauseDurationSelect.querySelector('option[value="custom_paused"]');
    if (customOpt && value !== 'custom_paused') {
      customOpt.remove();
    }

    chrome.runtime.sendMessage({ action: 'settingsChanged' });
  });

  groupNowButton.addEventListener('click', async () => {
    groupNowButton.disabled = true;
    groupNowButton.innerHTML = `
      <svg class="btn-icon animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
        <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Grouping...
    `;

    chrome.runtime.sendMessage({ action: 'groupNow' }, async (response) => {
      // Re-fetch groups after organizing
      setTimeout(async () => {
        await refreshStatsAndGroups();
        groupNowButton.disabled = false;
        groupNowButton.innerHTML = `
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 6h16M4 12h16m-7 6h7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Group Tabs Now
        `;
      }, 500);
    });
  });
}

function updatePauseDropdown(pausedUntil, isCurrentlyPaused) {
  const pauseDurationSelect = document.getElementById('pauseDurationSelect');
  
  // Clear any existing custom option
  const existingCustom = pauseDurationSelect.querySelector('option[value="custom_paused"]');
  if (existingCustom) existingCustom.remove();

  if (isCurrentlyPaused) {
    if (pausedUntil === 'restart') {
      pauseDurationSelect.value = 'restart';
    } else {
      // Add custom Option to represent active timed pause
      const timeRemaining = Math.max(0, pausedUntil - Date.now());
      const minRemaining = Math.ceil(timeRemaining / (60 * 1000));
      
      const opt = document.createElement('option');
      opt.value = 'custom_paused';
      opt.textContent = `Paused (${minRemaining}m left)`;
      opt.selected = true;
      pauseDurationSelect.appendChild(opt);
    }
  } else {
    pauseDurationSelect.value = '0';
  }
}

function updateStatus(enabled, paused) {
  const statusBadge = document.getElementById('statusBadge');
  if (!enabled) {
    statusBadge.textContent = 'Disabled';
    statusBadge.className = 'status-badge disabled';
  } else if (paused) {
    statusBadge.textContent = 'Paused';
    statusBadge.className = 'status-badge paused';
  } else {
    statusBadge.textContent = 'Active';
    statusBadge.className = 'status-badge';
  }
}

async function refreshStatsAndGroups() {
  const totalTabsCount = document.getElementById('totalTabsCount');
  const activeGroupsCount = document.getElementById('activeGroupsCount');

  try {
    const currentWindow = await chrome.windows.getCurrent();
    const windowId = currentWindow.id;

    // Get all tabs and groups in current window
    const tabs = await chrome.tabs.query({ windowId });
    const groups = await chrome.tabGroups.query({ windowId });

    totalTabsCount.textContent = tabs.length;
    activeGroupsCount.textContent = groups.length;

    await renderGroups(tabs, groups);
  } catch (error) {
    console.error("Error refreshing dashboard:", error);
  }
}

async function renderGroups(tabs, groups) {
  const groupsListContainer = document.getElementById('groupsListContainer');
  
  // Keep empty state element if no groups
  if (groups.length === 0) {
    groupsListContainer.innerHTML = `
      <div class="empty-state" id="emptyStateDisplay">
        <p>No active groups found in this window.</p>
      </div>
    `;
    return;
  }

  groupsListContainer.innerHTML = '';
  const rules = await getRules();
  const settings = await getSettings();
  const commonName = settings.commonGroupName || 'Common';

  // Classify groups: custom rules vs auto-grouped
  const classifiedGroups = groups.map(group => {
    const groupTabs = tabs.filter(t => t.groupId === group.id);
    const count = groupTabs.length;

    const tabDomains = new Set();
    groupTabs.forEach(t => {
      try {
        const url = new URL(t.url);
        if (!['chrome:', 'chrome-extension:', 'brave:', 'about:'].includes(url.protocol)) {
          const domain = getBaseDomain(t.url);
          if (domain) tabDomains.add(domain);
        }
      } catch (e) { /* ignore */ }
    });

    const domainsArray = Array.from(tabDomains);

    let matchedRule = null;
    if (group.title && group.title !== commonName) {
      matchedRule = rules.find(r => r.group && r.group.name === group.title);
    }
    if (!matchedRule && domainsArray.length > 0) {
      matchedRule = rules.find(r => {
        if (r.match && r.match.type === 'domain') {
          const matchDomains = r.match.value.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
          return domainsArray.some(d => matchDomains.includes(d.toLowerCase()));
        }
        return false;
      });
    }

    return { group, count, domainsArray, matchedRule };
  });

  // Sort: custom rules first, then auto-grouped
  classifiedGroups.sort((a, b) => {
    if (a.matchedRule && !b.matchedRule) return -1;
    if (!a.matchedRule && b.matchedRule) return 1;
    return 0;
  });

  let lastSectionWasCustom = null;

  classifiedGroups.forEach(({ group, count, domainsArray, matchedRule }) => {
    const isCustom = !!matchedRule;

    // Insert section label when section changes
    if (lastSectionWasCustom !== isCustom) {
      const label = document.createElement('div');
      label.className = 'group-section-label';
      label.textContent = isCustom ? 'Custom Rules' : 'Auto-Grouped';
      groupsListContainer.appendChild(label);
      lastSectionWasCustom = isCustom;
    }

    const defaultPrefillDomains = matchedRule ? matchedRule.match.value : domainsArray.join(', ');
    const subtitleText = domainsArray.length > 0 ? domainsArray.join(', ') : 'Single/unmatched tabs';

    const item = document.createElement('div');
    item.className = 'group-item';
    item.style.setProperty('--indicator-color', `var(--chrome-${group.color})`);

    item.innerHTML = `
      <div class="group-meta">
        <span class="group-dot" style="background:var(--chrome-${group.color}); box-shadow: 0 0 6px var(--chrome-${group.color});"></span>
        <div class="group-title-container">
          <span class="group-name" title="${group.title || 'Common'}">${group.title || 'Common'}</span>
          <span class="group-domains-subtitle" title="${subtitleText}">${subtitleText}</span>
        </div>
        <span class="group-count">${count} tab${count !== 1 ? 's' : ''}</span>
      </div>
      <div class="group-actions">
        ${domainsArray.length > 0 ? `
        <button class="icon-btn edit-btn" title="Customize this group">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </button>` : ''}
      </div>
    `;

    if (domainsArray.length > 0) {
      item.querySelector('.edit-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openEditForm(item, group, defaultPrefillDomains, matchedRule);
      });
    }

    groupsListContainer.appendChild(item);
  });
}

function openEditForm(groupItem, group, defaultDomains, matchedRule) {
  const template = document.getElementById('editRuleTemplate');
  const clone = template.content.cloneNode(true);
  const editCard = clone.querySelector('.edit-rule-card');

  const domainsInput = editCard.querySelector('#editRuleDomainsInput');
  domainsInput.value = defaultDomains;

  const nameInput = editCard.querySelector('#editGroupNameInput');
  nameInput.value = group.title || '';

  // Handle color selection
  let selectedColor = group.color;
  const colorBtns = editCard.querySelectorAll('.color-dot-btn');
  
  // Highlight current color
  colorBtns.forEach(btn => {
    if (btn.dataset.color === selectedColor) {
      btn.classList.add('selected');
    }

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      colorBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedColor = btn.dataset.color;
    });
  });

  // Bind Actions
  const cancelBtn = editCard.querySelector('#cancelEditBtn');
  const deleteRuleBtn = editCard.querySelector('#deleteRuleBtn');
  const saveBtn = editCard.querySelector('#saveEditBtn');

  if (matchedRule) {
    // Show Delete button if custom rule is active
    deleteRuleBtn.classList.remove('hidden');
    deleteRuleBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const confirmed = confirm(`Are you sure you want to delete the custom rule for "${matchedRule.group.name}"?`);
      if (confirmed) {
        const rules = await getRules();
        const filtered = rules.filter(r => r.id !== matchedRule.id);
        await saveRules(filtered);
        chrome.runtime.sendMessage({ action: 'rulesChanged' }, () => {
          setTimeout(refreshStatsAndGroups, 400);
        });
      }
    });
  }

  cancelBtn.addEventListener('click', (e) => {
    e.preventDefault();
    refreshStatsAndGroups(); // Re-render standard list
  });

  saveBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const newName = nameInput.value.trim();
    const domainsVal = domainsInput.value.trim();

    if (!newName || !domainsVal) {
      alert("Please fill in both the group name and domain list.");
      return;
    }

    // Clean up domains array
    const cleanedDomains = domainsVal.split(',')
      .map(d => {
        let clean = d.trim().toLowerCase();
        try {
          if (clean.includes('://')) {
            const parsed = new URL(clean);
            clean = parsed.hostname;
          } else {
            clean = clean.split('/')[0];
          }
          if (clean.startsWith('www.')) {
            clean = clean.substring(4);
          }
        } catch (e) {
          // fallback
        }
        return clean;
      })
      .filter(Boolean);

    if (cleanedDomains.length === 0) {
      alert("Invalid domain list format.");
      return;
    }

    let cleanedDomainsStr = cleanedDomains.join(', ');

    // Save/Update Rule
    const rules = await getRules();
    
    // Find rule index by ID if matchedRule exists, or match by domain list overlap
    let ruleIdx = -1;
    if (matchedRule) {
      ruleIdx = rules.findIndex(r => r.id === matchedRule.id);
    } else {
      // Find if group name is already mapped to a rule
      ruleIdx = rules.findIndex(r => r.group && r.group.name.toLowerCase() === newName.toLowerCase());
    }

    // Usability Sweet Spot: If renaming/creating rules that collide with an existing group name, MERGE their domains!
    if (ruleIdx !== -1 && !matchedRule) {
      const existingDomains = rules[ruleIdx].match.value.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
      cleanedDomains.forEach(d => {
        if (!existingDomains.includes(d)) {
          existingDomains.push(d);
        }
      });
      cleanedDomainsStr = existingDomains.join(', ');
      selectedColor = rules[ruleIdx].group.color; // Retain existing color for the group
    }

    const ruleData = {
      id: ruleIdx !== -1 ? rules[ruleIdx].id : `rule_${Date.now()}`,
      match: {
        type: 'domain',
        value: cleanedDomainsStr
      },
      group: {
        name: newName,
        color: selectedColor
      }
    };

    if (ruleIdx !== -1) {
      rules[ruleIdx] = ruleData;
    } else {
      rules.push(ruleData);
    }

    await saveRules(rules);

    // Notify background worker
    chrome.runtime.sendMessage({ action: 'rulesChanged' }, () => {
      // Reload dashboard after background re-groups
      setTimeout(refreshStatsAndGroups, 400);
    });
  });

  // Replace group item with edit card
  groupItem.replaceWith(editCard);
  nameInput.focus();
}

function openAddRuleForm() {
  const groupsListContainer = document.getElementById('groupsListContainer');
  const template = document.getElementById('addRuleTemplate');
  const clone = template.content.cloneNode(true);
  const addCard = clone.querySelector('.add-rule-card');

  const domainInput = addCard.querySelector('#addRuleDomainInput');
  const nameInput = addCard.querySelector('#addRuleNameInput');

  // Handle color selection
  let selectedColor = 'blue';
  const colorBtns = addCard.querySelectorAll('.color-dot-btn');
  
  // Highlight default
  colorBtns.forEach(btn => {
    if (btn.dataset.color === selectedColor) {
      btn.classList.add('selected');
    }

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      colorBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedColor = btn.dataset.color;
    });
  });

  const cancelBtn = addCard.querySelector('#cancelAddBtn');
  const saveBtn = addCard.querySelector('#saveAddBtn');

  cancelBtn.addEventListener('click', (e) => {
    e.preventDefault();
    refreshStatsAndGroups();
  });

  saveBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const domainVal = domainInput.value.trim().toLowerCase();
    const nameVal = nameInput.value.trim();

    if (!domainVal || !nameVal) {
      alert('Please fill in both the domain list and the group name.');
      return;
    }

    // Clean up domain list
    const cleanedDomains = domainVal.split(',')
      .map(d => {
        let clean = d.trim().toLowerCase();
        try {
          if (clean.includes('://')) {
            const parsed = new URL(clean);
            clean = parsed.hostname;
          } else {
            clean = clean.split('/')[0];
          }
          if (clean.startsWith('www.')) {
            clean = clean.substring(4);
          }
        } catch (e) {
          // fallback
        }
        return clean;
      })
      .filter(Boolean);

    if (cleanedDomains.length === 0) {
      alert("Invalid domain list format.");
      return;
    }

    let cleanedDomainsStr = cleanedDomains.join(', ');

    const rules = await getRules();
    
    // Usability Sweet Spot: If creating a rule with an existing group name, MERGE their domains!
    const duplicateIdx = rules.findIndex(r => r.group && r.group.name.toLowerCase() === nameVal.toLowerCase());
    
    if (duplicateIdx !== -1) {
      const existingDomains = rules[duplicateIdx].match.value.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
      cleanedDomains.forEach(d => {
        if (!existingDomains.includes(d)) {
          existingDomains.push(d);
        }
      });
      rules[duplicateIdx].match.value = existingDomains.join(', ');
      rules[duplicateIdx].group.color = selectedColor; // Apply selected color
    } else {
      const newRule = {
        id: `rule_${Date.now()}`,
        match: {
          type: 'domain',
          value: cleanedDomainsStr
        },
        group: {
          name: nameVal,
          color: selectedColor
        }
      };
      rules.push(newRule);
    }

    await saveRules(rules);

    chrome.runtime.sendMessage({ action: 'rulesChanged' }, () => {
      setTimeout(refreshStatsAndGroups, 400);
    });
  });

  // Prepend or replace list content with Add Rule card
  const emptyState = groupsListContainer.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  groupsListContainer.insertBefore(addCard, groupsListContainer.firstChild);
  domainInput.focus();
}
