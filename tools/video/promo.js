/* ReelPilot promo video — every frame is a pure function of time `t`, so render.mjs can capture it
 * frame by frame. The panel, the on-reel bar and the popup are the extension's real UI code.
 *
 *  0.0  Intro          logo + name
 *  4.5  Auto-scroll    panel; cursor turns auto-scroll on; reels advance by themselves
 * 14.0  On-reel bar    controls move onto the reel; speed + next clicked
 * 21.0  Background     another tab takes over; the reel pops into Picture-in-Picture and keeps advancing
 * 29.5  Remote         toolbar popup + keyboard shortcuts
 * 36.5  Skip ads       a sponsored reel is skipped
 * 41.5  Outro          logo + "Free on the Chrome Web Store"
 */
(() => {
  'use strict';
  const K = window.StudioKit;
  const { RP, I, ICON, el, place } = K;
  const stage = document.getElementById('stage');

  // ── Easing ──
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const lerp = (a, b, x) => a + (b - a) * x;
  const easeOut = (x) => 1 - (1 - x) ** 3;
  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
  const easeBack = (x) => { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };
  /** Visibility 0→1→0 over [a, b] with fade-in/fade-out lengths. */
  const win = (t, a, b, fin = 0.5, fout = 0.4) => Math.min(easeOut(prog(t, a, a + fin)), 1 - easeInOut(prog(t, b - fout, b)));
  const show = (node, v) => { node.style.opacity = String(v); node.style.visibility = v > 0.002 ? 'visible' : 'hidden'; };

  // ── Timeline (seconds) ──
  const FPS = 30;
  const DURATION = 46;
  const S = { auto: [4.5, 14], hud: [14, 21], bg: [21, 29.5], remote: [29.5, 36.5], ads: [36.5, 41.5], outro: [41.5, 46] };
  const CLICK = { auto: 6.4, speed: 17.0, next: 19.2, toolbar: 30.6 };
  const KEYS = [33.2, 34.6]; // Alt+Shift+K: pause, then play again
  const SCROLL_DUR = 0.55;
  const PAGES = [
    { scene: 'sunset', author: '@sunset.demo', caption: 'Golden hour over the dunes', likes: '12.4K' },
    { scene: 'aurora', author: '@northern.demo', caption: 'Aurora night over the lake', likes: '48.1K' },
    { scene: 'city', author: '@neon.demo', caption: 'City lights after the rain', likes: '9.8K' },
    { scene: 'ocean', author: '@coast.demo', caption: 'Last light on the water', likes: '21.7K' },
    { scene: 'sunset', author: '@dunes.demo', caption: 'Desert road trip, day 3', likes: '5.2K' },
    { scene: 'product', author: '@brand.demo', caption: 'The summer drop is here', likes: '2.1K', ad: true },
    { scene: 'aurora', author: '@sky.demo', caption: 'Chasing the northern lights', likes: '33.0K' },
  ];
  const SCROLLS = [[8.6, 1], [11.8, 2], [CLICK.next, 3], [25.6, 4], [37.4, 5], [39.0, 6]]; // [time, page]

  const SET = {
    panel: RP.normalizeSettings({ dimIdle: false }),
    reel: RP.normalizeSettings({ dimIdle: false, controls: 'reel' }),
    reelFast: RP.normalizeSettings({ dimIdle: false, controls: 'reel', speed: 1.5 }),
  };
  const settingsAt = (t) => (t < S.hud[0] ? SET.panel : t < CLICK.speed ? SET.reel : SET.reelFast);

  function feedPos(t) {
    let pos = 0;
    for (const [at, idx] of SCROLLS) {
      if (t < at) break;
      pos = lerp(pos, idx, easeInOut(prog(t, at, at + SCROLL_DUR)));
    }
    return pos;
  }

  /** What the real engine would report at time t. */
  function stateAt(t) {
    const pos = feedPos(t);
    const i = Math.round(pos);
    const pg = PAGES[i];
    const start = i === 0 ? 2.3 : SCROLLS.find((s) => s[1] === i)[0];
    const next = SCROLLS.find((s) => s[1] === i + 1);
    const end = next ? next[0] : DURATION;
    const dur = end - start + 0.25;
    const time = clamp(t - start, 0, dur);
    const auto = t >= CLICK.auto && t < S.outro[0];
    return Object.assign({}, K.baseState, {
      author: pg.author, sponsored: !!pg.ad, reelNumber: 12 + i, time, duration: dur,
      auto, playing: !(t >= KEYS[0] && t < KEYS[1]), busy: Math.abs(pos - i) > 0.02,
      untilNext: auto ? Math.max(0, end - t) : null, autoProgress: auto ? clamp(time / dur) : 0,
      speed: t >= CLICK.speed ? 1.5 : 1, watchSec: 250 + t,
      hidden: t >= S.bg[0] + 0.6 && t < S.ads[0], pip: t >= S.bg[0] + 1 && t < S.ads[0],
      settings: settingsAt(t), panelCollapsed: false,
    });
  }

  // ── Backdrop ──
  const blobs = [
    place(el('<div class="blob pink"></div>'), { x: -180, y: -250 }),
    place(el('<div class="blob blue"></div>'), { x: 820, y: 280 }),
    place(el('<div class="blob orange"></div>'), { x: 720, y: -280 }),
  ];
  const drift = (t) => blobs.forEach((b, k) => {
    b.style.transform = `translate(${(Math.sin(t * 0.21 + k * 2) * 46).toFixed(1)}px, ${(Math.cos(t * 0.17 + k) * 34).toFixed(1)}px)`;
  });

  // ── Thumbnail mode ──
  if (new URLSearchParams(location.search).has('thumb')) {
    stage.appendChild(el(`<div class="thumb-title"><div class="l2">REELS ON</div><div class="l2 grad">AUTOPILOT</div></div>`));
    stage.appendChild(el(`<div class="thumb-badge">${RP.logoSVG('thumbLogo')}Free Chrome extension for Instagram Reels</div>`));
    const r = K.reel({ x: 830, y: 40, scene: 'sunset', author: '@sunset.demo', caption: 'Golden hour over the dunes' });
    r.style.zIndex = 3;
    K.overlay({ state: { untilNext: 8.2, autoProgress: 0.58 }, settings: { controls: 'reel' }, anchor: r });
    drift(3);
    document.fonts.ready.then(() => { document.body.dataset.ready = '1'; });
    return;
  }

  // ── Intro / outro ──
  const intro = el(`
    <div class="center">
      <span class="logo">${RP.logoSVG('introLogo')}</span>
      <div class="name">ReelPilot</div>
      <div class="tag">Instagram Reels on autopilot</div>
      ${K.chips([['zap', 'Auto-scroll'], ['reels', 'Background play'], ['pip', 'Picture-in-Picture'], ['keyboard', 'Remote control']])}
    </div>`);
  stage.appendChild(intro);
  const introParts = [intro.querySelector('.name'), intro.querySelector('.tag')];
  const introLogo = intro.querySelector('.logo');
  const introChips = [...intro.querySelectorAll('.chip')];

  const outro = el(`
    <div class="center">
      <span class="logo">${RP.logoSVG('outroLogo')}</span>
      <div class="name">ReelPilot</div>
      <div class="tag">Auto-scroll for Instagram Reels — in any tab</div>
      <div class="cws">${I.zap}Free on the Chrome Web Store</div>
      <div class="legal">Not affiliated with Instagram or Meta. Instagram is a trademark of Meta Platforms, Inc.</div>
    </div>`);
  stage.appendChild(outro);
  const outroLogo = outro.querySelector('.logo');
  const outroParts = [outro.querySelector('.name'), outro.querySelector('.tag'), outro.querySelector('.cws'), outro.querySelector('.legal')];

  // ── Captions ──
  const caps = {
    auto: K.copy({ eyebrow: 'Auto-scroll', title: 'Reels on<br><span class="grad">autopilot</span>', text: 'ReelPilot moves to the next reel when the current one ends — after 1 to 10 plays, or on a timer.' }),
    hud: K.copy({ eyebrow: 'On-reel controls', title: 'Controls right<br><span class="grad">on the reel</span>', text: 'Play, skip, auto-scroll, speed and Picture-in-Picture in a slim bar on top of the reel.' }),
    bg: K.copy({ eyebrow: 'Background play', title: 'Keeps rolling<br><span class="grad">in any tab</span>', text: 'Switch tabs and your reels keep playing. Picture-in-Picture follows every next reel.' }),
    remote: K.copy({
      eyebrow: 'Remote control', title: 'A remote in<br><span class="grad">your toolbar</span>', text: 'Control your reels from any tab, or with keyboard shortcuts.',
      extra: K.keys([['Alt+Shift+S', 'Auto-scroll on / off'], ['Alt+Shift+K', 'Play / pause'], ['Alt+Shift+Down', 'Next reel']]),
    }),
    ads: K.copy({ eyebrow: 'Skip ads', title: 'Sponsored?<br><span class="grad">Skipped.</span>', text: 'Sponsored reels and image ads are skipped the moment they show up.' }),
  };
  const keyRows = [...caps.remote.querySelectorAll('.key-row')];

  // ── Browser, reel, popup ──
  const browserEl = K.browser({
    x: 470, y: 60, w: 760, h: 600, url: 'docs.example.com/q3-report',
    tabs: [{ title: 'Q3 report — Docs', on: true }, { title: 'Reels', reels: true, sound: true }],
  });
  const extBtn = browserEl.querySelector('.ext');
  const badge = browserEl.querySelector('.badge');

  const reelEl = el(`
    <div class="reel feed-reel">
      <div class="feed">${PAGES.map((pg) => `<div class="page">${K.reelContent(pg)}</div>`).join('')}</div>
      <div class="pip-chrome">
        <div class="pip-top"><span>${ICON.back}</span><span>${ICON.close}</span></div>
        <div class="pip-ctrl"><span>${ICON.prevTrack}</span><span class="big">${ICON.pause}</span><span>${ICON.nextTrack}</span></div>
        <div class="pip-progress"><b></b></div>
      </div>
    </div>`);
  stage.appendChild(reelEl);
  const feedEl = reelEl.querySelector('.feed');
  const pipChrome = reelEl.querySelector('.pip-chrome');
  const pipBar = pipChrome.querySelector('.pip-progress b');
  const pipPlay = pipChrome.querySelector('.pip-ctrl .big');
  const PLAY_ICON = '<svg viewBox="0 0 24 24" fill="#fff"><path d="M8 5.6v12.8c0 .8.9 1.3 1.6.9l10.2-6.4a1.05 1.05 0 0 0 0-1.8L9.6 4.7C8.9 4.3 8 4.8 8 5.6Z"/></svg>';
  let pipShowsPause = true;

  const popup = place(el('<iframe class="popup-frame" src="../../src/popup/popup.html"></iframe>'), { x: 858, y: 140, h: 524 });
  let popupReady = false;
  popup.addEventListener('load', () => {
    const style = popup.contentDocument.createElement('style');
    style.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }';
    popup.contentDocument.head.appendChild(style);
    popupReady = true;
  });

  const pipCallout = place(el(`<div class="callout"><span class="ico">${I.zap}</span><span class="txt"></span></div>`), { x: 660, y: 598 });
  const pipCalloutText = pipCallout.querySelector('.txt');
  const adCallout = place(el(`<div class="callout"><span class="ico">${I.skip}</span>Sponsored reel — skipping</div>`), { x: 0, y: 0 });

  // ── The real ReelPilot overlay ──
  let current = stateAt(0);
  const ov = K.overlay({ getState: () => current, settings: SET.panel, anchor: () => reelEl, pos: { side: 'right', x: 56, y: 64 } });
  RP.adoptStyles(ov.shadow, '*, *::before, *::after { animation: none !important; transition: none !important; }');

  // ── Cursor ──
  // Appended after the overlay's host (same top z-index) so the cursor draws above the panel and bar.
  const ripple = place(el('<div class="ripple"></div>'), { x: 0, y: 0 }, document.body);
  const cursor = place(el('<svg class="cursor" viewBox="0 0 28 28"><path d="M5 3l16 9.5-7 1.8 4.4 7.4-3 1.7-4.3-7.5-5.1 4.9z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>'), { x: 0, y: 0 }, document.body);
  const inShadow = (sel) => () => ov.shadow.querySelector(sel);
  const CURSOR = [
    { show: [5.3, 7.9], path: [[5.3, { x: 980, y: 700 }], [6.2, inShadow('.rp-auto .rp-switch')], [6.9, inShadow('.rp-auto .rp-switch')], [7.7, { x: 1010, y: 640 }]] },
    { show: [15.6, 20.2], path: [[15.6, { x: 1060, y: 560 }], [16.7, inShadow('[data-hud="speed"]')], [17.4, inShadow('[data-hud="speed"]')], [18.8, inShadow('[data-hud="next"]')], [19.6, inShadow('[data-hud="next"]')], [20.2, { x: 930, y: 430 }]] },
    { show: [29.9, 31.7], path: [[29.9, { x: 1000, y: 420 }], [30.45, () => extBtn], [31.0, () => extBtn], [31.7, { x: 1110, y: 330 }]] },
  ];
  const resolve = (target) => {
    if (typeof target !== 'function') return target;
    const r = target().getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  function cursorAt(t, track) {
    const { path } = track;
    if (t <= path[0][0]) return resolve(path[0][1]);
    for (let k = 0; k < path.length - 1; k++) {
      const [t0, a] = path[k];
      const [t1, b] = path[k + 1];
      if (t <= t1) {
        const pa = resolve(a);
        const pb = resolve(b);
        const x = easeInOut(prog(t, t0, t1));
        return { x: lerp(pa.x, pb.x, x), y: lerp(pa.y, pb.y, x) };
      }
    }
    return resolve(path[path.length - 1][1]);
  }

  // ── Per-frame layout ──
  const BOX = { a: { x: 470, y: 40, s: 1 }, b: { x: 640, y: 40, s: 1 }, pip: { x: 1012, y: 296, s: 0.555 }, pip2: { x: 500, y: 296, s: 0.555 } };
  const REEL_KEYS = [[4.5, BOX.a], [14.0, BOX.a], [14.7, BOX.b], [21.6, BOX.b], [22.5, BOX.pip], [29.6, BOX.pip], [30.2, BOX.pip2], [36.5, BOX.pip2], [37.3, BOX.b]];
  function reelBox(t) {
    if (t <= REEL_KEYS[0][0]) return REEL_KEYS[0][1];
    for (let k = 0; k < REEL_KEYS.length - 1; k++) {
      const [t0, a] = REEL_KEYS[k];
      const [t1, b] = REEL_KEYS[k + 1];
      if (t <= t1) {
        const x = easeInOut(prog(t, t0, t1));
        return { x: lerp(a.x, b.x, x), y: lerp(a.y, b.y, x), s: lerp(a.s, b.s, x) };
      }
    }
    return REEL_KEYS[REEL_KEYS.length - 1][1];
  }

  function renderIntro(t) {
    const exit = easeInOut(prog(t, 3.9, 4.5));
    show(intro, 1 - exit);
    intro.style.transform = `scale(${1 + 0.06 * exit})`;
    const s = easeBack(prog(t, 0.25, 0.95));
    introLogo.style.transform = `scale(${lerp(0.5, 1, s)})`;
    introLogo.style.opacity = String(prog(t, 0.25, 0.55));
    introParts.forEach((node, k) => {
      const x = easeOut(prog(t, 0.75 + k * 0.4, 1.25 + k * 0.4));
      node.style.opacity = String(x);
      node.style.transform = `translateY(${(1 - x) * 20}px)`;
    });
    introChips.forEach((node, k) => {
      const x = easeOut(prog(t, 1.9 + k * 0.12, 2.3 + k * 0.12));
      node.style.opacity = String(x);
      node.style.transform = `translateY(${(1 - x) * 14}px)`;
    });
  }

  function renderOutro(t) {
    show(outro, prog(t, S.outro[0], S.outro[0] + 0.3));
    const s = easeBack(prog(t, 41.6, 42.2));
    outroLogo.style.transform = `scale(${lerp(0.5, 1, s)})`;
    outroLogo.style.opacity = String(prog(t, 41.6, 41.9));
    outroParts.forEach((node, k) => {
      const x = easeOut(prog(t, 41.9 + k * 0.22, 42.4 + k * 0.22));
      node.style.opacity = String(x);
      if (!node.classList.contains('legal')) node.style.transform = `translateY(${(1 - x) * 18}px)`;
    });
  }

  function renderCaptions(t) {
    for (const [key, [a, b]] of Object.entries({ auto: S.auto, hud: S.hud, bg: S.bg, remote: S.remote, ads: S.ads })) {
      const node = caps[key];
      show(node, win(t, a + 0.25, b - 0.05, 0.6, 0.4));
      node.style.transform = `translateY(calc(-50% + ${((1 - easeOut(prog(t, a + 0.25, a + 0.85))) * 22).toFixed(1)}px))`;
    }
    const pressed = KEYS.some((k) => t >= k && t < k + 0.35);
    keyRows[1].classList.toggle('pressed', pressed);
  }

  function renderReel(t) {
    const box = reelBox(t);
    const enter = easeOut(prog(t, 4.5, 5.1));
    show(reelEl, Math.min(enter, 1 - easeInOut(prog(t, 41.2, 41.7))));
    reelEl.style.transform = `translate(${box.x.toFixed(1)}px, ${(box.y + (1 - enter) * 30).toFixed(1)}px) scale(${box.s.toFixed(4)})`;
    feedEl.style.transform = `translateY(${(-feedPos(t) * 640).toFixed(1)}px)`;
    show(pipChrome, win(t, 22.2, 36.7, 0.4, 0.3));
    pipBar.style.width = `${(current.autoProgress * 100).toFixed(1)}%`;
    if (pipShowsPause !== current.playing) {
      pipShowsPause = current.playing;
      pipPlay.innerHTML = current.playing ? ICON.pause : PLAY_ICON;
    }
  }

  function renderOverlay(t) {
    ov.update(current, settingsAt(t));
    const panel = win(t, 4.7, 14.0, 0.6, 0.4);
    ov.root.style.opacity = String(panel);
    ov.root.style.transform = `translateX(${((1 - easeOut(prog(t, 4.7, 5.3))) * 40).toFixed(1)}px)`;
    let hud = 0;
    if (t < S.bg[0] + 0.5) hud = easeOut(prog(t, 14.3, 14.8)) * (1 - prog(t, 21.0, 21.4));
    else if (t < S.outro[0]) hud = easeOut(prog(t, 37.1, 37.5)) * (1 - prog(t, 41.1, 41.5));
    ov.hud.style.opacity = String(hud);
  }

  function renderBrowser(t) {
    show(browserEl, win(t, 21.0, 36.9, 0.6, 0.5));
    const dx = (1 - easeOut(prog(t, 21.0, 21.7))) * 120 + easeInOut(prog(t, 36.4, 36.9)) * 60;
    browserEl.style.transform = `translateX(${dx.toFixed(1)}px)`;
    badge.hidden = !current.auto;
    badge.textContent = String(current.reelNumber);
    extBtn.classList.toggle('active', t >= CLICK.toolbar && t < 36.3);

    show(popup, win(t, CLICK.toolbar + 0.05, 36.3, 0.25, 0.3));
    popup.style.transform = `scale(${lerp(0.94, 1, easeOut(prog(t, CLICK.toolbar + 0.05, CLICK.toolbar + 0.35)))})`;
    if (popupReady) popup.contentWindow.__rpState = current;
  }

  function renderCallouts(t) {
    show(pipCallout, win(t, 23.2, 28.9, 0.4, 0.3));
    pipCalloutText.textContent = current.busy ? 'Moving to the next reel…' : `Next reel in ${Math.ceil(current.untilNext || 0)}s — follows auto-scroll`;
    show(adCallout, win(t, 37.75, 39.0, 0.25, 0.25));
    const box = reelBox(t);
    adCallout.style.transform = `translate(${(box.x + 180 - adCallout.offsetWidth / 2).toFixed(1)}px, 96px) scale(${lerp(0.9, 1, easeBack(prog(t, 37.75, 38.15)))})`;
  }

  function renderCursor(t) {
    const track = CURSOR.find((c) => t >= c.show[0] && t <= c.show[1]);
    if (!track) { show(cursor, 0); show(ripple, 0); return; }
    const p = cursorAt(t, track);
    show(cursor, win(t, track.show[0], track.show[1], 0.25, 0.3));
    cursor.style.transform = `translate(${(p.x - 5).toFixed(1)}px, ${(p.y - 3).toFixed(1)}px)`;
    const click = Object.values(CLICK).find((c) => t >= c && t < c + 0.45);
    if (click == null) { show(ripple, 0); return; }
    const x = prog(t, click, click + 0.45);
    const at = cursorAt(click, track);
    show(ripple, 1 - x);
    ripple.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px) scale(${lerp(0.4, 1.5, easeOut(x))})`;
  }

  const black = place(el('<div class="black"></div>'), { x: 0, y: 0 });

  function render(t) {
    current = stateAt(t);
    drift(t);
    renderIntro(t);
    renderCaptions(t);
    renderReel(t);
    renderOverlay(t);
    renderBrowser(t);
    renderCallouts(t);
    renderCursor(t);
    renderOutro(t);
    black.style.opacity = String(Math.max(1 - prog(t, 0, 0.45), prog(t, DURATION - 0.9, DURATION)));
  }

  window.__timeline = {
    duration: DURATION,
    fps: FPS,
    cues: {
      whoosh: [S.auto[0], S.hud[0], S.bg[0], S.remote[0], S.ads[0], S.outro[0]],
      swish: SCROLLS.map((s) => s[0]),
      click: Object.values(CLICK),
      key: KEYS,
      bell: [0.3, 41.65],
    },
  };
  window.__seek = (t) => render(t);
  render(0);
  Promise.all([document.fonts.ready, new Promise((r) => (popupReady ? r() : popup.addEventListener('load', r)))])
    .then(() => { document.body.dataset.ready = '1'; });
})();
