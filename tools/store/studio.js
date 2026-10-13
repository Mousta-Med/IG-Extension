/* ReelPilot store studio — builds each store graphic from the extension's real UI components.
 * studio.html?shot=1..5 → 1280×800 screenshots · ?shot=promo → 440×280 · ?shot=marquee → 1400×560
 */
(() => {
  'use strict';
  const { RP, I, ICON, SCENES, el, place, reel, copy, chips, keys, overlay, browser } = window.StudioKit;
  const stage = document.getElementById('stage');
  const shot = new URLSearchParams(location.search).get('shot') || '1';

  // ── Shots ──
  const SHOTS = {
    1() {
      stage.appendChild(el('<div class="glow"></div>'));
      copy({
        eyebrow: 'ReelPilot',
        title: 'Instagram Reels<br><span class="grad">on autopilot</span>',
        text: 'Moves to the next reel when the one you’re watching ends — after 1 to 10 plays, or on a timer.',
        extra: chips([['zap', 'Auto-scroll'], ['reels', 'Background play'], ['pip', 'Picture-in-Picture']]),
      }).style.width = '400px';
      reel({ x: 500, y: 80, scene: 'sunset', author: '@sunset.demo', caption: 'Golden hour over the dunes' });
      overlay({ state: {}, pos: { side: 'right', x: 56, y: 96 } });
    },

    2() {
      stage.appendChild(el('<div class="glow warm"></div>'));
      copy({
        eyebrow: 'On-reel controls',
        title: 'Controls right<br><span class="grad">on the reel</span>',
        text: 'A slim bar sits on top of the reel: play, skip, auto-scroll with a countdown, speed and Picture-in-Picture. It fades away while you watch.',
      });
      const r = reel({ x: 660, y: 50, w: 394, h: 700, scene: 'aurora', author: '@northern.demo', caption: 'Aurora night over the lake', likes: '48.1K' });
      overlay({ state: { author: '@northern.demo', untilNext: 7.2, autoProgress: 0.62, time: 11.6, duration: 18.7 }, settings: { controls: 'reel' }, anchor: r });
    },

    3() {
      stage.appendChild(el('<div class="glow"></div>'));
      copy({
        eyebrow: 'Background play',
        title: 'Keeps rolling<br><span class="grad">in any tab</span>',
        text: 'Switch tabs and your reels keep playing. Pop one into Picture-in-Picture and the window follows every next reel.',
      });
      browser({
        x: 548, y: 84, w: 680, h: 600, url: 'docs.example.com/q3-report',
        tabs: [{ title: 'Q3 report — Docs', on: true }, { title: 'Reels', reels: true, sound: true }],
      });
      const pip = el(`
        <div class="pip">
          ${SCENES.city()}
          <div class="pip-top"><span>${ICON.back}</span><span>${ICON.close}</span></div>
          <div class="pip-ctrl"><span>${ICON.prevTrack}</span><span class="big">${ICON.pause}</span><span>${ICON.nextTrack}</span></div>
          <div class="pip-progress"><b></b></div>
        </div>`);
      place(pip, { x: 960, y: 300 });
      place(el(`<div class="callout"><span class="ico">${I.zap}</span>Next reel in 4s — follows auto-scroll</div>`), { x: 640, y: 660 });
    },

    4() {
      stage.appendChild(el('<div class="glow warm"></div>'));
      copy({
        eyebrow: 'Remote control',
        title: 'A remote in<br><span class="grad">your toolbar</span>',
        text: 'Play, skip and auto-scroll from any tab, without switching back.',
        extra: keys([['Alt+Shift+S', 'Auto-scroll on / off'], ['Alt+Shift+K', 'Play / pause'], ['Alt+Shift+Down', 'Next reel'], ['Alt+Shift+Up', 'Previous reel']]),
      });
      browser({
        x: 548, y: 40, w: 690, h: 720, url: 'mail.example.com/inbox', active: true, badge: '12',
        tabs: [{ title: 'Inbox — Mail', on: true }, { title: 'Reels', reels: true, sound: true }],
      });
      const frame = el('<iframe class="popup-frame" src="../../src/popup/popup.html"></iframe>');
      place(frame, { x: 548 + 690 - 360 - 12, y: 40 + 38 + 44 - 2, h: 524 });
    },

    5() {
      stage.appendChild(el('<div class="glow"></div>'));
      copy({
        eyebrow: 'Your rules',
        title: 'Skip ads.<br><span class="grad">Your pace.</span>',
        text: 'Jump over sponsored reels automatically, pick 0.5× to 2× speed, and choose how many times each reel plays.',
      }).style.width = '400px';
      reel({ x: 500, y: 80, scene: 'product', author: '@brand.demo', caption: 'The summer drop is here', ad: true, likes: '2.1K' });
      const ov = overlay({
        state: { author: '@brand.demo', sponsored: true, busy: true, untilNext: 0, autoProgress: 1, time: 3.2, duration: 15, speed: 1.25 },
        settings: { skipSponsored: true, speed: 1.25, autoPip: true },
        pos: { side: 'right', x: 56, y: 28 },
      });
      ov.shadow.querySelector('[data-ref="moreToggle"]').click();
      place(el(`<div class="callout"><span class="ico">${I.skip}</span>Skipping sponsored reel</div>`), { x: 572, y: 104 });
    },

    promo() {
      document.body.className = 'promo';
      stage.appendChild(el('<div class="glow"></div>'));
      reel({ x: 322, y: 30, w: 170, h: 302, scene: 'sunset', ui: false }).style.transform = 'rotate(8deg)';
      place(el(`
        <div class="brand-lockup">
          <span class="logo" style="width:68px;height:68px">${RP.logoSVG('promoLogo')}</span>
          <div><div class="name" style="font-size:38px">ReelPilot</div><div class="tag" style="font-size:16px">Reels on autopilot</div></div>
        </div>`), { x: 30, y: 104 });
    },

    marquee() {
      document.body.className = 'marquee';
      stage.appendChild(el('<div class="glow warm"></div>'));
      place(el(`
        <div class="brand-lockup">
          <span class="logo" style="width:104px;height:104px">${RP.logoSVG('marqueeLogo')}</span>
          <div><div class="name" style="font-size:72px">ReelPilot</div>
          <div class="tag" style="font-size:24px">Auto-scroll for Instagram Reels — in any tab</div></div>
        </div>`), { x: 90, y: 200 });
      reel({ x: 890, y: 40, w: 270, h: 480, scene: 'sunset', ui: false }).style.transform = 'rotate(-7deg)';
      const front = reel({ x: 1060, y: 20, w: 290, h: 516, scene: 'aurora', author: '@northern.demo', caption: 'Aurora night over the lake', likes: '48.1K' });
      overlay({ state: { author: '@northern.demo', untilNext: 7.2, autoProgress: 0.62 }, settings: { controls: 'reel' }, anchor: front });
    },
  };

  (SHOTS[shot] || SHOTS[1])();
  document.fonts.ready.then(() => { document.body.dataset.ready = '1'; });
})();
