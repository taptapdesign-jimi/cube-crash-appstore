#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 48_000;
const OUTPUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../assets/sound/merge 6/regular-merge6-v2',
);

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

function envelope(time, duration, attack = 0.001, power = 2.5) {
  if (time < 0 || time >= duration) return 0;
  return Math.min(1, time / Math.max(attack, 0.0001)) * ((1 - time / duration) ** power);
}

function addTone(buffer, start, duration, fromHz, toHz, amplitude, options = {}) {
  let phase = options.phase ?? 0;
  const startIndex = Math.max(0, Math.floor(start * SAMPLE_RATE));
  const endIndex = Math.min(buffer.length, Math.ceil((start + duration) * SAMPLE_RATE));
  for (let index = startIndex; index < endIndex; index += 1) {
    const time = index / SAMPLE_RATE - start;
    const progress = time / duration;
    const frequency = fromHz * ((toHz / fromHz) ** progress);
    phase += Math.PI * 2 * frequency / SAMPLE_RATE;
    const sine = Math.sin(phase);
    const rounded = Math.tanh(sine * (options.warmth ?? 1.15));
    buffer[index] += rounded * amplitude * envelope(
      time,
      duration,
      options.attack ?? 0.001,
      options.power ?? 2.5,
    );
  }
}

function addCrack(buffer, random, start, strength = 1) {
  const grains = [0, 0.006, 0.014, 0.025];
  for (let grain = 0; grain < grains.length; grain += 1) {
    const grainStart = start + grains[grain] + random() * 0.0025;
    const duration = 0.012 + random() * 0.012;
    const startIndex = Math.floor(grainStart * SAMPLE_RATE);
    const endIndex = Math.min(buffer.length, Math.ceil((grainStart + duration) * SAMPLE_RATE));
    let low = 0;
    let previousLow = 0;
    for (let index = startIndex; index < endIndex; index += 1) {
      const time = index / SAMPLE_RATE - grainStart;
      const white = random() * 2 - 1;
      low += (white - low) * (0.13 + grain * 0.025);
      const fibre = low - previousLow * 0.72;
      previousLow = low;
      buffer[index] += fibre * strength * (0.42 - grain * 0.065) * envelope(time, duration, 0.00035, 4.8);
    }
  }
}

function addWoodBlock(buffer, start, strength, pitch) {
  const partials = [126, 204, 318, 492, 735];
  const amplitudes = [0.9, 0.64, 0.34, 0.16, 0.055];
  partials.forEach((frequency, index) => {
    addTone(
      buffer,
      start + index * 0.0008,
      0.17 + strength * 0.065 - index * 0.012,
      frequency * pitch,
      frequency * pitch * (0.955 - index * 0.003),
      amplitudes[index] * strength,
      { attack: 0.0008, power: 2.45 + index * 0.42, warmth: index < 2 ? 1.35 : 1.08 },
    );
  });
}

function addBubbleBoop(buffer, start, strength, pitch) {
  addTone(buffer, start, 0.145, 285 * pitch, 710 * pitch, 0.44 * strength, {
    attack: 0.003,
    power: 2.35,
    warmth: 1.28,
  });
  addTone(buffer, start + 0.007, 0.105, 610 * pitch, 980 * pitch, 0.15 * strength, {
    attack: 0.002,
    power: 3.1,
  });
}

