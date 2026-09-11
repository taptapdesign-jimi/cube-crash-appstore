#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const SOURCE_PATH = path.join(PROJECT_ROOT, 'assets/shop/fish/bubbly.svg');
const FAST_SVG_PATH = path.join(PROJECT_ROOT, 'assets/shop/fish/bubbly-fast.svg');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'assets/shop/fish/bubbly-fast-hevc.mov');
const RENDERER_PATH = path.join(PROJECT_ROOT, 'scripts/render-animated-svg-frames.mjs');
const ENCODER_SOURCE_PATH = path.join(PROJECT_ROOT, 'scripts/encode-hevc-alpha-frames.swift');

const WIDTH = 432;
const HEIGHT = 768;
const SOURCE_DURATION_SECONDS = 3.6;
const PLAYBACK_SPEED = 1.5;
const OUTPUT_DURATION_SECONDS = SOURCE_DURATION_SECONDS / PLAYBACK_SPEED;
const FRAMES_PER_SECOND = 60;
const FRAME_COUNT = Math.round(OUTPUT_DURATION_SECONDS * FRAMES_PER_SECOND);
const OUTPUT_DURATION_MILLISECONDS = Math.round(OUTPUT_DURATION_SECONDS * 1000);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`${command} exited ${code}: ${stderr || stdout}`));
    });
  });
}

const sourceSvg = await readFile(SOURCE_PATH, 'utf8');
const fastSvg = sourceSvg
  .replaceAll('dur="3.6s"', 'dur="2.4s"')
  .replaceAll('repeatCount="indefinite"', 'repeatCount="1"');
if (fastSvg === sourceSvg || fastSvg.includes('dur="3.6s"')) {
  throw new Error('Fish bubbly timing rewrite did not replace the authored 3.6-second cycle.');
}
await writeFile(FAST_SVG_PATH, fastSvg);

const workDirectory = await mkdtemp(path.join(tmpdir(), 'cc-fish-bubbles-hevc-'));
const frameDirectory = path.join(workDirectory, 'frames');
const encoderBinary = path.join(workDirectory, 'encode-hevc-alpha-frames');
const temporaryProResOutput = path.join(workDirectory, 'fish-bubbles-prores4444.mov');
const temporaryOutput = path.join(workDirectory, 'fish-bubbles-fast-hevc.mov');

try {
  await mkdir(frameDirectory, { recursive: true });
  console.log(`[fish-bubbles] render-start ${WIDTH}x${HEIGHT} ${FRAME_COUNT}f`);
  await run(process.execPath, [
    RENDERER_PATH,
    FAST_SVG_PATH,
    frameDirectory,
    String(WIDTH),
    String(HEIGHT),
    String(FRAMES_PER_SECOND),
    String(OUTPUT_DURATION_SECONDS),
  ]);

  await run('/usr/bin/xcrun', ['swiftc', '-O', ENCODER_SOURCE_PATH, '-o', encoderBinary]);
  await run(encoderBinary, [
    frameDirectory,
    temporaryProResOutput,
    String(WIDTH),
    String(HEIGHT),
    String(FRAME_COUNT),
    '1',
    String(OUTPUT_DURATION_MILLISECONDS),
    'prores4444',
  ]);
  await run('/usr/bin/avconvert', [
    '--source', temporaryProResOutput,
    '--preset', 'PresetHEVCHighestQualityWithAlpha',
    '--output', temporaryOutput,
    '--replace',
  ]);

  await copyFile(temporaryOutput, OUTPUT_PATH);
  console.log(`[fish-bubbles] complete ${path.relative(PROJECT_ROOT, OUTPUT_PATH)} ${WIDTH}x${HEIGHT} ${FRAME_COUNT}f/${OUTPUT_DURATION_MILLISECONDS}ms`);
} finally {
  await rm(workDirectory, { recursive: true, force: true });
}
