#!/usr/bin/env node

/**
 * Generic animated SVG -> transparent HEVC .mov generator for Stack to Six.
 *
 * Example:
 * node scripts/generate-svg-hevc-alpha.mjs \
 *   --input "assets/path/animation.svg" \
 *   --output "assets/path/animation-hevc.mov" \
 *   --source-duration-ms 2000 \
 *   --width 680 \
 *   --fps 30 \
 *   --qa-dir "/tmp/animation-hevc-qa"
 *
 * `source-duration-ms` must be the complete authored SVG loop period. Use
 * `output-duration-ms` only when the exported playback should intentionally
 * run faster or slower than the SVG source.
 */

import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const RENDERER_PATH = path.join(PROJECT_ROOT, 'scripts/render-animated-svg-frames.mjs');
const ENCODER_SOURCE_PATH = path.join(PROJECT_ROOT, 'scripts/encode-hevc-alpha-frames.swift');

function fail(message) {
  console.error(`svg-hevc-alpha: ${message}`);
  process.exit(1);
}

function printUsage() {
  console.log(`Usage:
  node scripts/generate-svg-hevc-alpha.mjs \\
    --input <animated.svg> \\
    --output <transparent-hevc.mov> \\
    --source-duration-ms <complete-loop-ms> \\
    [--output-duration-ms <playback-ms>] \\
    [--width <pixels>] [--fps <frames-per-second>] \\
    [--qa-dir <directory>] [--force]

Defaults:
  --width 680
  --fps 30
  --output-duration-ms = --source-duration-ms

The script preserves the SVG viewBox aspect ratio, samples the complete loop
without duplicating its terminal frame, and exports HEVC with alpha through an
Apple ProRes 4444 intermediate.`);
}

function parseArguments(values) {
  const options = {
    width: 680,
    fps: 30,
    force: false,
  };

  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (key === '--help' || key === '-h') {
      printUsage();
      process.exit(0);
    }
    if (key === '--force') {
      options.force = true;
      continue;
    }
    const value = values[index + 1];
    if (!value || value.startsWith('--')) fail(`missing value for ${key}`);
    index += 1;
    if (key === '--input') options.input = value;
    else if (key === '--output') options.output = value;
    else if (key === '--source-duration-ms') options.sourceDurationMs = Number(value);
    else if (key === '--output-duration-ms') options.outputDurationMs = Number(value);
    else if (key === '--width') options.width = Number(value);
    else if (key === '--fps') options.fps = Number(value);
    else if (key === '--qa-dir') options.qaDir = value;
    else fail(`unknown option: ${key}`);
  }

  if (!options.input) fail('--input is required');
  if (!options.output) fail('--output is required');
  if (!Number.isFinite(options.sourceDurationMs) || options.sourceDurationMs <= 0) {
    fail('--source-duration-ms must be a positive number');
  }
  if (!Number.isInteger(options.width) || options.width <= 0) fail('--width must be a positive integer');
  if (!Number.isFinite(options.fps) || options.fps <= 0) fail('--fps must be a positive number');
  options.outputDurationMs ??= options.sourceDurationMs;
  if (!Number.isFinite(options.outputDurationMs) || options.outputDurationMs <= 0) {
    fail('--output-duration-ms must be a positive number');
  }
  return options;
}

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

function readViewBox(svgMarkup) {
  const match = svgMarkup.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
  if (!match) fail('input SVG has no viewBox');
  const values = match[1].trim().split(/[\s,]+/).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
    fail('input SVG has an invalid viewBox');
  }
  if (values[2] <= 0 || values[3] <= 0) fail('input SVG viewBox dimensions must be positive');
  return { width: values[2], height: values[3] };
}

