/* ReelPilot — service worker.
 *  • global keyboard shortcuts → the right Instagram tab
 *  • toolbar badge showing auto-scroll status
 *  • un-throttled timers for background tabs ("rp:sleep")
 *  • keeps auto-scrolling tabs from being discarded by Memory Saver
 */
'use strict';

const IG_MATCH = ['*://www.instagram.com/*', '*://instagram.com/*'];
const REELS_URL = 'https://www.instagram.com/reels/';
const COMMAND_MAP = {
  'toggle-autoscroll': 'toggleAuto',
  'next-reel': 'next',
  'prev-reel': 'prev',
  'play-pause': 'togglePlay',
};

// tabId → { auto, count, playing, enabled, author, updated }
const tabState = new Map();
const ready = chrome.storage.session.get('rp:tabs').then((res) => {
  for (const [id, s] of Object.entries(res['rp:tabs'] || {})) tabState.set(Number(id), s);
}).catch(() => {});

function persist() {
  chrome.storage.session.set({ 'rp:tabs': Object.fromEntries(tabState) }).catch(() => {});
}

function updateBadge() {
  const running = [...tabState.values()].filter((s) => s.auto).sort((a, b) => b.updated - a.updated);
  if (!running.length) {
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setTitle({ title: 'ReelPilot – Auto Scroll for Reels' });
    return;
  }
  const n = running[0].count || 0;
  chrome.action.setBadgeBackgroundColor({ color: '#E1306C' });
  if (chrome.action.setBadgeTextColor) chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
  chrome.action.setBadgeText({ text: n > 999 ? '999+' : n ? String(n) : 'ON' });
  chrome.action.setTitle({ title: `ReelPilot — auto-scrolling (${n} reel${n === 1 ? '' : 's'} this session)` });
}

/** The Instagram tab a command should go to. */
async function findTargetTab() {
  await ready;
  const tabs = await chrome.tabs.query({ url: IG_MATCH });
  if (!tabs.length) return null;
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (active && tabs.some((t) => t.id === active.id)) return active;
  const isReels = (t) => /instagram\.com\/reels?\//.test(t.url || '');
  const pools = [
    tabs.filter((t) => tabState.get(t.id)?.auto),
    tabs.filter((t) => t.audible && isReels(t)),
    tabs.filter(isReels),
    tabs,
  ];
  const pool = pools.find((p) => p.length);
  return pool.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
}

async function shortcutMap() {
  const out = {};
  try {
    for (const c of await chrome.commands.getAll()) {
      if (COMMAND_MAP[c.name] && c.shortcut) out[COMMAND_MAP[c.name]] = c.shortcut;
    }
  } catch (_) { /* ignore */ }
  return out;
}

function contentScriptFiles() {
  const cs = chrome.runtime.getManifest().content_scripts || [];
  const isolated = cs.find((c) => c.world !== 'MAIN');
  const main = cs.find((c) => c.world === 'MAIN');
  return { isolated: isolated ? isolated.js : [], main: main ? main.js : [] };
}

// Inject into Instagram tabs that were already open, so no page refresh is needed after install/update.
async function injectIntoOpenTabs() {
  const { isolated, main } = contentScriptFiles();
  const tabs = await chrome.tabs.query({ url: IG_MATCH });
  for (const tab of tabs) {
    if (tab.discarded) continue;
    try {
      if (main.length) await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: main, world: 'MAIN' });
      if (isolated.length) await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: isolated });
    } catch (_) { /* tab not scriptable (e.g. error page) */ }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  injectIntoOpenTabs();
  updateBadge();
});

chrome.runtime.onStartup.addListener(() => {
  tabState.clear();
  persist();
  updateBadge();
});

chrome.commands.onCommand.addListener(async (name) => {
  const command = COMMAND_MAP[name];
  if (!command) return;
  const tab = await findTargetTab();
  if (!tab) {
    if (command === 'toggleAuto') await chrome.tabs.create({ url: REELS_URL });
    return;
  }
  chrome.tabs.sendMessage(tab.id, { type: 'rp:command', command }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== 'string') return undefined;
  switch (msg.type) {
    case 'rp:sleep': {
      const ms = Math.min(10000, Math.max(0, Number(msg.ms) || 0));
      setTimeout(() => sendResponse(true), ms);
      return true;
    }
    case 'rp:state': {
      const tabId = sender.tab && sender.tab.id;
      if (tabId == null) return undefined;
      const prev = tabState.get(tabId);
      const next = Object.assign({}, msg.state, { updated: Date.now() });
      tabState.set(tabId, next);
      persist();
      updateBadge();
      // Memory Saver must not discard a tab that is auto-scrolling.
      if (!prev || !!prev.auto !== !!next.auto) {
        chrome.tabs.update(tabId, { autoDiscardable: !next.auto }).catch(() => {});
      }
      return undefined;
    }
    case 'rp:findTarget':
      findTargetTab().then((tab) => sendResponse(tab ? { id: tab.id, windowId: tab.windowId, url: tab.url, title: tab.title } : null));
      return true;
    case 'rp:getShortcuts':
      shortcutMap().then(sendResponse);
      return true;
    default:
      return undefined;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabState.delete(tabId)) { persist(); updateBadge(); }
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  // Navigating away from Instagram ends that tab's session. (A reload re-reports fresh state itself.)
  if (info.url && !/^https?:\/\/(www\.)?instagram\.com\//.test(info.url) && tabState.has(tabId)) {
    tabState.delete(tabId);
    persist();
    updateBadge();
  }
});
