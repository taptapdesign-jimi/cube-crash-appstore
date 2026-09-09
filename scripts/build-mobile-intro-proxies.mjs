#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { copyFile, mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const OUTPUT_DIRECTORY = path.join(PROJECT_ROOT, 'assets/logo addons/optimized');
const RENDERER = path.join(PROJECT_ROOT, 'scripts/render-animated-svg-frames.mjs');
const HEVC_ENCODER_SOURCE = path.join(PROJECT_ROOT, 'scripts/encode-hevc-alpha-frames.swift');
const FRAME_WIDTH = 680;
const SOURCE_FPS = 30;
const SOURCE_FRAME_STRIDE = 2;
const CHARACTER_CONCURRENCY = 2;
const ENCODE_CONCURRENCY = 4;

const characters = [
  ['lik-game.svg', 'lik-game-mobile.webp', 'lik-game-mobile-hevc.mov', 2, 990],
  ['lik-gitara.svg', 'lik-gitara-mobile.webp', 'lik-gitara-mobile-hevc.mov', 2, 990],
  ['lik-pas-SVG.svg', 'lik-pas-SVG-mobile.webp', 'lik-pas-SVG-mobile-hevc.mov', 4, 1980],
  ['lik-cvijet.svg', 'lik-cvijet-mobile.webp', 'lik-cvijet-mobile-hevc.mov', 2, 990],
  ['lik-kauc.svg', 'lik-kauc-mobile.webp', 'lik-kauc-mobile-hevc.mov', 1.2755102, 638],
  ['lik-board.svg', 'lik-board-mobile.webp', 'lik-board-mobile-hevc.mov', 1.3798623, 804],
  ['lik slikanje.svg', 'lik-slikanje-mobile.webp', 'lik-slikanje-mobile-hevc.mov', 2, 990],
  ['lik-laptop.svg', 'lik-laptop-mobile.webp', 'lik-laptop-mobile-hevc.mov', 3, 1485],
  ['lik-nogomet.svg', 'lik-nogomet-mobile.webp', 'lik-nogomet-mobile-hevc.mov', 2, 990],
  ['lik-speceraj.svg', 'lik-speceraj-mobile.webp', 'lik-speceraj-mobile-hevc.mov', 2, 990],
  ['pas novine.svg', 'pas-novine-mobile.webp', 'pas-novine-mobile-hevc.mov', 2, 990],
];

const requestedSources = new Set(process.argv.slice(2));
const selectedCharacters = requestedSources.size === 0
  ? characters
  : characters.filter(([source]) => requestedSources.has(source));

if (selectedCharacters.length !== (requestedSources.size || characters.length)) {
  const known = new Set(characters.map(([source]) => source));
  const unknown = [...requestedSources].filter((source) => !known.has(source));
  throw new Error(`Unknown intro SVG: ${unknown.join(', ')}`);
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

async function mapWithConcurrency(items, concurrency, worker) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(workers);
}

function readViewBox(svgMarkup, sourceName) {
  const match = svgMarkup.match(/\bviewBox="([^"]+)"/);
  if (!match) throw new Error(`${sourceName} has no viewBox`);
  const values = match[1].trim().split(/\s+/).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`${sourceName} has an invalid viewBox`);
  }
  return { width: values[2], height: values[3] };
}

function frameDurationMilliseconds(frameIndex, frameCount, outputDurationMilliseconds) {
  const frameStart = Math.round(frameIndex * outputDurationMilliseconds / frameCount);
  const frameEnd = Math.round((frameIndex + 1) * outputDurationMilliseconds / frameCount);
  return frameEnd - frameStart;
}

