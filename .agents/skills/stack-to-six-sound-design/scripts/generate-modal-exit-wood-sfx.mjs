#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 48_000;
const OUTPUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../assets/sound/navigation-v2',
);

const variants = [
  { file: 'modal-exit-wood-01.wav', durationMs: 112, seed: 0x574f4f31, bodyHz: 214, secondAtMs: 17, character: 'dry wooden tap-tup' },
  { file: 'modal-exit-wood-02.wav', durationMs: 124, seed: 0x574f4f32, bodyHz: 188, secondAtMs: 21, character: 'muted wooden clap-tup' },
  { file: 'modal-exit-wood-03.wav', durationMs: 136, seed: 0x574f4f33, bodyHz: 166, secondAtMs: 24, character: 'rounded low wooden tup-tap' },
];

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

function addDampedPartial(samples, start, frequency, amplitude, decayMs, phase = 0) {
  const startIndex = Math.floor(start * SAMPLE_RATE);
  const decaySeconds = decayMs / 1000;
  for (let index = startIndex; index < samples.length; index += 1) {
    const time = (index - startIndex) / SAMPLE_RATE;
    const attack = Math.min(1, time / 0.0012);
    const envelope = attack * Math.exp(-5.8 * time / decaySeconds);
    samples[index] += Math.sin(Math.PI * 2 * frequency * time + phase) * amplitude * envelope;
  }
}

function addMutedWoodContact(samples, random, start, weight, bodyHz) {
  const startIndex = Math.floor(start * SAMPLE_RATE);
  const endIndex = Math.min(samples.length, startIndex + Math.floor(SAMPLE_RATE * 0.027));
  let low = 0;
  let previousLow = 0;
  for (let index = startIndex; index < endIndex; index += 1) {
    const localTime = (index - startIndex) / SAMPLE_RATE;
    const white = random() * 2 - 1;
    low += (white - low) * 0.105;
    const grain = low * 0.82 + (low - previousLow) * 0.18;
    previousLow = low;
    const envelope = Math.exp(-localTime * 155) * Math.min(1, localTime / 0.00055);
    samples[index] += grain * 0.36 * weight * envelope;
  }

  addDampedPartial(samples, start, bodyHz, 0.92 * weight, 58, 0.18);
  addDampedPartial(samples, start + 0.0008, bodyHz * 1.58, 0.48 * weight, 42, 1.1);
  addDampedPartial(samples, start + 0.0015, bodyHz * 2.34, 0.19 * weight, 27, 2.2);
}

function removeDcAndFade(samples) {
  const mean = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
  const fadeSamples = Math.floor(SAMPLE_RATE * 0.009);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] -= mean;
    if (index >= samples.length - fadeSamples) {
      samples[index] *= (samples.length - index - 1) / fadeSamples;
    }
  }
}

function normalize(samples, peakDbfs = -7.2) {
  const currentPeak = samples.reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0);
  const targetPeak = 10 ** (peakDbfs / 20);
  const gain = targetPeak / Math.max(currentPeak, 1e-9);
  for (let index = 0; index < samples.length; index += 1) samples[index] *= gain;
}

function encodePcm16Wav(samples) {
  const dataSize = samples.length * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(SAMPLE_RATE * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);
  samples.forEach((sample, index) => {
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + index * 2);
  });
  return wav;
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
for (const variant of variants) {
  const samples = new Float64Array(Math.round(SAMPLE_RATE * variant.durationMs / 1000));
  const random = randomSource(variant.seed);
  addMutedWoodContact(samples, random, 0, 1, variant.bodyHz);
  addMutedWoodContact(samples, random, variant.secondAtMs / 1000, 0.42, variant.bodyHz * 1.12);
  removeDcAndFade(samples);
  normalize(samples);
  fs.writeFileSync(path.join(OUTPUT_DIR, variant.file), encodePcm16Wav(samples));
}

const manifest = {
  family: 'modal-exit-wood',
  version: 2,
  design: 'Short muted wooden clap/tap/tup contacts. No bubble, water-drop, pitch sweep, boing or reverb layer.',
  format: { channels: 1, sampleRate: SAMPLE_RATE, bitsPerSample: 16 },
  runtimeWired: true,
  files: variants.map(({ file, durationMs, character }) => ({ file, durationMs, character })),
};
fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${variants.length} muted wooden modal Exit sounds in ${OUTPUT_DIR}`);