function codecSafeDimension(value) {
  return Math.max(8, Math.ceil(value / 8) * 8);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function sha256(filePath) {
  const data = await readFile(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

const options = parseArguments(process.argv.slice(2));
const inputPath = path.resolve(PROJECT_ROOT, options.input);
const outputPath = path.resolve(PROJECT_ROOT, options.output);

if (path.extname(inputPath).toLowerCase() !== '.svg') fail('--input must point to an .svg file');
if (path.extname(outputPath).toLowerCase() !== '.mov') fail('--output must end in .mov');
if (!(await exists(inputPath))) fail(`input does not exist: ${inputPath}`);
if (await exists(outputPath)) {
  if (!options.force) fail(`output already exists (pass --force to replace it): ${outputPath}`);
  await rm(outputPath);
}

const svgMarkup = await readFile(inputPath, 'utf8');
const viewBox = readViewBox(svgMarkup);
const width = codecSafeDimension(options.width);
const height = codecSafeDimension(width * viewBox.height / viewBox.width);
const sourceDurationSeconds = options.sourceDurationMs / 1000;
const frameCount = Math.max(1, Math.round(options.fps * sourceDurationSeconds));
const effectiveRenderFps = frameCount / sourceDurationSeconds;
const outputDurationMs = Math.round(options.outputDurationMs);
const workDirectory = await mkdtemp(path.join(tmpdir(), 'cc-generic-svg-hevc-'));
const frameDirectory = path.join(workDirectory, 'frames');
const encoderBinary = path.join(workDirectory, 'encode-hevc-alpha-frames');
const proResPath = path.join(workDirectory, 'intermediate-prores4444.mov');
const hevcPath = path.join(workDirectory, 'output-hevc-alpha.mov');

try {
  await mkdir(frameDirectory, { recursive: true });
  await mkdir(path.dirname(outputPath), { recursive: true });
  console.log(`[svg-hevc-alpha] render ${path.relative(PROJECT_ROOT, inputPath)} ${width}x${height} ${frameCount} frames`);
  await run(process.execPath, [
    RENDERER_PATH,
    inputPath,
    frameDirectory,
    String(width),
    String(height),
    String(effectiveRenderFps),
    String(sourceDurationSeconds),
  ]);

  await run('/usr/bin/xcrun', ['swiftc', '-O', ENCODER_SOURCE_PATH, '-o', encoderBinary]);
  await run(encoderBinary, [
    frameDirectory,
    proResPath,
    String(width),
    String(height),
    String(frameCount),
    '1',
    String(outputDurationMs),
    'prores4444',
  ]);
  await run('/usr/bin/avconvert', [
    '--source', proResPath,
    '--preset', 'PresetHEVCHighestQualityWithAlpha',
    '--output', hevcPath,
    '--replace',
  ]);
  await copyFile(hevcPath, outputPath);

  let qaFrames = null;
  if (options.qaDir) {
    const qaDirectory = path.resolve(PROJECT_ROOT, options.qaDir);
    await mkdir(qaDirectory, { recursive: true });
    const indices = [...new Set([0, Math.floor(frameCount / 2), frameCount - 1])];
    qaFrames = [];
    for (const index of indices) {
      const frameName = `frame-${String(index).padStart(4, '0')}.png`;
      const label = index === 0 ? 'first.png' : index === frameCount - 1 ? 'last.png' : 'middle.png';
      const destination = path.join(qaDirectory, label);
      await copyFile(path.join(frameDirectory, frameName), destination);
      qaFrames.push(destination);
    }
  }

  const mediaInfo = await run('/usr/bin/avmediainfo', [outputPath, '--brief']);
  const result = {
    input: inputPath,
    output: outputPath,
    sourceViewBox: viewBox,
    width,
    height,
    frameCount,
    sourceDurationMs: options.sourceDurationMs,
    outputDurationMs,
    fps: frameCount * 1000 / outputDurationMs,
    bytes: (await stat(outputPath)).size,
    sha256: await sha256(outputPath),
    qaFrames,
    mediaInfo,
  };
  console.log(JSON.stringify(result, null, 2));
} finally {
  await rm(workDirectory, { recursive: true, force: true });
}
