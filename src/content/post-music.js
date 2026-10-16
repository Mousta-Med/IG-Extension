/* ReelPilot — music on photo posts.
 *
 * In Instagram's app a photo or carousel post can play a song; instagram.com shows it silently.
 * page-music.js (MAIN world) finds each post's song. This module works out which post you are
 * looking at, plays the part of the song the author picked, on a loop, while the post stays on
 * screen, and pins a small "now playing" pill to the photo that mutes / unmutes it.
 */
(() => {
  'use strict';
  const RP = (globalThis.ReelPilot = globalThis.ReelPilot || {});
  const I = RP.ICONS;
  const HOST_ID = 'reelpilot-music';
  const TICK_MS = 250;
  const DWELL_PLAY_MS = 200;         // don't start songs for posts you're only scrolling past
  const DWELL_KNOWN_MS = 250;        // post known to have music: fetch its song almost at once
  const DWELL_PROBE_MS = 900;        // post we know nothing about: only once you've stopped on it
  const RETRY_MS = 5 * 60 * 1000;
  const DEFAULT_CLIP_MS = 30000;
  const FADE_MS = 450;
  const MIN_MEDIA_PX = 150;
  const MIN_VISIBLE = 0.45;          // share of the photo that must be on screen
  const MAX_RECORDS = 1000;
  const POST_PATH_RE = /\/(?:p|tv)\/([A-Za-z0-9_-]{5,})/;
  const POST_LINK_RE = /\/(p|reel|tv)\/([A-Za-z0-9_-]{5,})/;
  const AUDIO_LINK = 'a[href*="/audio/"]';
  // Keep clicks on the pill away from Instagram (a double-click on a photo likes it).
  const CONTAINED_EVENTS = [
    'click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup',
    'touchstart', 'touchend', 'contextmenu', 'keydown', 'keyup',
  ];
  const EQ = '<span class="pm-eq" aria-hidden="true"><i></i><i></i><i></i></span>';

  const MUSIC_CSS = String.raw`
:host { all: initial; }
.pm-pill {
  position: fixed; left: 0; top: 0; display: inline-flex; align-items: center; gap: 8px;
  max-width: 320px; height: 32px; margin: 0; padding: 0 11px 0 5px; border: 0; border-radius: 999px;
  background: rgba(14, 14, 18, .66); color: #fff; cursor: pointer; pointer-events: auto;
  -webkit-backdrop-filter: blur(14px) saturate(160%); backdrop-filter: blur(14px) saturate(160%);
  box-shadow: 0 8px 22px -8px rgba(0, 0, 0, .65), inset 0 0 0 1px rgba(255, 255, 255, .14);
  font: 600 12px/1 var(--rp-font); letter-spacing: .005em; text-align: left;
  will-change: transform; transition: opacity .25s, background .15s;
  animation: pm-in .35s var(--rp-ease);
}
.pm-pill:hover { background: rgba(14, 14, 18, .84); }
.pm-pill:focus { outline: none; }
.pm-pill:focus-visible { outline: 2px solid rgba(255, 255, 255, .9); outline-offset: 2px; }
.pm-pill.off { opacity: 0; pointer-events: none; animation: none; }
.pm-pill.dim .pm-text { opacity: .7; }
.pm-ico {
  width: 22px; height: 22px; border-radius: 50%; flex: none; display: grid; place-items: center;
  background: var(--rp-grad); box-shadow: 0 3px 10px -2px rgba(214, 41, 118, .7);
}
.pm-ico svg { width: 12px; height: 12px; }
.pm-text { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.pm-text b { font-weight: 650; }
.pm-text small { font: inherit; font-weight: 500; color: rgba(255, 255, 255, .72); }
.pm-vol { flex: none; color: rgba(255, 255, 255, .9); }
.pm-vol svg { width: 15px; height: 15px; }
.pm-vol[hidden] { display: none; }
.pm-eq { display: flex; align-items: flex-end; gap: 2px; height: 11px; }
.pm-eq i { width: 2.5px; height: 100%; border-radius: 1px; background: #fff; transform-origin: 50% 100%; transform: scaleY(.45); }
.pm-pill.live .pm-eq i { animation: pm-eq .8s ease-in-out infinite alternate; }
.pm-pill.live .pm-eq i:nth-child(2) { animation-duration: .62s; animation-delay: -.3s; }
.pm-pill.live .pm-eq i:nth-child(3) { animation-duration: .95s; animation-delay: -.55s; }
@keyframes pm-eq { from { transform: scaleY(.3); } to { transform: scaleY(1); } }
@keyframes pm-in { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .pm-pill, .pm-eq i { animation: none !important; } }
`;

  class PostMusic {
    constructor({ onSettings } = {}) {
      this.onSettings = onSettings || (() => {});
      this.settings = RP.normalizeSettings();
      this.enabled = false;
      this.alive = true;
      this.records = new Map();      // shortcode → record from page-music.js
      this.asked = new Map();        // shortcode → when we asked for a lookup
      this.failed = new Set();       // shortcodes whose song wouldn't play
      this.pageHasMusic = false;     // Instagram's own data has shown a song → its "no music" is reliable
      this.target = null;            // the post on screen
      this.current = null;           // the clip loaded into the player
      this.state = 'idle';           // idle · loading · playing · paused · ducked · blocked
      this.renderKey = '';
      this.shown = false;
      this.raf = 0;
      this.fadeTimer = 0;
      this.loopTimer = 0;
      this.unlock = null;

      const a = (this.audio = new Audio());
      a.preload = 'auto';
      a.addEventListener('loadedmetadata', () => this.onMetadata());
      a.addEventListener('timeupdate', () => {
        const c = this.current;
        if (c && a.currentTime >= c.end) a.currentTime = c.start;
      });
      a.addEventListener('seeked', () => this.armLoop());
      a.addEventListener('ended', () => {
        if (!this.current) return;
        a.currentTime = this.current.start;
        this.play();
      });
      a.addEventListener('playing', () => {
        if (!this.current) return;
        this.state = 'playing';
        this.fadeIn();
        this.armLoop();
        this.render();
      });
      a.addEventListener('pause', () => {
        // Paused by someone else (Chrome's media controls, a headset button…): don't fight it.
        if (this.current && this.state === 'playing' && a.paused && !a.ended) {
          this.state = 'paused';
          this.render();
        }
      });
      a.addEventListener('error', () => this.onAudioError());

      this.buildUI();
      this.onMedia = (e) => this.ingest(e.detail);
      document.addEventListener('reelpilot:media', this.onMedia);
      document.dispatchEvent(new CustomEvent('reelpilot:media-sync'));
      this.timer = setInterval(() => this.tick(), TICK_MS);
    }

    // ── Public API ──
    setSettings(settings) {
      this.settings = settings;
      if (!settings.postMusic) this.release();
      else this.sync();
    }

    setEnabled(on) {
      this.enabled = !!on;
      if (!this.enabled) { this.target = null; this.release(); }
    }

    ensureAttached() {
      if (!this.host.isConnected) (document.body || document.documentElement).appendChild(this.host);
    }

    destroy() {
      this.alive = false;
      clearInterval(this.timer);
      this.release();
      this.disarmUnlock();
      document.removeEventListener('reelpilot:media', this.onMedia);
      this.host.remove();
    }

    // ── Data from page-music.js ──
    ingest(detail) {
      let list;
      try { list = JSON.parse(detail || '[]'); } catch (_) { return; }
      if (!Array.isArray(list)) return;
      let touched = false;
      for (const r of list) {
        if (!r || typeof r.code !== 'string' || r.error) continue; // failed lookups retry after RETRY_MS
        if (r.source === 'page' && r.has === true) this.pageHasMusic = true;
        this.records.delete(r.code);
        this.records.set(r.code, r);
        if (this.target && this.target.code === r.code) touched = true;
      }
      while (this.records.size > MAX_RECORDS) this.records.delete(this.records.keys().next().value);
      if (touched) this.tick();
    }

    lookup(code) {
      this.asked.set(code, performance.now());
      document.dispatchEvent(new CustomEvent('reelpilot:media-lookup', { detail: JSON.stringify({ code }) }));
    }

    shouldLookup(t, rec, now) {
      const asked = this.asked.get(t.code);
      if ((asked != null && now - asked < RETRY_MS) || this.failed.has(t.code)) return false;
      const dwell = now - t.since;
      if (rec) {
        if (rec.video || rec.source === 'lookup' || rec.muted) return false;
        if (rec.has === true) return dwell >= DWELL_KNOWN_MS;
        // Trust "no music" from Instagram's data only once that data has shown it carries music at all,
        // and never for carousels: their song is often missing from what the page loads, so ask.
        if (rec.has === false && this.pageHasMusic && !rec.carousel) return t.audioLink && dwell >= DWELL_KNOWN_MS;
      }
      if (t.audioLink) return dwell >= DWELL_KNOWN_MS;
      if (t.isVideo) return false;
      return dwell >= DWELL_PROBE_MS;
    }

    // ── Main loop ──
    tick() {
      if (!this.alive) return;
      const on = this.enabled && this.settings.postMusic && !document.hidden;
      const t = on ? this.findTarget() : null;
      if (!t) { this.target = null; this.release(); return; }

      const now = performance.now();
      if (!this.target || this.target.code !== t.code) {
        this.release();
        t.since = now;
      } else {
        t.since = this.target.since;
      }
      this.target = t;

      const rec = this.records.get(t.code);
      const playable = rec && rec.has && rec.track && !rec.muted && !rec.video && !this.failed.has(rec.code);
      if (playable) {
        if (now - t.since >= DWELL_PLAY_MS) this.load(rec);
      } else if (this.shouldLookup(t, rec, now)) this.lookup(t.code);
      this.sync();
    }

    // ── Finding the post on screen ──
    findTarget() {
      const path = location.pathname;
      if (RP.isReelsPath(path) || /^\/stories\//.test(path)) return null;
      const cache = new Map();

      // A single post: its own page, or the post window opened from the feed / a profile / Explore.
      const m = path.match(POST_PATH_RE);
      if (m) {
        const dialog = RP.postDialog();
        const pick = this.pickMedia(dialog || document.body, true, cache);
        if (!pick) return null;
        const post = dialog || pick.media.closest('article');
        return Object.assign(pick, {
          code: m[1],
          scope: post || document.body,
          audioLink: !!(post && post.querySelector(AUDIO_LINK)),
          covered: false,
        });
      }

      // The feed: the post whose photo has the most area on screen.
      let best = null;
      for (const article of document.querySelectorAll('article')) {
        const b = article.getBoundingClientRect();
        if (b.bottom <= 0 || b.top >= window.innerHeight) continue;
        const pick = this.pickMedia(article, false, cache);
        if (pick && (!best || pick.score > best.score)) best = Object.assign(pick, { scope: article });
      }
      if (!best) return null;
      const link = this.codeIn(best.scope);
      if (!link) return null;
      return Object.assign(best, {
        code: link.code,
        isVideo: best.isVideo || link.kind === 'reel',
        audioLink: !!best.scope.querySelector(AUDIO_LINK),
        covered: !!this.openDialog(),
      });
    }

    /** The shortcode most links in the post point to (its date, comments, likes…). */
    codeIn(scope) {
      const counts = new Map();
      for (const a of scope.querySelectorAll('a[href]')) {
        const m = (a.getAttribute('href') || '').match(POST_LINK_RE);
        if (!m) continue;
        const prev = counts.get(m[2]);
        counts.set(m[2], { code: m[2], kind: m[1], n: prev ? prev.n + 1 : 1 });
      }
      let best = null;
      for (const c of counts.values()) if (!best || c.n > best.n) best = c;
      return best;
    }

    openDialog() {
      for (const d of document.querySelectorAll('[role="dialog"]')) {
        const b = d.getBoundingClientRect();
        if (b.width > 100 && b.height > 100) return d;
      }
      return null;
    }

    /**
     * The post's photo or video. In a carousel the slides next to the current one are clipped away,
     * so we measure what is actually visible. `single`: one post on the page — its photo is the
     * largest media (bigger than the "more posts" thumbnails below it).
     */
    pickMedia(scope, single, cache) {
      const list = [];
      for (const el of scope.querySelectorAll('img, video')) {
        const b = el.getBoundingClientRect();
        if (b.width < MIN_MEDIA_PX || b.height < MIN_MEDIA_PX) continue;
        list.push({ el, b, area: b.width * b.height });
      }
      if (!list.length) return null;
      let pool = list;
      if (single) {
        const max = Math.max(...list.map((c) => c.area));
        pool = list.filter((c) => c.area >= max * 0.8);
      }
      let best = null;
      for (const c of pool) {
        if (c.b.bottom <= 0 || c.b.top >= window.innerHeight || c.b.right <= 0 || c.b.left >= window.innerWidth) continue;
        const clips = this.clipAncestors(c.el, cache);
        const r = this.visibleRect(c.el, clips);
        if (!r) continue;
        const score = r.width * r.height;
        if (!best || score > best.score) {
          best = { media: c.el, clips, score, vis: score / c.area, isVideo: c.el.tagName === 'VIDEO' };
        }
      }
      return best && best.vis >= MIN_VISIBLE ? best : null;
    }

    clipAncestors(el, cache) {
      const out = [];
      for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
        let clips = cache.get(p);
        if (clips === undefined) {
          const cs = getComputedStyle(p);
          clips = cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
          cache.set(p, clips);
        }
        if (clips) out.push(p);
      }
      return out;
    }

    visibleRect(el, clips) {
      const b = el.getBoundingClientRect();
      let l = b.left; let t = b.top; let r = b.right; let btm = b.bottom;
      for (const c of clips) {
        const cr = c.getBoundingClientRect();
        l = Math.max(l, cr.left); t = Math.max(t, cr.top);
        r = Math.min(r, cr.right); btm = Math.min(btm, cr.bottom);
      }
      l = Math.max(l, 0); t = Math.max(t, 0);
      r = Math.min(r, window.innerWidth); btm = Math.min(btm, window.innerHeight);
      return r > l && btm > t ? { left: l, top: t, width: r - l, height: btm - t } : null;
    }

    audible(scope) {
      if (!scope || !scope.isConnected) return false;
      for (const m of scope.querySelectorAll('video, audio')) {
        if (!m.paused && !m.ended && !m.muted && m.volume > 0) return true;
      }
      return false;
    }

    // ── Playback ──
    load(rec) {
      const c = this.current;
      if (c && c.code === rec.code && c.url === rec.track.url) return;
      this.release();
      const start = Math.max(0, (Number(rec.track.start) || 0) / 1000);
      const lengthMs = Number(rec.track.length);
      const length = (lengthMs >= 1000 ? lengthMs : DEFAULT_CLIP_MS) / 1000;
      this.current = {
        code: rec.code, url: rec.track.url, start, length, end: start + length,
        title: rec.title || '', artist: rec.artist || '',
      };
      const a = this.audio;
      a.volume = 0; // faded in once it starts
      a.muted = !!this.settings.musicMuted;
      a.src = rec.track.url;
      this.state = 'loading';
      this.play();
      this.render();
    }

    onMetadata() {
      const c = this.current;
      if (!c) return;
      const d = this.audio.duration;
      if (Number.isFinite(d) && d > 0) {
        if (c.start >= d - 1) c.start = 0; // the file is only the clip itself
        c.end = Math.min(c.start + c.length, d - 0.05);
      }
      if (Math.abs(this.audio.currentTime - c.start) > 0.3) this.audio.currentTime = c.start;
    }

    onAudioError() {
      const c = this.current;
      if (!c) return;
      const rec = this.records.get(c.code);
      this.release();
      // A link from the page data may simply have expired: fetch a fresh one once.
      if (rec && rec.source !== 'lookup') { rec.track = null; rec.has = true; this.asked.delete(c.code); }
      else this.failed.add(c.code);
    }

    play() {
      const c = this.current;
      if (!c) return;
      if (this.state !== 'playing') this.state = 'loading';
      let p;
      try { p = this.audio.play(); } catch (_) { return; }
      if (p && typeof p.catch === 'function') {
        p.catch((err) => {
          if (this.current !== c || !err || err.name !== 'NotAllowedError') return; // AbortError: source changed
          // Chrome wants a click on the page before it plays sound.
          this.state = 'blocked';
          this.armUnlock();
          this.render();
        });
      }
    }

    /** Jump back to the start of the clip right at its end (timeupdate alone can be seconds late). */
    armLoop() {
      clearTimeout(this.loopTimer);
      this.loopTimer = 0;
      const c = this.current;
      const a = this.audio;
      if (!c || a.paused) return;
      const left = c.end - a.currentTime;
      if (left <= 0.02) a.currentTime = c.start; // 'seeked' re-arms
      else this.loopTimer = setTimeout(() => this.armLoop(), Math.max(15, left * 1000 - 5));
    }

    fadeIn() {
      clearInterval(this.fadeTimer);
      const a = this.audio;
      const from = a.volume;
      if (from >= 1) return;
      const t0 = performance.now();
      this.fadeTimer = setInterval(() => {
        const k = Math.min(1, (performance.now() - t0) / FADE_MS);
        a.volume = from + (1 - from) * k;
        if (k >= 1) { clearInterval(this.fadeTimer); this.fadeTimer = 0; }
      }, 30);
    }

    /** Keep the player in line with the settings and with other sound in the post. */
    sync() {
      const c = this.current;
      const a = this.audio;
      if (c) {
        const muted = !!this.settings.musicMuted;
        if (a.muted !== muted) a.muted = muted;
        // A video in the same post playing with sound (e.g. a carousel slide) wins.
        const busy = !!this.target && this.audible(this.target.scope);
        if (busy && (this.state === 'loading' || this.state === 'playing')) {
          this.state = 'ducked';
          if (!a.paused) a.pause();
        } else if (!busy && this.state === 'ducked') {
          this.play();
        }
      }
      this.render();
    }

    release() {
      clearInterval(this.fadeTimer);
      clearTimeout(this.loopTimer);
      this.fadeTimer = 0;
      this.loopTimer = 0;
      if (this.current) {
        this.current = null;
        const a = this.audio;
        a.pause();
        a.removeAttribute('src');
        try { a.load(); } catch (_) { /* ignore */ }
      }
      this.state = 'idle';
      this.render();
    }

    armUnlock() {
      if (this.unlock) return;
      this.unlock = () => {
        this.disarmUnlock();
        if (this.current && this.state === 'blocked') this.play();
      };
      for (const type of ['pointerdown', 'pointerup', 'keydown']) window.addEventListener(type, this.unlock, true);
    }

    disarmUnlock() {
      if (!this.unlock) return;
      for (const type of ['pointerdown', 'pointerup', 'keydown']) window.removeEventListener(type, this.unlock, true);
      this.unlock = null;
    }

    onPillClick() {
      if (!this.current) return;
      if (this.state === 'blocked' || this.state === 'paused') {
        if (this.settings.musicMuted) this.setMuted(false);
        this.play();
        return;
      }
      this.setMuted(!this.settings.musicMuted);
    }

    setMuted(muted) {
      this.settings = Object.assign({}, this.settings, { musicMuted: muted });
      this.audio.muted = muted;
      this.render();
      this.onSettings({ musicMuted: muted });
    }

    // ── UI ──
    buildUI() {
      document.getElementById(HOST_ID)?.remove();
      const host = (this.host = document.createElement('div'));
      host.id = HOST_ID;
      const hostStyle = {
        position: 'fixed', top: '0', left: '0', width: '0', height: '0', margin: '0', padding: '0',
        border: '0', overflow: 'visible', 'z-index': '2147483646', display: 'none',
      };
      for (const [k, v] of Object.entries(hostStyle)) host.style.setProperty(k, v, 'important');
      const shadow = host.attachShadow({ mode: 'open' });
      RP.adoptStyles(shadow, RP.UI_CSS + MUSIC_CSS);

      const pill = (this.pill = document.createElement('button'));
      pill.type = 'button';
      pill.className = 'rp-ui pm-pill off';
      RP.setHTML(pill, `
        <span class="pm-ico" data-ref="ico"></span>
        <span class="pm-text"><b data-ref="title"></b><small data-ref="sub"></small></span>
        <span class="pm-vol" data-ref="vol"></span>`);
      this.refs = {};
      pill.querySelectorAll('[data-ref]').forEach((el) => { this.refs[el.dataset.ref] = el; });
      shadow.appendChild(pill);

      for (const type of CONTAINED_EVENTS) host.addEventListener(type, (e) => e.stopPropagation());
      pill.addEventListener('click', () => this.onPillClick());
      (document.body || document.documentElement).appendChild(host);
    }

    render() {
      const c = this.current;
      if (!c || this.state === 'idle') { this.hide(); return; }
      this.show();
      const muted = !!this.settings.musicMuted;
      const key = [this.state, muted, c.title, c.artist].join('|');
      if (key === this.renderKey) return;
      this.renderKey = key;

      const waiting = this.state === 'blocked' || this.state === 'paused';
      const live = this.state === 'playing' && !muted;
      const pill = this.pill;
      pill.classList.toggle('live', live);
      pill.classList.toggle('dim', this.state === 'loading' || this.state === 'ducked');
      RP.setHTML(this.refs.ico, waiting ? I.play : live ? EQ : I.music);
      this.refs.title.textContent = c.title || 'Music';
      this.refs.sub.textContent = this.state === 'blocked' ? ' · click to play'
        : this.state === 'paused' ? ' · paused'
          : c.artist ? ` · ${c.artist}` : '';
      this.refs.vol.hidden = waiting;
      RP.setHTML(this.refs.vol, muted ? I.muted : I.volume);
      const label = waiting ? 'Play the music on this post' : muted ? 'Unmute the music' : 'Mute the music';
      pill.title = label;
      pill.setAttribute('aria-label', c.title ? `${label}: ${c.title}${c.artist ? ` by ${c.artist}` : ''}` : label);
    }

    show() {
      if (this.raf) return;
      this.shown = true;
      this.host.style.setProperty('display', 'block', 'important');
      const frame = () => {
        this.raf = 0;
        if (!this.current || !this.alive) return;
        this.place();
        this.raf = requestAnimationFrame(frame);
      };
      this.place();
      this.raf = requestAnimationFrame(frame);
    }

    hide() {
      if (!this.shown) return;
      this.shown = false;
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.renderKey = '';
      this.pill.classList.add('off');
      this.host.style.setProperty('display', 'none', 'important');
    }

    /** Pin the pill to the top-left corner of the visible part of the photo. */
    place() {
      const t = this.target;
      const r = t && !t.covered && t.media.isConnected ? this.visibleRect(t.media, t.clips) : null;
      const ok = !!r && r.width >= 140 && r.height >= 56;
      this.pill.classList.toggle('off', !ok);
      if (!ok) return;
      const x = r.left + 12;
      const y = r.top + 12;
      this.pill.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      const maxW = `${Math.round(Math.min(320, r.width - 24))}px`;
      if (this.pill.style.maxWidth !== maxW) this.pill.style.maxWidth = maxW;
    }
  }

  RP.PostMusic = PostMusic;
})();