async function buildCharacter(
  [sourceName, webpOutputName, hevcOutputName, sourceDurationSeconds, outputDurationMilliseconds],
  hevcEncoderBinary,
) {
  const sourcePath = path.join(PROJECT_ROOT, 'assets/logo addons', sourceName);
  const webpOutputPath = path.join(OUTPUT_DIRECTORY, webpOutputName);
  const hevcOutputPath = path.join(OUTPUT_DIRECTORY, hevcOutputName);
  const svgMarkup = await readFile(sourcePath, 'utf8');
  const viewBox = readViewBox(svgMarkup, sourceName);
  const outputHeight = Math.round(FRAME_WIDTH * viewBox.height / viewBox.width);
  const workDirectory = await mkdtemp(path.join(tmpdir(), 'cc-intro-proxy-'));
  const frameDirectory = path.join(workDirectory, 'frames');
  const encodedDirectory = path.join(workDirectory, 'encoded');
  const temporaryHevcPath = path.join(workDirectory, hevcOutputName);
  await mkdir(frameDirectory, { recursive: true });
  await mkdir(encodedDirectory, { recursive: true });

  console.log(`[intro-proxy] render-start ${sourceName} ${FRAME_WIDTH}x${outputHeight}`);
  try {
    await run(process.execPath, [
      RENDERER,
      sourcePath,
      frameDirectory,
      String(FRAME_WIDTH),
      String(outputHeight),
      String(SOURCE_FPS),
      String(sourceDurationSeconds),
    ]);

    const outputFrameCount = Math.round(SOURCE_FPS * sourceDurationSeconds / SOURCE_FRAME_STRIDE);
    const retainedFrameIndices = Array.from(
      { length: outputFrameCount },
      (_, index) => index * SOURCE_FRAME_STRIDE,
    );
    const buildWebp = async () => {
      await mapWithConcurrency(retainedFrameIndices, ENCODE_CONCURRENCY, async (frameIndex, outputIndex) => {
        const sourceFrame = path.join(frameDirectory, `frame-${String(frameIndex).padStart(4, '0')}.png`);
        const encodedFrame = path.join(encodedDirectory, `frame-${String(outputIndex).padStart(4, '0')}.webp`);
        await run('/opt/homebrew/bin/cwebp', [
          '-quiet', '-q', '85', '-alpha_q', '100', '-m', '6', '-mt', sourceFrame, '-o', encodedFrame,
        ]);
      });

      const muxArgs = [];
      for (let index = 0; index < retainedFrameIndices.length; index += 1) {
        muxArgs.push(
          '-frame',
          path.join(encodedDirectory, `frame-${String(index).padStart(4, '0')}.webp`),
          `+${frameDurationMilliseconds(index, outputFrameCount, outputDurationMilliseconds)}+0+0+0-b`,
        );
      }
      muxArgs.push('-loop', '0', '-bgcolor', '255,255,255,255', '-o', webpOutputPath);
      await run('/opt/homebrew/bin/webpmux', muxArgs);
    };

    const buildHevc = async () => {
      await run(hevcEncoderBinary, [
        frameDirectory,
        temporaryHevcPath,
        String(FRAME_WIDTH),
        String(outputHeight),
        String(outputFrameCount),
        String(SOURCE_FRAME_STRIDE),
        String(outputDurationMilliseconds),
      ]);
      await copyFile(temporaryHevcPath, hevcOutputPath);
    };

    await Promise.all([buildWebp(), buildHevc()]);
    console.log(`[intro-proxy] complete ${webpOutputName} + ${hevcOutputName} ${FRAME_WIDTH}x${outputHeight} ${outputFrameCount}f/${outputDurationMilliseconds}ms`);
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
}

await mkdir(OUTPUT_DIRECTORY, { recursive: true });
const encoderBuildDirectory = await mkdtemp(path.join(tmpdir(), 'cc-hevc-encoder-'));
const hevcEncoderBinary = path.join(encoderBuildDirectory, 'encode-hevc-alpha-frames');
try {
  await run('/usr/bin/xcrun', ['swiftc', '-O', HEVC_ENCODER_SOURCE, '-o', hevcEncoderBinary]);
  await mapWithConcurrency(
    selectedCharacters,
    CHARACTER_CONCURRENCY,
    (character) => buildCharacter(character, hevcEncoderBinary),
  );
} finally {
  await rm(encoderBuildDirectory, { recursive: true, force: true });
}
