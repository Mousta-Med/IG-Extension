/* ReelPilot — on-page controls, rendered in a Shadow DOM above the reels.
 *
 * Two layouts (setting `controls`):
 *   'panel' → floating, draggable panel that minimizes to a small orb.
 *   'reel'  → compact control bar pinned to the top of the current reel; its ⚙ button opens the
 *             full panel as a popover.
 */
(() => {
  'use strict';
  const RP = (globalThis.ReelPilot = globalThis.ReelPilot || {});
  const I = RP.ICONS;
  const HOST_ID = 'reelpilot-overlay';
  const ORB_C = 2 * Math.PI * 27;
  const HUD_C = 2 * Math.PI * 17;
  const HUD_IDLE_MS = 2600;

  // Events that must not leak from our controls to Instagram's own handlers
  // (otherwise e.g. arrow keys on a slider would also scroll the reels).
  const CONTAINED_EVENTS = [
    'keydown', 'keyup', 'keypress', 'wheel', 'click', 'dblclick', 'mousedown', 'mouseup',
    'pointerdown', 'pointerup', 'touchstart', 'touchend', 'contextmenu', 'input', 'change',
  ];

  const ringGradient = (id, size) => `
    <defs>
      <linearGradient id="${id}" x1="0" y1="${size}" x2="${size}" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#feda75"/><stop offset=".3" stop-color="#fa7e1e"/>
        <stop offset=".6" stop-color="#d62976"/><stop offset="1" stop-color="#962fbf"/>
      </linearGradient>
    </defs>`;

  const OVERLAY_CSS = String.raw`
/* No !important here: inside a shadow root it would beat the host's inline styles (used to show/hide). */
:host { all: initial; }
.rp-root { position: fixed; top: 76px; right: 20px; pointer-events: none; }
.rp-root > .rp-panel, .rp-root > .rp-orb { pointer-events: auto; }

.rp-panel {
  position: relative; width: 312px; max-height: calc(100vh - 24px); overflow-y: auto; overflow-x: hidden;
  overscroll-behavior: contain; scrollbar-width: none; padding: 12px 14px; border-radius: 24px;
  background:
    radial-gradient(120% 55% at 100% 0%, rgba(214, 41, 118, .17), transparent 62%),
    radial-gradient(90% 45% at 0% 0%, rgba(250, 126, 30, .1), transparent 60%),
    linear-gradient(180deg, rgba(28, 28, 34, .86), rgba(13, 13, 17, .9));
  -webkit-backdrop-filter: blur(26px) saturate(170%);
  backdrop-filter: blur(26px) saturate(170%);
  border: 1px solid rgba(255, 255, 255, .1);
  box-shadow: 0 30px 70px -20px rgba(0, 0, 0, .75), 0 4px 18px rgba(0, 0, 0, .3), inset 0 1px 0 rgba(255, 255, 255, .08);
  transition: opacity .45s var(--rp-ease);
  animation: rp-pop .45s var(--rp-ease);
}
.rp-panel::-webkit-scrollbar { display: none; }
.rp-root.idle .rp-panel:not(:hover):not(:focus-within) { opacity: .38; }
.rp-root.dragging .rp-panel, .rp-root.dragging .rp-orb { transition: none; cursor: grabbing; }
.rp-root.popover .rp-icon-btn[data-act="collapse"] { display: none; }

.rp-head {
  display: flex; align-items: center; gap: 10px; margin: -2px -6px 12px 0;
  cursor: grab; user-select: none; -webkit-user-select: none; touch-action: none;
}
.rp-logo { width: 32px; height: 32px; flex: none; filter: drop-shadow(0 6px 12px rgba(214, 41, 118, .45)); }
.rp-logo svg { width: 100%; height: 100%; }
.rp-brand { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.rp-name { font-weight: 760; font-size: 14.5px; letter-spacing: -.015em; line-height: 1.1; }
.rp-status {
  display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600;
  color: var(--rp-text-3); line-height: 1.35;
}
.rp-status b { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.35; }
.rp-status i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: none; }
.rp-status[data-tone="live"] { color: #ff5c93; }
.rp-status[data-tone="live"] i { animation: rp-pulse 1.6s ease-out infinite; }
.rp-status[data-tone="play"] { color: var(--rp-ok); }
.rp-head-actions { display: flex; gap: 2px; }
.rp-icon-btn {
  width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center;
  color: var(--rp-text-3); transition: background .15s, color .15s;
}
.rp-icon-btn:hover { background: rgba(255, 255, 255, .08); color: var(--rp-text); }
.rp-icon-btn svg { width: 16px; height: 16px; }

.rp-foot {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 4px;
  padding-top: 10px; border-top: 1px solid var(--rp-border); font-size: 11px; color: var(--rp-text-3);
}
.rp-foot b { color: var(--rp-text-2); font-weight: 700; font-variant-numeric: tabular-nums; }
.rp-kbd { display: inline-flex; align-items: center; gap: 3px; }
.rp-kbd kbd {
  font: 650 10px/1 var(--rp-font); padding: 3px 5px 2px; border-radius: 5px; min-width: 18px; text-align: center;
  background: rgba(255, 255, 255, .07); border: 1px solid rgba(255, 255, 255, .1); border-bottom-width: 2px;
  color: var(--rp-text-2);
}
.rp-kbd span { margin-right: 3px; }

.rp-orb {
  position: relative; width: 60px; height: 60px; border-radius: 50%; display: grid; place-items: center;
  cursor: grab; touch-action: none; background: rgba(18, 18, 23, .88);
  -webkit-backdrop-filter: blur(18px) saturate(160%); backdrop-filter: blur(18px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, .12) !important;
  box-shadow: 0 16px 36px -8px rgba(0, 0, 0, .7), inset 0 1px 0 rgba(255, 255, 255, .08);
  transition: transform .25s var(--rp-spring), opacity .45s;
  animation: rp-pop .4s var(--rp-ease);
}
.rp-orb:hover { transform: scale(1.07); }
.rp-orb .rp-ring-fill { stroke-dasharray: 169.65; stroke-dashoffset: 169.65; }
.rp-orb-core { width: 40px; height: 40px; border-radius: 12px; overflow: hidden; display: grid; place-items: center; }
.rp-orb-core svg { width: 100%; height: 100%; }
.rp-orb-dot {
  position: absolute; top: 0; right: 0; width: 15px; height: 15px; border-radius: 50%;
  background: var(--rp-grad); border: 2.5px solid #121217; display: none;
}
.rp-root.auto .rp-orb-dot { display: block; animation: rp-pulse-dot 1.6s ease-out infinite; }
.rp-root.idle .rp-orb:not(:hover) { opacity: .6; }

/* Toasts */
.rp-toasts {
  position: absolute; top: calc(100% + 10px); right: 0; display: flex; flex-direction: column;
  align-items: flex-end; gap: 6px; width: max-content; pointer-events: none;
}
.rp-root.side-left .rp-toasts { right: auto; left: 0; align-items: flex-start; }
.rp-root.toasts-up .rp-toasts { top: auto; bottom: calc(100% + 10px); flex-direction: column-reverse; }
.rp-toast {
  display: flex; align-items: center; gap: 9px; max-width: 330px; padding: 7px 14px 7px 7px; border-radius: 999px;
  font-weight: 650; font-size: 12px; line-height: 1.25; color: var(--rp-text);
  background: rgba(20, 20, 26, .94); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, .12); box-shadow: 0 12px 30px -8px rgba(0, 0, 0, .7);
  animation: rp-toast-in .45s var(--rp-spring);
}
.rp-toast.out { animation: rp-toast-out .25s ease forwards; }
.rp-toast-ico {
  width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; flex: none;
  background: rgba(255, 255, 255, .1);
}
.rp-toast-ico svg { width: 13px; height: 13px; }
.rp-toast[data-tone="ok"] .rp-toast-ico { background: var(--rp-grad); color: #fff; }
.rp-toast[data-tone="warn"] .rp-toast-ico { background: rgba(252, 211, 77, .16); color: var(--rp-warn); }

/* ── On-reel control bar ───────────────────────────────── */
.rp-hud { position: fixed; left: 0; top: 0; transform-origin: 50% 0; pointer-events: none; will-change: transform; }
.rp-hud[hidden] { display: none !important; }
.rp-hud-bar {
  pointer-events: auto; display: flex; align-items: center; gap: 2px; padding: 4px 5px 4px 4px; border-radius: 999px;
  white-space: nowrap; background: rgba(16, 16, 20, .58);
  -webkit-backdrop-filter: blur(18px) saturate(170%); backdrop-filter: blur(18px) saturate(170%);
  border: 1px solid rgba(255, 255, 255, .14);
  box-shadow: 0 12px 32px -10px rgba(0, 0, 0, .75), inset 0 1px 0 rgba(255, 255, 255, .1);
  transition: opacity .35s var(--rp-ease), transform .35s var(--rp-ease), visibility .35s;
  animation: rp-hud-in .45s var(--rp-ease);
}
.rp-hud.off .rp-hud-bar { opacity: 0; visibility: hidden; transform: translateY(-6px); }
.rp-hud.idle .rp-hud-bar:not(:focus-within) { opacity: 0; transform: translateY(-4px); }
.rp-hud-play { position: relative; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; flex: none; }
.rp-hud-play .rp-ring-fill { stroke-dasharray: 106.81; stroke-dashoffset: 106.81; }
.rp-hud-play-icon {
  width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
  background: #fff; color: #121217; transition: transform .2s var(--rp-spring);
}
.rp-hud-play:hover .rp-hud-play-icon { transform: scale(1.08); }
.rp-hud-play:active .rp-hud-play-icon { transform: scale(.9); }
.rp-hud-play-icon svg { width: 14px; height: 14px; }
.rp-hud-play-icon.is-play svg { transform: translateX(1px); }
.rp-hud-btn {
  height: 32px; min-width: 32px; padding: 0 6px; border-radius: 999px; display: grid; place-items: center;
  color: rgba(255, 255, 255, .88); font-size: 12px; font-weight: 750; font-variant-numeric: tabular-nums;
  transition: background .15s, color .15s, transform .15s var(--rp-spring);
}
.rp-hud-btn:hover { background: rgba(255, 255, 255, .13); color: #fff; }
.rp-hud-btn:active { transform: scale(.9); }
.rp-hud-btn svg { width: 18px; height: 18px; }
.rp-hud-btn.on { color: #ff6fa0; background: rgba(255, 46, 116, .16); }
.rp-hud-speed { min-width: 42px; }
.rp-hud-sep { width: 1px; height: 18px; margin: 0 4px; background: rgba(255, 255, 255, .16); flex: none; }
.rp-hud-auto {
  height: 30px; display: inline-flex; align-items: center; gap: 7px; padding: 0 11px 0 10px; border-radius: 999px;
  font-size: 12px; font-weight: 750; color: rgba(255, 255, 255, .9); background: rgba(255, 255, 255, .09);
  transition: background .25s, box-shadow .25s, transform .15s var(--rp-spring);
}
.rp-hud-auto:hover { background: rgba(255, 255, 255, .16); }
.rp-hud-auto:active { transform: scale(.94); }
.rp-hud-auto i { width: 7px; height: 7px; border-radius: 50%; background: rgba(255, 255, 255, .45); flex: none; }
.rp-hud-auto b { font-weight: 650; opacity: .9; font-variant-numeric: tabular-nums; min-width: 20px; }
.rp-hud-auto b:empty { display: none; }
.rp-hud-auto.on { background: var(--rp-grad); color: #fff; box-shadow: 0 6px 18px -6px rgba(214, 41, 118, .95); }
.rp-hud-auto.on i { background: #fff; animation: rp-pulse-white 1.6s ease-out infinite; }
.rp-hud-toasts {
  position: absolute; top: calc(100% + 10px); left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 6px; width: max-content; pointer-events: none;
}

/* ── Video bar (bottom of the reel) ────────────────────── */
/* Idle: a thin progress line on the reel's bottom edge. Awake (pointer over the reel, or paused):
   seek bar, play/pause, time and volume. Only the controls themselves take clicks. */
.rp-vbar {
  position: fixed; left: 0; top: 0; box-sizing: border-box; pointer-events: none; will-change: transform;
  padding: 28px 8px 0; border-radius: 0 0 10px 10px;
  background: linear-gradient(180deg, transparent, rgba(0, 0, 0, .5));
  transition: background .3s;
}
.rp-vbar.off { display: none; }
.rp-vbar:not(.awake) { background: transparent; }
.rp-vbar-row {
  display: flex; align-items: center; gap: 2px; height: 34px; pointer-events: none;
  transition: opacity .25s, transform .25s var(--rp-ease);
}
.rp-vbar-row > :not(.rp-vbar-spacer) { pointer-events: auto; }
.rp-vbar:not(.awake) .rp-vbar-row { opacity: 0; transform: translateY(4px); }
.rp-vbar:not(.awake) .rp-vbar-row > * { pointer-events: none; }
.rp-vbar-btn {
  width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; color: #fff;
  transition: background .15s, transform .15s var(--rp-spring);
}
.rp-vbar-btn:hover { background: rgba(255, 255, 255, .15); }
.rp-vbar-btn:active { transform: scale(.9); }
.rp-vbar-btn svg { width: 18px; height: 18px; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .5)); }
.rp-vbar-time {
  padding: 0 6px; font-size: 12px; font-weight: 650; font-variant-numeric: tabular-nums; white-space: nowrap;
  color: rgba(255, 255, 255, .92); text-shadow: 0 1px 2px rgba(0, 0, 0, .6);
}
.rp-vbar-spacer { flex: 1; min-width: 0; }
.rp-vbar-vol { display: flex; align-items: center; }
.rp-vbar-vol .rp-range { flex: none; width: 0; opacity: 0; transition: width .2s var(--rp-ease), opacity .2s, margin .2s; }
.rp-vbar-vol:hover .rp-range, .rp-vbar-vol:focus-within .rp-range { width: 76px; opacity: 1; margin: 0 4px 0 6px; }
.rp-vbar-seek { position: relative; height: 16px; margin: 0 -8px; pointer-events: auto; cursor: pointer; touch-action: none; }
.rp-vbar:not(.awake) .rp-vbar-seek { pointer-events: none; }
.rp-vbar-rail {
  position: absolute; left: 10px; right: 10px; bottom: 6px; height: 4px; border-radius: 4px;
  background: rgba(255, 255, 255, .3); transition: height .15s, left .2s, right .2s, bottom .2s, border-radius .2s;
}
.rp-vbar-seek:hover .rp-vbar-rail, .rp-vbar-seek.dragging .rp-vbar-rail { height: 6px; bottom: 5px; }
.rp-vbar:not(.awake) .rp-vbar-rail { left: 0; right: 0; bottom: 0; height: 2px; border-radius: 0; background: rgba(255, 255, 255, .2); }
.rp-vbar-fill {
  position: absolute; inset: 0; border-radius: inherit; transform-origin: 0 50%; transform: scaleX(0);
  background: var(--rp-grad-h);
}
.rp-vbar-knob {
  position: absolute; top: 50%; left: 0; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%;
  background: #fff; box-shadow: 0 0 0 3px rgba(255, 46, 116, .3), 0 2px 6px rgba(0, 0, 0, .5);
  transform: scale(0); transition: transform .15s var(--rp-spring);
}
.rp-vbar-seek:hover .rp-vbar-knob, .rp-vbar-seek.dragging .rp-vbar-knob, .rp-vbar-seek:focus-visible .rp-vbar-knob { transform: scale(1); }
.rp-vbar:not(.awake) .rp-vbar-knob { transform: scale(0); }
.rp-vbar-tip {
  position: absolute; bottom: 18px; left: 0; padding: 3px 7px; border-radius: 6px; transform: translateX(-50%);
  font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; color: #fff; white-space: nowrap;
  background: rgba(16, 16, 20, .9); opacity: 0; pointer-events: none; transition: opacity .12s;
}
.rp-vbar-seek:hover .rp-vbar-tip, .rp-vbar-seek.dragging .rp-vbar-tip { opacity: 1; }

@keyframes rp-pop { from { opacity: 0; transform: translateY(-6px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes rp-hud-in { from { opacity: 0; transform: translateY(-8px) scale(.96); } to { opacity: 1; transform: none; } }
@keyframes rp-pulse { 0% { box-shadow: 0 0 0 0 rgba(255, 92, 147, .65); } 100% { box-shadow: 0 0 0 7px rgba(255, 92, 147, 0); } }
@keyframes rp-pulse-dot { 0% { box-shadow: 0 0 0 0 rgba(255, 46, 116, .6); } 100% { box-shadow: 0 0 0 9px rgba(255, 46, 116, 0); } }
@keyframes rp-pulse-white { 0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, .7); } 100% { box-shadow: 0 0 0 6px rgba(255, 255, 255, 0); } }
@keyframes rp-toast-in { from { opacity: 0; transform: translateY(-8px) scale(.9); } to { opacity: 1; transform: none; } }
@keyframes rp-toast-out { to { opacity: 0; transform: scale(.94); } }
`;

  const formatSpeed = (s) => `${Number(s.toFixed(2))}×`;

  class Overlay {
    constructor({ onCommand, onSettings, onPanel, getState, getVideo }) {
      this.onCommand = onCommand;
      this.onSettings = onSettings;
      this.onPanel = onPanel;
      this.getState = getState;
      this.getVideo = getVideo || (() => null);
      this.pos = { side: 'right', x: 20, y: 76, collapsed: false };
      this.settings = RP.normalizeSettings();
      this.state = {};
      this.visible = false;
      this.hovering = false;
      this.raf = 0;
      this.idleTimer = 0;
      this.dragMoved = false;
      this.panelOpen = false;     // 'reel' layout: full panel shown as a popover
      this.pointer = null;        // last pointer position, for waking the on-reel bar
      this.hudHover = false;
      this.hudWakeUntil = 0;
      this.hudWidth = 340;
      this.hudPlaying = null;

      document.getElementById(HOST_ID)?.remove();
      const host = (this.host = document.createElement('div'));
      host.id = HOST_ID;
      const hostStyle = {
        position: 'fixed', top: '0', left: '0', width: '0', height: '0', margin: '0', padding: '0',
        border: '0', overflow: 'visible', 'z-index': '2147483647', display: 'none',
      };
      for (const [k, v] of Object.entries(hostStyle)) host.style.setProperty(k, v, 'important');
      this.shadow = host.attachShadow({ mode: 'open' });
      RP.adoptStyles(this.shadow, RP.UI_CSS + OVERLAY_CSS);

      const root = (this.root = document.createElement('div'));
      root.className = 'rp-ui rp-root side-right';
      RP.setHTML(root, `
        <div class="rp-panel" data-ref="panel" role="region" aria-label="ReelPilot controls">
          <header class="rp-head" data-ref="head" title="Drag to move">
            <span class="rp-logo">${RP.logoSVG('rpOverlayLogo')}</span>
            <span class="rp-brand">
              <span class="rp-name">ReelPilot</span>
              <span class="rp-status" data-ref="status" data-tone="idle"><i></i><b data-ref="statusText">Looking for reels…</b></span>
            </span>
            <span class="rp-head-actions">
              <button class="rp-icon-btn" data-act="collapse" title="Minimize" aria-label="Minimize panel">${I.minus}</button>
              <button class="rp-icon-btn" data-act="hide" data-ref="hideBtn" title="Hide panel — bring it back from the toolbar icon" aria-label="Hide panel">${I.close}</button>
            </span>
          </header>
          <div data-ref="controls"></div>
          <footer class="rp-foot">
            <span data-ref="stats"></span>
            <span class="rp-kbd" data-ref="kbd" title="Toggle auto-scroll from any tab"></span>
          </footer>
        </div>
        <button class="rp-orb" data-ref="orb" hidden aria-label="Open ReelPilot" title="ReelPilot — click to open, drag to move">
          <svg class="rp-ring" viewBox="0 0 60 60" aria-hidden="true">${ringGradient('rpOrbRing', 60)}
            <circle class="rp-ring-track" cx="30" cy="30" r="27"/>
            <circle class="rp-ring-fill" data-ref="orbRing" cx="30" cy="30" r="27" stroke="url(#rpOrbRing)"/>
          </svg>
          <span class="rp-orb-core">${RP.logoSVG('rpOrbLogo')}</span>
          <i class="rp-orb-dot"></i>
        </button>
        <div class="rp-toasts" data-ref="toasts" aria-live="polite"></div>`);

      const hud = document.createElement('div');
      hud.className = 'rp-ui rp-hud off';
      hud.hidden = true;
      RP.setHTML(hud, `
        <div class="rp-hud-bar" data-ref="hudBar" role="toolbar" aria-label="ReelPilot">
          <button class="rp-hud-play" data-hud="togglePlay" aria-label="Play or pause" title="Play / pause">
            <svg class="rp-ring" viewBox="0 0 40 40" aria-hidden="true">${ringGradient('rpHudRing', 40)}
              <circle class="rp-ring-track" cx="20" cy="20" r="17"/>
              <circle class="rp-ring-fill" data-ref="hudRing" cx="20" cy="20" r="17" stroke="url(#rpHudRing)"/>
            </svg>
            <span class="rp-hud-play-icon" data-ref="hudPlayIcon">${I.play}</span>
          </button>
          <button class="rp-hud-btn" data-hud="prev" title="Previous reel" aria-label="Previous reel">${I.up}</button>
          <button class="rp-hud-btn" data-hud="next" title="Next reel" aria-label="Next reel">${I.down}</button>
          <span class="rp-hud-sep"></span>
          <button class="rp-hud-auto" data-hud="toggleAuto" data-ref="hudAuto" title="Toggle auto-scroll" aria-pressed="false"><i></i><span>Auto</span><b data-ref="hudCount"></b></button>
          <span class="rp-hud-sep"></span>
          <button class="rp-hud-btn rp-hud-speed" data-hud="speed" data-ref="hudSpeed" title="Speed — click for faster, right-click for slower">1×</button>
          <button class="rp-hud-btn" data-hud="pip" data-ref="hudPip" title="Picture-in-Picture" aria-label="Picture-in-Picture">${I.pip}</button>
          <button class="rp-hud-btn" data-hud="panel" data-ref="hudPanel" title="All settings" aria-label="All settings">${I.settings}</button>
        </div>
        <div class="rp-hud-toasts" data-ref="hudToasts" aria-live="polite"></div>`);
      this.hud = hud;

      const vbar = document.createElement('div');
      vbar.className = 'rp-ui rp-vbar off';
      vbar.setAttribute('role', 'group');
      vbar.setAttribute('aria-label', 'Video controls');
      RP.setHTML(vbar, `
        <div class="rp-vbar-row">
          <button class="rp-vbar-btn" data-vbar="togglePlay" data-ref="vPlay" aria-label="Play" title="Play / pause">${I.play}</button>
          <span class="rp-vbar-time" data-ref="vTime">0:00 / 0:00</span>
          <span class="rp-vbar-spacer"></span>
          <span class="rp-vbar-vol">
            <input type="range" class="rp-range" data-ref="vVolume" min="0" max="100" step="1" aria-label="Volume">
            <button class="rp-vbar-btn" data-vbar="mute" data-ref="vMute" aria-label="Mute" title="Mute / unmute">${I.volume}</button>
          </span>
        </div>
        <div class="rp-vbar-seek" data-ref="vSeek" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div class="rp-vbar-rail" data-ref="vRail"><div class="rp-vbar-fill" data-ref="vFill"></div><div class="rp-vbar-knob" data-ref="vKnob"></div></div>
          <div class="rp-vbar-tip" data-ref="vTip">0:00</div>
        </div>`);
      this.vbar = vbar;
      this.vbarHover = false;
      this.vbarRect = null;       // last video rect the bar was pinned to
      this.vSeekDrag = null;      // { f, sentAt } while dragging the seek bar
      this.vPlaying = null;
      this.vMuteIcon = '';

      this.shadow.append(root, hud, vbar);
      this.refs = {};
      this.shadow.querySelectorAll('[data-ref]').forEach((el) => { this.refs[el.dataset.ref] = el; });

      this.controls = RP.createControls({ mount: this.refs.controls, variant: 'overlay', onCommand, onSettings });

      this.bind();
      (document.body || document.documentElement).appendChild(host);
    }

    get reelMode() { return this.settings.controls === 'reel'; }

    bind() {
      const { head, orb, hudBar } = this.refs;
      for (const type of CONTAINED_EVENTS) this.host.addEventListener(type, (e) => e.stopPropagation());

      this.root.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        if (this.reelMode) { this.setPanelOpen(false); return; } // popover: both buttons close it
        if (btn.dataset.act === 'collapse') this.setCollapsed(true);
        else if (btn.dataset.act === 'hide') this.onSettings({ showPanel: false });
      });

      head.addEventListener('pointerdown', (e) => this.startDrag(e, head));
      orb.addEventListener('pointerdown', (e) => this.startDrag(e, orb));
      orb.addEventListener('click', () => {
        if (this.dragMoved) return;
        this.setCollapsed(false);
      });

      this.root.addEventListener('pointerenter', () => { this.hovering = true; this.armIdle(); });
      this.root.addEventListener('pointerleave', () => { this.hovering = false; this.armIdle(); });

      // On-reel bar
      this.hud.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-hud]');
        if (!btn) return;
        this.wakeHud();
        const act = btn.dataset.hud;
        if (act === 'speed') this.stepSpeed(1);
        else if (act === 'pip') this.onCommand('togglePip');
        else if (act === 'panel') this.setPanelOpen(!this.panelOpen);
        else this.onCommand(act);
      });
      this.refs.hudSpeed.addEventListener('contextmenu', (e) => { e.preventDefault(); this.stepSpeed(-1); });
      hudBar.addEventListener('pointerenter', () => { this.hudHover = true; });
      hudBar.addEventListener('pointerleave', () => { this.hudHover = false; this.wakeHud(); });
      if (typeof ResizeObserver === 'function') {
        new ResizeObserver(() => { this.hudWidth = hudBar.offsetWidth || this.hudWidth; }).observe(hudBar);
      }

      this.bindVideoBar();

      this.onPointer = (e) => { this.pointer = { x: e.clientX, y: e.clientY, t: performance.now() }; };
      document.addEventListener('pointermove', this.onPointer, { capture: true, passive: true });
      this.onResize = () => this.applyPosition();
      window.addEventListener('resize', this.onResize);
    }

    bindVideoBar() {
      const { vSeek, vRail, vTip, vVolume } = this.refs;
      const bar = this.vbar;
      bar.addEventListener('pointerenter', () => { this.vbarHover = true; });
      bar.addEventListener('pointerleave', () => { this.vbarHover = false; });
      bar.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-vbar]');
        if (!btn) return;
        if (btn.dataset.vbar === 'mute') this.toggleMute();
        else this.onCommand(btn.dataset.vbar);
      });

      const fractionAt = (clientX) => {
        const r = vRail.getBoundingClientRect();
        return r.width ? RP.clamp((clientX - r.left) / r.width, 0, 1) : 0;
      };
      const seek = (f, final) => {
        const drag = this.vSeekDrag;
        if (drag) drag.f = f;
        // Seeking decodes a frame: while dragging, at most every 80 ms; always on release.
        if (!final && drag && performance.now() - drag.sentAt < 80) return;
        if (drag) drag.sentAt = performance.now();
        this.onCommand('seek', f);
      };
      const showTip = (clientX) => {
        const d = this.getState().duration || 0;
        const f = fractionAt(clientX);
        vTip.textContent = RP.formatTime(f * d);
        vTip.style.left = `${clientX - vSeek.getBoundingClientRect().left}px`;
      };
      vSeek.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || !(this.getState().duration > 0)) return;
        this.vSeekDrag = { f: fractionAt(e.clientX), sentAt: 0 };
        vSeek.classList.add('dragging');
        try { vSeek.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        seek(this.vSeekDrag.f, true);
      });
      vSeek.addEventListener('pointermove', (e) => {
        showTip(e.clientX);
        if (this.vSeekDrag) seek(fractionAt(e.clientX), false);
      });
      const endDrag = () => {
        const drag = this.vSeekDrag;
        if (!drag) return;
        this.vSeekDrag = null;
        vSeek.classList.remove('dragging');
        this.onCommand('seek', drag.f);
      };
      vSeek.addEventListener('pointerup', endDrag);
      vSeek.addEventListener('pointercancel', endDrag);
      vSeek.addEventListener('keydown', (e) => {
        const s = this.getState();
        const step = e.key === 'ArrowRight' ? 5 : e.key === 'ArrowLeft' ? -5 : 0;
        if (!step || !(s.duration > 0)) return;
        e.preventDefault();
        this.onCommand('seek', RP.clamp((s.time + step) / s.duration, 0, 1));
      });

      vVolume.addEventListener('input', () => {
        const v = Number(vVolume.value);
        vVolume.style.setProperty('--p', `${v}%`);
        this.onSettings({ volume: v / 100, muted: v === 0, audioManaged: true });
      });
    }

    toggleMute() {
      const s = this.getState();
      const muted = !(s.muted || s.volume === 0);
      const patch = { muted, audioManaged: true };
      if (!muted && (s.volume || 0) < 0.05) patch.volume = 0.6;
      this.onSettings(patch);
    }

    stepSpeed(dir) {
      const list = RP.SPEEDS;
      let i = list.findIndex((x) => Math.abs(x - this.settings.speed) < 0.001);
      if (i < 0) i = list.indexOf(1);
      this.onSettings({ speed: list[(i + dir + list.length) % list.length] });
    }

    // ── Layout ──
    applyLayout() {
      const reel = this.reelMode;
      const showRoot = !reel || this.panelOpen;
      this.root.style.display = showRoot ? '' : 'none';
      const collapsed = !reel && this.pos.collapsed;
      this.root.classList.toggle('collapsed', collapsed);
      this.root.classList.toggle('popover', reel);
      this.refs.panel.hidden = collapsed;
      this.refs.orb.hidden = !collapsed;
      this.refs.hideBtn.title = reel ? 'Close settings' : 'Hide panel — bring it back from the toolbar icon';
      this.hud.hidden = !reel;
      this.refs.hudPanel.classList.toggle('on', reel && this.panelOpen);
      if (showRoot) this.applyPosition();
    }

    setPanelOpen(open) {
      this.panelOpen = !!open;
      this.applyLayout();
      if (open) { this.render(); this.armIdle(); }
    }

    // ── Position / drag ──
    setPosition(pos) {
      if (!pos || typeof pos !== 'object') return;
      this.pos = {
        side: pos.side === 'left' ? 'left' : 'right',
        x: Number.isFinite(pos.x) ? pos.x : 20,
        y: Number.isFinite(pos.y) ? pos.y : 76,
        collapsed: !!pos.collapsed,
      };
      this.applyLayout();
    }

    applyPosition() {
      const style = this.root.style;
      const rect = this.root.getBoundingClientRect();
      const w = rect.width || (this.pos.collapsed ? 60 : 312);
      const h = rect.height || 60;
      const x = RP.clamp(this.pos.x, 8, Math.max(8, window.innerWidth - w - 8));
      const y = RP.clamp(this.pos.y, 8, Math.max(8, window.innerHeight - h - 8));
      style.top = `${y}px`;
      if (this.pos.side === 'left') { style.left = `${x}px`; style.right = 'auto'; }
      else { style.right = `${x}px`; style.left = 'auto'; }
      this.root.classList.toggle('side-left', this.pos.side === 'left');
      this.root.classList.toggle('side-right', this.pos.side !== 'left');
      this.root.classList.toggle('toasts-up', y + h + 130 > window.innerHeight);
    }

    startDrag(e, handle) {
      if (e.button !== 0) return;
      if (handle === this.refs.head && e.target.closest('button')) return;
      const rect = this.root.getBoundingClientRect();
      const start = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top };
      let moved = false;
      try { handle.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }

      const onMove = (ev) => {
        const dx = ev.clientX - start.x;
        const dy = ev.clientY - start.y;
        if (!moved && Math.hypot(dx, dy) < 4) return;
        if (!moved) { moved = true; this.root.classList.add('dragging'); }
        const left = start.left + dx;
        const side = left + rect.width / 2 < window.innerWidth / 2 ? 'left' : 'right';
        this.pos.side = side;
        this.pos.x = side === 'left' ? left : window.innerWidth - left - rect.width;
        this.pos.y = start.top + dy;
        this.applyPosition();
      };
      const onUp = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
        this.root.classList.remove('dragging');
        if (moved) {
          this.dragMoved = true;
          setTimeout(() => { this.dragMoved = false; }, 0); // swallow the click that follows a drag
          this.savePanel();
        }
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    }

    setCollapsed(collapsed) {
      this.pos.collapsed = !!collapsed;
      this.applyLayout();
      this.savePanel();
      if (!collapsed) this.render();
    }

    /** Re-attach if the page removed our host (e.g. a full re-render of <body>). */
    ensureAttached() {
      if (this.host.isConnected) return;
      (document.body || document.documentElement).appendChild(this.host);
      if (this.visible) {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
        this.startLoop();
      }
    }

    savePanel() {
      if (this.onPanel) this.onPanel(Object.assign({}, this.pos));
    }

    // ── Visibility / idle ──
    setVisible(visible) {
      visible = !!visible;
      if (visible === this.visible) return;
      this.visible = visible;
      this.host.style.setProperty('display', visible ? 'block' : 'none', 'important');
      if (visible) {
        this.applyLayout();
        this.render();
        this.armIdle();
        this.wakeHud();
        this.startLoop();
      }
    }

    armIdle() {
      clearTimeout(this.idleTimer);
      this.root.classList.remove('idle');
      if (!this.settings.dimIdle || this.hovering) return;
      this.idleTimer = setTimeout(() => this.root.classList.add('idle'), 2800);
    }

    wakeHud(ms = HUD_IDLE_MS) {
      this.hudWakeUntil = Math.max(this.hudWakeUntil, performance.now() + ms);
    }

    startLoop() {
      if (this.raf) return;
      const frame = () => {
        this.raf = 0;
        if (!this.visible || !this.host.isConnected) return;
        const s = this.getState();
        if (!this.refs.panel.hidden && this.root.style.display !== 'none') this.controls.progress(s);
        if (!this.refs.orb.hidden) this.paintOrb(s);
        if (this.reelMode) this.paintHud(s);
        this.paintVideoBar(s);
        this.raf = requestAnimationFrame(frame);
      };
      this.raf = requestAnimationFrame(frame);
    }

    paintOrb(s) {
      const d = s.duration || 0;
      const f = s.auto ? s.autoProgress || 0 : d ? s.time / d : 0;
      this.refs.orbRing.style.strokeDashoffset = String(ORB_C * (1 - RP.clamp(f, 0, 1)));
    }

    /** Pin the bar to the top of the current reel, scale it down on narrow reels, fade when idle. */
    paintHud(s) {
      const v = this.getVideo();
      let r = null;
      if (v && v.isConnected) {
        const b = v.getBoundingClientRect();
        if (b.width >= 120 && b.height >= 160 && b.bottom > 80 && b.top < window.innerHeight - 80) r = b;
      }
      this.hud.classList.toggle('off', !r);
      if (!r) return;

      const scale = Math.min(1, (r.width - 20) / this.hudWidth);
      const x = r.left + r.width / 2;
      const y = Math.max(8, r.top + 12);
      this.hud.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translateX(-50%) scale(${scale.toFixed(3)})`;

      const d = s.duration || 0;
      const f = s.auto ? s.autoProgress || 0 : d ? s.time / d : 0;
      this.refs.hudRing.style.strokeDashoffset = String(HUD_C * (1 - RP.clamp(f, 0, 1)));
      const count = s.auto && s.untilNext != null ? `${Math.ceil(s.untilNext)}s` : '';
      if (this.refs.hudCount.textContent !== count) this.refs.hudCount.textContent = count;

      const now = performance.now();
      const p = this.pointer;
      const near = !!p && now - p.t < HUD_IDLE_MS
        && p.x >= r.left - 16 && p.x <= r.right + 16 && p.y >= r.top - 16 && p.y <= r.bottom + 16;
      const awake = near || this.hudHover || now < this.hudWakeUntil || !this.settings.dimIdle || !s.playing;
      this.hud.classList.toggle('idle', !awake);
    }

    /** Pin the video bar to the bottom of the current reel; wake it while the pointer is over the reel. */
    paintVideoBar(s) {
      const bar = this.vbar;
      const v = this.getVideo();
      let r = null;
      if (this.settings.videoBar && s.kind === 'video' && v && v.isConnected && v.tagName === 'VIDEO') {
        const b = v.getBoundingClientRect();
        if (b.width >= 160 && b.height >= 200 && b.bottom > 120 && b.top < window.innerHeight - 120) r = b;
      }
      bar.classList.toggle('off', !r);
      this.vbarRect = r;
      if (!r) return;

      const left = Math.max(0, r.left);
      const width = Math.min(window.innerWidth, r.right) - left;
      const bottom = Math.min(window.innerHeight, r.bottom);
      const w = `${Math.round(width)}px`;
      if (bar.style.width !== w) bar.style.width = w;
      bar.style.transform = `translate(${left.toFixed(1)}px, ${bottom.toFixed(1)}px) translateY(-100%)`;

      const d = s.duration || 0;
      const f = this.vSeekDrag ? this.vSeekDrag.f : d ? RP.clamp(s.time / d, 0, 1) : 0;
      this.refs.vFill.style.transform = `scaleX(${f.toFixed(4)})`;
      this.refs.vKnob.style.left = `${(f * 100).toFixed(2)}%`;
      this.refs.vSeek.setAttribute('aria-valuenow', String(Math.round(f * 100)));
      const time = `${RP.formatTime(this.vSeekDrag ? f * d : s.time)} / ${RP.formatTime(d)}`;
      if (this.refs.vTime.textContent !== time) this.refs.vTime.textContent = time;

      const p = this.pointer;
      const near = !!p && performance.now() - p.t < HUD_IDLE_MS
        && p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
      const awake = near || this.vbarHover || !!this.vSeekDrag || !s.playing || !this.settings.dimIdle;
      bar.classList.toggle('awake', awake);
    }

    // ── Rendering ──
    update(state, settings) {
      const prev = this.state;
      this.state = state || {};
      if (settings) {
        const old = this.settings;
        this.settings = settings;
        if (settings.dimIdle !== old.dimIdle) this.armIdle();
        if (settings.controls !== old.controls) {
          this.panelOpen = false;
          this.applyLayout();
          this.wakeHud(4000);
        }
      }
      if (!!prev.auto !== !!this.state.auto) { this.armIdle(); this.wakeHud(); }
      if (prev.reelNumber !== this.state.reelNumber || prev.pip !== this.state.pip) this.wakeHud();
      this.render();
    }

    render() {
      const s = this.state;
      this.root.classList.toggle('auto', !!s.auto);
      if (!this.visible) return;
      this.renderHud(s);
      this.renderVideoBar(s);
      if (this.root.style.display === 'none') return;
      this.controls.update(s, this.settings);

      const profile = s.mode === 'popup';
      const autoText = profile ? 'Auto-playing posts' : 'Auto-scrolling';
      let tone = 'idle';
      let text = profile ? 'Looking for the post…' : 'Looking for reels…';
      if (s.hasVideo) {
        if (s.auto && (s.playing || s.busy)) { tone = 'live'; text = s.hidden ? `${autoText} in background` : autoText; }
        else if (s.auto) text = profile ? 'Auto-play · paused' : 'Auto-scroll · paused';
        else if (s.playing) { tone = 'play'; text = 'Playing'; }
        else text = 'Paused';
      }
      this.refs.status.dataset.tone = tone;
      if (this.refs.statusText.textContent !== text) this.refs.statusText.textContent = text;

      const n = s.reelNumber || 0;
      const unit = profile ? 'post' : 'reel';
      RP.setHTML(this.refs.stats, `<b>${n}</b> ${unit}${n === 1 ? '' : 's'} · <b>${RP.formatSpan(s.watchSec || 0)}</b> watched`);
    }

    renderVideoBar(s) {
      const playing = !!s.playing;
      if (this.vPlaying !== playing) {
        this.vPlaying = playing;
        RP.setHTML(this.refs.vPlay, playing ? I.pause : I.play);
        this.refs.vPlay.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      }
      const vol = s.volume != null ? s.volume : this.settings.volume;
      const muted = s.muted != null ? s.muted : this.settings.muted;
      const shown = muted ? 0 : Math.round(vol * 100);
      const icon = shown === 0 ? 'muted' : shown < 50 ? 'volumeLow' : 'volume';
      if (this.vMuteIcon !== icon) {
        this.vMuteIcon = icon;
        RP.setHTML(this.refs.vMute, I[icon]);
        this.refs.vMute.setAttribute('aria-label', shown === 0 ? 'Unmute' : 'Mute');
      }
      const range = this.refs.vVolume;
      if (this.shadow.activeElement !== range && String(range.value) !== String(shown)) {
        range.value = shown;
        range.style.setProperty('--p', `${shown}%`);
      }
    }

    renderHud(s) {
      if (!this.reelMode) return;
      const playing = !!s.playing;
      if (this.hudPlaying !== playing) {
        this.hudPlaying = playing;
        RP.setHTML(this.refs.hudPlayIcon, playing ? I.pause : I.play);
        this.refs.hudPlayIcon.classList.toggle('is-play', !playing);
        this.refs.hudPlayIcon.parentElement.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      }
      this.refs.hudAuto.classList.toggle('on', !!s.auto);
      this.refs.hudAuto.setAttribute('aria-pressed', String(!!s.auto));
      const speed = formatSpeed(this.settings.speed);
      if (this.refs.hudSpeed.textContent !== speed) this.refs.hudSpeed.textContent = speed;
      this.refs.hudPip.classList.toggle('on', !!s.pip);
      this.refs.hudPip.hidden = s.pipSupported === false;
      this.refs.hudPip.title = s.pip ? 'Exit Picture-in-Picture' : 'Picture-in-Picture';
      this.refs.hudPanel.classList.toggle('on', this.panelOpen);
    }

    setShortcuts(map) {
      this.controls.setShortcuts(map || {});
      const tip = (cmd, label) => (map && map[cmd] ? `${label} (${map[cmd]})` : label);
      this.hud.querySelector('[data-hud="prev"]').title = tip('prev', 'Previous reel');
      this.hud.querySelector('[data-hud="next"]').title = tip('next', 'Next reel');
      this.hud.querySelector('[data-hud="togglePlay"]').title = tip('togglePlay', 'Play / pause');
      this.refs.hudAuto.title = tip('toggleAuto', 'Toggle auto-scroll');
      const combo = map && map.toggleAuto;
      const kbd = this.refs.kbd;
      if (!combo) { kbd.hidden = true; return; }
      kbd.hidden = false;
      const keys = RP.shortcutKeys(combo);
      RP.setHTML(kbd, `<span>Auto</span>${keys.map(() => '<kbd></kbd>').join('')}`);
      kbd.querySelectorAll('kbd').forEach((el, i) => { el.textContent = keys[i]; });
    }

    toast({ text, tone = 'info', icon } = {}) {
      if (!text || !this.visible) return;
      const box = this.reelMode && !this.panelOpen ? this.refs.hudToasts : this.refs.toasts;
      const el = document.createElement('div');
      el.className = 'rp-toast';
      el.dataset.tone = tone;
      const ico = document.createElement('span');
      ico.className = 'rp-toast-ico';
      RP.setHTML(ico, I[icon] || (tone === 'warn' ? I.alert : tone === 'ok' ? I.check : I.zap));
      const label = document.createElement('span');
      label.textContent = text;
      el.append(ico, label);
      box.appendChild(el);
      while (box.children.length > 3) box.firstElementChild.remove();
      this.armIdle();
      this.wakeHud();
      setTimeout(() => {
        el.classList.add('out');
        setTimeout(() => el.remove(), 260);
      }, tone === 'warn' ? 4200 : 2400);
    }

    destroy() {
      cancelAnimationFrame(this.raf);
      clearTimeout(this.idleTimer);
      window.removeEventListener('resize', this.onResize);
      document.removeEventListener('pointermove', this.onPointer, { capture: true });
      this.visible = false;
      this.host.remove();
    }
  }

  RP.Overlay = Overlay;
})();
