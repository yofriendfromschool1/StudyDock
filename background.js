'use strict';

const DEFAULTS = {
  enabled: true,
  privacyGuardEnabled: true,
  quizLoaderEnabled: true,
  showInjectedUI: true,
  badge: true,
  hosts: [],
  excludedHosts: [],
  blockedUrls: [],
  policies: null,
  visibility: true,
  focus: true,
  blur: true,
  redirect: true,
  mouseleave: true,
  mouseout: true,
  pointercapture: true,
  fullscreen: false
};

const MAIN_ID = 'studydock-main';
const ISOLATED_ID = 'studydock-isolated';
const SCRIPT_IDS = [MAIN_ID, ISOLATED_ID];
const MAIN_FILES = [
  'content/always-active-page.js',
  'content/canvas-guard-page.js'
];
const ISOLATED_FILES = [
  'content/always-active-isolated.js',
  'content/canvas-guard-isolated.js'
];
const CANVAS_MATCHES = ['*://*/courses/*'];
const REGISTER_KEYS = new Set(['enabled', 'hosts', 'blockedUrls']);
const BADGE_KEYS = new Set(['enabled', 'privacyGuardEnabled', 'hosts', 'excludedHosts', 'blockedUrls', 'badge']);

/* Removed during upgrade. These keys are not read by StudyDock; they only
   exist so old paid/account/analytics state can be cleaned from the profile. */
const LEGACY_KEYS = [
  'paid',
  'lifetimePaid',
  'email',
  'customerEmail',
  'pendingEmail',
  'deviceId',
  'purchase_pending',
  'showPurchasePage',
  'showSettingsPage',
  'ab',
  'ab_force',
  'ab_cache',
  'install_id',
  'install_at',
  'tracked_once',
  'flags',
  'lastSendTime',
  'saveCorrectAnswers',
  'injectQuizAnswers',
  'hideGetHelp',
  'injectedUINudgeShown',
  'shouldReload'
];

const ALLOWED_SETTINGS = new Set(Object.keys(DEFAULTS));

const getLocal = (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve));
const setLocal = (items) => new Promise((resolve) => chrome.storage.local.set(items, resolve));

const normalizeHost = (value) => {
  let host = String(value || '').trim().toLowerCase();
  if (!host) return '';
  if (host === '*') return '*';
  if (host.startsWith('*.')) {
    const base = normalizeHost(host.slice(2));
    return base ? '*.' + base : '';
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(host)) {
    try {
      host = new URL(host).hostname;
    }
    catch (e) {
      return '';
    }
  }
  else {
    host = host.split('/')[0].split('?')[0].split('#')[0];
  }
  host = host.replace(/^www\./, '');
  return /^[a-z0-9.-]+$/i.test(host) ? host : '';
};

const normalizeHostList = (list) => {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of list) {
    const host = normalizeHost(entry);
    if (!host || seen.has(host)) continue;
    seen.add(host);
    out.push(host);
  }
  return out;
};

const normalizePolicies = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out = {};
  for (const [host, events] of Object.entries(value)) {
    const key = normalizeHost(host);
    if (!key || !Array.isArray(events)) continue;
    out[key] = events.filter((event) => typeof event === 'string');
  }
  return Object.keys(out).length ? out : null;
};

const normalizeSettings = (raw) => {
  const source = raw || {};
  const settings = { ...DEFAULTS, ...source };
  settings.hosts = normalizeHostList(settings.hosts);
  settings.excludedHosts = normalizeHostList(settings.excludedHosts);
  settings.blockedUrls = normalizeHostList(settings.blockedUrls);
  settings.policies = normalizePolicies(settings.policies);
  for (const key of ['enabled', 'privacyGuardEnabled', 'quizLoaderEnabled', 'showInjectedUI', 'badge', 'visibility', 'focus', 'blur', 'redirect', 'mouseleave', 'mouseout', 'pointercapture', 'fullscreen']) {
    settings[key] = source[key] === undefined ? DEFAULTS[key] : !!source[key];
  }
  return settings;
};

const getSettings = async () => normalizeSettings(await getLocal(DEFAULTS));

const urlHost = (url) => {
  try {
    return normalizeHost(new URL(url).hostname);
  }
  catch (e) {
    return '';
  }
};

