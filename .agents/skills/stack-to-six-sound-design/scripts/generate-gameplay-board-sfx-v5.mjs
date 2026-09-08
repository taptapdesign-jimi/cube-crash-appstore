#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 48_000;
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const CANDIDATE_DIR = path.join(PROJECT_ROOT, 'assets/sound/gameplay-board/candidates-v5');
const RUNTIME_DIR = path.join(PROJECT_ROOT, 'assets/sound/gameplay-v5');

const familyDefinitions = [
  ['tile-pickup', 3, 95, -9],
  ['invalid-drop', 2, 120, -10],
  ['stack-light', 4, 150, -7.2],
  ['stack-heavy', 3, 200, -5.8],
  ['spawn-pop', 3, 140, -8],
  ['combo-step', 3, 110, -9],
  ['combo-milestone', 2, 210, -6.8],
  ['hud-tap', 3, 70, -11],
  ['hud-sheet-open', 2, 125, -9.5],
  ['hud-sheet-close', 2, 110, -10],
  ['carrier-arrive', 2, 190, -7],
  ['carrier-open', 2, 155, -8.5],
  ['carrier-release', 2, 130, -9],
  ['carrier-land', 3, 210, -5.8],
  ['carrier-close', 2, 145, -8.5],
];

const triggers = {
  'tile-pickup': 'accepted ordinary-cube pickup',
  'invalid-drop': 'rejected ordinary-cube release as snap-back begins',
  'stack-light': 'accepted shallow ordinary stack contact',
  'stack-heavy': 'accepted deeper ordinary stack contact',
  'spawn-pop': 'ordinary replacement cube visible landing',
  'combo-step': 'ordinary combo increment',
  'combo-milestone': 'larger ordinary combo milestone',
  'hud-tap': 'gameplay HUD input accepts a tap',
  'hud-sheet-open': 'gameplay HUD sheet begins opening',
  'hud-sheet-close': 'gameplay HUD sheet begins closing',
  'carrier-arrive': 'Arcade wooden carrier settles above the board',
  'carrier-open': 'Arcade wooden carrier begins opening',
  'carrier-release': 'reward die leaves the wooden carrier',
  'carrier-land': 'reward die contacts its board cell',
  'carrier-close': 'Arcade wooden carrier begins closing',
};

function hashSeed(text) {
  let value = 2166136261;
  for (const char of text) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function randomSource(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function addDampedPartial(samples, startSeconds, frequency, amplitude, decayMs, phase) {
  const startIndex = Math.floor(startSeconds * SAMPLE_RATE);
  const decaySeconds = decayMs / 1000;
  for (let index = startIndex; index < samples.length; index += 1) {
    const time = (index - startIndex) / SAMPLE_RATE;
    const attack = Math.min(1, time / 0.0011);
    const envelope = attack * Math.exp(-5.6 * time / decaySeconds);
    samples[index] += Math.sin(Math.PI * 2 * frequency * time + phase) * amplitude * envelope;
  }
}

function addWoodContact(samples, random, startMs, bodyHz, weight = 1, grain = 0.1) {
  const startSeconds = startMs / 1000;
  const startIndex = Math.floor(startSeconds * SAMPLE_RATE);
  const grainEnd = Math.min(samples.length, startIndex + Math.floor(SAMPLE_RATE * 0.025));
  let low = 0;
  let previous = 0;
  for (let index = startIndex; index < grainEnd; index += 1) {
    const time = (index - startIndex) / SAMPLE_RATE;
    low += ((random() * 2 - 1) - low) * grain;
    const texture = low * 0.86 + (low - previous) * 0.14;
    previous = low;
    const envelope = Math.min(1, time / 0.00055) * Math.exp(-time * 160);
    samples[index] += texture * 0.34 * weight * envelope;
  }

  addDampedPartial(samples, startSeconds, bodyHz, 0.92 * weight, 59, 0.15);
  addDampedPartial(samples, startSeconds + 0.0007, bodyHz * 1.57, 0.45 * weight, 41, 1.08);
  addDampedPartial(samples, startSeconds + 0.0014, bodyHz * 2.31, 0.16 * weight, 25, 2.15);
}

function addSequence(samples, random, family, variant) {
  const pitch = 0.965 + variant * 0.022 + (random() - 0.5) * 0.018;
  const contact = (at, hz, weight, grain = 0.1) => addWoodContact(samples, random, at, hz * pitch, weight, grain);
  switch (family) {
    case 'tile-pickup': contact(0, 282, 0.72, 0.12); contact(20, 345, 0.25, 0.13); break;
    case 'invalid-drop': contact(0, 205, 0.62, 0.085); contact(27, 166, 0.34, 0.08); break;
    case 'stack-light': contact(0, 184, 0.94, 0.09); contact(21, 238, 0.24, 0.1); break;
    case 'stack-heavy': contact(0, 142, 1.08, 0.075); contact(29, 176, 0.52, 0.08); contact(55, 210, 0.18, 0.09); break;
    case 'spawn-pop': contact(0, 232, 0.76, 0.11); contact(17, 306, 0.38, 0.12); break;
    case 'combo-step': contact(0, 318, 0.58, 0.12); contact(18, 368, 0.25, 0.13); break;
    case 'combo-milestone': contact(0, 191, 0.95, 0.09); contact(24, 268, 0.5, 0.11); contact(51, 326, 0.27, 0.12); break;
    case 'hud-tap': contact(0, 386, 0.45, 0.13); break;
    case 'hud-sheet-open': contact(0, 258, 0.56, 0.105); contact(20, 322, 0.3, 0.12); break;
    case 'hud-sheet-close': contact(0, 228, 0.5, 0.095); contact(17, 181, 0.36, 0.085); break;
    case 'carrier-arrive': contact(0, 146, 0.94, 0.075); contact(30, 188, 0.5, 0.085); break;
    case 'carrier-open': contact(0, 208, 0.62, 0.095); contact(18, 278, 0.4, 0.11); contact(41, 231, 0.22, 0.09); break;
    case 'carrier-release': contact(0, 262, 0.54, 0.11); contact(16, 329, 0.34, 0.12); break;
    case 'carrier-land': contact(0, 132, 1.08, 0.07); contact(32, 171, 0.55, 0.08); break;
    case 'carrier-close': contact(0, 181, 0.68, 0.085); contact(22, 145, 0.48, 0.075); break;
    default: throw new Error(`Unknown family ${family}`);
  }
}

function finish(samples, peakDbfs) {
  const mean = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
  const fadeLength = Math.floor(SAMPLE_RATE * 0.01);
  let peak = 0;
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] -= mean;
    if (index >= samples.length - fadeLength) samples[index] *= (samples.length - index - 1) / fadeLength;
    peak = Math.max(peak, Math.abs(samples[index]));
  }
  const gain = (10 ** (peakDbfs / 20)) / Math.max(peak, 1e-9);
  for (let index = 0; index < samples.length; index += 1) samples[index] *= gain;
}

