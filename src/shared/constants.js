/* ReelPilot — shared constants & helpers (content scripts + popup). */
(() => {
  'use strict';
  const RP = (globalThis.ReelPilot = globalThis.ReelPilot || {});

  RP.VERSION = '1.0.0';
  RP.STORAGE_KEY = 'reelpilot:settings';
  RP.PANEL_KEY = 'reelpilot:panel';
  RP.REELS_URL = 'https://www.instagram.com/reels/';

  RP.DEFAULTS = Object.freeze({
    mode: 'end',          // 'end' → advance after N full plays · 'timer' → after N seconds
    loops: 1,             // plays per reel in 'end' mode
    timerSec: 15,         // seconds per reel in 'timer' mode
    speed: 1,
    volume: 1,
    muted: false,
    audioManaged: false,  // becomes true once the user touches our volume controls
    background: true,     // keep playing while the tab is hidden
    skipSponsored: false,
    smooth: true,
    dimIdle: true,
    showPanel: true,      // master switch for on-page controls
    controls: 'panel',    // 'panel' → floating panel · 'reel' → compact bar on top of the reel
    autoPip: false,       // pop the reel into Picture-in-Picture when you leave the tab
    postMusic: true,      // play the song attached to photo posts, as the app does
    musicMuted: false,    // the mute button on that song's pill
  });

  RP.SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  RP.LIMITS = Object.freeze({ loops: [1, 10], timerSec: [3, 120] });

  RP.clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  RP.normalizeSettings = (raw) => {
    const d = RP.DEFAULTS;
    const s = Object.assign({}, d, raw && typeof raw === 'object' ? raw : {});
    const num = (v, fb) => (typeof v === 'number' && Number.isFinite(v) ? v : fb);
    s.mode = s.mode === 'timer' ? 'timer' : 'end';
    s.controls = s.controls === 'reel' ? 'reel' : 'panel';
    s.loops = Math.round(RP.clamp(num(s.loops, d.loops), ...RP.LIMITS.loops));
    s.timerSec = Math.round(RP.clamp(num(s.timerSec, d.timerSec), ...RP.LIMITS.timerSec));
    s.speed = RP.clamp(num(s.speed, d.speed), 0.25, 4);
    s.volume = RP.clamp(num(s.volume, d.volume), 0, 1);
    for (const k of ['muted', 'audioManaged', 'background', 'skipSponsored', 'smooth', 'dimIdle', 'showPanel', 'autoPip', 'postMusic', 'musicMuted']) {
      s[k] = typeof s[k] === 'boolean' ? s[k] : d[k];
    }
    return s;
  };

  RP.formatTime = (sec) => {
    if (!Number.isFinite(sec) || sec < 0) sec = 0;
    const s = Math.floor(sec);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  RP.formatSpan = (sec) => {
    if (!Number.isFinite(sec) || sec < 0) sec = 0;
    const s = Math.floor(sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m ${s % 60}s`;
    return `${s}s`;
  };

  // "Alt+Shift+Down Arrow" → ['Alt', '⇧', '↓']
  const KEY_LABELS = {
    Shift: '⇧', Command: '⌘', MacCtrl: '⌃', Option: '⌥',
    Up: '↑', Down: '↓', Left: '←', Right: '→',
    'Up Arrow': '↑', 'Down Arrow': '↓', 'Left Arrow': '←', 'Right Arrow': '→',
  };
  RP.shortcutKeys = (combo) => String(combo || '').split('+').filter(Boolean).map((k) => KEY_LABELS[k.trim()] || k.trim());

  // /reels/, /reels/<code>/, /reel/<code>/
  RP.isReelsPath = (path) => /^\/reels?(\/|$)/.test(path || '');

  /** The popup Instagram shows a post in (opened from a profile, Explore…), if one is open. */
  RP.postDialog = () => {
    const dialogs = document.querySelectorAll('[role="dialog"]');
    for (let i = dialogs.length - 1; i >= 0; i--) {
      for (const el of dialogs[i].querySelectorAll('video, img')) {
        const r = el.getBoundingClientRect();
        if (r.width >= 200 && r.height >= 200) return dialogs[i];
      }
    }
    return null;
  };

  // Set HTML in a way that survives pages enforcing Trusted Types.
  let ttPolicy = null;
  RP.setHTML = (el, html) => {
    try {
      el.innerHTML = html;
      return;
    } catch (_) { /* Trusted Types enforced — fall through */ }
    if (!ttPolicy && globalThis.trustedTypes) {
      ttPolicy = globalThis.trustedTypes.createPolicy('reelpilot', { createHTML: (s) => s });
    }
    el.innerHTML = ttPolicy.createHTML(html);
  };

  // Attach CSS to a document or shadow root without tripping page CSP.
  RP.adoptStyles = (root, css) => {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    } catch (_) {
      const style = document.createElement('style');
      style.textContent = css;
      (root.head || root).appendChild(style);
    }
  };
})();