const isHttpUrl = (url) => /^https?:\/\//i.test(String(url || ''));

const isCanvasUrl = (url) => {
  try {
    return /^\/courses\/\d+(?:\/|$)/.test(new URL(url).pathname);
  }
  catch (e) {
    return false;
  }
};

const matchesHost = (hostname, entry) => {
  hostname = normalizeHost(hostname);
  entry = normalizeHost(entry);
  if (!hostname || !entry) return false;
  if (entry === '*') return true;
  if (entry === hostname) return true;
  if (entry.startsWith('*.')) {
    const domain = entry.slice(2);
    return hostname === domain || hostname.endsWith('.' + domain);
  }
  return false;
};

const matchesAnyHost = (hostname, list) => (list || []).some((entry) => matchesHost(hostname, entry));

const siteState = (tab, settings) => {
  const host = tab && tab.url ? urlHost(tab.url) : '';
  const http = !!(tab && isHttpUrl(tab.url));
  const canvas = !!(tab && isCanvasUrl(tab.url));
  const blocked = !!(host && matchesAnyHost(host, settings.blockedUrls));
  const excluded = !!(host && matchesAnyHost(host, settings.excludedHosts));
  const listed = !!(host && matchesAnyHost(host, settings.hosts));
  const explicit = !!(host && listed && !excluded && !blocked);
  const canvasAuto = !!(canvas && settings.privacyGuardEnabled && !blocked && !excluded);
  const alwaysActive = !!(settings.enabled && host && !blocked && !excluded && (listed || canvasAuto));

  return {
    tab: {
      id: tab ? tab.id : null,
      url: tab ? tab.url : '',
      host,
      http,
      canvas
    },
    site: {
      blocked,
      excluded,
      listed,
      explicit,
      canvasAuto,
      alwaysActive
    }
  };
};

const getActiveTab = () => new Promise((resolve) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs && tabs[0] ? tabs[0] : null));
});

const getTab = (tabId) => new Promise((resolve) => {
  if (!tabId && tabId !== 0) {
    resolve(null);
    return;
  }
  chrome.tabs.get(tabId, (tab) => resolve(chrome.runtime.lastError ? null : tab));
});

const expandHostPattern = (host) => {
  const patterns = [];
  if (host === '*') {
    patterns.push('*://*/*');
    return patterns;
  }
  patterns.push(`*://${host}/*`);
  if (!host.startsWith('*.') && host.includes('.') && !/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    patterns.push(`*://www.${host}/*`);
  }
  return patterns;
};

const buildRegistration = (settings) => {
  const matches = new Set(CANVAS_MATCHES);
  for (const host of settings.hosts) {
    for (const pattern of expandHostPattern(host)) matches.add(pattern);
  }

  const excludeMatches = [];
  for (const host of settings.blockedUrls) {
    if (host === '*') {
      return { matches: [], excludeMatches: [], blockedAll: true };
    }
    excludeMatches.push(...expandHostPattern(host));
  }

  return {
    matches: [...matches],
    excludeMatches: [...new Set(excludeMatches)],
    blockedAll: false
  };
};

let registerTimer = 0;
let registerQueue = Promise.resolve();

async function unregisterScripts() {
  for (const id of SCRIPT_IDS) {
    try {
      await chrome.scripting.unregisterContentScripts({ ids: [id] });
    }
    catch (e) {
      /* This id was not registered. */
    }
  }
}

async function registerNow() {
  await unregisterScripts();
  const settings = await getSettings();
  if (!settings.enabled) return { ok: true };

  const registration = buildRegistration(settings);
  if (registration.blockedAll || !registration.matches.length) return { ok: true };

  const base = {
    matches: registration.matches,
    allFrames: true,
    runAt: 'document_start',
    persistAcrossSessions: true,
    ...(registration.excludeMatches.length ? { excludeMatches: registration.excludeMatches } : {})
  };

  try {
    await chrome.scripting.registerContentScripts([
      {
        ...base,
        id: MAIN_ID,
        js: MAIN_FILES,
        world: 'MAIN'
      },
      {
        ...base,
        id: ISOLATED_ID,
        js: ISOLATED_FILES,
        world: 'ISOLATED'
      }
    ]);
    return { ok: true };
  }
  catch (error) {
    console.error('[StudyDock] Could not register page guards:', error);
    return { ok: false, error: error.message || 'Could not register page guards.' };
  }
}

