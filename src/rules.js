import { getBaseDomain, isValidTabUrl } from './utils.js';

/**
 * Matches a tab's URL against the list of user rules.
 * Supports exact domain matching and subdomain matching (e.g. sub.domain.com matching domain.com).
 * @param {string} urlStr - The tab's URL.
 * @param {Array} rules - The array of rule objects.
 * @returns {object|null} The group configuration {name, color} if matched, otherwise null.
 */
export function matchRules(urlStr, rules) {
  if (!isValidTabUrl(urlStr)) return null;

  const domain = getBaseDomain(urlStr);
  if (!domain) return null;

  const tabDomain = domain.toLowerCase().trim();

  for (const rule of rules) {
    if (rule.match && rule.match.type === 'domain') {
      const matchPattern = rule.match.value.toLowerCase().trim();
      
      // Support comma-separated domains
      const matchDomains = matchPattern.split(',').map(d => d.trim()).filter(Boolean);

      for (const ruleVal of matchDomains) {
        if (tabDomain === ruleVal || tabDomain.endsWith('.' + ruleVal)) {
          return rule.group;
        }
      }
    }
  }

  return null;
}
