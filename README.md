# Ultimate Bookmark

Ultimate Bookmark is a clean, full-screen bookmark manager for Chrome-based browsers. It replaces the small extension popup with a focused dashboard where you can browse folders, search bookmarks, switch layouts, and rename bookmarks or folders from a right-click menu.

![Ultimate Bookmark screenshot](assets/icons/screenshot.png)

## Features

- Full-screen bookmark management experience
- Folder sidebar with nested expand/collapse navigation
- Grid and list view modes
- Light and dark theme switcher
- Search across bookmark title, URL, domain, and folder path
- Website favicon shown on each bookmark card
- Right-click context menu for renaming bookmarks and folders
- Clean card layout with ellipsis handling for long text
- Sticky, scrollable folder sidebar for large bookmark collections
- Opens directly in a full browser tab when clicking the extension icon

## Project structure

```text
UltimateBookmark/
├── app.js                 # Main bookmark loading, rendering, search, rename, and UI logic
├── background.js          # Opens the full-screen page when the extension icon is clicked
├── fullscreen.html        # Main extension UI
├── manifest.json          # Chrome extension manifest
├── README.md
└── assets/
    └── icons/
        ├── edit.png
        ├── folder.png
        ├── grid.png
        ├── list.png
        ├── modeswtich.png
        └── screenshot.png
```

## Local installation

You can run this project locally as an unpacked Chrome extension.

1. Clone the repository:

```bash
git clone git@github.com:elegentLIFER/UltimateBookmark.git
cd UltimateBookmark
```

2. Open Chrome or another Chromium-based browser.

3. Go to:

```text
chrome://extensions/
```

4. Enable **Developer mode**.

5. Click **Load unpacked**.

6. Select the `UltimateBookmark` project folder.

7. Click the Ultimate Bookmark extension icon in the browser toolbar. It will open the full-screen bookmark manager in a new tab.

## Usage

- Click a folder in the sidebar to view bookmarks in that folder.
- Click a folder again to expand or collapse it.
- Use the search input to filter bookmarks.
- Click a bookmark card to open the website.
- Use the grid/list icon button to switch layout modes.
- Use the theme icon button to switch between light and dark mode.
- Right-click a folder or bookmark card and choose **Rename** to edit its name.

## Permissions

The extension uses the following Chrome permissions:

- `bookmarks`: required to read and rename bookmarks and bookmark folders.
- `tabs`: required to open the full-screen manager tab from the extension icon.

## Notes

- This project is dependency-free and uses plain HTML, CSS, and JavaScript.
- Bookmark data is read from the browser's native bookmarks API.
- Favicon images are loaded via Google's favicon endpoint based on each bookmark URL.
