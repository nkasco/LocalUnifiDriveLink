Local UniFi Drive - Chrome Extension

What it does
- Injects a small Drive icon near the top-left of UniFi web UI pages (Network / Protect) and opens a configured link when clicked.

Files added
- `manifest.json` - MV3 manifest
- `content/content.js` - Injects the icon and reads the saved link
- `content/content.css` - Styles for the icon
- `options/options.html` + `options/options.js` - Options page to configure the link
- `icons/DriveDark.png` - extension icon (replace placeholder with the provided image file)

Install & test (developer mode)
1. Copy the provided DriveDark.png image into `icons/DriveDark.png` (replace the placeholder file).
2. Open Chrome and go to chrome://extensions
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension folder:
   - c:\Users\airfo\OneDrive\Desktop\Projects\Chrome Extensions\Local Unifi Drive
5. Open the UniFi Network or Protect UI page. The Drive icon should appear in the top-left near other icons.
6. To configure the link: click the extension entry on chrome://extensions and click "Extension options", or open the options page directly from the extension details.

Notes and troubleshooting
- The script attempts a few header/container selectors used by different UniFi versions. If the icon doesn't appear:
  - Open DevTools and look for `.local-unifi-drive-wrapper` element.
  - Adjust the selectors in `content/content.js` to match the UniFi page structure, or the CSS to change placement.
- The extension uses `chrome.storage.sync` to store the link.

Next steps (optional)
- Limit content script matches to specific UniFi hostnames instead of `<all_urls>` if desired.
- Add a small popup UI instead of options page.
- Improve placement logic to target the exact toolbar element by classnames from the installed UniFi version.

Developer notes
- A `demo.html` file exists to simulate the UniFi header for local testing. When opened via file:// or served from localhost, the content script will expose a debug hook on `window.__localUnifiDrive`.

Changelog
- 1.0.0 - Initial implementation with robust insertion and repair logic.