/* Storage changes and direct popup actions can arrive together. Serialize
   unregister/register pairs so two calls cannot interleave and leave the
   extension with no registered page guard. */
function registerScripts() {
  registerQueue = registerQueue
    .then(registerNow, registerNow)
    .catch((error) => {
      console.error('[StudyDock] Registration queue error:', error);
      return { ok: false, error: error.message || 'Could not register page guards.' };
    });
  return registerQueue;
}

function scheduleRegister() {
  clearTimeout(registerTimer);
  registerTimer = setTimeout(() => registerScripts(), 100);
}

async function refreshBadge(tab, settings) {
  if (!tab || !tab.id) return;
  settings = settings || await getSettings();
  const state = siteState(tab, settings);
  const active = state.site.alwaysActive;
  const host = state.tab.host;

  try {
    await chrome.action.setBadgeText({
      tabId: tab.id,
      text: settings.badge ? (active ? 'ON' : 'OFF') : ''
    });
    await chrome.action.setBadgeBackgroundColor({
      tabId: tab.id,
      color: active ? '#1b5e20' : '#b01818'
    });
    const title = host
      ? `StudyDock — ${host} (${active ? 'always active' : 'not active'})`
      : 'StudyDock';
    await chrome.action.setTitle({ tabId: tab.id, title });
  }
  catch (e) {
    /* The tab may have closed while the badge was being painted. */
  }
}

async function refreshActiveBadge() {
  const tab = await getActiveTab();
  if (tab) await refreshBadge(tab);
}

async function migrateSettings() {
  const existing = await getLocal(null);
  const patch = {};

  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (existing[key] === undefined) patch[key] = value;
  }

  if (existing.quizLoaderEnabled === undefined && existing.saveCorrectAnswers !== undefined) {
    patch.quizLoaderEnabled = existing.saveCorrectAnswers !== false;
  }

  if (Object.keys(patch).length) await setLocal(patch);

  const presentLegacy = LEGACY_KEYS.filter((key) => existing[key] !== undefined);
  if (presentLegacy.length) {
    await new Promise((resolve) => chrome.storage.local.remove(presentLegacy, resolve));
  }
}

async function injectGuard(tabId) {
  const tab = await getTab(tabId);
  if (!tab || !isHttpUrl(tab.url)) return false;
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: MAIN_FILES,
      world: 'MAIN',
      injectImmediately: true
    });
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ISOLATED_FILES,
      world: 'ISOLATED',
      injectImmediately: true
    });
    return true;
  }
  catch (e) {
    console.warn('[StudyDock] Immediate injection failed:', e);
    return false;
  }
}

async function validateHosts(hosts) {
  const normalized = normalizeHostList(hosts);
  if (!normalized.length) return { ok: true };
  const matches = [];
  for (const host of normalized) matches.push(...expandHostPattern(host));
  try {
    await chrome.scripting.registerContentScripts([{
      id: 'studydock-validate',
      matches: [...new Set(matches)],
      js: ['content/always-active-page.js'],
      runAt: 'document_start'
    }]);
    await chrome.scripting.unregisterContentScripts({ ids: ['studydock-validate'] });
    return { ok: true };
  }
  catch (error) {
    try {
      await chrome.scripting.unregisterContentScripts({ ids: ['studydock-validate'] });
    }
    catch (e) {}
    return { ok: false, error: error.message };
  }
}

async function stateResponse(tabId, settings) {
  settings = settings || await getSettings();
  const tab = tabId || tabId === 0 ? await getTab(tabId) : await getActiveTab();
  return {
    ok: true,
    version: chrome.runtime.getManifest().version,
    settings,
    ...siteState(tab, settings)
  };
}

