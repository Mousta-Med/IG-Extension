/* ReelPilot — post music data (runs in the page's MAIN world at document_start).
 *
 * In Instagram's app a photo or carousel post can play a song. instagram.com shows the same post
 * silently. This script finds the song for each post so the content script can play it:
 *   1. It reads the post data Instagram downloads anyway (GraphQL / API responses and the JSON
 *      embedded in the page) and keeps a small record per post: whether it has music, the audio
 *      URL, the part of the song the author picked, title and artist.
 *   2. When that data doesn't say, the content script asks for a lookup and we fetch the post's
 *      info from Instagram's own web API (same site, the user's own session), one post at a time,
 *      only for the post on screen, and backing off as soon as Instagram pushes back.
 * Records reach the content script over DOM CustomEvents, the only channel shared between worlds.
 */
(() => {
  'use strict';
  if (window.__reelPilotMusic) return;
  const api = { version: 1 };
  Object.defineProperty(window, '__reelPilotMusic', { value: api, enumerable: false });

  const APP_ID = '936619743392459';          // instagram.com's web app id, sent by its own API calls
  const WATCH = /\/(?:api\/)?graphql|\/api\/v1\//;
  const CODE_RE = /^[A-Za-z0-9_-]{5,64}$/;
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const MAX_RECORDS = 600;
  const MAX_NODES = 250000;                  // walk budget per response
  const LOOKUP_GAP_MS = 1200;                // at most one lookup per 1.2 s
  const BACKOFF_MS = 10 * 60 * 1000;         // after a 401/403/429 or a login page
  const URL_KEYS = ['progressive_download_url', 'fast_start_progressive_download_url', 'web_30s_preview_download_url'];
  // Parts of a post that never hold its song (and can be large).
  const SKIP_KEYS = new Set([
    'user', 'owner', 'caption', 'comments', 'preview_comments', 'usertags', 'image_versions2', 'video_versions',
    'coauthor_producers', 'invited_coauthor_producers', 'facepile_top_likers', 'top_likers', 'likers', 'location',
    'sponsor_tags', 'edge_media_to_comment', 'edge_media_preview_like',
  ]);

  const nativeFetch = window.fetch;
  const records = new Map();                 // shortcode → record
  const lookups = new Map();                 // shortcode → outcome of its last lookup (for troubleshooting)
  const noop = () => {};
  const later = (fn) => setTimeout(fn, 0);

  // ── Reading Instagram's media objects ─────────────────────
  const isUrl = (v) => typeof v === 'string' && /^https:\/\//.test(v);
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : null);
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const obj = (v) => (v && typeof v === 'object' ? v : null);

  /** The audio file inside a music object, under whichever key this API version uses. */
  function findAudioUrl(node, depth = 0) {
    if (!obj(node) || depth > 6) return null;
    for (const k of URL_KEYS) if (isUrl(node[k])) return node[k];
    for (const [k, v] of Object.entries(node)) {
      if (/download_url$|(?:^|_)audio_url$/.test(k) && isUrl(v)) return v;
    }
    if (typeof node.dash_manifest === 'string') {
      const m = node.dash_manifest.match(/<BaseURL>([^<]+)<\/BaseURL>/);
      if (m) return m[1].replace(/&amp;/g, '&');
    }
    for (const v of Object.values(node)) {
      if (obj(v)) {
        const u = findAudioUrl(v, depth + 1);
        if (u) return u;
      }
    }
    return null;
  }

  function findNumber(node, keyRe, depth = 0) {
    if (!obj(node) || depth > 6) return null;
    for (const [k, v] of Object.entries(node)) {
      if (keyRe.test(k) && num(v) != null) return num(v);
    }
    for (const v of Object.values(node)) {
      if (obj(v)) {
        const n = findNumber(v, keyRe, depth + 1);
        if (n != null) return n;
      }
    }
    return null;
  }

  /**
   * A carousel's song isn't always where a photo's is (`music_metadata.music_info` on the post): it
   * can sit on the slides or under another key. Search the post for a music asset — an object with
   * `music_asset_info`, or one holding an audio download link — skipping video slides (their sound is
   * their own) and other posts nested inside. Returns { info, asset }; `info` holds the clip timing.
   */
  function findMusic(media) {
    const stack = [[media, null, 0]];
    let budget = 5000;
    while (stack.length && budget-- > 0) {
      const [node, parent, depth] = stack.pop();
      if (!Array.isArray(node)) {
        if (depth > 0 && node.media_type === 2) continue;
        if (depth > 0 && typeof node.code === 'string' && node.code !== media.code) continue;
        if (obj(node.music_asset_info)) return { info: node, asset: node.music_asset_info };
        if (URL_KEYS.some((k) => isUrl(node[k]))) return { info: parent && !Array.isArray(parent) ? parent : node, asset: node };
      }
      if (depth >= 8) continue;
      for (const k of Object.keys(node)) {
        if (SKIP_KEYS.has(k) || !obj(node[k])) continue;
        stack.push([node[k], node, depth + 1]);
      }
    }
    return null;
  }

  const isMedia = (o) => typeof o.code === 'string' && CODE_RE.test(o.code)
    && ('music_metadata' in o || 'media_type' in o) && ('pk' in o || 'id' in o);

  /**
   * One record per post. `has`: true = music attached, false = none, null = this data doesn't say.
   * `complete` = the object came from the full media-info API, where a missing field means "none".
   */
  function recordFrom(media, source) {
    const complete = source === 'lookup';
    const pk = media.pk != null ? String(media.pk) : media.id != null ? String(media.id).split('_')[0] : null;
    const product = str(media.product_type);
    const rec = {
      code: media.code,
      pk: pk && /^\d+$/.test(pk) ? pk : null,
      video: media.media_type === 2 || product === 'clips' || product === 'igtv',
      carousel: media.media_type === 8 || Array.isArray(media.carousel_media),
      has: null,
      muted: false,
      track: null,
      title: '',
      artist: '',
      source,
    };

    const mm = obj(media.music_metadata);
    const original = mm && obj(mm.original_sound_info);
    let info = mm && obj(mm.music_info);
    let asset = info && obj(info.music_asset_info);
    if (!info && !original && rec.carousel) {
      const found = findMusic(media);
      if (found) ({ info, asset } = found);
    }
    if (!info && !original) {
      if (mm || media.music_metadata === null || complete) rec.has = false;
      return rec;
    }

    asset = asset || original || {};
    const usage = (info && obj(info.music_consumption_info)) || (original && obj(original.consumption_info)) || {};
    rec.has = true;
    rec.muted = usage.should_mute_audio === true;
    rec.title = str(asset.title) || str(asset.original_audio_title);
    rec.artist = str(asset.display_artist) || str(original && obj(original.ig_artist) && original.ig_artist.username);

    const url = findAudioUrl(asset) || findAudioUrl(original) || findAudioUrl(info) || findAudioUrl(mm);
    if (url) {
      const where = info || mm;
      const highlights = Array.isArray(asset.highlight_start_times_in_ms) ? asset.highlight_start_times_in_ms : [];
      const start = num(usage.audio_asset_start_time_in_ms)
        ?? findNumber(where, /audio_asset_start_time_in_ms$/)
        ?? num(highlights[0])
        ?? 0;
      const length = num(usage.overlap_duration_in_ms) ?? findNumber(where, /overlap_duration_in_ms$/);
      rec.track = { url, start, length };
    }
    return rec;
  }

  // ── Store & bridge ─────────────────────────────────────────
  let outbox = [];
  let outTimer = 0;
  function emit(list) {
    if (!list.length) return;
    outbox.push(...list);
    if (!outTimer) outTimer = setTimeout(flush, 30);
  }
  function flush() {
    outTimer = 0;
    const batch = outbox;
    outbox = [];
    document.dispatchEvent(new CustomEvent('reelpilot:media', { detail: JSON.stringify(batch) }));
  }

  /** Keep the most informative record per post. Returns the record if it changed. */
  function store(rec) {
    const prev = records.get(rec.code);
    if (prev && rec.source !== 'lookup') {
      if (prev.source === 'lookup') return null;
      if (rec.has == null && prev.has != null) return null;
      if (prev.track && !rec.track) return null;
    }
    const json = JSON.stringify(rec);
    if (prev && prev.json === json) return null;
    records.delete(rec.code);
    records.set(rec.code, Object.assign(rec, { json }));
    if (records.size > MAX_RECORDS) records.delete(records.keys().next().value);
    return rec;
  }

  const strip = (rec) => { const { json, ...rest } = rec; return rest; };

  /** Walk any JSON from Instagram and pick out the media objects. */
  function walk(root) {
    const changed = [];
    const stack = [root];
    let budget = MAX_NODES;
    while (stack.length && budget-- > 0) {
      const node = stack.pop();
      if (!obj(node)) continue;
      if (Array.isArray(node)) {
        for (let i = node.length - 1; i >= 0; i--) if (obj(node[i])) stack.push(node[i]);
        continue;
      }
      if (isMedia(node)) {
        const rec = store(recordFrom(node, 'page'));
        if (rec) changed.push(strip(rec));
      }
      for (const k in node) {
        const v = node[k];
        if (obj(v)) stack.push(v);
      }
    }
    emit(changed);
  }

  function scanText(text) {
    if (typeof text !== 'string' || text.indexOf('music_metadata') === -1) return;
    const body = text.replace(/^\s*for\s*\(;;\);/, '');
    try {
      walk(JSON.parse(body));
    } catch (_) {
      // Streamed responses: one JSON document per line.
      for (const line of body.split('\n')) {
        const t = line.trim();
        if (t[0] !== '{' || t.indexOf('music_metadata') === -1) continue;
        try { walk(JSON.parse(t)); } catch (_) { /* not JSON */ }
      }
    }
  }

  // ── Watching Instagram's own requests ──────────────────────
  if (typeof nativeFetch === 'function') {
    const wrapped = function fetch(input) {
      const p = nativeFetch.apply(this, arguments);
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || String(input || '');
        if (WATCH.test(url)) {
          p.then((res) => {
            try { if (res && res.ok) res.clone().text().then(scanText, noop); } catch (_) { /* body already used */ }
          }, noop);
        }
      } catch (_) { /* never break the page's request */ }
      return p;
    };
    window.fetch = wrapped;
  }

  const XHR = window.XMLHttpRequest;
  if (XHR && XHR.prototype && typeof XHR.prototype.open === 'function') {
    const nativeOpen = XHR.prototype.open;
    const onLoad = function onLoad() {
      try {
        if (this.status < 200 || this.status >= 300) return;
        const type = this.responseType;
        if (type === '' || type === 'text') {
          const text = this.responseText;
          later(() => scanText(text));
        } else if (type === 'json' && this.response) {
          const data = this.response;
          later(() => walk(data));
        }
      } catch (_) { /* ignore */ }
    };
    XHR.prototype.open = function open(method, url) {
      try { if (WATCH.test(String(url))) this.addEventListener('load', onLoad); } catch (_) { /* ignore */ }
      return nativeOpen.apply(this, arguments);
    };
  }

  // Data embedded in the HTML of a full page load (e.g. opening a /p/<code>/ link directly).
  function scanEmbedded() {
    for (const s of document.querySelectorAll('script[type="application/json"]')) {
      const text = s.textContent;
      if (text && text.indexOf('music_metadata') !== -1) later(() => scanText(text));
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scanEmbedded, { once: true });
  else scanEmbedded();
  window.addEventListener('load', scanEmbedded, { once: true });

  // ── Lookups via the media-info API ─────────────────────────
  function codeToPk(code) {
    let id = 0n;
    for (const ch of code.slice(0, 11)) {
      const i = ALPHABET.indexOf(ch);
      if (i < 0) return null;
      id = id * 64n + BigInt(i);
    }
    return id > 0n ? id.toString() : null;
  }

  let pending = null;        // only the newest request matters — older ones are posts scrolled past
  let busy = false;
  let lastLookup = 0;
  let pausedUntil = 0;
  let pumpTimer = 0;

  function note(code, outcome) {
    lookups.delete(code);
    lookups.set(code, Object.assign({ at: new Date().toISOString() }, outcome));
    if (lookups.size > 100) lookups.delete(lookups.keys().next().value);
  }

  const fail = (code, error) => {
    note(code, { error });
    emit([{ code, error }]);
  };

  function requestLookup(code) {
    if (!CODE_RE.test(code || '')) return;
    const known = records.get(code);
    if (known && known.source === 'lookup') { emit([strip(known)]); return; }
    pending = code;
    pump();
  }

  function pump() {
    if (busy || !pending) return;
    const now = Date.now();
    if (now < pausedUntil) { fail(pending, 'paused'); pending = null; return; }
    const wait = lastLookup + LOOKUP_GAP_MS - now;
    if (wait > 0) {
      if (!pumpTimer) pumpTimer = setTimeout(() => { pumpTimer = 0; pump(); }, wait);
      return;
    }
    const code = pending;
    pending = null;
    busy = true;
    lastLookup = now;
    lookup(code).catch(() => fail(code, 'network')).finally(() => { busy = false; pump(); });
  }

  async function lookup(code) {
    const known = records.get(code);
    const pk = (known && known.pk) || codeToPk(code);
    if (!pk) { fail(code, 'code'); return; }
    let claim = '0';
    try { claim = sessionStorage.getItem('www-claim-v2') || '0'; } catch (_) { /* storage blocked */ }
    const res = await nativeFetch.call(window, `/api/v1/media/${pk}/info/`, {
      credentials: 'include',
      headers: { 'X-IG-App-ID': APP_ID, 'X-IG-WWW-Claim': claim, 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      pausedUntil = Date.now() + BACKOFF_MS;
      fail(code, `blocked (http ${res.status})`);
      return;
    }
    if (!res.ok) { fail(code, `http ${res.status}`); return; }
    let data;
    try { data = await res.json(); } catch (_) {
      pausedUntil = Date.now() + BACKOFF_MS; // an HTML login / checkpoint page instead of JSON
      fail(code, 'blocked (not JSON)');
      return;
    }
    const items = data && Array.isArray(data.items) ? data.items : [];
    const item = items.find((it) => it && it.code === code) || items[0];
    if (!obj(item)) { fail(code, 'missing'); return; }
    const rec = recordFrom(item, 'lookup');
    rec.code = code;
    note(code, { ok: true });
    store(rec);
    emit([strip(rec)]);
  }

  // Troubleshooting from the DevTools console: __reelPilotMusic.inspect('<shortcode>')
  api.inspect = (code) => {
    const rec = records.get(code);
    return { record: rec ? strip(rec) : null, lookup: lookups.get(code) || null, pausedUntil: pausedUntil || null };
  };

  document.addEventListener('reelpilot:media-sync', () => {
    emit(Array.from(records.values(), strip));
  });
  document.addEventListener('reelpilot:media-lookup', (e) => {
    try { requestLookup(JSON.parse(e.detail || '{}').code); } catch (_) { /* malformed */ }
  });
})();
