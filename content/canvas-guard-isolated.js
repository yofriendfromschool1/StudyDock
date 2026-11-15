/*
 * Canvas-side isolated controller for StudyDock.
 *
 * Owns the optional kiosk frame, the settings shortcut, and the visibility
 * toggle for the MAIN-world toolbar. The always-active prefs and port state
 * are handled by always-active-isolated.js.
 */
(() => {
  if (self.__studyDockCanvasIsolated) {
    return;
  }
  self.__studyDockCanvasIsolated = true;

  const KIOSK_ID = 'studydock-kiosk';
  const KIOSK_FRAME_ID = 'studydock-kiosk-frame';
  const HIDE_STYLE_ID = 'studydock-hide-ui';
  const PORT_ID = 'studydock-port';

  const normalizeUrl = (value) => {
    if (!value) return '';
    try {
      const raw = /^[a-z][a-z0-9+.-]*:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
      const parsed = new URL(raw);
      return `${parsed.protocol}//${parsed.hostname.replace(/^www\./, '')}`;
    }
    catch (e) {
      return '';
    }
  };

  const isBlocked = (blockedUrls) => {
    if ((blockedUrls || []).some((entry) => String(entry).trim() === '*')) return true;
    const current = normalizeUrl(window.location.href);
    if (!current) return false;
    return (blockedUrls || []).some((entry) => {
      const blocked = normalizeUrl(entry);
      return blocked && current.startsWith(blocked);
    });
  };

  const port = () => document.getElementById(PORT_ID);

  const setHidden = (hidden) => {
    let style = document.getElementById(HIDE_STYLE_ID);
    if (!hidden) {
      if (style) style.remove();
      return;
    }
    if (style) return;
    style = document.createElement('style');
    style.id = HIDE_STYLE_ID;
    style.textContent = `
      #studydock-toolbar,
      #studydock-toolbar *,
      #studydock-panel,
      #studydock-panel * {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  };

  chrome.storage.local.get({
    blockedUrls: [],
    showInjectedUI: true
  }, (prefs) => {
    if (isBlocked(prefs.blockedUrls)) {
      return;
    }

    let barInjected = !!document.getElementById(KIOSK_ID);
    setHidden(!prefs.showInjectedUI);

    const removeBar = () => {
      const entry = document.getElementById(KIOSK_ID);
      if (entry) entry.remove();
      if (document.body) document.body.classList.remove('studydock-kiosk-mode');
      barInjected = false;
    };

    const injectBar = () => {
      if (barInjected || document.getElementById(KIOSK_ID)) {
        barInjected = true;
        return;
      }
      if (!document.body) return;

      const pageSrc = window.location.href;
      const wrapper = document.createElement('div');
      wrapper.id = KIOSK_ID;
      wrapper.innerHTML = `
        <div class="studydock-kiosk-bar" role="region" aria-label="StudyDock kiosk session">
          <span class="studydock-kiosk-brand" aria-hidden="true">D</span>
          <span class="studydock-kiosk-title">StudyDock session</span>
          <button type="button" class="studydock-kiosk-button" id="studydock-kiosk-restart">Restart</button>
          <button type="button" class="studydock-kiosk-button" id="studydock-kiosk-exit">Exit kiosk</button>
        </div>
        <iframe
          src="${pageSrc.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"
          id="${KIOSK_FRAME_ID}"
          title="StudyDock kiosk frame"
          scrolling="auto"
          sandbox="allow-same-origin allow-scripts allow-forms allow-top-navigation allow-top-navigation-by-user-activation"></iframe>
        <style>
          body.studydock-kiosk-mode {
            height: 100vh;
            width: 100vw;
            margin: 0;
            padding: 0;
            overflow: hidden;
          }
          #${KIOSK_ID} {
            position: fixed;
            inset: 0;
            z-index: 2147483645;
            background: #0b1220;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          #${KIOSK_ID} .studydock-kiosk-bar {
            position: fixed;
            top: 0;
            left: 0;
            z-index: 2;
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
            height: 44px;
            padding: 0 12px;
            background: #0b1220;
            border-bottom: 1px solid rgba(148, 163, 184, 0.24);
            color: #e8eefc;
            box-sizing: border-box;
          }
          #${KIOSK_ID} .studydock-kiosk-brand {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border-radius: 7px;
            background: rgba(94, 234, 212, 0.16);
            border: 1px solid rgba(94, 234, 212, 0.3);
            color: #5eead4;
            font-weight: 800;
            font-size: 12px;
          }
          #${KIOSK_ID} .studydock-kiosk-title {
            font-size: 12px;
            font-weight: 650;
            color: #cbd5e1;
          }
          #${KIOSK_ID} .studydock-kiosk-button {
            margin-left: auto;
            padding: 5px 9px;
            border: 1px solid rgba(148, 163, 184, 0.3);
            border-radius: 7px;
            background: rgba(148, 163, 184, 0.08);
            color: #e8eefc;
            font: 600 11px/1 ui-sans-serif, system-ui, sans-serif;
            cursor: pointer;
          }
          #${KIOSK_ID} .studydock-kiosk-button + .studydock-kiosk-button {
            margin-left: 0;
          }
          #${KIOSK_ID} .studydock-kiosk-button:hover {
            border-color: rgba(94, 234, 212, 0.5);
            color: #5eead4;
          }
          #${KIOSK_ID} iframe {
            position: fixed;
            top: 44px;
            left: 0;
            width: 100vw;
            height: calc(100vh - 44px);
            border: 0;
            background: #fff;
          }
        </style>
      `;

      document.body.classList.add('studydock-kiosk-mode');
      document.body.prepend(wrapper);
      barInjected = true;

      const frame = wrapper.querySelector(`#${KIOSK_FRAME_ID}`);
      wrapper.querySelector('#studydock-kiosk-restart').addEventListener('click', () => {
        try {
          frame.contentWindow.location.reload();
        }
        catch (e) {
          frame.src = pageSrc;
        }
      });
      wrapper.querySelector('#studydock-kiosk-exit').addEventListener('click', removeBar);
    };

    document.addEventListener('click', (event) => {
      if (!event.target || !event.target.closest) return;
      if (!event.target.closest('#studydock-settings')) return;
      const panel = document.getElementById('studydock-panel');
      if (panel) panel.classList.remove('sd-open');
      try {
        chrome.runtime.sendMessage({ type: 'openOptions' }, () => void chrome.runtime.lastError);
      }
      catch (e) {
        /* Extension context can disappear during a reload. */
      }
    }, true);

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message && message.action) {
        case 'toggleBar':
          if (barInjected) removeBar();
          else injectBar();
          sendResponse({ injected: barInjected });
          break;

        case 'removeBar':
          removeBar();
          sendResponse({ injected: barInjected });
          break;

        case 'isInjected':
          sendResponse({ injected: barInjected });
          break;

        case 'enablePrivacyGuard': {
          const node = port();
          if (node) node.dataset.privacy = 'true';
          sendResponse({ ok: true });
          break;
        }

        case 'disablePrivacyGuard': {
          const node = port();
          if (node) node.dataset.privacy = 'false';
          sendResponse({ ok: true });
          break;
        }

        case 'applyShowInjectedUI':
          setHidden(!message.show);
          sendResponse({ ok: true });
          break;

        default:
          sendResponse({ ok: false });
      }
      return true;
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.showInjectedUI) {
        setHidden(!changes.showInjectedUI.newValue);
      }
      if (changes.blockedUrls) {
        if (isBlocked(changes.blockedUrls.newValue || [])) {
          removeBar();
        }
      }
    });
  });
})();
