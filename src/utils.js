/**
 * Validates whether a URL should be processed by the tab manager.
 * Excludes internal, system, and file URLs.
 * @param {string} urlStr
 * @returns {boolean}
 */
export function isValidTabUrl(urlStr) {
  if (!urlStr) return false;
  try {
    const url = new URL(urlStr);
    const ignoredProtocols = [
      'chrome:',
      'chrome-extension:',
      'brave:',
      'about:',
      'file:',
      'edge:',
      'view-source:',
      'devtools:'
    ];
    return !ignoredProtocols.includes(url.protocol);
  } catch (e) {
    return false;
  }
}

/**
 * Extracts the base domain/hostname from a URL (removing 'www.').
 * Keeps subdomains (like mail.google.com vs calendar.google.com) separate
 * for better application-level grouping, unless overridden by rules.
 * @param {string} urlStr
 * @returns {string}
 */
export function getBaseDomain(urlStr) {
  if (!isValidTabUrl(urlStr)) return '';
  try {
    const url = new URL(urlStr);
    let hostname = url.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    return hostname;
  } catch (e) {
    return '';
  }
}

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 * @param {Function} func
 * @param {number} wait
 * @returns {Function}
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
