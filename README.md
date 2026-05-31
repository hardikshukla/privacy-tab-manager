# tabManager

A high-performance, privacy-focused extension for Chrome and Brave that automatically organizes your tabs into native browser tab groups. It keeps your workspace clean, reduces cognitive load, and respects your privacy.

## Features

1. **Zero-Configuration Startup**: Works immediately upon installation. Groups tabs by domain once you open 2 or more tabs from the same domain (e.g. `github.com`).
2. **Group Single Tabs**: Gathers single, ungrouped tabs that do not meet the domain threshold into a single "Common" group, keeping the tab bar 100% organized. (Enabled by default, can be toggled in the popup).
3. **Sleek Popup Dashboard**: A modern, dark-mode glassmorphic control panel to toggle features, view active groups, adjust settings, and trigger immediate organization.
4. **In-Popup Rule Editing**: Customize group titles and colors (using native Chrome group colors) directly from the popup. The extension automatically remembers your choices and applies them as persistent, custom grouping rules for that domain.
5. **Auto-Collapse Inactive Groups**: Automatically collapses other tab groups when none of their tabs are active, keeping only your active group expanded to save precious screen space. Incorporates a smart delay to avoid flashing/jumpiness during rapid tab switching.
6. **Temporary Pause Control**: Need to do chaotic research? Temporarily pause auto-grouping for 30 minutes, 2 hours, 24 hours, or until you restart your browser.
7. **Pinned Tab Exclusion**: Your pinned tabs (Slack, Gmail, etc.) are left alone as anchors and never automatically grouped.
8. **Local Sandbox Privacy**: 
   - **No remote servers, no analytics, no external databases, and no cloud sync.**
   - Everything is processed 100% offline inside your browser sandbox.
   - Minimal permissions declared (`tabs`, `tabGroups`, `storage`) to avoid scary security warnings (no broad host permissions like `<all_urls>` requested).

---

## Installation Instructions

1. **Download / Clone** this repository to a folder on your computer.
2. Open **Chrome** or **Brave** and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. Select the `tabManger/` folder containing this project (the directory containing `manifest.json`).
6. The extension is now loaded! Pin it to your toolbar for quick access.

---

## Usage Guide

- **Settings Panel**: Click the **⚙ gear icon** in the top-right of the popup header to toggle the full settings panel. Settings are hidden by default to give maximum space to your active groups list.
  - Toggle Auto-Grouping, Auto-Collapse, Group Single Tabs
  - Set a Temporary Pause (30m / 2h / 24h / until restart)
  - Adjust the Domain Threshold slider
- **Active Groups**: The main list shows all current tab groups with their **domain subtitle** (so you always know which domains map to that group at a glance).
- **Customize Active Groups (Multi-Domain rules)**: 
  1. Open multiple tabs (e.g. `github.com` and `gitlab.com`).
  2. Click the extension icon. You will see active groups listed under **Active Groups & Custom Rules**.
  3. Click the **Edit Pencil Icon** next to the group.
  4. Prefilled domains will load inside the **Domains** field. You can append more domains separated by commas (e.g., `github.com, gitlab.com, bitbucket.org`).
  5. Type a new name (e.g., "Development") and choose a color (e.g., Purple).
  6. Click **Save Rule**. In the future, any tab matching *any* of those domains will immediately join the same unified "Development" (Purple) group!
- **Add Rules from Scratch**:
  1. Click the **Add Rule** button at the top-right of the groups list.
  2. Type in a comma-separated list of domains (e.g., `youtube.com, twitch.tv`), a group title (e.g., `Entertainment`), and select a color.
  3. Click **Create Rule** to save it. If tabs for those domains are already open, they'll immediately cluster under your new group!
- **Delete Custom Rules**:
  1. Click the **Edit Pencil Icon** next to any customized group in the list.
  2. A red **Delete Rule** button will appear in the form.
  3. Click it to remove the custom rule. The domain will instantly revert to standard auto-grouping or ungrouped status.
- **Temporary Pause**: Open the settings panel and change the dropdown from "Active" to pause auto-grouping temporarily.
- **Manual Clean-up**: Click **Group Tabs Now** at the bottom of the popup to run an immediate grouping pass.

