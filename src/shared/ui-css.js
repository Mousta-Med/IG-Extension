/* ReelPilot — design tokens + control styles shared by the overlay and the popup. */
(() => {
  'use strict';
  const RP = (globalThis.ReelPilot = globalThis.ReelPilot || {});

  RP.UI_CSS = String.raw`
.rp-ui {
  --rp-bg-solid: #121217;
  --rp-surface: rgba(255, 255, 255, 0.055);
  --rp-surface-hover: rgba(255, 255, 255, 0.11);
  --rp-border: rgba(255, 255, 255, 0.085);
  --rp-border-strong: rgba(255, 255, 255, 0.16);
  --rp-text: #f6f6f8;
  --rp-text-2: rgba(246, 246, 248, 0.7);
  --rp-text-3: rgba(246, 246, 248, 0.46);
  --rp-pink: #ff2e74;
  --rp-ok: #3ddc97;
  --rp-warn: #fcd34d;
  --rp-grad: linear-gradient(120deg, #feda75 0%, #fa7e1e 22%, #d62976 52%, #962fbf 78%, #4f5bd5 100%);
  --rp-grad-h: linear-gradient(90deg, #fa7e1e, #d62976 50%, #962fbf);
  --rp-grad-soft: linear-gradient(120deg, rgba(250, 126, 30, 0.2), rgba(214, 41, 118, 0.22) 48%, rgba(79, 91, 213, 0.22));
  --rp-font: "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif;
  --rp-ease: cubic-bezier(.2, .9, .3, 1);
  --rp-spring: cubic-bezier(.3, 1.45, .5, 1);
  font: 500 12.5px/1.35 var(--rp-font);
  color: var(--rp-text);
  letter-spacing: .003em;
  -webkit-font-smoothing: antialiased;
  text-align: left;
}
.rp-ui *, .rp-ui *::before, .rp-ui *::after { box-sizing: border-box; }
.rp-ui button {
  font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0;
  cursor: pointer; -webkit-tap-highlight-color: transparent; text-transform: none; letter-spacing: inherit;
}
.rp-ui button:disabled { cursor: default; }
.rp-ui svg { display: block; flex: none; }
.rp-ui [hidden] { display: none !important; }
.rp-ui :focus { outline: none; }
.rp-ui button:focus-visible, .rp-ui [tabindex]:focus-visible, .rp-ui .rp-toggle input:focus-visible + .rp-switch,
.rp-ui .rp-range:focus-visible { outline: 2px solid rgba(255, 255, 255, .9); outline-offset: 2px; }

/* ── Now playing ───────────────────────────────────────── */
.rp-now { padding: 2px 2px 0; }
.rp-now-top { display: flex; align-items: center; gap: 8px; min-height: 20px; }
.rp-author {
  flex: 1; min-width: 0; font-weight: 650; font-size: 13px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rp-reelno { color: var(--rp-text-3); font-size: 11.5px; font-variant-numeric: tabular-nums; }
.rp-badge {
  font-size: 9.5px; font-weight: 750; letter-spacing: .07em; text-transform: uppercase;
  padding: 2px 6px; border-radius: 6px; background: rgba(252, 211, 77, .14); color: var(--rp-warn);
}
.rp-bar { position: relative; height: 16px; margin: 7px 0 1px; cursor: pointer; touch-action: none; }
.rp-bar::before {
  content: ""; position: absolute; left: 0; right: 0; top: 6px; height: 4px; border-radius: 4px;
  background: rgba(255, 255, 255, .13);
}
.rp-bar-fill {
  position: absolute; left: 0; right: 0; top: 6px; height: 4px; border-radius: 4px;
  background: var(--rp-grad-h); clip-path: inset(0 100% 0 0 round 4px);
}
.rp-bar-knob {
  position: absolute; top: 3px; left: 0; width: 10px; height: 10px; margin-left: -5px; border-radius: 50%;
  background: #fff; box-shadow: 0 0 0 3px rgba(255, 46, 116, .28), 0 2px 6px rgba(0, 0, 0, .45);
  opacity: 0; transform: scale(.5); transition: opacity .15s, transform .2s var(--rp-spring);
}
.rp-bar:hover .rp-bar-knob, .rp-bar.dragging .rp-bar-knob, .rp-bar:focus-visible .rp-bar-knob { opacity: 1; transform: scale(1); }
.rp-times {
  display: flex; justify-content: space-between; gap: 8px;
  font-size: 11px; color: var(--rp-text-3); font-variant-numeric: tabular-nums;
}
.rp-loop { color: var(--rp-text-2); font-weight: 600; }

/* ── Transport ─────────────────────────────────────────── */
.rp-transport {
  display: grid; grid-template-columns: 1fr auto auto auto 1fr; align-items: center; gap: 10px; padding: 10px 0 14px;
}
.rp-transport > .rp-side:first-child { justify-self: start; }
.rp-transport > .rp-side:last-child { justify-self: end; }
.rp-side {
  width: 48px; height: 48px; border-radius: 14px; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 4px; color: var(--rp-text-3); font-size: 9.5px; font-weight: 700; letter-spacing: .02em;
  white-space: nowrap; transition: background .15s, color .15s;
}
.rp-side > span { display: block; line-height: 1; }
.rp-side svg { width: 19px; height: 19px; }
.rp-side:hover:not(:disabled) { background: rgba(255, 255, 255, .07); color: var(--rp-text); }
.rp-side.on { color: #ff6fa0; background: rgba(255, 46, 116, .1); }
.rp-side:disabled { opacity: .3; }
.rp-tbtn {
  width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
  background: var(--rp-surface); border: 1px solid var(--rp-border) !important;
  transition: background .15s, transform .15s var(--rp-spring), border-color .15s;
}
.rp-tbtn:hover { background: var(--rp-surface-hover); border-color: var(--rp-border-strong) !important; }
.rp-tbtn:active { transform: scale(.9); }
.rp-tbtn svg { width: 20px; height: 20px; }
.rp-play { position: relative; width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; }
.rp-ring { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); pointer-events: none; }
.rp-ring-track { fill: none; stroke: rgba(255, 255, 255, .1); stroke-width: 3; }
.rp-ring-fill {
  fill: none; stroke-width: 3; stroke-linecap: round;
  stroke-dasharray: 163.36; stroke-dashoffset: 163.36; transition: stroke-dashoffset .2s linear, opacity .3s;
}
.rp-play-icon {
  width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center;
  background: #fff; color: #121217; box-shadow: 0 8px 22px -4px rgba(0, 0, 0, .55);
  transition: transform .2s var(--rp-spring);
}
.rp-play:hover .rp-play-icon { transform: scale(1.05); }
.rp-play:active .rp-play-icon { transform: scale(.92); }
.rp-play-icon svg { width: 22px; height: 22px; }
.rp-play-icon.is-play svg { transform: translateX(1px); }

/* ── Auto-scroll card ──────────────────────────────────── */
.rp-auto {
  position: relative; display: flex; align-items: center; gap: 12px; padding: 11px 12px;
  border-radius: 15px; background: var(--rp-surface); border: 1px solid var(--rp-border);
  transition: border-color .3s, box-shadow .3s; isolation: isolate; overflow: hidden; cursor: pointer;
}
.rp-auto::before {
  content: ""; position: absolute; inset: 0; z-index: -1; background: var(--rp-grad-soft);
  opacity: 0; transition: opacity .35s;
}
.rp-auto::after {
  content: ""; position: absolute; z-index: -1; top: 0; bottom: 0; width: 40%; left: -40%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, .08), transparent);
  opacity: 0;
}
.rp-auto.on { border-color: rgba(255, 46, 116, .45); box-shadow: 0 10px 30px -12px rgba(214, 41, 118, .75); }
.rp-auto.on::before { opacity: 1; }
.rp-auto.on::after { opacity: 1; animation: rp-sheen 3.2s ease-in-out infinite; }
.rp-auto-icon {
  width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; flex: none;
  background: rgba(255, 255, 255, .08); color: var(--rp-text-2); transition: background .3s, color .3s;
}
.rp-auto-icon svg { width: 18px; height: 18px; }
.rp-auto.on .rp-auto-icon { background: var(--rp-grad); color: #fff; box-shadow: 0 6px 16px -4px rgba(214, 41, 118, .8); }
.rp-auto-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.rp-auto-title { font-weight: 700; font-size: 13.5px; letter-spacing: -.005em; }
.rp-auto-sub {
  font-size: 11.5px; color: var(--rp-text-2); font-variant-numeric: tabular-nums;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* ── Switch ────────────────────────────────────────────── */
.rp-switch {
  position: relative; flex: none; width: 44px; height: 26px; border-radius: 999px;
  background: rgba(255, 255, 255, .17); transition: background .3s;
}
.rp-switch-knob {
  position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%;
  background: #fff; box-shadow: 0 2px 6px rgba(0, 0, 0, .4); transition: transform .3s var(--rp-spring);
}
.rp-switch[aria-checked="true"], .rp-toggle input:checked + .rp-switch { background: var(--rp-grad); }
.rp-switch[aria-checked="true"] .rp-switch-knob { transform: translateX(18px); }
.rp-switch.sm { width: 36px; height: 22px; }
.rp-switch.sm .rp-switch-knob { width: 16px; height: 16px; }
.rp-toggle input:checked + .rp-switch.sm .rp-switch-knob { transform: translateX(14px); }

/* ── Settings rows ─────────────────────────────────────── */
.rp-settings { display: flex; flex-direction: column; gap: 9px; padding: 14px 0 2px; }
.rp-row { display: flex; align-items: center; gap: 10px; min-height: 32px; }
.rp-label { width: 56px; flex: none; color: var(--rp-text-2); font-size: 12px; font-weight: 550; }
.rp-hint { color: var(--rp-text-3); font-size: 11px; }

.rp-seg {
  position: relative; flex: 1; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; padding: 3px;
  border-radius: 11px; background: rgba(255, 255, 255, .055); border: 1px solid var(--rp-border);
}
.rp-seg button {
  position: relative; z-index: 1; height: 26px; border-radius: 8px; font-size: 12px; font-weight: 600;
  color: var(--rp-text-2); transition: color .2s;
}
.rp-seg button:hover { color: var(--rp-text); }
.rp-seg button[aria-checked="true"] { color: #fff; }
.rp-seg-pill {
  position: absolute; z-index: 0; top: 3px; bottom: 3px; left: 3px; width: calc((100% - 6px) / 2);
  border-radius: 8px; background: rgba(255, 255, 255, .15);
  box-shadow: 0 1px 3px rgba(0, 0, 0, .35), inset 0 0 0 1px rgba(255, 255, 255, .07);
  transition: transform .35s var(--rp-spring);
}
.rp-seg[data-index="1"] .rp-seg-pill { transform: translateX(100%); }

.rp-chips { flex: 1; display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; }
.rp-chips button {
  height: 28px; border-radius: 8px; font-size: 11.5px; font-weight: 650; color: var(--rp-text-2);
  background: rgba(255, 255, 255, .055); border: 1px solid transparent !important; font-variant-numeric: tabular-nums;
  transition: background .15s, color .15s, transform .15s var(--rp-spring);
}
.rp-chips button:hover { background: rgba(255, 255, 255, .1); color: var(--rp-text); }
.rp-chips button:active { transform: scale(.92); }
.rp-chips button[aria-checked="true"] {
  color: #fff;
  background: linear-gradient(#2a1424, #2a1424) padding-box, var(--rp-grad) border-box;
}

.rp-stepper {
  display: flex; align-items: center; gap: 2px; padding: 3px; border-radius: 11px;
  background: rgba(255, 255, 255, .055); border: 1px solid var(--rp-border);
}
.rp-stepper button {
  width: 28px; height: 26px; border-radius: 8px; display: grid; place-items: center; color: var(--rp-text-2);
  transition: background .15s, color .15s;
}
.rp-stepper button:hover:not(:disabled) { background: rgba(255, 255, 255, .1); color: var(--rp-text); }
.rp-stepper button:disabled { opacity: .3; }
.rp-stepper button svg { width: 14px; height: 14px; }
.rp-stepper output { min-width: 32px; text-align: center; font-weight: 700; font-variant-numeric: tabular-nums; }

.rp-range-wrap { flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0; }
.rp-range-wrap output {
  min-width: 34px; text-align: right; font-weight: 650; color: var(--rp-text-2); font-variant-numeric: tabular-nums;
}
.rp-range {
  -webkit-appearance: none; appearance: none; flex: 1; min-width: 0; height: 22px; margin: 0;
  background: transparent; cursor: pointer; --p: 50%;
}
.rp-range::-webkit-slider-runnable-track {
  height: 4px; border-radius: 4px;
  background: linear-gradient(90deg, #fa7e1e, #d62976 55%, #962fbf) 0 0 / var(--p) 100% no-repeat, rgba(255, 255, 255, .14);
}
.rp-range::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none; width: 14px; height: 14px; margin-top: -5px; border-radius: 50%;
  background: #fff; border: 0; box-shadow: 0 0 0 4px rgba(255, 46, 116, .2), 0 2px 6px rgba(0, 0, 0, .45);
  transition: transform .2s var(--rp-spring), box-shadow .2s;
}
.rp-range:hover::-webkit-slider-thumb { box-shadow: 0 0 0 6px rgba(255, 46, 116, .22), 0 2px 6px rgba(0, 0, 0, .45); }
.rp-range:active::-webkit-slider-thumb { transform: scale(1.2); }
.rp-mini {
  width: 28px; height: 28px; flex: none; border-radius: 8px; display: grid; place-items: center;
  color: var(--rp-text-2); transition: background .15s, color .15s;
}
.rp-mini:hover { background: rgba(255, 255, 255, .09); color: var(--rp-text); }
.rp-mini svg { width: 18px; height: 18px; }

/* ── Options (collapsible) ─────────────────────────────── */
.rp-more { margin-top: 10px; border-top: 1px solid var(--rp-border); }
.rp-more-head {
  width: 100%; display: flex; align-items: center; gap: 8px; padding: 10px 2px 8px;
  color: var(--rp-text-2); font-weight: 650;
}
.rp-more-head:hover { color: var(--rp-text); }
.rp-more-head svg { width: 16px; height: 16px; }
.rp-more-head span { flex: 1; text-align: left; }
.rp-more-head .rp-chev { transition: transform .3s var(--rp-ease); }
.rp-more.open .rp-more-head .rp-chev { transform: rotate(180deg); }
.rp-more-body { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .35s var(--rp-ease); }
.rp-more.open .rp-more-body { grid-template-rows: 1fr; }
.rp-more-inner { overflow: hidden; min-height: 0; }
.rp-toggle {
  position: relative; display: flex; align-items: center; gap: 12px; padding: 7px 8px; margin: 0 -8px;
  border-radius: 11px; cursor: pointer; transition: background .15s;
}
.rp-toggle:hover { background: rgba(255, 255, 255, .045); }
.rp-toggle-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.rp-toggle-text b { font-weight: 600; font-size: 12.5px; }
.rp-toggle-text small { font-size: 11px; color: var(--rp-text-3); line-height: 1.3; }
.rp-toggle input { position: absolute; opacity: 0; width: 1px; height: 1px; margin: 0; pointer-events: none; }

@keyframes rp-sheen { 0%, 35% { transform: translateX(0); } 100% { transform: translateX(360%); } }

@media (prefers-reduced-motion: reduce) {
  .rp-ui *, .rp-ui *::before, .rp-ui *::after { animation: none !important; transition: none !important; }
}
`;
})();
