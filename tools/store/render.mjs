// Render Chrome Web Store graphics → store/assets/
//   cd tools/store && npm install && npm run render
// Uses your installed Chrome (override with CHROME_PATH=...).
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const OUT = path.join(ROOT, 'store', 'assets');
const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => fs.existsSync(p));

const SHOTS = [
  ['1', 'screenshot-1-autopilot.png', 1280, 800],
  ['2', 'screenshot-2-on-reel-controls.png', 1280, 800],
  ['3', 'screenshot-3-background-pip.png', 1280, 800],
  ['4', 'screenshot-4-remote-control.png', 1280, 800],
  ['5', 'screenshot-5-skip-ads.png', 1280, 800],
  ['promo', 'promo-small-440x280.png', 440, 280],
  ['marquee', 'promo-marquee-1400x560.png', 1400, 560],
];

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// The popup normally talks to the extension; in the studio it gets a frozen "auto-scrolling" state.
function popupStub() {
  if (!location.pathname.endsWith('/src/popup/popup.html')) return;
  const state = {
    enabled: true, hasVideo: true, kind: 'video', auto: true, playing: true, busy: false,
    time: 6.2, duration: 14.5, loopsDone: 0, untilNext: 8.3, autoProgress: 0.43, author: '@sunset.demo',
    sponsored: false, reelNumber: 12, watchSec: 263, muted: false, volume: 0.8, speed: 1, hidden: true,
    pip: false, pipSupported: true, settings: {}, panelCollapsed: false,
  };
  const shortcuts = { toggleAuto: 'Alt+Shift+S', next: 'Alt+Shift+Down', prev: 'Alt+Shift+Up', togglePlay: 'Alt+Shift+K' };
  const ok = async () => {};
  Object.defineProperty(window, 'chrome', {
    configurable: true,
    value: {
      storage: { local: { get: async () => ({}), set: ok } },
      runtime: { sendMessage: async (m) => (m.type === 'rp:getShortcuts' ? shortcuts : m.type === 'rp:findTarget' ? { id: 1, windowId: 1 } : null) },
      tabs: { sendMessage: async () => state, get: async () => ({ id: 1 }), create: ok, update: ok, reload: ok },
      windows: { update: ok },
    },
  });
}

fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--force-color-profile=srgb', '--hide-scrollbars'] });
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(popupStub);
  page.on('pageerror', (e) => console.error('  page error:', e.message));
  for (const [shot, file, width, height] of SHOTS) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(`${BASE}/tools/store/studio.html?shot=${shot}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.body.dataset.ready === '1');
    await new Promise((r) => setTimeout(r, 1100)); // animations settle, popup polls once
    await page.screenshot({ path: path.join(OUT, file), clip: { x: 0, y: 0, width, height } });
    console.log(`  ${file}  ${width}×${height}`);
  }
} finally {
  await browser.close();
  server.close();
}

fs.copyFileSync(path.join(ROOT, 'icons', 'icon128.png'), path.join(OUT, 'store-icon-128.png'));
console.log('  store-icon-128.png  128×128');

// The store wants screenshots and tiles without an alpha channel (24-bit PNG).
const flatten = `
import sys
from pathlib import Path
from PIL import Image
for p in Path(sys.argv[1]).glob('*.png'):
    if p.name.startswith('store-icon'):
        continue
    im = Image.open(p)
    if im.mode != 'RGB':
        im.convert('RGB').save(p, optimize=True)
`;
const py = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['-I', '-c', flatten, OUT], { stdio: 'inherit' });
if (py.status !== 0) console.warn('  (could not flatten PNGs — install Python + Pillow, or convert them to 24-bit PNG/JPEG yourself)');
