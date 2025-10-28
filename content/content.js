(() => {
  /*
    Local Unifi Drive content script

    Purpose:
    - Insert a Drive icon into the UniFi header to the right of the Protect icon.
    - Use robust heuristics to handle nested header DOM structures and to recover
      from previously-orphaned icons that ended up attached to <body>.

    Notes / edge cases:
    - The script prefers the explicit container selector
      `div.unifi-portal-1vz64y0.evzy7n80` when present.
    - It attempts to insert the wrapper directly after the Protect anchor's
      parent (so that `protect.nextElementSibling === drive` becomes true).
    - If the page re-renders the header, a MutationObserver will re-create
      the icon. If a leftover icon is found attached to <body>, `repairExisting`
      will move it into the header on startup.
    - For testing/debugging we expose a small `window.__localUnifiDrive` hook
      (only if not already present) so you can call create/remove/repair from
      the console when running the extension in development.
  */
  const ICON_ID = 'local-unifi-drive-icon';
  const DEFAULT_LINK = 'https://example.com';
  let _currentDriveLink = DEFAULT_LINK;

  // Generate a transparent-background inline SVG data URL (used as a safe
  // fallback when chrome.runtime resources can't be loaded). Keep the SVG
  // minimal (only the motif path) so site CSS cannot force a dark background.
  function createInlineSvgDataUrl() {
    try {
  // stacked-database/cylinder motif using currentColor so CSS controls the color
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 24 24'><path fill='currentColor' d='M12 2C7.03 2 3 3.79 3 6v12c0 2.21 4.03 4 9 4s9-1.79 9-4V6c0-2.21-4.03-4-9-4zm0 2c3.87 0 7 1.12 7 2s-3.13 2-7 2-7-1.12-7-2 3.13-2 7-2zm0 14c-3.87 0-7-1.12-7-2V10c1.3 1.07 4.2 1.71 7 1.71s5.7-.64 7-1.71v6c0 .88-3.13 2-7 2z'/></svg>";
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    } catch (e) { return ''; }
  }

  function createIcon(link) {
    console.debug('[local-unifi-drive] createIcon called, link=', link);
    // Quick debounce
    const now = Date.now();
    if (createIcon._last && now - createIcon._last < 500) return;
    createIcon._last = now;

    // Remove any existing wrapper to avoid duplicates and to ensure we re-place it correctly
    try { removeIcon(); } catch (e) {}

    // Build icon: prefer using the extension PNG when running as an installed
    // extension (chrome.runtime.id is present). If runtime id is missing or
    // CSP blocks resource loading, fall back to an inline SVG so the icon
    // always renders and avoids net::ERR_FAILED chrome-extension://invalid/.
    const runtimeHasId = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && typeof chrome.runtime.getURL === 'function');
    let img = null;
    let svgEl = null;
    if (runtimeHasId) {
      img = document.createElement('img');
      img.className = 'local-unifi-drive-img';
      img.title = 'Open Drive Link';
      img.alt = 'Drive';
      img.style.cursor = 'pointer';
      try {
        img.src = chrome.runtime.getURL('icons/DriveDark.png');
      } catch (e) {
        // fallback to inline svg below
        img = null;
      }
      if (img) {
        img.addEventListener('error', () => {
          try {
            if (img.dataset && img.dataset._svgFallbackApplied) return;
            // Use the shared transparent SVG data URL (no rect/background)
            const data = createInlineSvgDataUrl();
            if (data) {
              img.dataset._svgFallbackApplied = '1';
              img.src = data;
              img.classList.add('local-unifi-drive-svg-fallback');
            }
          } catch (e) { console.debug('Drive icon fallback failed', e); }
        });
      }
    }

    // Inline SVG element (used when runtime id missing or img failed)
    function makeInlineSvg() {
      const wrapperSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      wrapperSvg.setAttribute('width', '28');
      wrapperSvg.setAttribute('height', '28');
      wrapperSvg.setAttribute('viewBox', '0 0 24 24');
      wrapperSvg.classList.add('local-unifi-drive-svg');
      try {
        // Use a transparent background and a simple motif path so site styles
        // don't force a dark box behind the icon.
        // (Avoid adding a filled rect here.)
  // database/cylinder motif path using currentColor so CSS controls color
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', 'M12 2C7.03 2 3 3.79 3 6v12c0 2.21 4.03 4 9 4s9-1.79 9-4V6c0-2.21-4.03-4-9-4zm0 2c3.87 0 7 1.12 7 2s-3.13 2-7 2-7-1.12-7-2 3.13-2 7-2zm0 14c-3.87 0-7-1.12-7-2V10c1.3 1.07 4.2 1.71 7 1.71s5.7-.64 7-1.71v6c0 .88-3.13 2-7 2z');
  wrapperSvg.appendChild(path);
      } catch (e) { console.debug('inline svg creation failed', e); }
      return wrapperSvg;
    }

    svgEl = makeInlineSvg();

    // Create wrapper anchor (use same wrapper class as before for CSS)
    const wrapper = document.createElement('a');
    wrapper.className = 'local-unifi-drive-wrapper';
    wrapper.id = ICON_ID;
    wrapper.setAttribute('data-local-unifi-drive', '1');
    wrapper.setAttribute('role', 'button');
    wrapper.setAttribute('href', '#');
    wrapper.setAttribute('tabindex', '0');
    // Attach either the <img> (if available) or the inline SVG element.
    const childEl = img || svgEl;
    if (childEl) wrapper.appendChild(childEl);
    wrapper.addEventListener('click', (e) => { e.preventDefault(); window.open((link || _currentDriveLink || DEFAULT_LINK), '_blank'); });

    // Strong inline style overrides to defeat site CSS that produces a black box.
    try {
      const applyImportant = (el, map) => {
        if (!el || !map) return;
        for (const k of Object.keys(map)) {
          try { el.style.setProperty(k, map[k], 'important'); } catch (e) {}
        }
      };
      const wrapperStyles = {
        'background': 'transparent',
        'background-image': 'none',
        'box-shadow': 'none',
        'filter': 'none',
        'padding': '0',
        'margin': '0',
        'display': 'inline-flex',
        'align-items': 'center',
        'justify-content': 'center',
        'z-index': '9999'
      };
      const childStyles = {
        'background': 'transparent',
        'background-image': 'none',
        'box-shadow': 'none',
        'filter': 'none',
        'width': '28px',
        'height': '28px',
        'display': 'inline-block'
      };
      applyImportant(wrapper, wrapperStyles);
      if (childEl && childEl.style) applyImportant(childEl, childStyles);
      // If it's an inline SVG, ensure path fill is set
      try {
        if (childEl && childEl.namespaceURI === 'http://www.w3.org/2000/svg') {
          const p = childEl.querySelector('path');
          if (p) p.setAttribute('fill', '#60a5fa');
        }
      } catch (e) {}
    } catch (e) {}

    // Find the explicit header container
    const sc = document.querySelector('div.unifi-portal-1vz64y0.evzy7n80');
    const container = sc || (function() {
      // fallback heuristics: find a header-like element that contains both network and protect
      const n = document.querySelector('a[data-testid="applink-network"]');
      const p = document.querySelector('a[data-testid="applink-protect"]');
      if (!n || !p) return document.body;
      let anc = n.parentElement;
      while (anc && !anc.contains(p)) anc = anc.parentElement;
      return anc || document.body;
    })();

    // Determine the visual host (direct child of container) that contains the protect anchor
    function findHostForAnchor(anchor, containerEl) {
      if (!anchor || !containerEl) return null;
      let host = anchor;
      while (host && host.parentElement && host.parentElement !== containerEl) host = host.parentElement;
      if (host && host.parentElement === containerEl) return host;
      return null;
    }

    const protectAnchor = container.querySelector('a[data-testid="applink-protect"]');
    const networkAnchor = container.querySelector('a[data-testid="applink-network"]');

    try {
      console.debug('[local-unifi-drive] container resolved:', container);
      // Helper: find the direct child of container that contains the anchor
      function findDirectChildContaining(anchor, containerEl) {
        if (!anchor || !containerEl) return null;
        const children = Array.from(containerEl.children);
        for (const child of children) {
          if (child.contains(anchor)) return child;
        }
        return null;
      }

      if (protectAnchor) {
        console.debug('[local-unifi-drive] protectAnchor found, parent=', protectAnchor.parentElement);
        // Ensure we place the wrapper directly into the header (protectAnchor.parentElement is the header container)
        try {
          const parent = protectAnchor.parentElement || container;
          parent.insertBefore(wrapper, protectAnchor.nextSibling);
          console.debug('[local-unifi-drive] inserted wrapper into protect parent');
          // Copy parent classes so wrapper inherits header styling
          try { for (const c of Array.from((parent.classList || []))) if (c) wrapper.classList.add(c); } catch (e) {}
          return;
        } catch (e) {
          // fallback to previous robust insertion
          const topChild = findDirectChildContaining(protectAnchor, container) || protectAnchor;
          try {
            const children = Array.from(container.children);
            const idx = children.indexOf(topChild);
            try { for (const c of Array.from(topChild.classList || [])) if (c) wrapper.classList.add(c); } catch (e) {}
            if (idx >= 0) {
              const next = container.children[idx + 1] || null;
              container.insertBefore(wrapper, next);
            } else {
              (topChild.parentElement || container).insertBefore(wrapper, topChild.nextSibling);
            }
          } catch (e2) {
            try { topChild.insertAdjacentElement('afterend', wrapper); } catch (e3) { (topChild.parentElement || container).insertBefore(wrapper, topChild.nextSibling); }
          }
          return;
        }
      }

      if (networkAnchor) {
        const topChild = findDirectChildContaining(networkAnchor, container) || networkAnchor;
        try {
          const children = Array.from(container.children);
          const idx = children.indexOf(topChild);
          try { for (const c of Array.from(topChild.classList || [])) if (c) wrapper.classList.add(c); } catch (e) {}
          if (idx >= 0) {
            const next = container.children[idx + 1] || null;
            container.insertBefore(wrapper, next);
          } else {
            (topChild.parentElement || container).insertBefore(wrapper, topChild.nextSibling);
          }
        } catch (e) {
          try { topChild.insertAdjacentElement('afterend', wrapper); } catch (e2) { (topChild.parentElement || container).insertBefore(wrapper, topChild.nextSibling); }
        }
        return;
      }

  // fallback: append to container
  (container || document.body).appendChild(wrapper);
  console.debug('[local-unifi-drive] appended wrapper to container/body as fallback');

      // Verification pass: ensure the created wrapper becomes the immediate
      // sibling of the protect anchor where possible. Some UniFi DOMs nest the
      // anchor inside a child container; try moving the inserted element into
      // the protect anchor's parent (direct sibling) and if that fails, ensure
      // it's placed after the visual host child inside the header container.
      try {
        const created = document.getElementById(ICON_ID);
        if (protectAnchor && created && protectAnchor.nextElementSibling !== created) {
          try { protectAnchor.parentElement.insertBefore(created, protectAnchor.nextSibling); } catch (e) {}
        }
        // Final fallback: move into container after the direct child that
        // contains protectAnchor (so it's visually adjacent even if not a
        // DOM sibling of the anchor itself).
        if (protectAnchor && created && protectAnchor.nextElementSibling !== created) {
          const topChild = (function findDirectChildContaining(anchor, containerEl) {
            if (!anchor || !containerEl) return null;
            const children = Array.from(containerEl.children);
            for (const child of children) if (child.contains(anchor)) return child;
            return null;
          })(protectAnchor, container) || protectAnchor;
          try {
            const children = Array.from((container || document.body).children);
            const idx = children.indexOf(topChild);
            if (idx >= 0) {
              const next = (container || document.body).children[idx + 1] || null;
              (container || document.body).insertBefore(created, next);
            } else {
              (topChild.parentElement || container || document.body).insertBefore(created, topChild.nextSibling);
            }
          } catch (e) {}
        }
      } catch (e) {}
  // Final safety: in case the wrapper ended up attached to <body> or
      // another container, attempt to repair/move it into the header now.
      try {
        console.debug('[local-unifi-drive] createIcon: running final repairExisting check');
        repairExisting();
      } catch (e) { console.debug('[local-unifi-drive] final repairExisting failed', e); }
    } catch (e) {
      // Last resort: attach to body
      try { document.body.appendChild(wrapper); } catch (e2) {}
    }
  }

  function removeIcon() {
    const el = document.getElementById(ICON_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function loadAndCreate() {
    // Read saved link and delayed create setting. Fall back to defaults when
    // chrome.storage isn't available (demo page).
    const apply = (link, delayedSeconds) => {
      // Use provided link when creating the icon; createIcon() will use the
      // provided link when clicking.
      try { createIcon(link || DEFAULT_LINK); } catch (e) { createIcon(DEFAULT_LINK); }
      // Schedule delayed create according to stored preference (if > 0)
      try {
        if (typeof delayedSeconds === 'number' && delayedSeconds > 0) {
          setTimeout(() => {
            try { console.debug('[local-unifi-drive] scheduled delayed create (from storage) running'); createIcon(link || DEFAULT_LINK); }
            catch (e) { console.debug('[local-unifi-drive] scheduled delayed create failed', e); }
          }, delayedSeconds * 1000);
        }
      } catch (e) {}
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync && typeof chrome.storage.sync.get === 'function') {
      try {
        chrome.storage.sync.get({ driveLink: '', delayedCreate: 5 }, (items) => {
          try { _currentDriveLink = items.driveLink || DEFAULT_LINK; } catch (e) {}
          apply(items.driveLink || DEFAULT_LINK, Number(items.delayedCreate || 0));
        });
      } catch (e) { _currentDriveLink = DEFAULT_LINK; apply(DEFAULT_LINK, 5); }
    } else {
      _currentDriveLink = DEFAULT_LINK;
      apply(DEFAULT_LINK, 5);
    }
  }

  // Observe DOM changes
  let observer = null;
  // If a previous wrapper exists attached to the body, move it into the header
  function repairExisting() {
    try {
      console.debug('[local-unifi-drive] repairExisting running');
      const existing = document.getElementById(ICON_ID);
      if (!existing) return;
      const sc = document.querySelector('div.unifi-portal-1vz64y0.evzy7n80');
      if (!sc) return;
      const protectAnchor = sc.querySelector('a[data-testid="applink-protect"]');
      if (protectAnchor && protectAnchor.parentElement) {
        console.debug('[local-unifi-drive] moving existing into protect parent');
        // move existing into header as sibling after protect
        try { protectAnchor.parentElement.insertBefore(existing, protectAnchor.nextSibling); }
        catch (e) {
          // fallback to insert after the direct child that contains protect
          try {
            const topChild = (function findDirectChildContaining(anchor, containerEl) {
              if (!anchor || !containerEl) return null;
              const children = Array.from(containerEl.children);
              for (const child of children) if (child.contains(anchor)) return child;
              return null;
            })(protectAnchor, sc) || protectAnchor;
            const children = Array.from(sc.children);
            const idx = children.indexOf(topChild);
            if (idx >= 0) {
              const next = sc.children[idx + 1] || null;
              sc.insertBefore(existing, next);
            } else {
              (topChild.parentElement || sc).insertBefore(existing, topChild.nextSibling);
            }
          } catch (e2) { sc.appendChild(existing); }
        }
      } else {
        sc.appendChild(existing);
      }

      // Copy certain classes from the host element so styling matches
      try {
        const host = (protectAnchor && protectAnchor.parentElement) || null;
        if (host && existing) {
          try { for (const c of Array.from(host.classList || [])) if (c) existing.classList.add(c); } catch (e) {}
          // Optionally copy inline styles that matter (color, background)
          try {
            const cs = window.getComputedStyle(host);
            if (cs) {
              existing.style.color = cs.color || '';
              existing.style.background = cs.background || cs.backgroundColor || '';
              console.debug('[local-unifi-drive] copied styles from host to existing');
            }
          } catch (e) {}
        }
      } catch (e) {}

      // Apply inline important styles to ensure not rendered as a black box
      try {
        const applyImportant = (el, map) => {
          if (!el || !map) return;
          for (const k of Object.keys(map)) {
            try { el.style.setProperty(k, map[k], 'important'); } catch (e) {}
          }
        };
        const wrapperStyles = {
          'background': 'transparent',
          'background-image': 'none',
          'box-shadow': 'none',
          'filter': 'none',
          'padding': '0',
          'margin': '0',
          'display': 'inline-flex',
          'align-items': 'center',
          'justify-content': 'center',
          'z-index': '9999'
        };
        const childStyles = {
          'background': 'transparent',
          'background-image': 'none',
          'box-shadow': 'none',
          'filter': 'none',
          'width': '28px',
          'height': '28px',
          'display': 'inline-block'
        };
        applyImportant(existing, wrapperStyles);
        const child = existing.querySelector('img, svg');
        if (child && child.style) applyImportant(child, childStyles);
        // If the child is an <img> that used an older rect-based inline SVG,
        // replace its src with the transparent inline SVG data URL so the
        // black box disappears. Also ensure svg children don't contain a rect.
        try {
          if (child && child.tagName && child.tagName.toLowerCase() === 'img') {
            const src = (child.getAttribute && child.getAttribute('src')) || '';
            if (src && src.indexOf('%3Crect') !== -1) {
              const data = createInlineSvgDataUrl();
              if (data) {
                child.setAttribute('src', data);
                child.dataset._svgFallbackApplied = '1';
                child.classList.add('local-unifi-drive-svg-fallback');
              }
            }
          } else if (child && child.namespaceURI === 'http://www.w3.org/2000/svg') {
            // remove any rect element inside the inline svg
            try { const rect = child.querySelector('rect'); if (rect && rect.parentNode) rect.parentNode.removeChild(rect); } catch (e) {}
          }
        } catch (e) {}
      } catch (e) {}
    } catch (e) {}
  }
  function ensureObserver(container) {
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    observer = new MutationObserver(() => {
      const icon = document.getElementById(ICON_ID);
      if (!icon || !document.body.contains(icon)) {
        const last = createIcon._last || 0;
        if (Date.now() - last < 1000) return;
        loadAndCreate();
      }
    });

    try {
      observer.observe(container || document.documentElement, { 
        childList: true, 
        subtree: true 
      });
    } catch (e) {}
  }

  // Watch specifically for the Protect anchor to appear and create the icon
  // immediately when it does. This helps pages that render the header late
  // (SPA re-renders) so users don't have to run the page bridge manually.
  function ensurePersistentProtectWatcher() {
    try {
      const selector = 'a[data-testid="applink-protect"]';
      // Avoid installing multiple watchers
      if (window.__localUnifiDriveProtectWatcher) return;

      const checkAndCreate = () => {
        try {
          const protect = document.querySelector(selector);
          const existing = document.getElementById(ICON_ID);
          if (protect && !existing) {
            console.debug('[local-unifi-drive] persistent watcher: protect found, creating icon');
            createIcon();
            return true;
          }
          return false;
        } catch (e) { return false; }
      };

      // Run immediate check
      checkAndCreate();

      // Polling interval (stops itself once icon exists)
      const iv = setInterval(() => {
        const done = checkAndCreate();
        if (done) {
          try { clearInterval(iv); } catch (e) {}
        }
      }, 500);

      // Listen for SPA navigation changes and re-run check immediately
      const onLocationChange = () => { setTimeout(checkAndCreate, 50); };
      const originalPush = history.pushState;
      const originalReplace = history.replaceState;
      history.pushState = function() {
        const rv = originalPush.apply(this, arguments);
        try { window.dispatchEvent(new Event('local-unifi-drive-locationchange')); } catch (e) {}
        return rv;
      };
      history.replaceState = function() {
        const rv = originalReplace.apply(this, arguments);
        try { window.dispatchEvent(new Event('local-unifi-drive-locationchange')); } catch (e) {}
        return rv;
      };
      window.addEventListener('popstate', onLocationChange);
      window.addEventListener('local-unifi-drive-locationchange', onLocationChange);

      window.__localUnifiDriveProtectWatcher = {
        interval: iv,
        stop: () => {
          try { clearInterval(iv); } catch (e) {}
          try { window.removeEventListener('popstate', onLocationChange); } catch (e) {}
          try { window.removeEventListener('local-unifi-drive-locationchange', onLocationChange); } catch (e) {}
        }
      };
      console.debug('[local-unifi-drive] persistent protect watcher installed');
    } catch (e) { console.debug('[local-unifi-drive] ensurePersistentProtectWatcher failed', e); }
  }

  // Start after DOMContentLoaded or immediately
  function start() {
    // If a previous wrapper was attached to the body (leftover from earlier runs),
    // try to repair it first so it becomes a sibling of Protect in the header.
    try { repairExisting(); } catch (e) {}
  loadAndCreate();
  // Ensure we also watch for Protect anchor and auto-create when it appears.
  try { ensurePersistentProtectWatcher(); } catch (e) {}
    const container = document.querySelector('div.unifi-portal-1vz64y0.evzy7n80');
    ensureObserver(container || document.documentElement);

    // One-time delayed create: some pages render slowly or perform background
    // work after load. Ensure we attempt a forced create after 5 seconds so
    // users don't have to manually trigger it.
    try {
      if (!start._delayedCreateScheduled) {
        start._delayedCreateScheduled = true;
        setTimeout(() => {
          try {
            console.debug('[local-unifi-drive] delayed create (5s) running');
            createIcon();
          } catch (e) { console.debug('[local-unifi-drive] delayed create failed', e); }
        }, 5000);
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // Listen for storage changes (guarded for non-extension demo environments)
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged && typeof chrome.storage.onChanged.addListener === 'function') {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes.driveLink) {
          loadAndCreate();
        }
      });
    }
  } catch (e) {}

  // Expose a small testing/debugging hook on window for manual validation
  // Only expose when running locally (file:// or localhost) to avoid exposing
  // dev utilities in production environments.
  // Always expose the debug API so users can test directly in-page when the
  // extension is loaded. This helps debug placement issues on production pages.
  try {
    // Content scripts live in an isolated world. To allow page console calls
    // like `window.__localUnifiDrive.create(...)` we inject a small bridge into
    // the page which posts messages that this content script listens for.
    // Install two safe bridges for page -> content-script communication:
    // 1) CustomEvent bridge: the page can dispatch a CustomEvent named
    //    'local-unifi-drive' with detail { action: 'create'|'remove'|'repair', link }
    //    This avoids injecting inline scripts and works with strict CSP.
    try {
      document.addEventListener('local-unifi-drive', (ev) => {
        try {
          const d = (ev && ev.detail) || {};
          if (!d || !d.action) return;
          switch (d.action) {
            case 'create': createIcon(d.link); break;
            case 'remove': removeIcon(); break;
            case 'repair': repairExisting(); break;
            default: break;
          }
          document.dispatchEvent(new CustomEvent('local-unifi-drive-response', { detail: { status: 'ok', action: d.action } }));
        } catch (e) {
          document.dispatchEvent(new CustomEvent('local-unifi-drive-response', { detail: { status: 'error', action: (ev && ev.detail && ev.detail.action) || '', message: String(e) } }));
        }
      }, false);
      console.debug('[local-unifi-drive] installed document CustomEvent bridge (dispatch event "local-unifi-drive")');
    } catch (e) { console.debug('[local-unifi-drive] install custom event bridge failed', e); }

    // 2) postMessage bridge: the page can send window.postMessage({__localUnifiDriveAction:'create', link}, '*')
    try {
      window.addEventListener('message', (ev) => {
        if (!ev || !ev.data) return;
        const d = ev.data;
        if (d && d.__localUnifiDriveAction) {
          try {
            switch (d.__localUnifiDriveAction) {
              case 'create': createIcon(d.link); break;
              case 'remove': removeIcon(); break;
              case 'repair': repairExisting(); break;
              default: break;
            }
            // Acknowledge back to the page
            window.postMessage({ __localUnifiDriveResponse: 'ok', action: d.__localUnifiDriveAction }, '*');
          } catch (e) { window.postMessage({ __localUnifiDriveResponse: 'error', action: d.__localUnifiDriveAction, message: String(e) }, '*'); }
        }
      }, false);
      console.debug('[local-unifi-drive] listening for page bridge messages (postMessage)');
    } catch (e) { console.debug('[local-unifi-drive] message listener install failed', e); }
  } catch (e) {}
})();