async function saveSettings(patch) {
  const clean = {};
  for (const [key, value] of Object.entries(patch || {})) {
    if (!ALLOWED_SETTINGS.has(key)) continue;
    clean[key] = value;
  }

  if ('hosts' in clean) {
    clean.hosts = normalizeHostList(clean.hosts);
  }
  if ('excludedHosts' in clean) {
    clean.excludedHosts = normalizeHostList(clean.excludedHosts);
  }
  if ('blockedUrls' in clean) {
    clean.blockedUrls = normalizeHostList(clean.blockedUrls);
  }
  if ('policies' in clean) {
    clean.policies = normalizePolicies(clean.policies);
  }
  for (const key of ['enabled', 'privacyGuardEnabled', 'quizLoaderEnabled', 'showInjectedUI', 'badge', 'visibility', 'focus', 'blur', 'redirect', 'mouseleave', 'mouseout', 'pointercapture', 'fullscreen']) {
    if (key in clean) clean[key] = !!clean[key];
  }

  if (Array.isArray(clean.hosts)) {
    const validation = await validateHosts(clean.hosts);
    if (!validation.ok) return validation;
  }

  await setLocal(clean);
  const registered = await registerScripts();
  if (!registered.ok) return registered;
  return { ok: true };
}

chrome.runtime.onInstalled.addListener(async () => {
  await migrateSettings();
  await registerScripts();
  await refreshActiveBadge();
});

chrome.runtime.onStartup.addListener(() => {
  registerScripts();
  refreshActiveBadge();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (Object.keys(changes).some((key) => REGISTER_KEYS.has(key))) {
    scheduleRegister();
  }
  if (Object.keys(changes).some((key) => BADGE_KEYS.has(key))) {
    refreshActiveBadge();
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  getTab(tabId).then((tab) => tab && refreshBadge(tab));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    refreshBadge(tab);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (!message || typeof message !== 'object') {
        sendResponse({ ok: false, error: 'Invalid message.' });
        return;
      }

      if (message.type === 'getState') {
        sendResponse(await stateResponse(message.tabId || null));
        return;
      }

      if (message.type === 'setSettings') {
        const saved = await saveSettings(message.patch || {});
        if (!saved.ok) {
          sendResponse(saved);
          return;
        }
        sendResponse(await stateResponse(message.tabId || null));
        return;
      }

      if (message.type === 'toggleSite') {
        const tab = await getTab(message.tabId) || await getActiveTab();
        if (!tab || !isHttpUrl(tab.url)) {
          sendResponse({ ok: false, error: 'This tab cannot use always-active mode.' });
          return;
        }
        const settings = await getSettings();
        const host = urlHost(tab.url);
        const current = siteState(tab, settings);
        if (current.site.blocked) {
          sendResponse({ ok: false, error: 'This site is in the blocked-host list.' });
          return;
        }

        let hosts = settings.hosts.slice();
        let excludedHosts = settings.excludedHosts.slice();
        let enabling = false;

        if (current.site.alwaysActive) {
          excludedHosts = normalizeHostList([...excludedHosts, host]);
        }
        else {
          excludedHosts = excludedHosts.filter((entry) => !matchesHost(host, entry));
          if (!matchesAnyHost(host, hosts)) hosts.push(host);
          enabling = true;
        }

        await setLocal({ hosts: normalizeHostList(hosts), excludedHosts: normalizeHostList(excludedHosts) });
        await registerScripts();
        const injected = enabling ? await injectGuard(tab.id) : false;
        const response = await stateResponse(tab.id);
        response.reloadRecommended = !enabling || !injected;
        sendResponse(response);
        return;
      }

      if (message.type === 'resetSettings') {
        await new Promise((resolve) => chrome.storage.local.clear(resolve));
        await setLocal(DEFAULTS);
        await registerScripts();
        sendResponse(await stateResponse(null));
        return;
      }

      if (message.type === 'openOptions') {
        chrome.runtime.openOptionsPage();
        sendResponse({ ok: true });
        return;
      }

      if (message.type === 'reloadTab') {
        const tabId = message.tabId || (sender.tab && sender.tab.id);
        if (tabId) chrome.tabs.reload(tabId);
        sendResponse({ ok: !!tabId });
        return;
      }

      if (message.method === 'set-icon') {
        const tab = sender.tab || await getActiveTab();
        if (tab) await refreshBadge(tab);
        sendResponse({ ok: true });
        return;
      }

      if (message.method === 'validate' || message.type === 'validateHosts') {
        sendResponse(await validateHosts(message.hosts || []));
        return;
      }

      sendResponse({ ok: false, error: 'Unknown StudyDock action.' });
    }
    catch (error) {
      console.error('[StudyDock] Background error:', error);
      sendResponse({ ok: false, error: error.message || 'StudyDock background error.' });
    }
  })();

  return true;
});
