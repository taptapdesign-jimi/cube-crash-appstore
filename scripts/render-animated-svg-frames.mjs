#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [inputPath, outputDirectory, widthText, heightText, fpsText, durationText] = process.argv.slice(2);

if (!inputPath || !outputDirectory || !widthText || !heightText || !fpsText || !durationText) {
  console.error('Usage: render-animated-svg-frames.mjs <input.svg> <output-dir> <width> <height> <fps> <duration-seconds>');
  process.exit(1);
}

const width = Number(widthText);
const height = Number(heightText);
const fps = Number(fpsText);
const durationSeconds = Number(durationText);
const frameCount = Math.round(fps * durationSeconds);

if (![width, height, fps, durationSeconds, frameCount].every(Number.isFinite) ||
    width <= 0 || height <= 0 || fps <= 0 || durationSeconds <= 0 || frameCount <= 0) {
  throw new Error('Width, height, fps and duration must be positive numbers.');
}

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const workDirectory = await mkdtemp(path.join(tmpdir(), 'cc-svg-frames-'));
const chromeProfile = path.join(workDirectory, 'chrome-profile');
const htmlPath = path.join(workDirectory, 'render.html');
const svgMarkup = await readFile(inputPath, 'utf8');

await mkdir(outputDirectory, { recursive: true });

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: transparent; }
      svg { display: block; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    ${svgMarkup}
    <script>
      const svg = document.querySelector('svg');
      svg.setAttribute('width', ${JSON.stringify(String(width))});
      svg.setAttribute('height', ${JSON.stringify(String(height))});
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      svg.pauseAnimations();
      window.__ccSetSvgTime = async (time) => {
        svg.setCurrentTime(time);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return svg.getCurrentTime();
      };
    </script>
  </body>
</html>`;

await writeFile(htmlPath, html);

const port = 9333 + Math.floor(Math.random() * 400);
const chrome = spawn(chromePath, [
  '--headless=new',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  '--disable-component-update',
  '--disable-sync',
  '--disable-extensions',
  '--force-device-scale-factor=1',
  `--window-size=${width},${height}`,
  `--remote-debugging-port=${port}`,
  '--remote-debugging-address=127.0.0.1',
  `--user-data-dir=${chromeProfile}`,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

let chromeError = '';
chrome.stderr.on('data', (chunk) => { chromeError += chunk.toString(); });

async function waitForDebugger() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Chrome DevTools endpoint did not start. ${chromeError}`);
}

let socket;
try {
  await waitForDebugger();
  const createResponse = await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent(pathToFileURL(htmlPath).href)}`,
    { method: 'PUT' },
  );
  if (!createResponse.ok) throw new Error(`Failed to create render target: ${createResponse.status}`);
  const target = await createResponse.json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Emulation.setDefaultBackgroundColorOverride', {
    color: { r: 0, g: 0, b: 0, a: 0 },
  });
  await send('Page.navigate', { url: pathToFileURL(htmlPath).href });

  const readyDeadline = Date.now() + 10_000;
  while (Date.now() < readyDeadline) {
    const ready = await send('Runtime.evaluate', {
      expression: 'typeof window.__ccSetSvgTime === "function" && document.readyState === "complete"',
      returnByValue: true,
    });
    if (ready.result?.value === true) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  for (let index = 0; index < frameCount; index += 1) {
    // Distribute samples over the exact requested cycle. This remains
    // identical to index/fps for whole-second sources, while fractional SVG
    // periods keep the final-to-first loop interval equal to every other one.
    const time = index * durationSeconds / frameCount;
    await send('Runtime.evaluate', {
      expression: `window.__ccSetSvgTime(${JSON.stringify(time)})`,
      awaitPromise: true,
      returnByValue: true,
    });
    const screenshot = await send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
    });
    const frameName = `frame-${String(index).padStart(4, '0')}.png`;
    await writeFile(path.join(outputDirectory, frameName), Buffer.from(screenshot.data, 'base64'));
  }

  console.log(JSON.stringify({ inputPath, outputDirectory, width, height, fps, durationSeconds, frameCount }));
} finally {
  try { socket?.close(); } catch {}
  chrome.kill('SIGTERM');
  await rm(workDirectory, { recursive: true, force: true });
}
