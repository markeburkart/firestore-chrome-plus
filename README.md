# Firebase JSON Collapser

A Chrome extension that adds quick-copy functionality to large JSON blocks in the Firebase console, making it easier to work with complex document structures.

## Features

- 📋 **Quick Copy** — Copy large JSON fields to clipboard with one click
- 🎯 Auto-detects large JSON blocks in Firebase console (>150 characters)
- 🔒 Hides verbose JSON by default, keeping the console clean
- ⚡ Instant feedback — button shows "✓ Copied!" when successful
- 🎨 Minimal, clean UI that matches Firebase's design language

## Installation

1. **Open Chrome Extensions**
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)

2. **Load the Extension**
   - Click "Load unpacked"
   - Select this folder (`firebase-json-collapser`)

3. **Start Using**
   - Go to https://console.firebase.google.com
   - Open any Firestore document with large JSON fields
   - Click **"📋 Copy"** to copy the JSON to your clipboard
   - Use **Cmd+V** to paste it anywhere

## Usage

- Large JSON text blocks are hidden by default
- Click **"📋 Copy"** to copy the field to your clipboard
- Paste with **Cmd+V** (or **Ctrl+V** on Windows/Linux)
- To view the full content, click on the field in Firebase's UI

## Customization

Edit `src/content.js` to adjust behavior:

```javascript
const MIN_TEXT_LENGTH = 150; // Minimum characters to show copy button
```

## Development

To test changes:

1. Edit files in `src/`
2. Go to `chrome://extensions/`
3. Click the **refresh icon** on the extension card
4. Reload the Firebase console tab (Cmd+R)

## Architecture

```
firebase-json-collapser/
├── manifest.json        # Extension configuration
├── src/
│   ├── content.js       # Main extension logic
│   └── styles.css       # Button styling
├── icons/               # Extension icons
└── README.md
```

## Notes

- ✅ Only runs on `console.firebase.google.com`
- ✅ No data collection or transmission
- ✅ Your Firebase data stays private and secure
- ✅ Works on any Firestore document with large fields
