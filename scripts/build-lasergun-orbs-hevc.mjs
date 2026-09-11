#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { copyFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const SOURCE_PATH = path.join(PROJECT_ROOT, 'assets/shop/gun/electric blue orbs.svg');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'assets/shop/gun/electric-blue-orbs-hevc.mov');
const RENDERER_PATH = path.join(PROJECT_ROOT, 'scripts/render-animated-svg-frames.mjs');
const ENCODER_SOURCE_PATH = path.join(PROJECT_ROOT, 'scripts/encode-hevc-alpha-frames.swift');

// HEVC-with-alpha requires a macroblock-safe canvas. 432x768 preserves the
// authored 9:16 viewBox exactly while keeping both dimensions divisible by 16.
const WIDTH = 432;
const HEIGHT = 768;
const SOURCE_DURATION_SECONDS = 3;
const FRAMES_PER_SECOND = 60;
const FRAME_COUNT = SOURCE_DURATION_SECONDS * FRAMES_PER_SECOND;
const OUTPUT_DURATION_MILLISECONDS = SOURCE_DURATION_SECONDS * 1_000;

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

const workDirectory = await mkdtemp(path.join(tmpdir(), 'cc-lasergun-orbs-'));
const frameDirectory = path.join(workDirectory, 'frames');
const encoderBinary = path.join(workDirectory, 'encode-hevc-alpha-frames');
const temporaryProResOutput = path.join(workDirectory, 'electric-blue-orbs-prores4444.mov');
const temporaryOutput = path.join(workDirectory, 'electric-blue-orbs-hevc.mov');

try {
  await mkdir(frameDirectory, { recursive: true });
  console.log(`[lasergun-orbs] render-start ${WIDTH}x${HEIGHT} ${FRAME_COUNT}f`);
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
  console.log(`[lasergun-orbs] complete ${path.relative(PROJECT_ROOT, OUTPUT_PATH)} ${WIDTH}x${HEIGHT} ${FRAME_COUNT}f/${OUTPUT_DURATION_MILLISECONDS}ms`);
} finally {
  await rm(workDirectory, { recursive: true, force: true });
}
