/* ReelPilot — playback engine.
 *
 * Finds the reel on screen, counts its plays, advances to the next reel, applies speed/volume and
 * keeps playback alive while the tab is in the background. It relies on the <video> elements and
 * page geometry rather than Instagram's class names, which change all the time.
 */
(() => {
  'use strict';
  const RP = (globalThis.ReelPilot = globalThis.ReelPilot || {});

  const MIN_W = 120;
  const MIN_H = 160;
  const VIDEO_EVENTS = ['timeupdate', 'seeking', 'ended', 'play', 'playing', 'pause', 'volumechange', 'emptied', 'loadedmetadata'];

  const RESERVED = new Set([
    'explore', 'reels', 'reel', 'direct', 'accounts', 'p', 'stories', 'about', 'legal', 'developer', 'web',
    'emails', 'challenge', 'session', 'privacy', 'terms', 'tv', 'nametag', 'directory', 'your_activity',
    'notifications', 'create', 'lite', 'api', 'graphql', 'ar', 'threads', 'saved', 'meta', 'help',
  ]);
  // Exact text of the label Instagram puts on ads ("Sponsored", or just "Ad" on reels), per language.
  const SPONSORED = new Set([
    'sponsored', 'ad', 'ads', 'sponsorisé', 'sponsorisée', 'publicité', 'patrocinado', 'patrocinada',
    'publicidad', 'anuncio', 'publicidade', 'gesponsert', 'werbung', 'anzeige', 'sponsorizzato', 'pubblicità',
    'gesponsord', 'advertentie', 'sponsorowane', 'reklama', 'реклама', 'sponsorlu', 'reklam', 'sponsrad',
    'annons', 'sponset', 'annonse', 'sponsoreret', 'annonce', 'sponsoroitu', 'mainos', 'bersponsor', 'iklan',
    'disponsori', 'được tài trợ', 'quảng cáo', 'ได้รับการสนับสนุน', 'โฆษณา', '広告', '광고', '赞助内容', '广告',
    '贊助', '廣告', 'प्रायोजित', 'विज्ञापन', 'ممول', 'مُموَّل', 'إعلان', 'إعلان ممول', 'ממומן', 'מודעה',
    'χορηγούμενη', 'διαφήμιση',
  ]);
  const IMAGE_SECONDS = 5; // how long an image reel/ad stays up in "When it ends" mode

  // ── Geometry helpers ──────────────────────────────────────
  const sizeOk = (r) => r.width >= MIN_W && r.height >= MIN_H;

  const visibleRatioOf = (r, vw = window.innerWidth, vh = window.innerHeight) => {
    const area = r.width * r.height;
    if (area <= 0) return 0;
    const w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    return (w * h) / area;
  };
  const visibleRatio = (el) => visibleRatioOf(el.getBoundingClientRect());

  /** The reel that is on screen right now (playing + most visible wins). */
  function findCurrentVideo(prefer = null, exclude = null) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let best = null;
    let bestScore = 0;
    for (const v of document.querySelectorAll('video')) {
      if (v === exclude || !v.isConnected) continue;
      const r = v.getBoundingClientRect();
      if (!sizeOk(r)) continue;
      const ratio = visibleRatioOf(r, vw, vh);
      if (ratio < 0.35) continue;
      let score = ratio;
      if (!v.paused && !v.ended) score += 0.5;
      if (v === prefer) score += 0.08;
      if (score > bestScore) { bestScore = score; best = v; }
    }
    return best;
  }

  /**
   * The feed "slot" holding a reel: the ancestor whose siblings are other reels stacked vertically.
   * Works even when the next slot is still a placeholder, or holds an image (photo reels, image ads).
   * Passing a slot returns that slot.
   */
  function findSlot(start, refHeight) {
    const vh = refHeight || start.getBoundingClientRect().height;
    let el = start;
    for (let depth = 0; el && depth < 25; depth++) {
      const parent = el.parentElement;
      if (!parent || parent === document.body || parent === document.documentElement) return null;
      if (parent.childElementCount >= 2) {
        const r = el.getBoundingClientRect();
        if (r.height >= vh * 0.8) {
          for (const sib of parent.children) {
            if (sib === el) continue;
            const sr = sib.getBoundingClientRect();
            if (sr.height >= r.height * 0.5 && Math.abs(sr.top - r.top) >= r.height * 0.5) return el;
          }
        }
      }
      el = parent;
    }
    return null;
  }

  function siblingSlot(slot, dir) {
    const r = slot.getBoundingClientRect();
    let s = dir > 0 ? slot.nextElementSibling : slot.previousElementSibling;
    while (s) {
      const sr = s.getBoundingClientRect();
      const stacked = dir > 0 ? sr.top > r.top + r.height * 0.5 : sr.top < r.top - r.height * 0.5;
      if (sr.height >= r.height * 0.5 && stacked) return s;
      s = dir > 0 ? s.nextElementSibling : s.previousElementSibling;
    }
    return null;
  }

  /** Largest element matching `selector` inside `el` (at least `min` px on each side). */
  function largest(el, selector, min = 0) {
    let best = null;
    let bestArea = 0;
    for (const m of el.querySelectorAll(selector)) {
      const r = m.getBoundingClientRect();
      const area = r.width * r.height;
      if (r.width >= min && r.height >= min && area > bestArea) { bestArea = area; best = m; }
    }
    return best;
  }
  const videoIn = (el) => largest(el, 'video');

  /**
   * The feed slot on screen when no reel-sized video is (image reels, image ads).
   * Uses the feed learned from earlier video reels, or probes the middle of the screen.
   */
  function findVisibleSlot(feed) {
    if (feed && feed.isConnected) {
      let best = null;
      let bestRatio = 0.5;
      for (const child of feed.children) {
        const r = child.getBoundingClientRect();
        if (r.height < MIN_H) continue;
        const ratio = visibleRatioOf(r);
        if (ratio > bestRatio) { bestRatio = ratio; best = child; }
      }
      if (best) return best;
    }
    const probes = document.elementsFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    for (const el of probes) {
      if (el.id === 'reelpilot-overlay' || el === document.body || el === document.documentElement) continue;
      const slot = findSlot(el, window.innerHeight * 0.5);
      if (slot) return slot;
    }
    return null;
  }

  /** Closest reel-sized video above/below `from`, by layout position. */
  function neighborVideo(from, dir) {
    const fr = from.getBoundingClientRect();
    let best = null;
    let bestDist = Infinity;
    for (const v of document.querySelectorAll('video')) {
      if (v === from || !v.isConnected) continue;
      const r = v.getBoundingClientRect();
      if (!sizeOk(r)) continue;
      const dist = (r.top - fr.top) * dir;
      if (dist > fr.height * 0.3 && dist < bestDist) { bestDist = dist; best = v; }
    }
    return best;
  }

  function scrollerOf(el) {
    for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      if (p.scrollHeight > p.clientHeight + 4) {
        const oy = getComputedStyle(p).overflowY;
        if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') return p;
      }
    }
    return document.scrollingElement || document.documentElement;
  }

  /** Largest ancestor that still belongs to this reel only (caption, author, labels…). */
  function itemOf(video) {
    const vh = video.getBoundingClientRect().height;
    let el = video;
    for (let i = 0; i < 30; i++) {
      const p = el.parentElement;
      if (!p || p === document.body || p === document.documentElement) break;
      if (p.getBoundingClientRect().height > Math.max(vh * 1.6, vh + 240)) break;
      if (p.querySelectorAll('video').length > 1) break;
      el = p;
    }
    return el;
  }

  function profileFromHref(href) {
    if (!href) return '';
    let path = href;
    if (/^https?:/i.test(href)) {
      try {
        const u = new URL(href);
        if (!/(^|\.)instagram\.com$/i.test(u.hostname)) return '';
        path = u.pathname;
      } catch (_) { return ''; }
    }
    const m = path.match(/^\/([A-Za-z0-9._]{1,30})\/?(?:reels\/?)?$/);
    if (!m || RESERVED.has(m[1].toLowerCase())) return '';
    return m[1];
  }

  function hasSponsoredLabel(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    let n = 0;
    while ((node = walker.nextNode()) && n++ < 800) {
      const txt = node.nodeValue;
      if (txt && txt.length <= 32 && SPONSORED.has(txt.trim().toLowerCase())) return true;
    }
    return false;
  }

  /** Author and ad label of a reel. `item` is its feed slot (or the reel's own container). */
  function readMeta(item) {
    let author = '';
    let fallback = '';
    for (const a of item.querySelectorAll('a[href]')) {
      const user = profileFromHref(a.getAttribute('href'));
      if (!user) continue;
      const text = (a.textContent || '').trim().replace(/^@/, '');
      if (text.toLowerCase() === user.toLowerCase()) { author = user; break; }
      if (!fallback && !text) fallback = user; // avatar link
    }
    const name = author || fallback;
    return { author: name ? `@${name}` : '', sponsored: hasSponsoredLabel(item) };
  }

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  const once = (target, type, timeout) => new Promise((resolve) => {
    const done = () => { clearTimeout(timer); target.removeEventListener(type, done); resolve(); };
    const timer = setTimeout(done, timeout);
    target.addEventListener(type, done, { once: true });
  });

  // Sites can opt videos out of PiP; the user explicitly asked for it, so opt back in.
  const allowPip = (v) => {
    try {
      v.disablePictureInPicture = false;
      v.removeAttribute('disablepictureinpicture');
    } catch (_) { /* ignore */ }
  };

  // ── Engine ────────────────────────────────────────────────
  class ReelEngine {
    /**
     * @param {object} opts
     * @param {(ms:number)=>Promise<void>} [opts.sleep] timer that keeps working in background tabs
     */
    constructor({ sleep } = {}) {
      this.sleep = sleep || delay;
      this.settings = RP.normalizeSettings();
      this.handlers = new Map();

      this.enabled = false;
      this.auto = false;
      this.video = null;         // current reel's <video> (null for image reels / image ads)
      this.item = null;          // current reel's feed slot
      this.feed = null;          // the feed list (parent of the slots), learned from video reels
      this.itemSince = 0;        // when an image item became current (it has no clock of its own)
      this.pendingDir = 0;       // a next/prev press that arrived mid-transition
      this.lastAudio = null;     // { volume, muted } of the last video, for carrying sound across images
      this.anchorCache = { item: null, el: null };
      this.meta = { author: '', sponsored: false };
      this.loopsDone = 0;
      this.playedSec = 0;
      this.lastTime = 0;
      this.seen = 0;
      this.watchSec = 0;
      this.sessionStart = Date.now();
      this.busy = false;
      this.wantPaused = false;   // the user asked for pause — never auto-resume
      this.keepPlaying = false;  // the current reel was playing; resume it if something else pauses it
      this.retryAt = 0;
      this.lastDir = 1;
      this.hbLast = -1;
      this.hbStall = 0;
      this.resumeLog = [];
      this.skipped = new WeakSet();
      this.hooksReady = false;
      this.destroyed = false;
      this.scanTimer = 0;
      this.lastToast = { text: '', at: 0 };
      this.pipWanted = false;    // keep Picture-in-Picture on, following each new reel

      this.onVideoEvent = this.onVideoEvent.bind(this);
      this.onDocPlay = this.onDocPlay.bind(this);
      this.onDocScroll = this.onDocScroll.bind(this);
      this.onPipEvent = this.onPipEvent.bind(this);
      document.addEventListener('play', this.onDocPlay, true);
      document.addEventListener('scroll', this.onDocScroll, { capture: true, passive: true });
      document.addEventListener('enterpictureinpicture', this.onPipEvent, true);
      document.addEventListener('leavepictureinpicture', this.onPipEvent, true);
      this.loop();
    }

    // ── Events ──
    on(type, fn) {
      if (!this.handlers.has(type)) this.handlers.set(type, new Set());
      this.handlers.get(type).add(fn);
      return () => this.handlers.get(type).delete(fn);
    }
    emit(type, data) {
      const set = this.handlers.get(type);
      if (!set) return;
      for (const fn of set) {
        try { fn(data); } catch (err) { console.error('[ReelPilot]', err); }
      }
    }
    toast(text, tone = 'info', icon) {
      const now = Date.now();
      if (this.lastToast.text === text && now - this.lastToast.at < 2500) return;
      this.lastToast = { text, at: now };
      this.emit('toast', { text, tone, icon });
    }

    // ── Public API ──
    setSettings(settings) {
      const autoPipChanged = !this.settings || this.settings.autoPip !== settings.autoPip;
      this.settings = RP.normalizeSettings(settings);
      if (this.video) this.applyPlayback(this.video);
      if (autoPipChanged) this.updateMediaSession();
      this.emit('change');
    }

    setEnabled(on) {
      on = !!on;
      if (on === this.enabled) return;
      this.enabled = on;
      if (!on) {
        this.auto = false;
        this.detachVideo();
        this.item = null;
      } else {
        this.scan();
      }
      this.updateMediaSession();
      this.emit('change');
    }

    setAuto(on) {
      on = !!on && this.enabled;
      if (on === this.auto) return;
      this.auto = on;
      if (on) {
        this.loopsDone = 0;
        this.playedSec = 0;
        this.retryAt = 0;
        const onImage = !this.video && this.item && this.item.isConnected;
        const v = this.video || (onImage ? null : findCurrentVideo());
        if (v && v !== this.video) this.attach(v);
        if (v) {
          this.lastTime = v.currentTime;
          if (v.paused) { this.wantPaused = false; this.keepPlaying = true; this.tryPlay(v); }
        } else if (onImage) {
          this.wantPaused = false;
          this.itemSince = Date.now();
        }
        this.toast('Auto-scroll on', 'ok', 'zap');
      } else {
        this.toast('Auto-scroll off');
      }
      this.updateMediaSession();
      this.emit('change');
    }

    togglePlay() {
      if (!this.video && this.item && this.item.isConnected) {
        // Image reel: "pause" holds it on screen; "play" restarts its countdown.
        this.wantPaused = !this.wantPaused;
        if (!this.wantPaused) this.itemSince = Date.now();
        this.emit('change');
        return;
      }
      const v = (this.video && this.video.isConnected && this.video) || findCurrentVideo();
      if (!v) { this.toast('No reel on screen', 'warn', 'alert'); return; }
      if (v !== this.video) this.attach(v);
      if (v.paused || v.ended) {
        this.wantPaused = false;
        this.keepPlaying = true;
        this.tryPlay(v);
      } else {
        this.wantPaused = true;
        this.keepPlaying = false;
        v.pause();
      }
      this.emit('change');
    }

    // ── Picture-in-Picture ──
    /** Toggle PiP for the current reel. Entering needs a click on the page (Chrome rule). */
    async togglePip() {
      if (document.pictureInPictureElement) {
        this.pipWanted = false;
        await document.exitPictureInPicture().catch(() => {});
        this.emit('change');
        return { ok: true };
      }
      const v = (this.video && this.video.isConnected && this.video) || findCurrentVideo();
      if (!v) {
        this.toast(this.item ? 'Picture-in-Picture works on video reels, not images' : 'No reel on screen', 'warn', 'alert');
        return { ok: false, error: 'novideo' };
      }
      if (v !== this.video) this.attach(v);
      return this.enterPip(v, true);
    }

    async enterPip(v, userInitiated) {
      if (!document.pictureInPictureEnabled) {
        if (userInitiated) this.toast('Picture-in-Picture is turned off in this browser', 'warn', 'alert');
        return { ok: false, error: 'unsupported' };
      }
      try {
        allowPip(v);
        if (v.readyState < 1) await once(v, 'loadedmetadata', 4000);
        await v.requestPictureInPicture();
        this.pipWanted = true;
        if (v.paused && !this.wantPaused) this.tryPlay(v);
        this.emit('change');
        return { ok: true };
      } catch (err) {
        const blocked = err && err.name === 'NotAllowedError';
        if (userInitiated) {
          this.toast(blocked ? 'Click the PiP button on the Instagram page to start Picture-in-Picture' : 'This reel can’t open in Picture-in-Picture', 'warn', 'alert');
        }
        return { ok: false, error: blocked ? 'activation' : 'failed' };
      }
    }

    /** While PiP is open, move it to the new reel (no click needed once PiP is already showing). */
    followPip(v) {
      const move = () => {
        if (this.video !== v || !this.pipWanted || !document.pictureInPictureElement || document.pictureInPictureElement === v) return;
        allowPip(v);
        v.requestPictureInPicture().catch(() => {});
      };
      if (v.readyState >= 1) move();
      else v.addEventListener('loadedmetadata', move, { once: true });
    }

    onPipEvent(e) {
      if (e.type === 'enterpictureinpicture') {
        this.pipWanted = true;
      } else {
        // Switching reels also fires "leave" on the old one — only a real close leaves nothing in PiP.
        setTimeout(() => {
          if (!document.pictureInPictureElement) this.pipWanted = false;
          this.emit('change');
        }, 400);
      }
      this.emit('change');
    }

    seek(fraction) {
      const v = this.video;
      if (!v || !(v.duration > 0) || !Number.isFinite(v.duration)) return;
      const t = RP.clamp(fraction, 0, 1) * v.duration;
      this.lastTime = t;
      v.currentTime = Math.min(t, v.duration - 0.05);
      this.emit('progress');
    }

    getState() {
      const v = this.video;
      const s = this.settings;
      const image = !v && !!this.item && this.item.isConnected;
      let d = v && Number.isFinite(v.duration) ? v.duration : 0;
      let t = v ? v.currentTime || 0 : 0;
      let untilNext = this.untilNext(v, t, d);
      let autoProgress = this.autoProgress(t, d);
      if (image) {
        // Image reels have no clock: show the time on screen against their dwell time.
        d = this.itemDwell();
        t = this.wantPaused ? 0 : Math.min(d, (Date.now() - this.itemSince) / 1000);
        untilNext = this.auto ? Math.max(0, d - t) : null;
        autoProgress = RP.clamp(t / d, 0, 1);
      }
      return {
        enabled: this.enabled,
        hasVideo: !!v || image,   // "a reel is on screen" (video or image)
        kind: v ? 'video' : image ? 'image' : null,
        auto: this.auto,
        playing: v ? !v.paused && !v.ended : image && !this.wantPaused,
        busy: this.busy,
        time: t,
        duration: d,
        loopsDone: this.loopsDone,
        playedSec: this.playedSec,
        untilNext,
        autoProgress,
        author: this.meta.author,
        sponsored: this.meta.sponsored,
        reelNumber: this.seen,
        watchSec: this.watchSec,
        sessionStart: this.sessionStart,
        muted: v ? v.muted : s.muted,
        volume: v ? v.volume : s.volume,
        speed: v ? v.playbackRate : s.speed,
        hidden: document.hidden,
        hooks: this.hooksReady,
        pip: !!document.pictureInPictureElement,
        pipSupported: !!document.pictureInPictureEnabled,
      };
    }

    destroy() {
      this.destroyed = true;
      this.detachVideo();
      clearTimeout(this.scanTimer);
      document.removeEventListener('play', this.onDocPlay, true);
      document.removeEventListener('scroll', this.onDocScroll, { capture: true });
      document.removeEventListener('enterpictureinpicture', this.onPipEvent, true);
      document.removeEventListener('leavepictureinpicture', this.onPipEvent, true);
      for (const action of ['nexttrack', 'previoustrack', 'enterpictureinpicture']) {
        try { navigator.mediaSession.setActionHandler(action, null); } catch (_) { /* not supported */ }
      }
      this.handlers.clear();
    }

    // ── Navigation ──
    async go(dir = 1, reason = 'manual') {
      if (!this.enabled || this.destroyed) return false;
      if (this.busy) {
        // Mid-transition: remember a user's press and run it right after.
        if (reason === 'manual' || reason === 'media') this.pendingDir = dir;
        return false;
      }
      const from = (this.video && this.video.isConnected && this.video)
        || (this.item && this.item.isConnected && this.item)
        || findCurrentVideo() || findVisibleSlot(this.feed);
      if (!from) { this.toast('No reel on screen', 'warn', 'alert'); return false; }
      const fromVideo = from instanceof HTMLVideoElement ? from : null;

      this.busy = true;
      this.lastDir = dir;
      this.wantPaused = false;
      this.keepPlaying = true;
      const hidden = document.hidden;
      this.emit('change');

      try {
        // Hidden: silence the old reel right away so it can't loop back audibly while we switch.
        // (`busy` keeps this from being treated as a user pause.)
        if (hidden && fromVideo) fromVideo.pause();
        const target = await this.scrollToNeighbor(from, dir, hidden);
        if (this.destroyed) return false;
        if (!target) {
          if (hidden && fromVideo) this.tryPlay(fromVideo);
          this.toast(dir > 0 ? 'No more reels loaded yet' : 'Already at the first reel', 'warn', 'alert');
          return false;
        }
        if (!(target instanceof HTMLVideoElement)) {
          // Image reel or image ad.
          if (fromVideo && !fromVideo.paused) fromVideo.pause();
          this.attachItem(target);
          this.emit('advance', { dir, reason });
          return true;
        }
        const audio = fromVideo ? { volume: fromVideo.volume, muted: fromVideo.muted } : this.lastAudio;
        if (hidden && audio && !this.settings.audioManaged) {
          // Instagram can't see the switch while hidden — carry the audio state over ourselves.
          try { target.volume = audio.volume; target.muted = audio.muted; } catch (_) { /* ignore */ }
        }
        this.attach(target);
        this.emit('advance', { dir, reason });
        await this.ensurePlaying(target, hidden);
        if (fromVideo && fromVideo !== target && !fromVideo.paused) fromVideo.pause();
        return true;
      } catch (err) {
        console.error('[ReelPilot] advance failed', err);
        return false;
      } finally {
        this.busy = false;
        this.emit('change');
        // Labels are read while busy, when skipping is suppressed — act on them now.
        if (this.meta.sponsored) this.refreshMeta();
        if (this.pendingDir) {
          const next = this.pendingDir;
          this.pendingDir = 0;
          setTimeout(() => this.go(next, 'manual'), 0);
        }
      }
    }

    /** Scroll to the neighbouring reel. Resolves to its <video>, its slot (image reel), or null. */
    async scrollToNeighbor(from, dir, hidden) {
      const behavior = !hidden && this.settings.smooth ? 'smooth' : 'instant';
      const slot = findSlot(from);
      const targetSlot = slot ? siblingSlot(slot, dir) : null;
      let target = targetSlot ? videoIn(targetSlot) : neighborVideo(from, dir);
      const scroller = scrollerOf(from);
      const started = Date.now();
      const imageGrace = hidden ? 2500 : 1000; // a slot without a video by then is an image reel

      const anchor = targetSlot || (target && (findSlot(target) || target));
      if (anchor) {
        anchor.scrollIntoView({ block: 'center', inline: 'nearest', behavior });
      } else {
        const h = (slot || from).getBoundingClientRect().height || window.innerHeight * 0.9;
        scroller.scrollBy({ top: dir * Math.max(200, h), behavior });
      }
      if (hidden) this.pokeScroll(scroller);

      const deadline = Date.now() + (hidden ? 7000 : 2800);
      while (Date.now() < deadline) {
        await this.sleep(hidden ? 300 : 120);
        if (this.destroyed) return null;
        if (hidden) this.pokeScroll(scroller);
        if (!target && targetSlot) target = videoIn(targetSlot);
        if (!target && !targetSlot) target = findCurrentVideo(null, from);
        if (target && target !== from && visibleRatio(target) >= 0.5) return target;
        if (!target && targetSlot && Date.now() - started >= imageGrace && visibleRatio(targetSlot) >= 0.5) {
          return targetSlot;
        }
      }
      if (target && target !== from && visibleRatio(target) >= 0.3) return target;
      return !target && targetSlot && visibleRatio(targetSlot) >= 0.3 ? targetSlot : null;
    }

    async ensurePlaying(v, hidden) {
      const tries = hidden ? 14 : 10;
      for (let i = 0; i < tries; i++) {
        if (this.destroyed || this.video !== v || this.wantPaused) return;
        if (!v.paused && v.readyState >= 2) return;
        // When visible, give Instagram's own autoplay the first shot.
        if (hidden || i > 0) this.tryPlay(v);
        if (hidden) this.pokeIO();
        await this.sleep(hidden ? 350 : 250);
      }
    }

    tryPlay(v) {
      let p;
      try { p = v.play(); } catch (_) { return; }
      if (p && typeof p.catch === 'function') {
        p.catch((err) => {
          if (err && err.name === 'NotAllowedError' && !v.muted) {
            v.muted = true;
            this.toast('Chrome blocked sound — playing muted. Click the page once to allow audio.', 'warn', 'alert');
            v.play().catch(() => {});
          }
        });
      }
    }

    pokeIO() {
      document.dispatchEvent(new CustomEvent('reelpilot:tick'));
    }

    pokeScroll(scroller) {
      try {
        const target = scroller === document.scrollingElement || scroller === document.documentElement ? window : scroller;
        target.dispatchEvent(new Event('scroll'));
      } catch (_) { /* ignore */ }
      this.pokeIO();
    }

    // ── Current reel tracking ──
    attach(v) {
      if (this.video === v) return;
      const sameItem = !this.video && this.item && this.item.contains(v); // image slot got its video
      this.detachVideo();
      this.video = v;
      this.item = findSlot(v);
      if (this.item && this.item.parentElement) this.feed = this.item.parentElement;
      for (const t of VIDEO_EVENTS) v.addEventListener(t, this.onVideoEvent);
      if (sameItem) this.seen--; // same reel, not a new one
      this.resetCounters();
      this.seen++;
      if (!v.paused) { this.wantPaused = false; this.keepPlaying = true; }
      this.applyPlayback(v);
      this.meta = { author: '', sponsored: false };
      this.refreshMeta();
      setTimeout(() => { if (this.video === v) this.refreshMeta(); }, 900);
      setTimeout(() => { if (this.video === v) this.refreshMeta(); }, 2500);
      if (this.pipWanted && document.pictureInPictureElement && document.pictureInPictureElement !== v) this.followPip(v);
      this.updateMediaSession();
      this.emit('change');
    }

    /** Make an image reel / image ad (a feed slot without a video) the current reel. */
    attachItem(slot) {
      if (!this.video && this.item === slot) return;
      this.detachVideo();
      this.item = slot;
      if (slot.parentElement) this.feed = slot.parentElement;
      this.itemSince = Date.now();
      this.resetCounters();
      this.seen++;
      this.meta = { author: '', sponsored: false };
      this.refreshMeta();
      setTimeout(() => { if (this.item === slot && !this.video) this.refreshMeta(); }, 900);
      this.updateMediaSession();
      this.emit('change');
    }

    detachVideo() {
      const v = this.video;
      if (!v) return;
      for (const t of VIDEO_EVENTS) v.removeEventListener(t, this.onVideoEvent);
      this.lastAudio = { volume: v.volume, muted: v.muted };
      this.video = null;
    }

    /** The page removed the current <video>; keep its slot as the current reel until it's replaced. */
    dropVideo() {
      this.detachVideo();
      this.itemSince = Date.now();
      this.emit('change');
    }

    /** Element to pin the on-reel controls to: the video, or the image of an image reel. */
    anchor() {
      if (this.video) return this.video;
      const item = this.item;
      if (!item || !item.isConnected) return null;
      const cache = this.anchorCache;
      if (cache.item !== item || !cache.el || !cache.el.isConnected) {
        cache.item = item;
        cache.el = largest(item, 'img, video, canvas', 120) || item;
      }
      return cache.el;
    }

    itemDwell() {
      return this.settings.mode === 'timer' ? this.settings.timerSec : IMAGE_SECONDS;
    }

    /** Image reels have no "ended" event: advance once their dwell time is up. */
    checkItemAuto() {
      if (!this.auto || this.busy || this.video || !this.item || this.wantPaused) return;
      if (Date.now() < this.retryAt || Date.now() - this.itemSince < this.itemDwell() * 1000) return;
      this.go(1, 'auto').then((ok) => { if (!ok) this.retryAt = Date.now() + 4000; });
    }

    resetCounters() {
      this.loopsDone = 0;
      this.playedSec = 0;
      this.lastTime = this.video ? this.video.currentTime || 0 : 0;
      this.hbLast = -1;
      this.hbStall = 0;
      this.retryAt = 0;
    }

    refreshMeta() {
      const cur = this.video || this.item;
      if (!cur || !cur.isConnected) return;
      // The slot holds the whole reel (caption, author, "Ad" label); fall back to the video's container.
      const root = this.item && this.item.isConnected ? this.item : itemOf(this.video);
      const m = readMeta(root);
      const changed = m.author !== this.meta.author || m.sponsored !== this.meta.sponsored;
      if (m.author || !this.meta.author) this.meta.author = m.author;
      this.meta.sponsored = m.sponsored;
      if (changed) {
        this.updateMediaSession();
        this.emit('change');
      }
      if (m.sponsored && this.auto && this.settings.skipSponsored && !this.busy && !this.skipped.has(cur)) {
        this.skipped.add(cur);
        this.toast('Skipped a sponsored reel', 'info', 'skip');
        this.go(this.lastDir || 1, 'sponsored');
      }
    }

    applyPlayback(v) {
      const s = this.settings;
      try {
        if (Math.abs(v.playbackRate - s.speed) > 0.001) v.playbackRate = s.speed;
        if ('preservesPitch' in v) v.preservesPitch = true;
        if (s.audioManaged) {
          if (Math.abs(v.volume - s.volume) > 0.001) v.volume = s.volume;
          if (v.muted !== s.muted) v.muted = s.muted;
        }
      } catch (_) { /* element may be mid-teardown */ }
    }

    scan() {
      if (!this.enabled || this.busy || this.destroyed) return;
      if (this.video && !this.video.isConnected) this.dropVideo();
      const best = findCurrentVideo(this.video);
      if (best) {
        if (best !== this.video) this.attach(best);
      } else {
        // No reel-sized video on screen: an image reel or image ad?
        const slot = findVisibleSlot(this.feed);
        if (slot && slot !== this.item) {
          this.attachItem(slot);
        } else if (!slot && (this.video || this.item) && !(this.video && visibleRatio(this.video) >= 0.05)) {
          this.detachVideo();
          this.item = null;
          this.emit('change');
        }
      }
      this.checkItemAuto();
    }

    onDocPlay(e) {
      if (!this.enabled || this.busy || document.hidden) return;
      if (!(e.target instanceof HTMLVideoElement) || e.target === this.video) return;
      this.scheduleScan(60);
    }

    onDocScroll() {
      if (!this.enabled || this.busy || document.hidden) return;
      this.scheduleScan(180);
    }

    scheduleScan(ms) {
      clearTimeout(this.scanTimer);
      this.scanTimer = setTimeout(() => this.scan(), ms);
    }

    async loop() {
      while (!this.destroyed) {
        const hidden = document.hidden;
        const active = hidden && this.enabled && (this.auto || (this.video && !this.video.paused) || this.keepPlaying);
        await (active ? this.sleep(1000) : delay(hidden ? 1000 : 400));
        if (this.destroyed) break;
        try {
          if (document.hidden) this.heartbeat();
          else this.scan();
        } catch (err) {
          console.error('[ReelPilot]', err);
        }
      }
    }

    /** Background watchdog: keeps the reel playing and unsticks the feed. */
    heartbeat() {
      if (!this.enabled || this.busy) return;
      if (this.video && !this.video.isConnected) this.dropVideo();
      let v = this.video;
      if (!v) {
        // Image reel on screen? Upgrade it if its video showed up, otherwise run its countdown.
        const slotVideo = this.item && this.item.isConnected ? videoIn(this.item) : null;
        const c = (slotVideo && sizeOk(slotVideo.getBoundingClientRect()) && slotVideo) || findCurrentVideo();
        if (!c) {
          const slot = this.item && this.item.isConnected ? this.item : findVisibleSlot(this.feed);
          if (slot) this.attachItem(slot);
          this.pokeIO();
          this.checkItemAuto();
          return;
        }
        this.attach(c);
        v = c;
      }
      if (!this.settings.background) return;
      this.pokeIO();
      if (this.wantPaused || !(this.keepPlaying || this.auto)) return;

      if (v.ended) {
        if (!this.checkAuto(v) && this.auto) { v.currentTime = 0; this.tryPlay(v); }
        return;
      }
      if (v.paused) { this.tryPlay(v); return; }

      const t = v.currentTime;
      this.hbStall = Math.abs(t - this.hbLast) < 0.01 ? this.hbStall + 1 : 0;
      this.hbLast = t;
      if (this.hbStall === 3) this.tryPlay(v);
      if (this.auto && this.hbStall >= 8) {
        this.hbStall = 0;
        this.toast('Reel stuck loading — skipping', 'warn', 'skip');
        this.go(1, 'stall');
      }
    }

    // ── Video events ──
    onVideoEvent(e) {
      const v = e.currentTarget;
      if (v !== this.video) return;
      switch (e.type) {
        case 'timeupdate': this.onTime(v); return;
        case 'seeking': this.onSeeking(v); return;
        case 'ended': this.onEnded(v); return;
        case 'pause': this.onPause(v); break;
        case 'play':
        case 'playing':
          this.wantPaused = false;
          this.keepPlaying = true;
          this.applyPlayback(v);
          break;
        case 'volumechange': this.onVolume(v); break;
        case 'emptied':
          this.resetCounters();
          setTimeout(() => this.refreshMeta(), 600);
          break;
        case 'loadedmetadata': this.applyPlayback(v); break;
        default: break;
      }
      this.emit('change');
    }

    onTime(v) {
      const t = v.currentTime;
      const d = v.duration;
      if (!(d > 0) || !Number.isFinite(d)) { this.lastTime = t; return; }
      const prev = this.lastTime;
      if (prev > d - 1.5 && t < 1.5 && t < prev - 1) {
        this.countLoop();
      } else {
        const dt = t - prev;
        if (dt > 0 && dt < 1.5 && !v.paused) {
          const real = dt / (v.playbackRate || 1);
          this.playedSec += real;
          this.watchSec += real;
        }
      }
      this.lastTime = t;
      this.emit('progress');
      this.checkAuto(v);
    }

    onSeeking(v) {
      const d = v.duration;
      const t = v.currentTime;
      // A native `loop` restarts by seeking to 0 — that's a completed play, not a user seek.
      if (d > 0 && this.lastTime > d - 1.5 && t < 1.5) {
        this.countLoop();
        this.checkAuto(v);
      } else {
        this.lastTime = t;
      }
    }

    onEnded(v) {
      this.countLoop();
      if (this.checkAuto(v)) return;
      if (this.auto && !v.loop) {
        v.currentTime = 0;
        this.tryPlay(v);
      }
    }

    onPause(v) {
      if (this.busy || v.ended) return;
      if (!document.hidden) {
        // Paused while the user is looking at it: respect that.
        this.wantPaused = true;
        this.keepPlaying = false;
        return;
      }
      if (this.settings.background && !this.wantPaused && (this.keepPlaying || this.auto)) this.resumeSoon(v);
    }

    async resumeSoon(v) {
      const now = Date.now();
      this.resumeLog = this.resumeLog.filter((t) => now - t < 10000);
      if (this.resumeLog.length >= 5) return; // something keeps pausing it — don't fight forever
      this.resumeLog.push(now);
      await this.sleep(250);
      if (this.video === v && v.paused && !this.wantPaused && document.hidden) this.tryPlay(v);
    }

    onVolume(v) {
      const s = this.settings;
      if (!s.audioManaged) return;
      if (Math.abs(v.volume - s.volume) > 0.01 || v.muted !== s.muted) {
        // Changed outside ReelPilot (e.g. Instagram's mute button) — adopt it.
        this.emit('settings', { volume: v.volume, muted: v.muted });
      }
    }

    countLoop() {
      this.loopsDone++;
      this.lastTime = 0;
      this.emit('change');
    }

    /** Advance if the current reel is done. Returns true when an advance was started. */
    checkAuto(v) {
      if (!this.auto || this.busy || v !== this.video || Date.now() < this.retryAt) return false;
      const s = this.settings;
      const d = v.duration;
      const t = v.currentTime;
      let due = false;
      if (s.mode === 'timer') {
        due = this.playedSec >= s.timerSec;
      } else if (this.loopsDone >= s.loops) {
        due = true;
      } else if (this.loopsDone >= s.loops - 1 && Number.isFinite(d) && d > 1.2 && d - t <= 0.3 && !v.paused) {
        due = true; // leave just before the end so the reel doesn't flash back to its start
      }
      if (!due) return false;
      this.go(1, 'auto').then((ok) => { if (!ok) this.retryAt = Date.now() + 4000; });
      return true;
    }

    untilNext(v, t, d) {
      if (!this.auto || !v) return null;
      const s = this.settings;
      if (s.mode === 'timer') return Math.max(0, s.timerSec - this.playedSec);
      if (!(d > 0) || !Number.isFinite(d)) return null;
      const remaining = Math.max(0, (s.loops - this.loopsDone - 1) * d + (d - t));
      return remaining / (v.playbackRate || 1);
    }

    autoProgress(t, d) {
      const s = this.settings;
      if (s.mode === 'timer') return RP.clamp(this.playedSec / s.timerSec, 0, 1);
      if (!(d > 0) || !Number.isFinite(d)) return 0;
      return RP.clamp((this.loopsDone + t / d) / s.loops, 0, 1);
    }

    updateMediaSession() {
      const ms = navigator.mediaSession;
      if (!ms) return;
      try {
        // These also put ⏮ ⏭ buttons in Chrome's Picture-in-Picture window and media controls.
        ms.setActionHandler('nexttrack', () => { this.go(1, 'media'); });
        ms.setActionHandler('previoustrack', () => { this.go(-1, 'media'); });
      } catch (_) { /* media session unsupported */ }
      try {
        // Chrome calls this when you switch tabs while a reel plays (automatic Picture-in-Picture).
        ms.setActionHandler('enterpictureinpicture', this.settings.autoPip && this.enabled
          ? () => { const v = this.video; if (v && !document.pictureInPictureElement) this.enterPip(v, false); }
          : null);
      } catch (_) { /* action not supported by this Chrome version */ }
      try {
        if (typeof MediaMetadata === 'function' && this.video) {
          ms.metadata = new MediaMetadata({
            title: this.meta.author ? `Reel by ${this.meta.author}` : 'Instagram Reel',
            artist: this.auto ? 'ReelPilot · auto-scrolling' : 'ReelPilot',
            album: `Reel #${this.seen}`,
          });
        }
      } catch (_) { /* media session unsupported */ }
    }
  }

  RP.ReelEngine = ReelEngine;
})();
