/* ReelPilot — page hooks (runs in the page's MAIN world at document_start).
 *
 * Instagram pauses reels and stops loading new ones when its tab is hidden. To keep reels
 * running in a background tab this script:
 *   1. Reports the page as visible/focused (document.hidden, visibilityState, hasFocus) and
 *      swallows the visibilitychange / window-blur events Instagram listens to.
 *   2. Wraps IntersectionObserver. Chrome stops computing intersections in hidden tabs, which is
 *      what Instagram uses to start the next reel and lazy-load more. While the tab is really
 *      hidden we compute intersections ourselves and deliver the callbacks Instagram expects.
 *   3. Falls back to timers for requestAnimationFrame while hidden (rAF never fires there).
 *
 * All of it is switchable at runtime from the content script ("Keep playing in background").
 * Communication happens over DOM CustomEvents, the only channel shared between worlds.
 */
(() => {
  'use strict';
  if (window.__reelPilotHooks) return;
  Object.defineProperty(window, '__reelPilotHooks', { value: { version: 1 }, enumerable: false });

  const state = { background: true };
  const docProto = Document.prototype;
  const desc = (name) => Object.getOwnPropertyDescriptor(docProto, name);
  const hiddenDesc = desc('hidden');
  const reallyHidden = () => (hiddenDesc && hiddenDesc.get ? hiddenDesc.get.call(document) : false);
  const active = () => state.background;

  // ── 1. Visibility & focus ─────────────────────────────────
  const spoof = (name, value) => {
    const d = desc(name);
    if (!d || !d.get) return;
    Object.defineProperty(docProto, name, {
      configurable: true,
      enumerable: d.enumerable,
      get() { return active() ? value : d.get.call(this); },
    });
  };
  spoof('hidden', false);
  spoof('visibilityState', 'visible');
  spoof('webkitHidden', false);
  spoof('webkitVisibilityState', 'visible');

  const nativeHasFocus = docProto.hasFocus;
  docProto.hasFocus = function hasFocus() {
    return active() ? true : nativeHasFocus.call(this);
  };

  const swallow = (e) => {
    if (!active()) return;
    if (e.type === 'blur' && e.target !== window) return; // only the window losing focus
    e.stopImmediatePropagation();
  };
  for (const type of ['visibilitychange', 'webkitvisibilitychange']) {
    window.addEventListener(type, swallow, true);
    document.addEventListener(type, swallow, true);
  }
  window.addEventListener('blur', swallow, true);

  // ── 2. IntersectionObserver ───────────────────────────────
  const NativeIO = window.IntersectionObserver;
  const registry = new Set(); // WeakRef<observer>
  const meta = new WeakMap(); // observer → { callback, thresholds, targets, last }

  const thresholdIndex = (ratio, isect, thresholds) => {
    if (!isect) return -1;
    let i = 0;
    while (i < thresholds.length && thresholds[i] <= ratio) i++;
    return i;
  };

  if (typeof NativeIO === 'function' && typeof WeakRef === 'function') {
    class ReelPilotIntersectionObserver extends NativeIO {
      constructor(callback, options) {
        const wrapped = function (entries, observer) {
          const m = meta.get(observer);
          if (m) {
            for (const e of entries) {
              m.last.set(e.target, { idx: thresholdIndex(e.intersectionRatio, e.isIntersecting, m.thresholds), isect: e.isIntersecting });
            }
          }
          return callback.call(this, entries, observer);
        };
        super(typeof callback === 'function' ? wrapped : callback, options);
        meta.set(this, {
          callback,
          thresholds: Array.from(this.thresholds || [0]),
          targets: new Set(),
          last: new WeakMap(),
        });
        registry.add(new WeakRef(this));
      }
      observe(target) {
        super.observe(target);
        const m = meta.get(this);
        if (m) m.targets.add(target);
      }
      unobserve(target) {
        super.unobserve(target);
        const m = meta.get(this);
        if (m) { m.targets.delete(target); m.last.delete(target); }
      }
      disconnect() {
        super.disconnect();
        const m = meta.get(this);
        if (m) { m.targets.clear(); m.last = new WeakMap(); }
      }
    }
    Object.defineProperty(ReelPilotIntersectionObserver, 'name', { value: 'IntersectionObserver' });
    window.IntersectionObserver = ReelPilotIntersectionObserver;
  }

  const parseMargin = (str, w, h) => {
    // CSS shorthand: 1–4 values (top, right = top, bottom = top, left = right).
    const [t, r = t, b = t, l = r] = String(str || '0px').trim().split(/\s+/);
    const val = (tok, base) => (tok.endsWith('%') ? (parseFloat(tok) / 100) * base : parseFloat(tok) || 0);
    return { top: val(t, h), right: val(r, w), bottom: val(b, h), left: val(l, w) };
  };

  const EntryProto = window.IntersectionObserverEntry ? window.IntersectionObserverEntry.prototype : Object.prototype;
  const rect = (x, y, w, h) => (window.DOMRectReadOnly ? new DOMRectReadOnly(x, y, w, h) : { x, y, width: w, height: h, top: y, left: x, right: x + w, bottom: y + h });
  const makeEntry = (fields) => {
    const props = {};
    for (const k of Object.keys(fields)) props[k] = { value: fields[k], enumerable: true };
    return Object.create(EntryProto, props);
  };

  function computeIntersection(target, root, rootBox, clipCache) {
    const none = { isect: false, ratio: 0, box: rect(0, 0, 0, 0), inter: null };
    if (!target || !target.isConnected || target.getClientRects().length === 0) return none;
    const b = target.getBoundingClientRect();
    let l = b.left; let t = b.top; let r = b.right; let btm = b.bottom;

    for (let el = target.parentElement; el && el !== root && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      let clip = clipCache.get(el);
      if (clip === undefined) {
        const cs = getComputedStyle(el);
        clip = cs.overflowX !== 'visible' || cs.overflowY !== 'visible' ? el.getBoundingClientRect() : null;
        clipCache.set(el, clip);
      }
      if (clip) {
        l = Math.max(l, clip.left); t = Math.max(t, clip.top);
        r = Math.min(r, clip.right); btm = Math.min(btm, clip.bottom);
        if (l > r || t > btm) return Object.assign({}, none, { box: b });
      }
    }
    l = Math.max(l, rootBox.left); t = Math.max(t, rootBox.top);
    r = Math.min(r, rootBox.right); btm = Math.min(btm, rootBox.bottom);
    const isect = l <= r && t <= btm;
    const area = b.width * b.height;
    const interArea = isect ? (r - l) * (btm - t) : 0;
    const ratio = area > 0 ? Math.min(1, interArea / area) : isect ? 1 : 0;
    return { isect, ratio, box: b, inter: isect ? rect(l, t, r - l, btm - t) : null };
  }

  function tick() {
    if (!active() || !reallyHidden()) return 0;
    const de = document.documentElement;
    const vw = de.clientWidth || window.innerWidth;
    const vh = de.clientHeight || window.innerHeight;
    const clipCache = new Map();
    let delivered = 0;

    for (const ref of registry) {
      const obs = ref.deref();
      if (!obs) { registry.delete(ref); continue; }
      const m = meta.get(obs);
      if (!m || !m.targets.size) continue;

      const root = obs.root && obs.root.nodeType === 1 ? obs.root : null;
      if (obs.root && obs.root.nodeType === 1 && !obs.root.isConnected) continue;
      const base = root ? root.getBoundingClientRect() : { left: 0, top: 0, right: vw, bottom: vh, width: vw, height: vh };
      const mg = parseMargin(obs.rootMargin, base.width, base.height);
      const rootBox = { left: base.left - mg.left, top: base.top - mg.top, right: base.right + mg.right, bottom: base.bottom + mg.bottom };

      const entries = [];
      for (const target of m.targets) {
        const res = computeIntersection(target, root, rootBox, clipCache);
        const idx = thresholdIndex(res.ratio, res.isect, m.thresholds);
        const prev = m.last.get(target);
        if (prev && prev.idx === idx && prev.isect === res.isect) continue;
        m.last.set(target, { idx, isect: res.isect });
        entries.push(makeEntry({
          time: performance.now(),
          target,
          rootBounds: rect(rootBox.left, rootBox.top, rootBox.right - rootBox.left, rootBox.bottom - rootBox.top),
          boundingClientRect: rect(res.box.left || 0, res.box.top || 0, res.box.width || 0, res.box.height || 0),
          intersectionRect: res.inter || rect(0, 0, 0, 0),
          isIntersecting: res.isect,
          intersectionRatio: res.ratio,
          isVisible: false,
        }));
      }
      if (entries.length) {
        delivered += entries.length;
        try { m.callback.call(obs, entries, obs); } catch (err) { setTimeout(() => { throw err; }); }
      }
    }
    return delivered;
  }

  setInterval(() => { if (active() && reallyHidden()) tick(); }, 1000);

  // ── 3. requestAnimationFrame fallback while hidden ─────────
  const nativeRAF = window.requestAnimationFrame;
  const nativeCAF = window.cancelAnimationFrame;
  if (typeof nativeRAF === 'function') {
    const timers = new Map();
    let seq = 0x40000000;
    window.requestAnimationFrame = function requestAnimationFrame(cb) {
      if (active() && reallyHidden() && typeof cb === 'function') {
        const id = ++seq;
        timers.set(id, setTimeout(() => { timers.delete(id); cb(performance.now()); }, 16));
        return id;
      }
      return nativeRAF.call(window, cb);
    };
    window.cancelAnimationFrame = function cancelAnimationFrame(id) {
      const t = timers.get(id);
      if (t !== undefined) { clearTimeout(t); timers.delete(id); return; }
      return nativeCAF.call(window, id);
    };
  }

  // ── Bridge to the content script ──────────────────────────
  document.addEventListener('reelpilot:config', (e) => {
    try {
      const cfg = JSON.parse(e.detail || '{}');
      if (typeof cfg.background === 'boolean') state.background = cfg.background;
    } catch (_) { /* ignore malformed config */ }
  });
  document.addEventListener('reelpilot:tick', () => { tick(); });
  document.addEventListener('reelpilot:ping', () => {
    document.dispatchEvent(new CustomEvent('reelpilot:pong'));
  });
})();
