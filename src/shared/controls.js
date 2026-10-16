/* ReelPilot — the control surface, shared by the on-page overlay and the toolbar popup.
 *
 *   const c = ReelPilot.createControls({ mount, variant, onCommand, onSettings });
 *   c.update(state, settings);   // full render (cheap; diffed)
 *   c.progress(state);           // hot path: bar, ring, countdown
 */
(() => {
  'use strict';
  const RP = (globalThis.ReelPilot = globalThis.ReelPilot || {});
  const I = RP.ICONS;
  const RING_C = 2 * Math.PI * 26;

  const toggle = (key, title, desc) => `
    <label class="rp-toggle">
      <span class="rp-toggle-text"><b>${title}</b><small>${desc}</small></span>
      <input type="checkbox" data-setting="${key}">
      <span class="rp-switch sm" aria-hidden="true"><span class="rp-switch-knob"></span></span>
    </label>`;

  const template = (variant, gid) => `
    <section class="rp-now">
      <div class="rp-now-top">
        <span class="rp-author" data-ref="author">Instagram Reels</span>
        <span class="rp-badge" data-ref="sponsored" hidden>Ad</span>
        <span class="rp-reelno" data-ref="reelNo"></span>
      </div>
      <div class="rp-bar" data-ref="bar" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <div class="rp-bar-fill" data-ref="barFill"></div>
        <div class="rp-bar-knob" data-ref="barKnob"></div>
      </div>
      <div class="rp-times">
        <span data-ref="time">0:00</span>
        <span class="rp-loop" data-ref="loopInfo"></span>
        <span data-ref="dur">0:00</span>
      </div>
    </section>

    <section class="rp-transport">
      <button class="rp-side" data-cmd="togglePip" data-ref="pipBtn" title="Picture-in-Picture — watch in a floating mini player" aria-label="Picture-in-Picture">${I.pip}<span data-ref="pipLabel">PiP</span></button>
      <button class="rp-tbtn" data-cmd="prev" title="Previous reel" aria-label="Previous reel">${I.up}</button>
      <button class="rp-play" data-cmd="togglePlay" title="Play / pause" aria-label="Play or pause">
        <svg class="rp-ring" viewBox="0 0 60 60" aria-hidden="true">
          <defs>
            <linearGradient id="${gid}" x1="0" y1="60" x2="60" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#feda75"/><stop offset=".3" stop-color="#fa7e1e"/>
              <stop offset=".6" stop-color="#d62976"/><stop offset="1" stop-color="#962fbf"/>
            </linearGradient>
          </defs>
          <circle class="rp-ring-track" cx="30" cy="30" r="26"/>
          <circle class="rp-ring-fill" data-ref="ring" cx="30" cy="30" r="26" stroke="url(#${gid})"/>
        </svg>
        <span class="rp-play-icon" data-ref="playIcon">${I.play}</span>
      </button>
      <button class="rp-tbtn" data-cmd="next" title="Next reel" aria-label="Next reel">${I.down}</button>
      <button class="rp-side" data-ref="layoutBtn" data-layout title="Show the controls on top of the reel" aria-label="Show controls on the reel"><span data-ref="layoutIcon">${I.onReel}</span><span data-ref="layoutLabel">On reel</span></button>
    </section>

    <section class="rp-auto" data-ref="autoCard">
      <span class="rp-auto-icon">${I.autoplay}</span>
      <span class="rp-auto-text">
        <span class="rp-auto-title">Auto-scroll</span>
        <span class="rp-auto-sub" data-ref="autoSub">Off</span>
      </span>
      <button class="rp-switch" role="switch" aria-checked="false" aria-label="Auto-scroll" data-cmd="toggleAuto"><span class="rp-switch-knob"></span></button>
    </section>

    <section class="rp-settings">
      <div class="rp-row">
        <span class="rp-label">Advance</span>
        <div class="rp-seg" data-group="mode" role="radiogroup" aria-label="Advance mode">
          <span class="rp-seg-pill"></span>
          <button data-val="end" role="radio">When it ends</button>
          <button data-val="timer" role="radio">Timer</button>
        </div>
      </div>
      <div class="rp-row" data-ref="loopsRow">
        <span class="rp-label">Plays</span>
        <div class="rp-stepper">
          <button data-step="loops" data-delta="-1" aria-label="Fewer plays">${I.minus}</button>
          <output data-ref="loopsVal">1×</output>
          <button data-step="loops" data-delta="1" aria-label="More plays">${I.plus}</button>
        </div>
        <span class="rp-hint">per reel</span>
      </div>
      <div class="rp-row" data-ref="timerRow" hidden>
        <span class="rp-label">Timer</span>
        <div class="rp-range-wrap">
          <input type="range" class="rp-range" data-input="timerSec" min="${RP.LIMITS.timerSec[0]}" max="${RP.LIMITS.timerSec[1]}" step="1" aria-label="Seconds per reel">
          <output data-ref="timerVal">15s</output>
        </div>
      </div>
      <div class="rp-row">
        <span class="rp-label">Speed</span>
        <div class="rp-chips" data-group="speed" role="radiogroup" aria-label="Playback speed">
          ${RP.SPEEDS.map((s) => `<button data-val="${s}" role="radio">${s}×</button>`).join('')}
        </div>
      </div>
      <div class="rp-row">
        <span class="rp-label">Volume</span>
        <div class="rp-range-wrap">
          <button class="rp-mini" data-cmd="toggleMute" data-ref="muteBtn" aria-label="Mute">${I.volume}</button>
          <input type="range" class="rp-range" data-input="volume" min="0" max="100" step="1" aria-label="Volume">
          <output data-ref="volVal">100</output>
        </div>
      </div>
    </section>

    <section class="rp-more" data-ref="more">
      <button class="rp-more-head" data-ref="moreToggle" aria-expanded="false">${I.settings}<span>Options</span>${I.chevron}</button>
      <div class="rp-more-body"><div class="rp-more-inner">
        ${toggle('background', 'Keep playing in background', 'Reels continue when you switch tabs')}
        ${toggle('skipSponsored', 'Skip sponsored reels', 'Jumps over ads while auto-scroll is on')}
        ${toggle('smooth', 'Smooth scrolling', 'Animate the move between reels')}
        ${toggle('autoPip', 'Auto Picture-in-Picture', 'Pops the reel out when you switch tabs')}
        ${toggle('postMusic', 'Music on photo posts', 'Plays the song added to a photo post, like the app')}
        ${toggle('dimIdle', 'Fade controls when idle', 'Controls fade out until you move the mouse')}
        ${variant === 'popup' ? toggle('showPanel', 'Show on-page controls', 'Panel or bar on top of the reels') : ''}
      </div></div>
    </section>`;

  RP.createControls = function createControls({ mount, variant = 'overlay', onCommand, onSettings }) {
    const gid = `rpRing${Math.random().toString(36).slice(2, 8)}`;
    const wrap = document.createElement('div');
    wrap.className = 'rp-controls';
    RP.setHTML(wrap, template(variant, gid));
    mount.appendChild(wrap);

    const refs = {};
    wrap.querySelectorAll('[data-ref]').forEach((el) => { refs[el.dataset.ref] = el; });
    const inputs = {};
    wrap.querySelectorAll('[data-input]').forEach((el) => { inputs[el.dataset.input] = el; });
    const checks = {};
    wrap.querySelectorAll('[data-setting]').forEach((el) => { checks[el.dataset.setting] = el; });
    const groups = {};
    wrap.querySelectorAll('[data-group]').forEach((el) => { groups[el.dataset.group] = el; });

    let state = {};
    let settings = RP.normalizeSettings();
    let activeInput = null;     // don't fight the user while they drag a slider
    let seeking = false;

    // Text/attr writes are diffed so the hot path stays cheap.
    const cache = new Map();
    const setText = (el, text) => {
      if (cache.get(el) !== text) { cache.set(el, text); el.textContent = text; }
    };
    const setHTMLOnce = (el, key, html) => {
      if (cache.get(el) !== key) { cache.set(el, key); RP.setHTML(el, html); }
    };
    const setRange = (input, value, pct) => {
      if (activeInput === input) return;
      if (String(input.value) !== String(value)) input.value = value;
      input.style.setProperty('--p', `${pct}%`);
    };

    // ── Events ──────────────────────────────────────────────
    wrap.addEventListener('click', (e) => {
      const card = e.target.closest('.rp-auto');
      const btn = e.target.closest('button');
      if (card && !btn) { onCommand('toggleAuto'); return; }
      if (!btn || !wrap.contains(btn)) return;

      if (btn === refs.moreToggle) {
        const open = !refs.more.classList.contains('open');
        refs.more.classList.toggle('open', open);
        btn.setAttribute('aria-expanded', String(open));
        return;
      }
      if (btn.dataset.cmd === 'toggleMute') {
        const muted = !(state.muted || state.volume === 0);
        const patch = { muted, audioManaged: true };
        if (!muted && (state.volume || 0) < 0.05) patch.volume = 0.6;
        applySettings(patch);
        return;
      }
      if (btn.dataset.cmd) { onCommand(btn.dataset.cmd); return; }
      if (btn === refs.layoutBtn) {
        applySettings({ controls: settings.controls === 'reel' ? 'panel' : 'reel', showPanel: true });
        return;
      }

      const group = btn.closest('[data-group]');
      if (group && btn.dataset.val != null) {
        const key = group.dataset.group;
        applySettings({ [key]: key === 'speed' ? parseFloat(btn.dataset.val) : btn.dataset.val });
        return;
      }
      if (btn.dataset.step) {
        const key = btn.dataset.step;
        const [lo, hi] = RP.LIMITS[key];
        applySettings({ [key]: RP.clamp(settings[key] + Number(btn.dataset.delta), lo, hi) });
      }
    });

    wrap.addEventListener('input', (e) => {
      const input = e.target.closest('[data-input]');
      if (!input) return;
      activeInput = input;
      const v = Number(input.value);
      if (input.dataset.input === 'timerSec') {
        const [lo, hi] = RP.LIMITS.timerSec;
        input.style.setProperty('--p', `${((v - lo) / (hi - lo)) * 100}%`);
        applySettings({ timerSec: v });
      } else if (input.dataset.input === 'volume') {
        input.style.setProperty('--p', `${v}%`);
        applySettings({ volume: v / 100, muted: v === 0, audioManaged: true });
      }
    });
    wrap.addEventListener('change', (e) => {
      if (e.target.matches('[data-input]')) activeInput = null;
      const check = e.target.closest('[data-setting]');
      if (check) applySettings({ [check.dataset.setting]: check.checked });
    });
    wrap.addEventListener('pointerup', () => { activeInput = null; }, true);

    // Seek bar: click or drag.
    const seekTo = (clientX) => {
      const r = refs.bar.getBoundingClientRect();
      const f = RP.clamp((clientX - r.left) / r.width, 0, 1);
      paintBar(f);
      onCommand('seek', f);
    };
    refs.bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !state.duration) return;
      seeking = true;
      refs.bar.classList.add('dragging');
      refs.bar.setPointerCapture(e.pointerId);
      seekTo(e.clientX);
    });
    refs.bar.addEventListener('pointermove', (e) => { if (seeking) seekTo(e.clientX); });
    const endSeek = () => { seeking = false; refs.bar.classList.remove('dragging'); };
    refs.bar.addEventListener('pointerup', endSeek);
    refs.bar.addEventListener('pointercancel', endSeek);
    refs.bar.addEventListener('keydown', (e) => {
      if (!state.duration) return;
      const step = e.key === 'ArrowRight' ? 0.05 : e.key === 'ArrowLeft' ? -0.05 : 0;
      if (!step) return;
      e.preventDefault();
      onCommand('seek', RP.clamp(state.time / state.duration + step, 0, 1));
    });

    function applySettings(patch) {
      settings = RP.normalizeSettings(Object.assign({}, settings, patch));
      if ('volume' in patch || 'muted' in patch) {
        state = Object.assign({}, state, { volume: settings.volume, muted: settings.muted });
      }
      render();
      onSettings(patch);
    }

    function paintBar(f) {
      const pct = RP.clamp(f, 0, 1) * 100;
      refs.barFill.style.clipPath = `inset(0 ${100 - pct}% 0 0 round 4px)`;
      refs.barKnob.style.left = `${pct}%`;
      refs.bar.setAttribute('aria-valuenow', String(Math.round(pct)));
    }

    // ── Rendering ───────────────────────────────────────────
    function autoSubText(s) {
      if (!s.auto) return s.hasVideo ? 'Off — tap to let reels roll' : 'Off';
      if (!s.hasVideo) return 'Waiting for a reel…';
      if (s.busy) return 'Moving to the next reel…';
      if (!s.playing) return 'Paused — resumes when you press play';
      const left = s.untilNext;
      let tail = settings.mode === 'timer'
        ? `every ${settings.timerSec}s`
        : `after ${settings.loops} play${settings.loops > 1 ? 's' : ''}`;
      if (s.kind === 'image') tail = s.mode === 'popup' ? 'photo post' : s.sponsored ? 'image ad' : 'image reel';
      if (left == null) return `On · ${tail}`;
      return `Next in ${left < 60 ? `${Math.ceil(left)}s` : RP.formatTime(left)} · ${tail}`;
    }

    function progress(s) {
      state = Object.assign({}, state, s);
      const d = state.duration || 0;
      if (!seeking) paintBar(d ? state.time / d : 0);
      setText(refs.time, RP.formatTime(state.time));
      setText(refs.dur, RP.formatTime(d));

      const ringFrac = state.auto ? (state.autoProgress || 0) : (d ? state.time / d : 0);
      refs.ring.style.strokeDashoffset = String(RING_C * (1 - RP.clamp(ringFrac, 0, 1)));

      let loopText = '';
      if (state.hasVideo && state.auto && settings.mode === 'end' && settings.loops > 1) {
        loopText = `Play ${Math.min(state.loopsDone + 1, settings.loops)} of ${settings.loops}`;
      } else if (state.hasVideo && state.loopsDone > 0) {
        loopText = `Looped ${state.loopsDone}×`;
      }
      setText(refs.loopInfo, loopText);
      setText(refs.autoSub, autoSubText(state));
    }

    function render() {
      const s = state;
      const fallbackName = s.kind === 'image'
        ? (s.mode === 'popup' ? 'Photo post' : s.sponsored ? 'Sponsored post' : 'Image reel')
        : 'Instagram Reel';
      setText(refs.author, s.hasVideo ? (s.author || fallbackName) : 'No reel detected yet');
      setText(refs.reelNo, s.hasVideo && s.reelNumber ? `#${s.reelNumber}` : '');
      refs.sponsored.hidden = !s.sponsored;

      const playing = !!s.playing;
      setHTMLOnce(refs.playIcon, playing ? 'pause' : 'play', playing ? I.pause : I.play);
      refs.playIcon.classList.toggle('is-play', !playing);
      refs.playIcon.parentElement.setAttribute('aria-label', playing ? 'Pause' : 'Play');

      refs.pipBtn.classList.toggle('on', !!s.pip);
      refs.pipBtn.disabled = s.pipSupported === false;
      setText(refs.pipLabel, s.pip ? 'Exit PiP' : 'PiP');
      const onReel = settings.controls === 'reel';
      setHTMLOnce(refs.layoutIcon, onReel ? 'panel' : 'onReel', onReel ? I.panel : I.onReel);
      setText(refs.layoutLabel, onReel ? 'Panel' : 'On reel');
      refs.layoutBtn.title = onReel ? 'Switch back to the floating panel' : 'Show the controls on top of the reel';

      refs.autoCard.classList.toggle('on', !!s.auto);
      const sw = refs.autoCard.querySelector('.rp-switch');
      sw.setAttribute('aria-checked', String(!!s.auto));

      // Mode segmented control
      const modeIdx = settings.mode === 'timer' ? 1 : 0;
      groups.mode.dataset.index = String(modeIdx);
      groups.mode.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.val === settings.mode)));
      refs.loopsRow.hidden = settings.mode !== 'end';
      refs.timerRow.hidden = settings.mode !== 'timer';

      setText(refs.loopsVal, `${settings.loops}×`);
      const [lLo, lHi] = RP.LIMITS.loops;
      refs.loopsRow.querySelector('[data-delta="-1"]').disabled = settings.loops <= lLo;
      refs.loopsRow.querySelector('[data-delta="1"]').disabled = settings.loops >= lHi;

      const [tLo, tHi] = RP.LIMITS.timerSec;
      setRange(inputs.timerSec, settings.timerSec, ((settings.timerSec - tLo) / (tHi - tLo)) * 100);
      setText(refs.timerVal, `${settings.timerSec}s`);

      const speed = settings.speed;
      groups.speed.querySelectorAll('button').forEach((b) => {
        b.setAttribute('aria-checked', String(Math.abs(parseFloat(b.dataset.val) - speed) < 0.001));
      });

      const vol = s.volume != null ? s.volume : settings.volume;
      const muted = s.muted != null ? s.muted : settings.muted;
      const shown = muted ? 0 : Math.round(vol * 100);
      setRange(inputs.volume, shown, shown);
      setText(refs.volVal, String(shown));
      const volIcon = shown === 0 ? 'muted' : shown < 50 ? 'volumeLow' : 'volume';
      setHTMLOnce(refs.muteBtn, volIcon, I[volIcon]);
      refs.muteBtn.setAttribute('aria-label', shown === 0 ? 'Unmute' : 'Mute');

      for (const [key, el] of Object.entries(checks)) el.checked = !!settings[key];

      progress({});
    }

    return {
      el: wrap,
      update(nextState, nextSettings) {
        if (nextSettings) settings = RP.normalizeSettings(nextSettings);
        if (nextState) state = Object.assign({}, state, nextState);
        render();
      },
      progress,
      setShortcuts(map) {
        const tip = (cmd, label) => (map[cmd] ? `${label} (${map[cmd]})` : label);
        wrap.querySelector('[data-cmd="prev"]').title = tip('prev', 'Previous reel');
        wrap.querySelector('[data-cmd="next"]').title = tip('next', 'Next reel');
        wrap.querySelector('[data-cmd="togglePlay"]').title = tip('togglePlay', 'Play / pause');
        refs.autoCard.title = tip('toggleAuto', 'Toggle auto-scroll');
      },
    };
  };
})();
