(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const form = $('#settings-form');
  const status = $('#save-status');
  const hostsBox = $('#hosts');
  const allSites = $('#all-sites');
  const policiesBox = $('#policies');

  const fields = {
    enabled: $('#enabled'),
    excludedHosts: $('#excludedHosts'),
    blockedUrls: $('#blockedUrls'),
    privacyGuardEnabled: $('#privacyGuardEnabled'),
    quizLoaderEnabled: $('#quizLoaderEnabled'),
    showInjectedUI: $('#showInjectedUI'),
    badge: $('#badge'),
    visibility: $('#visibility'),
    focus: $('#focus'),
    blur: $('#blur'),
    redirect: $('#redirect'),
    mouseleave: $('#mouseleave'),
    mouseout: $('#mouseout'),
    pointercapture: $('#pointercapture'),
    fullscreen: $('#fullscreen')
  };

  const send = (message) => new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, error: 'No response from StudyDock.' });
    });
  });

  const splitList = (value) => {
    const seen = new Set();
    const out = [];
    for (const part of String(value || '').split(/[\n,]+/)) {
      const item = part.trim();
      if (!item || seen.has(item)) continue;
      seen.add(item);
      out.push(item);
    }
    return out;
  };

  const setMessage = (text, kind = '') => {
    status.textContent = text;
    status.className = `save-status ${kind}`.trim();
  };

  const syncAllSites = () => {
    allSites.checked = splitList(hostsBox.value).includes('*');
  };

  hostsBox.addEventListener('input', syncAllSites);

  allSites.addEventListener('change', () => {
    const hosts = splitList(hostsBox.value).filter((host) => host !== '*');
    if (allSites.checked) hosts.push('*');
    hostsBox.value = hosts.join('\n');
  });

  function render(settings) {
    fields.enabled.checked = !!settings.enabled;
    fields.privacyGuardEnabled.checked = !!settings.privacyGuardEnabled;
    fields.quizLoaderEnabled.checked = !!settings.quizLoaderEnabled;
    fields.showInjectedUI.checked = !!settings.showInjectedUI;
    fields.badge.checked = settings.badge !== false;

    for (const key of ['visibility', 'focus', 'blur', 'redirect', 'mouseleave', 'mouseout', 'pointercapture', 'fullscreen']) {
      fields[key].checked = !!settings[key];
    }

    hostsBox.value = (settings.hosts || []).join('\n');
    fields.excludedHosts.value = (settings.excludedHosts || []).join('\n');
    fields.blockedUrls.value = (settings.blockedUrls || []).join('\n');
    policiesBox.value = settings.policies ? JSON.stringify(settings.policies, null, 2) : '';
    syncAllSites();
  }

  function readPolicies() {
    const raw = policiesBox.value.trim();
    if (!raw) return { ok: true, value: null };
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ok: false, error: 'Policies must be a JSON object.' };
      }
      for (const [host, events] of Object.entries(parsed)) {
        if (!host || !Array.isArray(events) || events.some((event) => typeof event !== 'string')) {
          return { ok: false, error: `Policy for "${host}" must be an array of event names.` };
        }
      }
      return { ok: true, value: parsed };
    } catch (error) {
      return { ok: false, error: `Policies JSON: ${error.message}` };
    }
  }

  async function load() {
    const response = await send({ type: 'getState' });
    if (!response.ok) {
      setMessage(response.error || 'Could not load settings.', 'error');
      return;
    }
    render(response.settings);
    $('#version').textContent = response.version || chrome.runtime.getManifest().version;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage('');

    const policies = readPolicies();
    if (!policies.ok) {
      setMessage(policies.error, 'error');
      return;
    }

    const hosts = splitList(hostsBox.value).filter((host) => host !== '*');
    if (allSites.checked) hosts.push('*');

    const patch = {
      enabled: fields.enabled.checked,
      hosts,
      excludedHosts: splitList(fields.excludedHosts.value),
      blockedUrls: splitList(fields.blockedUrls.value),
      privacyGuardEnabled: fields.privacyGuardEnabled.checked,
      quizLoaderEnabled: fields.quizLoaderEnabled.checked,
      showInjectedUI: fields.showInjectedUI.checked,
      badge: fields.badge.checked,
      visibility: fields.visibility.checked,
      focus: fields.focus.checked,
      blur: fields.blur.checked,
      redirect: fields.redirect.checked,
      mouseleave: fields.mouseleave.checked,
      mouseout: fields.mouseout.checked,
      pointercapture: fields.pointercapture.checked,
      fullscreen: fields.fullscreen.checked,
      policies: policies.value
    };

    const response = await send({ type: 'setSettings', patch });
    if (!response.ok) {
      setMessage(response.error || 'Could not save settings.', 'error');
      return;
    }
    render(response.settings);
    setMessage('Settings saved. Open tabs pick up changes on reload.', 'ok');
  });

  $('#reset').addEventListener('click', async () => {
    if (!confirm('Reset StudyDock to its default settings? This cannot be undone.')) return;
    const response = await send({ type: 'resetSettings' });
    if (!response.ok) {
      setMessage(response.error || 'Could not reset settings.', 'error');
      return;
    }
    render(response.settings);
    setMessage('Defaults restored.', 'ok');
  });

  load();
})();
