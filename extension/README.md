# Instagram Bookmark Tracker - Chrome Extension

A Chrome extension to bookmark Instagram posts, reels, and media for later reference.

## Features

- 🔖 Save Instagram posts and reels with one click
- 📸 Extracts caption, author info, and media URLs
- 📋 View all saved bookmarks in the popup
- 🗑️ Delete bookmarks you no longer need
- 🎨 Clean, Instagram-themed UI

## Installation

### Developer Mode (Local)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select the `extension` folder from this project
5. The extension icon will appear in your toolbar

### Backend Setup

The extension requires the backend server to be running:

```bash
# From the project root
cd /home/ubuntu/.openclaw/workspace/documents/development/project-1
npm install
npm run dev
```

The server runs on `http://localhost:3000` by default.

## Usage

1. Navigate to any Instagram post or reel
2. Click the extension icon in your toolbar
3. Click "Save Post" to bookmark it
4. View all bookmarks in the popup
5. Click the trash icon to delete a bookmark

## Extension Structure

```
extension/
├── manifest.json          # Extension manifest (v3)
├── background/
│   └── background.js      # Service worker for API calls
├── content/
│   └── content.js         # Content script for data extraction
├── popup/
│   ├── popup.html         # Popup UI markup
│   ├── popup.css          # Popup styles
│   └── popup.js           # Popup logic
└── icons/
    └── icon.svg           # Extension icons
```

## API Endpoints

The background script communicates with:

- `GET  /health` - Server health check
- `GET  /api/v1/bookmarks` - List bookmarks
- `POST /api/v1/bookmarks` - Create bookmark
- `DELETE /api/v1/bookmarks/:id` - Delete bookmark

## Permissions

- `storage` - Store extension settings
- `activeTab` - Access current tab information
- `*://*.instagram.com/*` - Access Instagram pages
- `http://localhost:3000/*` - Access local backend

## Troubleshooting

- **"Server offline"**: Make sure the backend is running on localhost:3000
- **"Not on Instagram"**: Navigate to a specific post/reel URL
- **Extension not working**: Try refreshing the Instagram page

## License

MIT