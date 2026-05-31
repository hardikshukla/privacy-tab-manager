const DEFAULT_STATE = {
  schemaVersion: 2,
  settings: {
    enabled: true,
    autoCollapse: true,
    minTabsForDomain: 2,
    pausedUntil: 0, // Epoch timestamp, 0 = active, positive integer = pause end time
    groupSingletons: true,
    commonGroupName: "Common",
    commonGroupColor: "grey"
  },
  rules: [
    {
      id: "rule_github",
      match: {
        type: "domain",
        value: "github.com"
      },
      group: {
        name: "Development",
        color: "purple"
      }
    },
    {
      id: "rule_google",
      match: {
        type: "domain",
        value: "google.com"
      },
      group: {
        name: "Google Search",
        color: "blue"
      }
    }
  ]
};

/**
 * Initializes local storage with default settings if not already set.
 * Performs schema migrations if necessary.
 * @returns {Promise<object>} Current storage state
 */
export async function initializeStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, async (result) => {
      if (!result || Object.keys(result).length === 0) {
        // Fresh install
        await chrome.storage.local.set(DEFAULT_STATE);
        resolve(DEFAULT_STATE);
      } else {
        // Run migration if schema version changes
        if (!result.schemaVersion || result.schemaVersion < DEFAULT_STATE.schemaVersion) {
          const migratedState = await runMigration(result);
          resolve(migratedState);
        } else {
          resolve(result);
        }
      }
    });
  });
}

/**
 * Migrates older schema formats to the current format.
 * @param {object} oldState
 * @returns {Promise<object>} Migrated state saved to storage
 */
async function runMigration(oldState) {
  const newState = { ...DEFAULT_STATE, ...oldState };
  newState.schemaVersion = DEFAULT_STATE.schemaVersion;
  
  // Ensure nested properties are structured correctly
  newState.settings = { ...DEFAULT_STATE.settings, ...(oldState.settings || {}) };
  newState.rules = oldState.rules || DEFAULT_STATE.rules;
  
  await chrome.storage.local.set(newState);
  return newState;
}

/**
 * Gets the complete local storage state.
 * @returns {Promise<object>}
 */
export async function getStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (result) => {
      resolve(result || DEFAULT_STATE);
    });
  });
}

/**
 * Gets the current settings.
 * @returns {Promise<object>}
 */
export async function getSettings() {
  const state = await getStorage();
  return state.settings || DEFAULT_STATE.settings;
}

/**
 * Updates settings with new values.
 * @param {object} newSettings
 * @returns {Promise<object>} The updated settings
 */
export async function updateSettings(newSettings) {
  const state = await getStorage();
  state.settings = { ...state.settings, ...newSettings };
  await chrome.storage.local.set(state);
  return state.settings;
}

/**
 * Gets the list of grouping rules.
 * @returns {Promise<Array>}
 */
export async function getRules() {
  const state = await getStorage();
  return state.rules || DEFAULT_STATE.rules;
}

/**
 * Saves a new set of rules.
 * @param {Array} rules
 * @returns {Promise<Array>}
 */
export async function saveRules(rules) {
  const state = await getStorage();
  state.rules = rules;
  await chrome.storage.local.set(state);
  return state.rules;
}

/**
 * Checks if the tab manager auto-grouping is temporarily paused.
 * @returns {Promise<boolean>}
 */
export async function isPaused() {
  const settings = await getSettings();
  if (settings.pausedUntil === 'restart') {
    return true;
  }
  if (settings.pausedUntil && settings.pausedUntil > Date.now()) {
    return true;
  }
  return false;
}
