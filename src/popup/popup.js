/* ReelPilot — toolbar popup: a remote control for the Instagram tab, usable from any tab. */
(() => {
  'use strict';
  const RP = globalThis.ReelPilot;
  const I = RP.ICONS;
  const $ = (id) => document.getElementById(id);

  RP.adoptStyles(document, RP.UI_CSS);
  RP.setHTML($('logo'), RP.logoSVG('ppLogo'));
  RP.setHTML($('heroArt'), RP.logoSVG('ppHero'));
  document.querySelectorAll('[data-icon]').forEach((el) => RP.setHTML(el, I[el.dataset.icon] || ''));

  let tab = null;
  let settings = RP.normalizeSettings();
  let lastLocalWrite = 0;
  let view = '';
  let emptyAction = null;

  const controls = RP.createControls({
    mount: $('controls'),
    variant: 'popup',
    onCommand: command,
    onSettings: saveSettings,
  });

  // ── Messaging ──
  const sendToTab = async (msg) => {
    if (!tab) return null;
    try { return (await chrome.tabs.sendMessage(tab.id, msg)) || null; } catch (_) { return null; }
  };

  async function command(cmd, value) {
    const s = await sendToTab({ type: 'rp:command', command: cmd, value });
    if (!s) return;
    render(s);
    if (cmd === 'togglePip' && s.commandError === 'activation') {
      showHint('Chrome only starts Picture-in-Picture from a click on the page. Use the PiP button on the Instagram tab.');
    }
  }

  let hintTimer = 0;
  function showHint(text) {
    $('hintText').textContent = text;
    $('hint').hidden = false;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { $('hint').hidden = true; }, 9000);
  }

  function saveSettings(patch) {
    settings = RP.normalizeSettings(Object.assign({}, settings, patch));
    lastLocalWrite = Date.now();
    chrome.storage.local.set({ [RP.STORAGE_KEY]: settings });
  }

  // ── Views ──
  function setView(name) {
    if (view === name) return;
    view = name;
    $('viewEmpty').hidden = name !== 'empty';
    $('viewControls').hidden = name !== 'controls';
    $('focusTab').hidden = name !== 'controls';
  }

  const EMPTY = {
    none: {
      title: 'Open Instagram Reels',
      text: 'A floating control panel on top of the reels that keeps them rolling, even in a background tab.',
      button: 'Open Reels',
      icon: 'reels',
      features: true,
      action: async () => { await chrome.tabs.create({ url: RP.REELS_URL }); window.close(); },
    },
    notReels: {
      title: 'Jump into Reels',
      text: 'Instagram is open on another page. Go to Reels to start the autopilot.',
      button: 'Go to Reels',
      icon: 'zap',
      features: false,
      action: async () => { await command('goToReels'); await focusTab(); },
    },
    reload: {
      title: 'Refresh Instagram',
      text: 'ReelPilot can’t reach this Instagram tab yet. Reload it once to connect.',
      button: 'Reload tab',
      icon: 'refresh',
      features: false,
      action: async () => { if (tab) await chrome.tabs.reload(tab.id); setTimeout(refresh, 1500); },
    },
  };

  function showEmpty(kind) {
    const e = EMPTY[kind];
    setView('empty');
    $('emptyTitle').textContent = e.title;
    $('emptyText').textContent = e.text;
    $('emptyBtnText').textContent = e.button;
    RP.setHTML($('emptyBtnIcon'), I[e.icon]);
    $('features').hidden = !e.features;
    emptyAction = e.action;
    setChip('idle', kind === 'none' ? 'No tab' : 'Standby');
  }

  function setChip(tone, text) {
    $('chip').dataset.tone = tone;
    $('chipText').textContent = text;
  }

  function render(s) {
    if (s.settings && Date.now() - lastLocalWrite > 700) settings = RP.normalizeSettings(s.settings);
    if (!s.enabled) { showEmpty('notReels'); return; }
    setView('controls');
    controls.update(s, settings);

    if (!s.hasVideo) setChip('idle', 'Waiting');
    else if (s.auto && (s.playing || s.busy)) setChip('live', s.hidden ? 'Auto · background' : 'Auto');
    else if (s.auto) setChip('idle', 'Auto · paused');
    else if (s.playing) setChip('play', 'Playing');
    else setChip('idle', 'Paused');

    $('panelRow').hidden = settings.showPanel && !s.panelCollapsed;
  }

  async function refresh() {
    if (!tab) {
      tab = await chrome.runtime.sendMessage({ type: 'rp:findTarget' }).catch(() => null);
      if (!tab) { showEmpty('none'); return; }
    }
    const s = await sendToTab({ type: 'rp:getState' });
    if (s) { render(s); return; }
    // No answer: the tab closed, or the content script isn't there yet.
    const still = await chrome.tabs.get(tab.id).catch(() => null);
    if (!still) { tab = null; showEmpty('none'); return; }
    showEmpty('reload');
  }

  async function focusTab() {
    if (!tab) return;
    await chrome.tabs.update(tab.id, { active: true }).catch(() => {});
    await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
    window.close();
  }

  // ── Shortcuts footer ──
  function renderKeys(map) {
    const rows = [
      ['toggleAuto', 'Auto-scroll'],
      ['togglePlay', 'Play / pause'],
      ['next', 'Next reel'],
      ['prev', 'Previous'],
    ];
    const box = $('keys');
    box.textContent = '';
    for (const [cmd, label] of rows) {
      const row = document.createElement('div');
      row.className = 'pp-key';
      const name = document.createElement('span');
      name.textContent = label;
      const keys = document.createElement('span');
      if (map[cmd]) {
        for (const k of RP.shortcutKeys(map[cmd])) {
          const kbd = document.createElement('kbd');
          kbd.textContent = k;
          keys.appendChild(kbd);
        }
      } else {
        const none = document.createElement('em');
        none.textContent = 'not set';
        keys.appendChild(none);
      }
      row.append(name, keys);
      box.appendChild(row);
    }

    // Collapsed footer previews the most useful shortcut.
    const peek = $('keysPeek');
    peek.textContent = '';
    for (const k of RP.shortcutKeys(map.toggleAuto)) {
      const kbd = document.createElement('kbd');
      kbd.textContent = k;
      peek.appendChild(kbd);
    }
  }

  // ── Wiring ──
  $('emptyBtn').addEventListener('click', () => { if (emptyAction) emptyAction(); });
  $('focusTab').addEventListener('click', focusTab);
  $('hintBtn').addEventListener('click', focusTab);
  $('showPanel').addEventListener('click', () => command('showPanel'));
  $('editKeys').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));
  $('keysToggle').addEventListener('click', () => {
    const open = $('foot').classList.toggle('open');
    $('keysToggle').setAttribute('aria-expanded', String(open));
  });

  (async () => {
    const res = await chrome.storage.local.get(RP.STORAGE_KEY);
    settings = RP.normalizeSettings(res[RP.STORAGE_KEY]);
    const shortcuts = (await chrome.runtime.sendMessage({ type: 'rp:getShortcuts' }).catch(() => null)) || {};
    renderKeys(shortcuts);
    controls.setShortcuts(shortcuts);
    await refresh();
    setInterval(refresh, 250);
  })();
})();
