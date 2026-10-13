/* ReelPilot studio kit — building blocks shared by the store graphics (studio.js) and the promo
 * video (tools/video/promo.js): illustrated reels, a mock browser, and the real ReelPilot overlay. */
(() => {
  'use strict';
  const RP = window.ReelPilot;
  const I = RP.ICONS;
  const SHORTCUTS = { toggleAuto: 'Alt+Shift+S', next: 'Alt+Shift+Down', prev: 'Alt+Shift+Up', togglePlay: 'Alt+Shift+K' };

  const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const ICON = {
    heart: svg('<path d="M12 20s-7-4.4-9.2-8.6C1.2 8.2 3 4.5 6.6 4.5c2 0 3.4 1.2 4.1 2.4h.6c.7-1.2 2.1-2.4 4.1-2.4 3.6 0 5.4 3.7 3.8 6.9C19 15.6 12 20 12 20z"/>'),
    comment: svg('<path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3.5 20l1.2-4.2A8.5 8.5 0 1 1 20.5 11.5z"/>'),
    send: svg('<path d="M21 3 10 14M21 3l-6.5 18-3.5-7-7-3.5L21 3z"/>'),
    music: svg('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'),
    back: svg('<path d="M14 4h6v6M20 4l-8 8M10 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-4"/>'),
    close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    prevTrack: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M7 5h2v14H7zM20 5.8v12.4L10.6 12z"/></svg>',
    nextTrack: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M15 5h2v14h-2zM4 5.8v12.4L13.4 12z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="#fff"><rect x="6" y="5" width="4.2" height="14" rx="1.3"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.3"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  };

  const el = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
  const place = (node, { x, y, w, h }, parent = document.getElementById('stage')) => {
    Object.assign(node.style, { left: `${x}px`, top: `${y}px` });
    if (w) node.style.width = `${w}px`;
    if (h) node.style.height = `${h}px`;
    parent.appendChild(node);
    return node;
  };

  // ── Illustrated scenes (pure CSS, styled in studio.css) ──
  const city = () => {
    const blds = [[0, 16, 46], [14, 12, 62], [24, 18, 38], [40, 13, 70], [52, 16, 50], [67, 12, 58], [78, 22, 42]]
      .map(([l, w, h]) => `<div class="bld" style="left:${l}%;width:${w}%;height:${h}%"></div>`).join('');
    return `<div class="scene city"><div class="moon"></div>${blds}</div>`;
  };
  const SCENES = {
    sunset: () => '<div class="scene sunset"><div class="stars"></div><div class="sun"></div><div class="d1"></div><div class="d2"></div><div class="d3"></div></div>',
    aurora: () => '<div class="scene aurora"><div class="band b1"></div><div class="band b2"></div><div class="band b3"></div><div class="mtn"></div><div class="lake"></div></div>',
    ocean: () => '<div class="scene ocean"><div class="sun"></div><div class="shine"></div></div>',
    city,
    product: () => '<div class="scene product"><div class="disc"></div><div class="sale">−40%<small>SUMMER DROP</small></div></div>',
  };

  /** Inner markup of a reel: scene + caption/author/actions. */
  const reelContent = ({ scene, author, caption, ad = false, likes = '12.4K', ui = true }) => `
    ${SCENES[scene]()}
    ${ui ? `<div class="reel-ui">
      <div class="reel-meta">
        <div class="who"><span class="av"></span>${author}</div>
        <p>${caption}</p>
        ${ad ? '<span class="ad">Ad</span>' : `<span class="tag">${ICON.music.replace('<svg', '<svg width="13" height="13"')} Original audio</span>`}
      </div>
      <div class="reel-actions">
        <div>${ICON.heart}${likes}</div><div>${ICON.comment}318</div><div>${ICON.send}</div>
      </div>
    </div>` : ''}`;

  function reel(opts, parent) {
    const { x, y, w = 360, h = 640 } = opts;
    return place(el(`<div class="reel">${reelContent(opts)}</div>`), { x, y, w, h }, parent);
  }

  function copy({ eyebrow, title, text, extra = '', top }, parent = document.getElementById('stage')) {
    const node = el(`
      <div class="copy">
        <span class="eyebrow">${RP.logoSVG(`eyebrowLogo${Math.random().toString(36).slice(2, 6)}`)}${eyebrow}</span>
        <h1>${title}</h1>
        <p>${text}</p>
        ${extra}
      </div>`);
    if (top != null) { node.style.top = `${top}px`; node.style.transform = 'none'; }
    parent.appendChild(node);
    return node;
  }

  const chips = (items) => `<div class="chips">${items.map(([icon, label]) => `<span class="chip">${I[icon]}${label}</span>`).join('')}</div>`;
  const keys = (rows) => `<div class="keys">${rows.map(([combo, label]) =>
    `<div class="key-row"><span>${RP.shortcutKeys(combo).map((k) => `<kbd>${k}</kbd>`).join('')}</span>${label}</div>`).join('')}</div>`;

  const baseState = {
    enabled: true, hasVideo: true, kind: 'video', auto: true, playing: true, busy: false,
    time: 9.4, duration: 21.3, loopsDone: 0, playedSec: 9.4, untilNext: 11.9, autoProgress: 0.44,
    author: '@sunset.demo', sponsored: false, reelNumber: 12, watchSec: 263, sessionStart: 0,
    muted: false, volume: 0.8, speed: 1, hidden: false, hooks: true, pip: false, pipSupported: true,
  };

  /** Mount the real ReelPilot overlay. Pass `state` for a frozen state or `getState` for a live one. */
  function overlay({ state, getState, settings = {}, anchor = null, pos = { side: 'right', x: 56, y: 96 } }) {
    const s = Object.assign({}, baseState, state);
    const read = getState || (() => s);
    const ov = new RP.Overlay({
      onCommand() {}, onSettings() {}, onPanel() {},
      getState: read,
      getVideo: () => (typeof anchor === 'function' ? anchor() : anchor),
    });
    const set = RP.normalizeSettings(Object.assign({ dimIdle: false }, settings));
    ov.update(read(), set);
    ov.setPosition(Object.assign({ collapsed: false }, pos));
    ov.setVisible(true);
    ov.setShortcuts(SHORTCUTS);
    return ov;
  }

  function browser({ x, y, w, h, tabs, url, active = false, badge = '' }, parent) {
    const node = el(`
      <div class="browser">
        <div class="tabs">${tabs.map((t) => `<div class="tab ${t.on ? 'on' : ''} ${t.reels ? 'reels' : ''}"><i></i>${t.title}${t.sound ? `<span class="snd">${ICON.sound}</span>` : ''}</div>`).join('')}</div>
        <div class="bar">
          <div class="url">${url}</div>
          <div class="ext ${active ? 'active' : ''}">${RP.logoSVG(`toolbarLogo${Math.random().toString(36).slice(2, 6)}`)}<span class="badge"${badge ? '' : ' hidden'}>${badge}</span></div>
        </div>
        <div class="doc">
          <div class="h"></div>
          <div class="l" style="width:92%"></div><div class="l" style="width:86%"></div><div class="l" style="width:64%"></div>
          <div class="chart"><b style="height:40%"></b><b style="height:62%"></b><b style="height:48%"></b><b style="height:80%"></b><b style="height:70%"></b><b style="height:95%"></b></div>
          <div class="l" style="width:90%"></div><div class="l" style="width:78%"></div><div class="l" style="width:84%"></div><div class="l" style="width:52%"></div>
        </div>
      </div>`);
    return place(node, { x, y, w, h }, parent);
  }

  window.StudioKit = { RP, I, ICON, SHORTCUTS, SCENES, el, place, reel, reelContent, copy, chips, keys, baseState, overlay, browser };
})();
