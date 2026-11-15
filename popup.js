(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const el = {
    siteHeading: $('#site-heading'),
    siteStatus: $('#site-status'),
    siteNote: $('#site-note'),
    toggleSite: $('#toggle-site'),
    reloadTab: $('#reload-tab'),
    allSites: $('#all-sites'),
    enabled: $('#enabled'),
    quizLoaderEnabled: $('#quizLoaderEnabled'),
    privacyGuardEnabled: $('#privacyGuardEnabled'),
    showInjectedUI: $('#showInjectedUI'),
    toggleKiosk: $('#toggle-kiosk'),
    kioskNote: $('#kiosk-note'),
    version: $('#version'),
    toast: $('#toast')
  };

  let activeTab = null;
  let state = null;
  let kioskInjected = false;
  let kioskAvailable = false;
  let reloadRecommended = false;
  let refreshTimer = 0;
  let toastTimer = 0;

  const send = (message) => new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, error: 'No response from StudyDock.' });
    });
  });

  const sendTab = (tabId, message) => new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve({ ok: true, response });
    });
  });

  const queryActiveTab = () => new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs && tabs[0] ? tabs[0] : null);
    });
  });

  function toast(text, isError = false) {
    if (!el.toast) return;
    clearTimeout(toastTimer);
    el.toast.textContent = text;
    el.toast.classList.toggle('error', isError);
    el.toast.classList.add('show');
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2800);
  }

  function setStatus(text, kind) {
    el.siteStatus.textContent = text;
    el.siteStatus.className = `status-pill ${kind || ''}`.trim();
  }

  function render() {
    if (!state || !state.settings) return;

    const settings = state.settings;
    const site = state.site || {};
    const host = state.tab && state.tab.host;
    const http = !!(state.tab && state.tab.http);

    el.siteHeading.textContent = host || 'This page';
    el.siteHeading.title = host || 'This page';

    if (!settings.enabled) {
      setStatus('Paused', 'off');
      el.siteNote.textContent = 'StudyDock is paused. Turn on the master switch below to restore page guards and quiz recall.';
    } else if (site.blocked) {
      setStatus('Skipped', 'off');
      el.siteNote.textContent = 'This site is in your skip list. Remove it in Settings to let StudyDock run here.';
    } else if (site.excluded) {
      setStatus('Excluded', 'off');
      el.siteNote.textContent = site.canvas
        ? 'Always-active is off for this host. Privacy Guard can still suppress Canvas focus signals.'
        : 'Always-active is off for this host.';
    } else if (site.explicit) {
      setStatus('Always active', 'ok');
      el.siteNote.textContent = site.canvasAuto
        ? 'Always-active tab and Canvas Privacy Guard are both on for this tab.'
        : 'This site stays active while its tab is in the background.';
    } else if (site.canvasAuto) {
      setStatus('Canvas protected', 'ok');
      el.siteNote.textContent = 'Canvas course pages are protected automatically by Privacy Guard.';
    } else {
      setStatus('Not protected', 'warn');
      el.siteNote.textContent = 'Enable always-active for this site, or turn on the all-sites option below.';
    }

    const canToggle = http && settings.enabled && !site.blocked;
    el.toggleSite.disabled = !canToggle;
    el.toggleSite.textContent = !http
      ? 'Not available here'
      : site.alwaysActive
        ? 'Disable always-active here'
        : 'Enable always-active here';

    el.reloadTab.hidden = !reloadRecommended || !http;
    el.allSites.checked = Array.isArray(settings.hosts) && settings.hosts.includes('*');
    el.allSites.disabled = !settings.enabled;

    el.enabled.checked = !!settings.enabled;
    el.quizLoaderEnabled.checked = !!settings.quizLoaderEnabled;
    el.privacyGuardEnabled.checked = !!settings.privacyGuardEnabled;
    el.showInjectedUI.checked = !!settings.showInjectedUI;

    for (const control of [el.quizLoaderEnabled, el.privacyGuardEnabled, el.showInjectedUI]) {
      control.disabled = !settings.enabled;
    }

    const canKiosk = settings.enabled && !site.blocked && !!site.canvas;
    el.toggleKiosk.disabled = !canKiosk || !kioskAvailable;
    if (!site.canvas) {
      el.toggleKiosk.textContent = 'Canvas only';
      el.kioskNote.textContent = 'Open a Canvas course page to use the kiosk-style frame.';
    } else if (!settings.enabled) {
      el.toggleKiosk.textContent = 'Paused';
      el.kioskNote.textContent = 'Enable StudyDock to use the kiosk bar.';
    } else if (!kioskAvailable) {
      el.toggleKiosk.textContent = 'Unavailable';
      el.kioskNote.textContent = 'The page guard is not active on this tab. Reload the page and try again.';
    } else {
      el.toggleKiosk.textContent = kioskInjected ? 'Remove' : 'Inject';
      el.kioskNote.textContent = kioskInjected
        ? 'Kiosk frame is active on this tab.'
        : 'Open this Canvas page in a kiosk-style frame.';
    }
  }

  async function refreshKiosk() {
    kioskInjected = false;
    kioskAvailable = false;
    if (!state || !state.tab || !state.tab.id || !state.tab.canvas || !state.settings.enabled) {
      render();
      return;
    }

    const result = await sendTab(state.tab.id, { action: 'isInjected' });
    if (result.ok && result.response && typeof result.response.injected === 'boolean') {
      kioskAvailable = true;
      kioskInjected = result.response.injected;
    }
    render();
  }

  async function loadState(options = {}) {
    activeTab = await queryActiveTab();
    const response = await send({ type: 'getState', tabId: activeTab ? activeTab.id : null });
    if (!response.ok) {
      toast(response.error || 'Could not read settings.', true);
      return;
    }
    state = response;
    if (options.resetReload) reloadRecommended = false;
    render();
    await refreshKiosk();
  }

  async function saveSettings(patch, successMessage) {
    const response = await send({ type: 'setSettings', patch });
    if (!response.ok) {
      toast(response.error || 'Could not save that setting.', true);
      await loadState();
      return false;
    }
    state = { ...state, ...response };
    if (response.reloadRecommended) reloadRecommended = true;
    render();
    if (successMessage) toast(successMessage);
    return true;
  }

  el.toggleSite.addEventListener('click', async () => {
    if (!activeTab) return;
    const response = await send({ type: 'toggleSite', tabId: activeTab.id });
    if (!response.ok) {
      toast(response.error || 'Could not change this site.', true);
      return;
    }
    state = { ...state, ...response };
    reloadRecommended = !!response.reloadRecommended;
    render();
    toast(response.site && response.site.alwaysActive
      ? 'Always-active enabled for this site.'
      : 'This site will stop using always-active after a reload.');
  });

  el.allSites.addEventListener('change', async () => {
    const hosts = Array.isArray(state.settings.hosts) ? state.settings.hosts.slice() : [];
    const withoutAll = hosts.filter((host) => host !== '*');
    const nextHosts = el.allSites.checked ? [...withoutAll, '*'] : withoutAll;
    await saveSettings({ hosts: nextHosts }, el.allSites.checked
      ? 'Always-active is on for all websites.'
      : 'Always-active is limited to your site list.');
  });

  el.enabled.addEventListener('change', async () => {
    reloadRecommended = true;
    await saveSettings({ enabled: el.enabled.checked }, el.enabled.checked
      ? 'StudyDock enabled.'
      : 'StudyDock paused. Reload tabs to remove the page guards.');
    await refreshKiosk();
  });

  el.quizLoaderEnabled.addEventListener('change', async () => {
    await saveSettings({ quizLoaderEnabled: el.quizLoaderEnabled.checked }, el.quizLoaderEnabled.checked
      ? 'Quiz Recall enabled. Reload a quiz tab to load it.'
      : 'Quiz Recall disabled. Reload a quiz tab to remove it.');
  });

  el.privacyGuardEnabled.addEventListener('change', async () => {
    await saveSettings({ privacyGuardEnabled: el.privacyGuardEnabled.checked }, el.privacyGuardEnabled.checked
      ? 'Privacy Guard enabled.'
      : 'Privacy Guard disabled for Canvas pages.');
  });

  el.showInjectedUI.addEventListener('change', async () => {
    const show = el.showInjectedUI.checked;
    await saveSettings({ showInjectedUI: show });
    if (activeTab && activeTab.id) {
      await sendTab(activeTab.id, { action: 'applyShowInjectedUI', show });
    }
    toast(show ? 'On-page toolbar shown.' : 'On-page toolbar hidden.');
  });

  el.toggleKiosk.addEventListener('click', async () => {
    if (!activeTab || !activeTab.id) return;
    const action = kioskInjected ? 'removeBar' : 'toggleBar';
    const result = await sendTab(activeTab.id, { action });
    if (!result.ok) {
      toast('Reload the Canvas page and try again.', true);
      return;
    }
    kioskInjected = !!(result.response && result.response.injected);
    render();
    toast(kioskInjected ? 'Kiosk bar injected.' : 'Kiosk bar removed.');
  });

  el.reloadTab.addEventListener('click', () => {
    if (activeTab && activeTab.id) chrome.tabs.reload(activeTab.id);
  });

  for (const button of [$('#open-options'), $('#open-options-link')]) {
    button.addEventListener('click', () => chrome.runtime.openOptionsPage());
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => loadState(), 120);
  });

  const manifest = chrome.runtime.getManifest();
  el.version.textContent = `StudyDock ${manifest.version}`;
  loadState({ resetReload: true });
})();