function encodeWav(samples) {
  const dataSize = samples.length * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + dataSize, 4); wav.write('WAVE', 8);
  wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SAMPLE_RATE, 24); wav.writeUInt32LE(SAMPLE_RATE * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(dataSize, 40);
  samples.forEach((sample, index) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + index * 2));
  return wav;
}

fs.mkdirSync(CANDIDATE_DIR, { recursive: true });
fs.mkdirSync(RUNTIME_DIR, { recursive: true });
const files = [];
for (const [family, count, durationMs, peakDbfs] of familyDefinitions) {
  for (let variant = 1; variant <= count; variant += 1) {
    const file = `${family}-${String(variant).padStart(2, '0')}.wav`;
    const samples = new Float64Array(Math.round(SAMPLE_RATE * durationMs / 1000));
    addSequence(samples, randomSource(hashSeed(`v5:${file}`)), family, variant);
    finish(samples, peakDbfs);
    const wav = encodeWav(samples);
    fs.writeFileSync(path.join(CANDIDATE_DIR, file), wav);
    fs.writeFileSync(path.join(RUNTIME_DIR, file), wav);
    files.push({ file, family, variant, durationMs, peakDbfs, intendedTrigger: triggers[family] });
  }
}

const manifest = {
  version: 5,
  identity: 'Muted wooden clap/tap/tup gameplay family with no water-drop, bubble, pitch sweep, sci-fi boing or reverb layers.',
  format: { channels: 1, sampleRate: SAMPLE_RATE, bitsPerSample: 16 },
  runtimeFolder: 'assets/sound/gameplay-v5',
  excluded: ['regular Merge-6', 'NO MOVES voice', 'Wild/Special', 'Board Transition'],
  files,
};
for (const directory of [CANDIDATE_DIR, RUNTIME_DIR]) {
  fs.writeFileSync(path.join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

const groups = Object.groupBy(files, entry => entry.family);
const audition = `<!doctype html><html><head><meta charset="utf-8"><title>Gameplay v5 wooden audition</title><style>body{font:16px system-ui;background:#f4eadb;color:#493628;padding:24px}section{margin:20px 0}audio{display:block;margin:8px 0}</style></head><body><h1>Gameplay v5 — muted wooden clap / tap / tup</h1><p>No water, bubble, pitch sweep, sci-fi boing or reverb layers.</p>${Object.entries(groups).map(([family, entries]) => `<section><h2>${family}</h2>${entries.map(entry => `<label>${entry.file}<audio controls preload="metadata" src="${entry.file}"></audio></label>`).join('')}</section>`).join('')}</body></html>`;
fs.writeFileSync(path.join(CANDIDATE_DIR, 'audition.html'), audition);
console.log(`Generated ${files.length} gameplay-v5 wooden WAVs and runtime copies.`);