function synthesize(variant) {
  const random = randomSource(0x6d657267 + variant * 991);
  const durations = [0.39, 0.405, 0.42, 0.4];
  const buffer = new Float64Array(Math.ceil(durations[variant - 1] * SAMPLE_RATE));
  const pitch = 0.965 + random() * 0.07;
  const secondHit = 0.042 + random() * 0.012;
  const rebound = 0.112 + random() * 0.016;

  addCrack(buffer, random, 0.0005, 0.9);
  addWoodBlock(buffer, 0.001, 0.92, 0.78 * pitch);
  addWoodBlock(buffer, secondHit, 0.52, 1.08 * pitch);
  addBubbleBoop(buffer, 0.018, 0.72, 0.98 * pitch);
  addCrack(buffer, random, secondHit + 0.003, 0.38);
  addBubbleBoop(buffer, rebound, 0.52, 1.2 * pitch);
  addWoodBlock(buffer, rebound + 0.018, 0.28, 1.34 * pitch);

  const fadeSamples = Math.floor(SAMPLE_RATE * 0.012);
  for (let index = 0; index < buffer.length; index += 1) buffer[index] = Math.tanh(buffer[index] * 1.08);
  for (let offset = 0; offset < fadeSamples; offset += 1) {
    buffer[buffer.length - fadeSamples + offset] *= 1 - offset / fadeSamples;
  }

  const mean = buffer.reduce((sum, value) => sum + value, 0) / buffer.length;
  let peak = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    buffer[index] -= mean;
    peak = Math.max(peak, Math.abs(buffer[index]));
  }
  const targetPeak = 10 ** (-4.8 / 20);
  for (let index = 0; index < buffer.length; index += 1) buffer[index] *= targetPeak / peak;
  return buffer;
}

function writeWav(filePath, samples) {
  const output = Buffer.alloc(44 + samples.length * 2);
  output.write('RIFF', 0);
  output.writeUInt32LE(36 + samples.length * 2, 4);
  output.write('WAVE', 8);
  output.write('fmt ', 12);
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(SAMPLE_RATE, 24);
  output.writeUInt32LE(SAMPLE_RATE * 2, 28);
  output.writeUInt16LE(2, 32);
  output.writeUInt16LE(16, 34);
  output.write('data', 36);
  output.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) => {
    const bounded = Math.max(-1, Math.min(1, sample));
    output.writeInt16LE(Math.round(bounded * (bounded < 0 ? 32768 : 32767)), 44 + index * 2);
  });
  fs.writeFileSync(filePath, output);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const manifest = {
  version: 2,
  soundId: 'gp-merge6-regular',
  status: 'runtime-wired',
  style: ['wooden-crack', 'double-toy-block', 'bubbly-boop', 'happy-elastic-rebound'],
  suppliedCartoonBase: {
    file: 'cartoon-bouncy-base.mp3',
    playbackRate: 1.45,
    role: 'sweet cartoony and bouncy layer',
  },
  exclusions: ['wild-special', 'board-transition'],
  format: { codec: 'PCM', sampleRate: SAMPLE_RATE, bitDepth: 16, channels: 1 },
  files: [],
};

for (let variant = 1; variant <= 4; variant += 1) {
  const samples = synthesize(variant);
  const file = `regular-merge6-v2-${String(variant).padStart(2, '0')}.wav`;
  writeWav(path.join(OUTPUT_DIR, file), samples);
  manifest.files.push({
    file,
    variant,
    durationMs: Math.round(samples.length / SAMPLE_RATE * 1000),
    targetPeakDbfs: -4.8,
    intendedTrigger: 'committed ordinary die-on-die merge equal to six',
  });
}

fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(OUTPUT_DIR, 'audition.html'), `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stack to Six - Regular Merge-6 v2</title>
<style>body{max-width:720px;margin:auto;padding:24px;font-family:system-ui;background:#f4eadb;color:#493628}label{display:grid;grid-template-columns:1fr 2fr;gap:16px;align-items:center;margin:14px 0;padding:14px;background:#fffaf1;border-radius:16px}audio{width:100%}@media(max-width:560px){label{grid-template-columns:1fr}}</style>
<h1>Regular Merge-6 v2</h1><p>Wooden crack, double toy-block body, bubbly boop and happy elastic rebound. Runtime layers the supplied cartoony base below one random lossless accent. Ordinary Merge-6 only.</p>
<label><span>cartoony base</span><audio controls preload="metadata" src="cartoon-bouncy-base.mp3"></audio></label>
${manifest.files.map(({ file }) => `<label><span>${file}</span><audio controls preload="metadata" src="${file}"></audio></label>`).join('')}`);

console.log(`Generated ${manifest.files.length} Regular Merge-6 v2 WAV files in ${OUTPUT_DIR}`);
