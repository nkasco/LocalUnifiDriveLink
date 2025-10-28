Local UniFi Drive - Chrome Extension

What it does
- Injects a small Drive icon near the top-left of UniFi web UI pages (Network / Protect) and opens a configured link when clicked.

Install & test (developer mode)
1. Copy the provided DriveDark.png image into `icons/DriveDark.png` (replace the placeholder file).
2. Open Chrome and go to chrome://extensions
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension folder:
   - path\to\LocalUnifiDriveLink
5. Open the UniFi Network or Protect UI page. The Drive icon should appear in the top-left near other icons.
6. To configure the link: click the extension entry on chrome://extensions and click "Extension options", or open the options page directly from the extension details.

Changelog
- 1.0.0 - Initial implementation with robust insertion and repair logic.
