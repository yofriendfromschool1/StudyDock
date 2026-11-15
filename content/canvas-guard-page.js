/*
 * Canvas page guard for StudyDock.
 *
 * The visibility/focus spoofing engine lives in always-active-page.js; this
 * file adds the Canvas-specific suppression layer, hidden-detector cleanup,
 * and the movable on-page status toolbar. Keeping the two concerns separate
 * avoids duplicating the always-active implementation.
 */
(() => {
  if (window.__studyDockCanvasGuardPage) {
    return;
  }
  window.__studyDockCanvasGuardPage = true;

  const PORT_ID = 'studydock-port';
  let port = document.getElementById(PORT_ID);
  if (!port) {
    port = document.createElement('span');
    port.id = PORT_ID;
    port.style.display = 'none';
    document.documentElement.append(port);
  }

  const canvasPage = /^\/courses\/\d+(?:\/|$)/.test(location.pathname);
  if (!canvasPage) {
    return;
  }

  const privacyOn = () => port.dataset.privacy !== 'false';
  const block = (event) => {
    if (!privacyOn()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  /* Canvas reacts to focus/visibility changes through listeners on the
     window and document. The always-active engine blocks its own events;
     this layer covers the remaining focus variants used by quiz UIs. */
  const blockedEvents = [
    'focus',
    'blur',
    'focusin',
    'focusout',
    'visibilitychange',
    'webkitvisibilitychange',
    'mozvisibilitychange',
    'msvisibilitychange'
  ];
  for (const target of [window, document]) {
    for (const type of blockedEvents) {
      target.addEventListener(type, block, true);
    }
  }

  /* Some Canvas pages include hidden accessibility spans that behave like
     simple attention detectors. Remove them when Privacy Guard is active. */
  const cleanHiddenDetectors = () => {
    if (!privacyOn()) {
      return;
    }
    const target = document.querySelector('#content-wrapper .description.user_content.enhanced[data-resource-type="assignment.body"]');
    if (!target) {
      return;
    }
    target.querySelectorAll('span[aria-hidden="true"]').forEach((span) => {
      try {
        span.remove();
      }
      catch (e) {
        span.style.display = 'none';
      }
    });
  };

  const startDetectorObserver = () => {
    const observer = new MutationObserver(cleanHiddenDetectors);
    observer.observe(document.body, { childList: true, subtree: true });
    cleanHiddenDetectors();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startDetectorObserver, { once: true });
  }
  else {
    startDetectorObserver();
  }

  const STYLE_ID = 'studydock-page-style';
  const TOOLBAR_ID = 'studydock-toolbar';
  const PANEL_ID = 'studydock-panel';

  const styles = `
    #${TOOLBAR_ID}, #${PANEL_ID} {
      --sd-bg: #0b1220;
      --sd-surface: #121d31;
      --sd-border: rgba(148, 163, 184, 0.28);
      --sd-text: #e8eefc;
      --sd-muted: #9aa9c3;
      --sd-accent: #5eead4;
      --sd-blue: #60a5fa;
      --sd-danger: #fb7185;
      box-sizing: border-box;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--sd-text);
      line-height: 1.4;
    }
    #${TOOLBAR_ID} * , #${PANEL_ID} * { box-sizing: border-box; }
    #${TOOLBAR_ID} {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 2147483646;
      display: flex;
      align-items: center;
      gap: 3px;
      padding: 4px;
      border: 1px solid var(--sd-border);
      border-radius: 999px;
      background: rgba(11, 18, 32, 0.94);
      box-shadow: 0 12px 34px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(12px);
      cursor: grab;
      user-select: none;
    }
    #${TOOLBAR_ID}.sd-dragging { cursor: grabbing; }
    #${TOOLBAR_ID} .sd-tb-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--sd-muted);
      font: 700 14px/1 ui-sans-serif, system-ui, sans-serif;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
    }
    #${TOOLBAR_ID} .sd-tb-btn:hover { background: rgba(94, 234, 212, 0.12); color: var(--sd-accent); }
    #${TOOLBAR_ID} .sd-tb-btn:focus-visible { outline: 2px solid var(--sd-accent); outline-offset: 1px; }
    #${TOOLBAR_ID} .sd-tb-divider { width: 1px; height: 16px; background: var(--sd-border); }
    #${PANEL_ID} {
      position: fixed;
      z-index: 2147483647;
      width: 302px;
      border: 1px solid var(--sd-border);
      border-radius: 16px;
      background: rgba(11, 18, 32, 0.97);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(16px);
      overflow: hidden;
      display: none;
    }
    #${PANEL_ID}.sd-open { display: block; }
    #${PANEL_ID} .sd-panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 12px 10px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
      cursor: grab;
    }
    #${PANEL_ID} .sd-brand { display: flex; align-items: center; gap: 9px; min-width: 0; }
    #${PANEL_ID} .sd-logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: linear-gradient(135deg, rgba(94, 234, 212, 0.2), rgba(96, 165, 250, 0.16));
      border: 1px solid rgba(94, 234, 212, 0.28);
      color: var(--sd-accent);
      font-size: 13px;
      font-weight: 800;
    }
    #${PANEL_ID} .sd-brand strong { display: block; font-size: 13px; letter-spacing: -0.01em; }
    #${PANEL_ID} .sd-brand small { display: block; color: var(--sd-muted); font-size: 10.5px; margin-top: 1px; }
    #${PANEL_ID} .sd-settings {
      flex: 0 0 auto;
      padding: 5px 9px;
      border: 1px solid var(--sd-border);
      border-radius: 8px;
      background: rgba(148, 163, 184, 0.08);
      color: var(--sd-text);
      font-size: 11px;
      font-weight: 650;
      cursor: pointer;
    }
    #${PANEL_ID} .sd-settings:hover { border-color: rgba(94, 234, 212, 0.5); color: var(--sd-accent); }
    #${PANEL_ID} .sd-steps { display: grid; gap: 2px; padding: 8px; }
    #${PANEL_ID} .sd-steps li {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 7px 8px;
      border-radius: 9px;
    }
    #${PANEL_ID} .sd-steps li:hover { background: rgba(148, 163, 184, 0.06); }
    #${PANEL_ID} .sd-dot {
      flex: 0 0 auto;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--sd-danger);
      box-shadow: 0 0 0 3px rgba(251, 113, 133, 0.1);
    }
    #${PANEL_ID} .sd-steps li.sd-on .sd-dot {
      background: var(--sd-accent);
      box-shadow: 0 0 0 3px rgba(94, 234, 212, 0.1);
    }
    #${PANEL_ID} .sd-steps strong { display: block; font-size: 12px; font-weight: 600; }
    #${PANEL_ID} .sd-steps small { display: block; color: var(--sd-muted); font-size: 10.5px; margin-top: 1px; }
    #${PANEL_ID} .sd-state {
      margin-left: auto;
      color: var(--sd-muted);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    #${PANEL_ID} .sd-steps li.sd-on .sd-state { color: var(--sd-accent); }
    #${PANEL_ID} .sd-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 9px 12px;
      border-top: 1px solid rgba(148, 163, 184, 0.14);
      color: var(--sd-muted);
      font-size: 10.5px;
    }
    #${PANEL_ID} .sd-foot strong { color: var(--sd-text); font-size: 11px; }
    #${PANEL_ID}.sd-dragging .sd-panel-head { cursor: grabbing; }
  `;

  const installStyles = () => {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = styles;
    (document.head || document.documentElement).appendChild(style);
  };

  const statusItems = [
    {
      key: 'active',
      title: 'Always-active tab',
      detail: 'Visibility and focus spoofing',
      state: () => port.dataset.enabled === 'true'
    },
    {
      key: 'privacy',
      title: 'Privacy Guard',
      detail: 'Canvas focus/visibility suppression',
      state: () => port.dataset.privacy === 'true'
    },
    {
      key: 'quiz',
      title: 'Quiz Recall',
      detail: 'Best prior answers on hover',
      state: () => port.dataset.quiz === 'true'
    },
    {
      key: 'cleanup',
      title: 'Detector cleanup',
      detail: 'Hidden accessibility spans removed',
      state: () => port.dataset.privacy === 'true'
    }
  ];

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const mount = () => {
    if (document.getElementById(TOOLBAR_ID)) {
      return;
    }
    installStyles();

    const toolbar = document.createElement('div');
    toolbar.id = TOOLBAR_ID;
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'StudyDock');
    toolbar.innerHTML = `
      <button class="sd-tb-btn" id="studydock-info" type="button" aria-label="StudyDock status" aria-expanded="false" title="StudyDock status">i</button>
      <span class="sd-tb-divider" aria-hidden="true"></span>
      <button class="sd-tb-btn" id="studydock-hide" type="button" aria-label="Hide StudyDock toolbar" title="Hide toolbar">&times;</button>
    `;

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'StudyDock protection status');
    panel.innerHTML = `
      <div class="sd-panel-head">
        <div class="sd-brand">
          <span class="sd-logo" aria-hidden="true">D</span>
          <div><strong>StudyDock</strong><small>Protection status</small></div>
        </div>
        <button class="sd-settings" id="studydock-settings" type="button">Settings</button>
      </div>
      <ul class="sd-steps">
        ${statusItems.map((item) => `
          <li data-key="${item.key}">
            <span class="sd-dot" aria-hidden="true"></span>
            <div><strong>${item.title}</strong><small>${item.detail}</small></div>
            <span class="sd-state">Off</span>
          </li>
        `).join('')}
      </ul>
      <div class="sd-foot"><span>Canvas course page</span><strong id="studydock-summary">Protection on</strong></div>
    `;

    document.body.append(toolbar, panel);

    const info = toolbar.querySelector('#studydock-info');
    const hide = toolbar.querySelector('#studydock-hide');

    const refreshStatus = () => {
      let enabledCount = 0;
      for (const item of statusItems) {
        const row = panel.querySelector(`li[data-key="${item.key}"]`);
        if (!row) continue;
        const on = item.state();
        if (on) enabledCount += 1;
        row.classList.toggle('sd-on', on);
        row.querySelector('.sd-state').textContent = on ? 'On' : 'Off';
      }
      const summary = panel.querySelector('#studydock-summary');
      summary.textContent = enabledCount >= 3 ? 'Protection on' : enabledCount > 0 ? 'Partial' : 'Protection off';
    };

    const toolbarPosition = { left: 0, top: 0 };
    const panelPosition = { left: 0, top: 0 };
    const toolbarSize = { width: 0, height: 0 };
    const panelSize = { width: 302, height: 0 };

    const writeToolbar = () => {
      toolbar.style.left = `${toolbarPosition.left}px`;
      toolbar.style.top = `${toolbarPosition.top}px`;
      toolbar.style.right = 'auto';
    };

    const writePanel = () => {
      panel.style.left = `${panelPosition.left}px`;
      panel.style.top = `${panelPosition.top}px`;
    };

    const measure = () => {
      const t = toolbar.getBoundingClientRect();
      toolbarSize.width = t.width;
      toolbarSize.height = t.height;
      const p = panel.getBoundingClientRect();
      panelSize.width = p.width || 302;
      panelSize.height = p.height || 0;
    };

    const clampToolbar = () => {
      toolbarPosition.left = clamp(toolbarPosition.left, 8, Math.max(8, window.innerWidth - toolbarSize.width - 8));
      toolbarPosition.top = clamp(toolbarPosition.top, 8, Math.max(8, window.innerHeight - toolbarSize.height - 8));
    };

    const dockPanel = () => {
      const left = clamp(toolbarPosition.left, 8, Math.max(8, window.innerWidth - panelSize.width - 8));
      const top = clamp(toolbarPosition.top + toolbarSize.height + 8, 8, Math.max(8, window.innerHeight - panelSize.height - 8));
      panelPosition.left = left;
      panelPosition.top = top;
      writePanel();
    };

    const placeInitial = () => {
      measure();
      toolbarPosition.left = Math.max(8, window.innerWidth - toolbarSize.width - 16);
      toolbarPosition.top = 16;
      writeToolbar();
      dockPanel();
    };

    const moveBoth = (dx, dy) => {
      toolbarPosition.left += dx;
      toolbarPosition.top += dy;
      clampToolbar();
      writeToolbar();
      dockPanel();
    };

    const makeDraggable = (handle, onMove, ignoreSelector) => {
      let startX = 0;
      let startY = 0;
      let dragging = false;

      const onDown = (event) => {
        if (event.button !== 0) return;
        if (ignoreSelector && event.target.closest(ignoreSelector)) return;
        dragging = true;
        startX = event.clientX;
        startY = event.clientY;
        toolbar.classList.add('sd-dragging');
        panel.classList.add('sd-dragging');
        handle.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      };

      const onPointerMove = (event) => {
        if (!dragging) return;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        startX = event.clientX;
        startY = event.clientY;
        onMove(dx, dy);
      };

      const onUp = (event) => {
        if (!dragging) return;
        dragging = false;
        toolbar.classList.remove('sd-dragging');
        panel.classList.remove('sd-dragging');
        handle.releasePointerCapture?.(event.pointerId);
      };

      handle.addEventListener('pointerdown', onDown);
      handle.addEventListener('pointermove', onPointerMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    };

    makeDraggable(toolbar, moveBoth, 'button');
    makeDraggable(panel.querySelector('.sd-panel-head'), moveBoth, 'button');

    const openPanel = () => {
      measure();
      dockPanel();
      panel.classList.add('sd-open');
      info.setAttribute('aria-expanded', 'true');
      refreshStatus();
    };

    const closePanel = () => {
      panel.classList.remove('sd-open');
      info.setAttribute('aria-expanded', 'false');
    };

    info.addEventListener('click', (event) => {
      event.stopPropagation();
      if (panel.classList.contains('sd-open')) closePanel();
      else openPanel();
    });

    hide.addEventListener('click', (event) => {
      event.stopPropagation();
      closePanel();
      toolbar.style.display = 'none';
    });

    panel.addEventListener('click', (event) => event.stopPropagation());
    document.addEventListener('click', (event) => {
      if (!panel.classList.contains('sd-open')) return;
      if (!panel.contains(event.target) && !toolbar.contains(event.target)) {
        closePanel();
      }
    });

    window.addEventListener('resize', () => {
      measure();
      clampToolbar();
      writeToolbar();
      dockPanel();
    });

    new MutationObserver(refreshStatus).observe(port, { attributes: true, attributeFilter: ['data-enabled', 'data-privacy', 'data-quiz'] });

    placeInitial();
    refreshStatus();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  }
  else {
    mount();
  }
})();
