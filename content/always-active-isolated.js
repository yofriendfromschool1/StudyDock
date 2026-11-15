/*
 * Adapted from Always Active Window v3 (MPL-2.0).
 * Source: ./always-active/v3/data/inject/isolated.js
 *
 * Runs in the extension's isolated world. It reads the shared StudyDock
 * settings and tells the MAIN-world always-active engine which protections
 * to apply on this document.
 */
(() => {
  if (self.__studyDockAlwaysActiveIsolated) {
    return;
  }
  self.__studyDockAlwaysActiveIsolated = true;

  /* One marker the page cannot see. Kept for compatibility with the
     upstream engine's frame-state checks. */
  self.PROTECTED = true;

  const PORT_ID = 'studydock-port';
  let port = document.getElementById(PORT_ID);
  if (!port) {
    port = document.createElement('span');
    port.id = PORT_ID;
    port.style.display = 'none';
    document.documentElement.append(port);
  }
  port.dataset.hidden = document.hidden;
  port.dataset.enabled = 'false';

  port.addEventListener('state', () => {
    port.dataset.hidden = document.hidden;
  });

  const normalizeHost = (value) => {
    let host = String(value || '').trim().toLowerCase();
    if (!host) {
      return '';
    }
    if (/^[a-z][a-z0-9+.-]*:\/\//.test(host)) {
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
    return host.replace(/^www\./, '');
  };

  const hostFromEntry = (entry) => {
    const value = String(entry || '').trim();
    if (!value || value === '*') {
      return value;
    }
    if (value.startsWith('*.')) {
      const base = normalizeHost(value.slice(2));
      return base ? '*.' + base : '';
    }
    return normalizeHost(value);
  };

  const matchesHost = (hostname, entry) => {
    hostname = normalizeHost(hostname);
    entry = hostFromEntry(entry);
    if (!hostname || !entry) {
      return false;
    }
    if (entry === '*') {
      return true;
    }
    if (entry === hostname) {
      return true;
    }
    if (entry.startsWith('*.')) {
      const domain = entry.slice(2);
      return hostname === domain || hostname.endsWith('.' + domain);
    }
    return false;
  };

  const currentHostname = () => {
    let hostname = location.hostname;
    try {
      if (parent !== window && parent.location.hostname) {
        hostname = parent.location.hostname;
      }
    }
    catch (e) {}
    return normalizeHost(hostname);
  };

  const currentPathname = () => {
    let pathname = location.pathname;
    try {
      if (parent !== window && parent.location.pathname) {
        pathname = parent.location.pathname;
      }
    }
    catch (e) {}
    return pathname;
  };

  const isCanvasPath = () => /^\/courses\/\d+(?:\/|$)/.test(currentPathname());

  const update = () => chrome.storage.local.get({
    enabled: true,
    privacyGuardEnabled: true,
    quizLoaderEnabled: true,
    hosts: [],
    excludedHosts: [],
    blockedUrls: [],
    policies: null,
    blur: true,
    focus: true,
    redirect: true,
    mouseleave: true,
    mouseout: true,
    visibility: true,
    pointercapture: true,
    fullscreen: false,
    badge: true
  }, (prefs) => {
    const hostname = currentHostname();
    const canvas = isCanvasPath();

    const blocked = (prefs.blockedUrls || []).some((entry) => matchesHost(hostname, entry));
    const excluded = (prefs.excludedHosts || []).some((entry) => matchesHost(hostname, entry));
    const listed = (prefs.hosts || []).some((entry) => matchesHost(hostname, entry));
    const privacy = !blocked && prefs.privacyGuardEnabled !== false;
    const active = !blocked &&
      !excluded &&
      prefs.enabled !== false &&
      (listed || (canvas && privacy));

    prefs.policies = prefs.policies && typeof prefs.policies === 'object' && !Array.isArray(prefs.policies)
      ? prefs.policies
      : {};
    const normalizedPolicies = {};
    for (const [key, events] of Object.entries(prefs.policies)) {
      const normalizedKey = normalizeHost(key);
      if (normalizedKey && Array.isArray(events)) normalizedPolicies[normalizedKey] = events;
    }
    const policy = normalizedPolicies[hostname] || [];

    port.dataset.enabled = active ? 'true' : 'false';
    port.dataset.privacy = privacy ? 'true' : 'false';
    port.dataset.quiz = !blocked && prefs.quizLoaderEnabled !== false ? 'true' : 'false';
    port.dataset.canvas = canvas ? 'true' : 'false';
    port.dataset.blocked = blocked ? 'true' : 'false';

    port.dataset.blur = policy.includes('blur') ? 'false' : String(prefs.blur !== false);
    port.dataset.focus = policy.includes('focus') ? 'false' : String(prefs.focus !== false);
    port.dataset.redirect = policy.includes('redirect') ? 'false' : String(prefs.redirect !== false);
    port.dataset.mouseleave = policy.includes('mouseleave') ? 'false' : String(prefs.mouseleave !== false);
    port.dataset.mouseout = policy.includes('mouseout') ? 'false' : String(prefs.mouseout !== false);
    port.dataset.visibility = policy.includes('visibility') ? 'false' : String(prefs.visibility !== false);
    port.dataset.pointercapture = policy.includes('pointercapture') ? 'false' : String(prefs.pointercapture !== false);

    const fullscreen = policy.includes('fullscreen') ? false : prefs.fullscreen === true;
    if (port.dataset.fullscreen !== undefined && (port.dataset.fullscreen === 'true') !== fullscreen) {
      port.dataset.fullscreen = String(fullscreen);
      port.dispatchEvent(new Event('fs'));
    }
    port.dataset.fullscreen = String(fullscreen);

    if (window.top === window) {
      try {
        chrome.runtime.sendMessage({
          method: 'set-icon',
          hostname,
          enabled: active,
          badge: prefs.badge !== false
        }, () => void chrome.runtime.lastError);
      }
      catch (e) {
        /* Extension context can disappear during a reload. */
      }
    }
  });

  update();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      update();
    }
  });
})();
