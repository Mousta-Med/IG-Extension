/* ReelPilot — content-script bootstrap: wires engine ⇄ overlay ⇄ storage ⇄ service worker. */
(() => {
  'use strict';
  const RP = globalThis.ReelPilot;
  if (!RP || !RP.ReelEngine || !RP.Overlay) return;

  // Retire an older instance (e.g. after the extension was updated), then listen for our own successor.
  document.dispatchEvent(new CustomEvent('reelpilot:takeover'));

  const AUTOSTART_KEY = 'reelpilot:autostart';
  let alive = true;

  const contextOk = () => {
    try { return !!(chrome.runtime && chrome.runtime.id); } catch (_) { return false; }
  };

  const send = (msg) => new Promise((resolve) => {
    if (!contextOk()) { resolve(undefined); return; }
    try {
      chrome.runtime.sendMessage(msg, (res) => { void chrome.runtime.lastError; resolve(res); });
    } catch (_) { resolve(undefined); }
  });

  const storageGet = (keys) => new Promise((resolve) => {
    if (!contextOk()) { resolve({}); return; }
    try {
      chrome.storage.local.get(keys, (res) => { void chrome.runtime.lastError; resolve(res || {}); });
    } catch (_) { resolve({}); }
  });

  const pendingWrites = new Set();
  const storageSet = (obj) => {
    if (!contextOk()) return;
    if (obj[RP.STORAGE_KEY]) pendingWrites.add(JSON.stringify(obj[RP.STORAGE_KEY]));
    try { chrome.storage.local.set(obj, () => void chrome.runtime.lastError); } catch (_) { /* context gone */ }
  };

  // Background tabs throttle setTimeout (down to once a minute after a while). The service worker's
  // timers aren't throttled, so while hidden we let it wake us up.
  const sleep = (ms) => {
    if (!document.hidden || !contextOk()) return new Promise((r) => setTimeout(r, ms));
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      send({ type: 'rp:sleep', ms }).then((ok) => { if (ok === true) finish(); else setTimeout(finish, ms); });
      setTimeout(finish, ms + 2000); // safety net
    });
  };

  // ── Core objects ──
  let settings = RP.normalizeSettings();
  const engine = new RP.ReelEngine({ sleep });
  const overlay = new RP.Overlay({
    onCommand: (cmd, value) => runCommand(cmd, value),
    onSettings: (patch) => updateSettings(patch),
    onPanel: (pos) => storageSet({ [RP.PANEL_KEY]: pos }),
    getState: () => engine.getState(),
    getVideo: () => engine.anchor(),
  });

  function render() {
    overlay.update(engine.getState(), settings);
  }

  function refreshVisibility() {
    overlay.setVisible(engine.enabled && settings.showPanel);
  }

  function pushHooksConfig() {
    document.dispatchEvent(new CustomEvent('reelpilot:config', {
      detail: JSON.stringify({ background: settings.background }),
    }));
  }

  function applySettings() {
    engine.setSettings(settings);
    pushHooksConfig();
    refreshVisibility();
    render();
  }

  function updateSettings(patch) {
    settings = RP.normalizeSettings(Object.assign({}, settings, patch));
    applySettings();
    storageSet({ [RP.STORAGE_KEY]: settings });
  }

  // ── Commands (overlay, popup, keyboard shortcuts, media keys) ──
  // Returns a result object for commands that can fail (PiP needs a click on the page itself).
  function runCommand(cmd, value) {
    switch (cmd) {
      case 'togglePip': return engine.togglePip();
      case 'next': engine.go(1, 'manual'); break;
      case 'prev': engine.go(-1, 'manual'); break;
      case 'togglePlay': engine.togglePlay(); break;
      case 'toggleAuto':
      case 'setAuto': {
        const on = cmd === 'setAuto' ? !!value : !engine.auto;
        if (on && !engine.enabled) { goToReels(true); break; }
        engine.setAuto(on);
        break;
      }
      case 'seek': engine.seek(Number(value)); break;
      case 'showPanel':
        updateSettings({ showPanel: true });
        if (settings.controls === 'panel') overlay.setCollapsed(false);
        break;
      case 'goToReels': goToReels(false); break;
      default: break;
    }
    return undefined;
  }

  function goToReels(autostart) {
    if (autostart) {
      try { sessionStorage.setItem(AUTOSTART_KEY, '1'); } catch (_) { /* storage blocked */ }
    }
    // Prefer Instagram's own link (instant in-app navigation); fall back to a full page load.
    const link = document.querySelector('a[href="/reels/"]');
    if (link) link.click();
    else location.assign('/reels/');
  }

  async function maybeAutostart() {
    let flagged = false;
    try {
      flagged = sessionStorage.getItem(AUTOSTART_KEY) === '1';
      sessionStorage.removeItem(AUTOSTART_KEY);
    } catch (_) { /* storage blocked */ }
    if (!flagged) return;
    for (let i = 0; i < 40 && alive; i++) {
      engine.scan();
      if (engine.video) { engine.setAuto(true); return; }
      await sleep(250);
    }
  }

  // ── SPA route tracking ──
  let lastPath = null;
  function checkRoute() {
    if (!alive) return;
    overlay.ensureAttached();
    const path = location.pathname;
    if (path === lastPath) return;
    lastPath = path;
    const onReels = RP.isReelsPath(path);
    engine.setEnabled(onReels);
    refreshVisibility();
    if (onReels) maybeAutostart();
  }
  const routeTimer = setInterval(checkRoute, 600);
  window.addEventListener('popstate', checkRoute);

  // ── Engine events ──
  let reportTimer = 0;
  let lastReport = '';
  function scheduleReport() {
    if (reportTimer) return;
    reportTimer = setTimeout(() => {
      reportTimer = 0;
      const s = engine.getState();
      const payload = { auto: s.auto, count: s.reelNumber, playing: s.playing, enabled: s.enabled, author: s.author };
      const key = JSON.stringify(payload);
      if (key === lastReport) return;
      lastReport = key;
      send({ type: 'rp:state', state: payload });
    }, 250);
  }

  engine.on('change', () => { render(); scheduleReport(); });
  engine.on('toast', (t) => overlay.toast(t));
  engine.on('settings', (patch) => updateSettings(patch));

  // ── Messages from the popup / service worker ──
  const snapshot = () => Object.assign(engine.getState(), {
    settings,
    url: location.href,
    panelCollapsed: settings.controls === 'panel' && overlay.pos.collapsed,
  });

  function onMessage(msg, _sender, sendResponse) {
    if (!alive || !msg || typeof msg.type !== 'string') return undefined;
    if (msg.type === 'rp:getState') { sendResponse(snapshot()); return undefined; }
    if (msg.type === 'rp:command') {
      Promise.resolve(runCommand(msg.command, msg.value))
        .catch(() => undefined)
        .then((result) => setTimeout(() => {
          const res = snapshot();
          if (result && result.error) res.commandError = result.error;
          sendResponse(res);
        }, 80));
      return true;
    }
    return undefined;
  }
  chrome.runtime.onMessage.addListener(onMessage);

  function onStorage(changes, area) {
    if (area !== 'local' || !alive) return;
    const change = changes[RP.STORAGE_KEY];
    if (!change || !change.newValue) return;
    const json = JSON.stringify(change.newValue);
    if (pendingWrites.delete(json)) return; // our own write echoing back
    settings = RP.normalizeSettings(change.newValue);
    applySettings();
  }
  chrome.storage.onChanged.addListener(onStorage);

  // ── Page hooks handshake ──
  const onPong = () => { engine.hooksReady = true; };
  document.addEventListener('reelpilot:pong', onPong);
  document.dispatchEvent(new CustomEvent('reelpilot:ping'));

  // ── Lifecycle ──
  function teardown() {
    if (!alive) return;
    alive = false;
    clearInterval(routeTimer);
    clearInterval(ctxTimer);
    clearTimeout(reportTimer);
    window.removeEventListener('popstate', checkRoute);
    document.removeEventListener('reelpilot:takeover', teardown);
    document.removeEventListener('reelpilot:pong', onPong);
    try { chrome.runtime.onMessage.removeListener(onMessage); } catch (_) { /* context gone */ }
    try { chrome.storage.onChanged.removeListener(onStorage); } catch (_) { /* context gone */ }
    engine.destroy();
    overlay.destroy();
  }
  document.addEventListener('reelpilot:takeover', teardown);
  const ctxTimer = setInterval(() => { if (!contextOk()) teardown(); }, 4000);

  // ── Boot ──
  (async () => {
    const res = await storageGet([RP.STORAGE_KEY, RP.PANEL_KEY]);
    if (!alive) return;
    settings = RP.normalizeSettings(res[RP.STORAGE_KEY]);
    if (res[RP.PANEL_KEY]) overlay.setPosition(res[RP.PANEL_KEY]);
    applySettings();
    checkRoute();
    const shortcuts = await send({ type: 'rp:getShortcuts' });
    if (alive && shortcuts) overlay.setShortcuts(shortcuts);
  })();
})();
