// Render the ReelPilot promo video → store/video/reelpilot-promo.mp4 (1920×1080, 30 fps, H.264 + AAC)
//   cd tools/store && npm install          (puppeteer-core lives there)
//   node ../video/render.mjs               full video + YouTube thumbnail
//   node ../video/render.mjs --preview     a few still frames to check the layout
// Needs Chrome, ffmpeg and Python with numpy on PATH.
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, '..', '..');
const require = createRequire(path.join(ROOT, 'tools', 'store', 'package.json'));
const puppeteer = require('puppeteer-core');

const OUT = path.join(ROOT, 'store', 'video');
const PREVIEW = process.argv.includes('--preview');
const SCALE = 1.5; // 1280×720 layout → 1920×1080 pixels
const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => fs.existsSync(p));
const PYTHON = process.platform === 'win32' ? 'python' : 'python3';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// The popup inside the video reads its state from the timeline (window.__rpState), not the extension.
function popupStub() {
  if (!location.pathname.endsWith('/src/popup/popup.html')) return;
  const shortcuts = { toggleAuto: 'Alt+Shift+S', next: 'Alt+Shift+Down', prev: 'Alt+Shift+Up', togglePlay: 'Alt+Shift+K' };
  const ok = async () => {};
  Object.defineProperty(window, 'chrome', {
    configurable: true,
    value: {
      storage: { local: { get: async () => ({}), set: ok } },
      runtime: { sendMessage: async (m) => (m.type === 'rp:getShortcuts' ? shortcuts : m.type === 'rp:findTarget' ? { id: 1, windowId: 1 } : null) },
      tabs: { sendMessage: async () => window.__rpState || null, get: async () => ({ id: 1 }), create: ok, update: ok, reload: ok },
      windows: { update: ok },
    },
  });
}

fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--force-color-profile=srgb', '--hide-scrollbars'] });
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(popupStub);
  page.on('pageerror', (e) => console.error('  page error:', e.message));
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: SCALE });
  await page.goto(`${BASE}/tools/video/promo.html`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.body.dataset.ready === '1');
  const timeline = await page.evaluate(() => window.__timeline);
  const seek = async (t) => {
    await page.evaluate((s) => window.__seek(s), t);
    await page.evaluate(nextFrame);           // let the overlay's own frame loop paint
    await page.evaluate((s) => window.__seek(s), t); // re-run with fresh layout (cursor targets)
    await page.evaluate(nextFrame);
  };

  if (PREVIEW) {
    for (const t of [1.6, 3.0, 7.0, 9.0, 16.0, 17.2, 20.0, 23.5, 27.0, 31.5, 33.3, 38.3, 43.5]) {
      await seek(t);
      const file = path.join(OUT, `preview-${String(t).replace('.', '_')}s.png`);
      await page.screenshot({ path: file });
      console.log('  preview', path.basename(file));
    }
  } else {
    // 1) Soundtrack, cued to the timeline.
    const cuesFile = path.join(OUT, 'cues.json');
    const wav = path.join(OUT, 'soundtrack.wav');
    fs.writeFileSync(cuesFile, JSON.stringify(timeline));
    const py = spawnSync(PYTHON, ['-I', path.join(HERE, 'music.py'), cuesFile, wav], { stdio: 'inherit' });
    if (py.status !== 0) throw new Error('music.py failed');

    // 2) Frames → ffmpeg.
    const mp4 = path.join(OUT, 'reelpilot-promo.mp4');
    const ff = spawn('ffmpeg', [
      '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(timeline.fps), '-c:v', 'png', '-i', '-',
      '-i', wav, '-map', '0:v', '-map', '1:a',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(timeline.fps),
      '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', mp4,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((resolve, reject) => ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))));

    const frames = Math.round(timeline.duration * timeline.fps);
    const started = Date.now();
    for (let i = 0; i < frames; i++) {
      await seek(i / timeline.fps);
      const png = await page.screenshot({ type: 'png', optimizeForSpeed: true });
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
      if (i % 150 === 0) console.log(`  frame ${i}/${frames}  (${((Date.now() - started) / 1000).toFixed(0)}s)`);
    }
    ff.stdin.end();
    await done;
    fs.rmSync(cuesFile);
    console.log(`  wrote ${path.relative(ROOT, mp4)}`);

    // 3) YouTube thumbnail (1280×720).
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    await page.goto(`${BASE}/tools/video/promo.html?thumb=1`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.body.dataset.ready === '1');
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(OUT, 'youtube-thumbnail.png') });
    console.log('  wrote store/video/youtube-thumbnail.png');
  }
} finally {
  await browser.close();
  server.close();
}
