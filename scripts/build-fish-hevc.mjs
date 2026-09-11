#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { copyFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const SOURCE_PATH = path.join(PROJECT_ROOT, 'assets/shop/fish/fish.svg');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'assets/shop/fish/fish-mobile-hevc.mov');
const RENDERER_PATH = path.join(PROJECT_ROOT, 'scripts/render-animated-svg-frames.mjs');
const ENCODER_SOURCE_PATH = path.join(PROJECT_ROOT, 'scripts/encode-hevc-alpha-frames.swift');

// Preserve the authored SVG viewport exactly. The 272x280 canvas is already
// codec-safe at an eight-pixel boundary and avoids stretching the Fish loop.
const WIDTH = 272;
const HEIGHT = 280;
const SOURCE_DURATION_SECONDS = 1.125;
const FRAMES_PER_SECOND = 64;
const FRAME_COUNT = 72;
const OUTPUT_DURATION_MILLISECONDS = 1125;

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

const workDirectory = await mkdtemp(path.join(tmpdir(), 'cc-fish-hevc-'));
const frameDirectory = path.join(workDirectory, 'frames');
const encoderBinary = path.join(workDirectory, 'encode-hevc-alpha-frames');
const temporaryProResOutput = path.join(workDirectory, 'fish-prores4444.mov');
const temporaryOutput = path.join(workDirectory, 'fish-mobile-hevc.mov');

try {
  await mkdir(frameDirectory, { recursive: true });
  console.log(`[fish] render-start ${WIDTH}x${HEIGHT} ${FRAME_COUNT}f`);
  await run(process.execPath, [
    RENDERER_PATH,
    SOURCE_PATH,
    frameDirectory,
    String(WIDTH),
    String(HEIGHT),
    String(FRAMES_PER_SECOND),
    String(SOURCE_DURATION_SECONDS),
  ]);

  await run('/usr/bin/xcrun', [
    'swiftc',
    '-O',
    ENCODER_SOURCE_PATH,
    '-o',
    encoderBinary,
  ]);
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
  console.log(`[fish] complete ${path.relative(PROJECT_ROOT, OUTPUT_PATH)} ${WIDTH}x${HEIGHT} ${FRAME_COUNT}f/${OUTPUT_DURATION_MILLISECONDS}ms`);
} finally {
  await rm(workDirectory, { recursive: true, force: true });
}
