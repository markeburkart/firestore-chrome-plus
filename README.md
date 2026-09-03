# Firestore Chrome Plus

A Chrome extension that tames large JSON fields in the Firebase console. It
truncates long values inline, adds hover **popovers** and a full-screen
**popup** for reading them, and gives every field (and the whole document) a
one-click **copy** button.

## Why

The Firestore console is built for browsing schema, not for pulling data out of
it. Deeply nested documents wrap and push everything off screen, values can only
be read by expanding them in place, and there is no way to copy a field — let
alone a whole document — as usable JSON.

This extension takes an opinionated stance on that workflow: **the tree should
stay compact, reading a value should never disturb the layout, and any value
should be one click from your clipboard as clean JSON.** So values are truncated
to a fixed width by default, the full content lives in a hover popover (or an
expandable modal for the big ones), and copy buttons emit raw strings without
quotes and objects as pretty-printed JSON — the shapes you actually want to
paste into code or a scratch file. It is a small set of choices, applied
consistently, rather than a configurable toolbox.

## Features

- **Collapsed values** — long field values are truncated inline so the document
  tree stays scannable
- **Hover popover** — hovering a truncated value opens an interactive card with
  the full value, pretty-printed if it's JSON, in a scrollable pane; it stays
  open while your pointer is inside it
- **Expand to a popup** — the `⤢` button (on the field, or in the popover)
  opens a centered modal with the full, formatted value — scroll, select, copy;
  closes on `Esc`, backdrop click, or the close button
- **Copy** — every field gets a `Copy` button; string values are copied raw
  (no surrounding quotes), objects/arrays as pretty-printed JSON
- **Copy All** — the first field exposes a `Copy All` button that serializes the
  entire document to JSON
- Minimal UI with crisp SVG icons that matches Firebase's dark styling

## Installation

1. Go to `chrome://extensions/` and enable **Developer mode** (top-right)
2. Click **Load unpacked** and select this folder (`firestore-chrome-plus`)
3. Open https://console.firebase.google.com, view any Firestore document, and
   hover / click the new controls

## Usage

- **Read a value** — hover the truncated text to open the popover; click
  `⤢ Expand` for the full-screen popup
- **Copy one field** — hover the field row, click `Copy`
- **Copy the whole document** — click `Copy All` on the first field
- Paste with **Cmd+V** (**Ctrl+V** on Windows/Linux)

## Customization

`src/content.js`:

```javascript
const MIN_TEXT_LENGTH = 150;   // reserved threshold constant
const ICON_COPY = '<svg …>';   // inline copy icon
const ICON_EXPAND = '<svg …>'; // inline expand icon
```

Value truncation width and popover / modal styling live in
`JSONCollapser.injectStyles()` in the same file; `src/styles.css` holds the base
button style.

## Development

After cloning, wire up the local commit settings (not carried by `git clone`):

```sh
git config user.email "" && git config core.hooksPath .githooks
```

Commits in this repo are recorded with an empty identity; the `pre-commit` hook
rejects any commit that carries an author email.

To test changes:

1. Edit files in `src/`
2. Go to `chrome://extensions/` and click the **reload** icon on the extension card
3. Reload the Firebase console tab (**Cmd+R**) — content scripts do not
   re-inject into already-open tabs on their own

There is no automated test suite; verify against a real Firestore document, or a
locally saved copy of its DOM served with `python3 -m http.server`.

## Firestore emulator

`src/content.js` also contains a parser for the Firestore emulator's
`FieldPreview` DOM (`localhost:4000/firestore`). The bundled `manifest.json`
only injects on `console.firebase.google.com`, so to use it against the emulator
you currently have to add a matching entry to `content_scripts.matches` (and
`host_permissions`) yourself.

## Architecture

```
firestore-chrome-plus/
├── manifest.json        # Extension configuration (MV3, content script)
├── src/
│   ├── content.js       # All logic: detection, collapsing, popover, modal, copy
│   └── styles.css       # Base button styling
├── icons/               # Extension icons (16 / 48 / 128) + generator script
└── README.md
```

`content.js` runs `JSONCollapser`, which detects the environment
(`firebase-console` vs `emulator`), injects styles, processes fields on a
`setTimeout` plus a `MutationObserver`, and manages a single shared popover and
modal.

## Notes

- Runs on `console.firebase.google.com` (emulator support is opt-in — see above)
- No data collection or transmission; your Firebase data stays local
- Works on any Firestore document with large fields

## Credits

The inline `Copy` and `Expand` glyphs are the `copy` and `maximize-2` icons from
[Feather](https://feathericons.com) (MIT).

## License

MIT — see [LICENSE](LICENSE).
