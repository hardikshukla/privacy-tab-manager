# tabManager

A high-performance, privacy-focused Chrome extension (Manifest V3) that automatically organizes your tabs into native browser tab groups. It keeps your workspace clean, reduces cognitive load, and respects your privacy — with zero remote servers.

> Compatible with **Chrome** and **Brave** browsers.

---

## Features

1. **Zero-Configuration Startup** — Works immediately upon installation. Tabs from the same domain are automatically grouped once 2 or more are open (threshold is configurable).
2. **Group Single Tabs** — Singleton and unmatched tabs are collected into a single **"Common"** group so your tab bar is always 100% organized. Enabled by default; can be toggled in the popup.
3. **Sleek Popup Dashboard** — A modern, dark-mode glassmorphic control panel to view active groups, adjust settings, manage rules, and trigger immediate organization.
4. **Live Stats Bar** — Displays the current **Total Tabs** and **Active Groups** count at a glance.
5. **In-Popup Rule Editing** — Customize group titles and colors (using all 9 native Chrome group colors) directly from the popup. Rules are saved persistently in local storage and applied automatically.
6. **Multi-Domain Rules** — A single rule can match multiple domains (comma-separated), so `github.com`, `gitlab.com`, and `bitbucket.org` can all be merged into one unified "Development" group.
7. **Subdomain Matching** — Rules match subdomains automatically (e.g., `mail.google.com` matches a rule for `google.com`).
8. **Auto-Collapse Inactive Groups** — Automatically collapses inactive tab groups when you switch tabs, keeping only your active group expanded. A built-in debounce (250ms) prevents visual jumpiness during rapid tab switching.
9. **Temporary Pause Control** — Suspend auto-grouping for **30 minutes**, **2 hours**, **24 hours**, or **until browser restart** — perfect for chaotic research sessions.
10. **Domain Threshold Slider** — Adjust how many tabs from the same domain are required before they're grouped (range: 2–10 tabs).
11. **Pinned Tab Exclusion** — Pinned tabs (Slack, Gmail, etc.) are always left untouched.
12. **Duplicate Group Merging** — After each organize pass, any duplicate groups with the same title (caused by race conditions or window merges) are automatically merged into one.
13. **Local Sandbox Privacy**
    - **No remote servers. No analytics. No cloud sync. No external databases.**
    - Everything is processed 100% offline inside your browser sandbox.
    - Minimal permissions: `tabs`, `tabGroups`, `storage` — no broad host permissions like `<all_urls>`.

---

## Project Structure

```
tabManger/
├── manifest.json          # Extension manifest (MV3)
├── background.js          # Service worker: core auto-grouping & collapse logic
├── popup/
│   ├── popup.html         # Popup UI markup
│   ├── popup.css          # Glassmorphic dark-mode styles
│   └── popup.js           # Popup UI logic (settings, rules, stats)
├── src/
│   ├── storage.js         # Chrome storage abstraction & schema migrations
│   ├── rules.js           # Domain rule matching engine
│   └── utils.js           # URL validation, domain extraction, debounce
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

---

## Architecture

The extension uses a **Manifest V3 service worker** architecture:

- **`background.js`** — The core service worker. Listens to `chrome.tabs` events (created, updated, removed, activated) and runs a debounced `organizeTabs()` function to minimize Chrome API rate-limit hits. Also handles auto-collapse logic per window with timeout-based debouncing.
- **`src/storage.js`** — Manages all Chrome local storage reads/writes with a versioned schema (`schemaVersion: 2`). Handles automatic migration of older data formats.
- **`src/rules.js`** — Pure matching logic. Given a URL and a list of rules, returns the matching group config `{ name, color }` or `null`.
- **`src/utils.js`** — Stateless helpers: `isValidTabUrl()`, `getBaseDomain()` (strips `www.`), and `debounce()`.
- **`popup/popup.js`** — Reads/writes settings and rules via the storage module, communicates with the background service worker via `chrome.runtime.sendMessage`.

### Default Rules (on fresh install)

| Domain | Group Name | Color |
|---|---|---|
| `github.com` | Development | Purple |
| `google.com` | Google Search | Blue |

---

## Installation

1. **Download / Clone** this repository to your local machine.
2. Open **Chrome** or **Brave** and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked**.
5. Select the `tabManger/` folder (the one containing `manifest.json`).
6. The extension is now active. Pin it to your toolbar for quick access.

---

## Usage Guide

### Settings Panel
Click the **⚙ gear icon** in the popup header to reveal the settings drawer.

| Setting | Description | Default |
|---|---|---|
| Auto-Grouping | Enable/disable all automatic tab grouping | On |
| Auto-Collapse | Collapse inactive groups when switching tabs | On |
| Group Single Tabs | Collect unmatched tabs into a "Common" group | On |
| Temporary Pause | Suspend grouping for 30m / 2h / 24h / until restart | Active |
| Domain Threshold | Minimum open tabs before a domain gets its own group | 2 |

### Managing Groups & Rules

**Edit an existing group:**
1. Open the popup — active groups appear under **Active Groups & Custom Rules**.
2. Click the **✏ pencil icon** next to a group.
3. Modify the domains (comma-separated), group name, or color.
4. Click **Save Rule** — the rule is saved and takes effect immediately.

**Add a rule from scratch:**
1. Click the **+ Add Rule** button at the top-right of the groups list.
2. Enter a comma-separated list of domains (e.g., `youtube.com, twitch.tv`).
3. Enter a group name and pick a color.
4. Click **Create Rule**.

**Delete a custom rule:**
1. Click the **✏ pencil icon** next to any customized group.
2. Click the red **Delete Rule** button.
3. The rule is removed and the domain reverts to standard auto-grouping behavior.

### Available Group Colors
`grey` · `blue` · `red` · `yellow` · `green` · `pink` · `purple` · `cyan` · `orange`

### Manual Grouping
Click **Group Tabs Now** at the bottom of the popup to immediately run a full organization pass on all open windows.

---

## Privacy

tabManager is built with privacy as a core constraint, not an afterthought:

- All data is stored exclusively in `chrome.storage.local` — never synced or transmitted.
- No analytics, telemetry, or tracking of any kind.
- No network requests are made by the extension (font loading in the popup is the only optional external resource and can be removed).
- Permissions are scoped to the minimum required: `tabs`, `tabGroups`, `storage`.

---

## License

MIT
