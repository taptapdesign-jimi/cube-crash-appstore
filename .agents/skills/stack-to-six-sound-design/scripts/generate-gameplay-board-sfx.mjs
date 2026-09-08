#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 48_000;
const OUTPUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../assets/sound/gameplay-board/candidates-v4',
);

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

function envelope(time, duration, attack = 0.008, curve = 2.2) {
  if (time < 0 || time >= duration) return 0;
  const attackGain = Math.min(1, time / Math.max(attack, 0.0001));
  const decay = Math.max(0, 1 - time / duration);
  return attackGain * Math.pow(decay, curve);
}

function addSweep(buffer, start, duration, fromHz, toHz, amplitude, options = {}) {
  const startIndex = Math.max(0, Math.floor(start * SAMPLE_RATE));
  const endIndex = Math.min(buffer.length, Math.ceil((start + duration) * SAMPLE_RATE));
  let phase = options.phase ?? 0;
  for (let index = startIndex; index < endIndex; index += 1) {
    const localTime = index / SAMPLE_RATE - start;
    const progress = Math.min(1, localTime / duration);
    const frequency = fromHz * Math.pow(Math.max(0.0001, toHz / fromHz), progress);
    phase += (Math.PI * 2 * frequency) / SAMPLE_RATE;
    const sine = Math.sin(phase);
    const triangle = (2 / Math.PI) * Math.asin(sine);
    const wave = options.triangle ? triangle : sine;
    buffer[index] += wave * amplitude * envelope(
      localTime,
      duration,
      options.attack ?? 0.006,
      options.curve ?? 2.2,
    );
  }
}

function addNoise(buffer, random, start, duration, amplitude, smooth = 0.18, curve = 3) {
  const startIndex = Math.max(0, Math.floor(start * SAMPLE_RATE));
  const endIndex = Math.min(buffer.length, Math.ceil((start + duration) * SAMPLE_RATE));
  let filtered = 0;
  let previous = 0;
  for (let index = startIndex; index < endIndex; index += 1) {
    const localTime = index / SAMPLE_RATE - start;
    const white = random() * 2 - 1;
    filtered += (white - filtered) * smooth;
    const textured = filtered - previous * 0.22;
    previous = filtered;
    buffer[index] += textured * amplitude * envelope(localTime, duration, 0.0015, curve);
  }
}

function addWoodKnock(buffer, random, start, weight = 1, pitch = 1) {
  // A rounded toy-block body with restrained grain. The lower, more tightly
  // clustered partials avoid the dry cork/plug character of candidates-v1.
  addNoise(buffer, random, start, 0.026 + weight * 0.01, 0.15 * weight, 0.16, 5.2);
  const partials = [148, 236, 372, 585];
  const amplitudes = [0.88, 0.54, 0.27, 0.08];
  partials.forEach((frequency, index) => {
    addSweep(
      buffer,
      start + index * 0.0015,
      0.105 + weight * 0.082 - index * 0.009,
      frequency * pitch,
      frequency * pitch * (0.96 - index * 0.005),
      amplitudes[index] * weight,
      { attack: 0.0012, curve: 2.75 + index * 0.42, triangle: index === 0 },
    );
  });
}

function addBubblePop(buffer, random, start, weight = 1, pitch = 1, rising = true) {
  const from = (rising ? 330 : 620) * pitch;
  const to = (rising ? 760 : 310) * pitch;
  const duration = 0.085 + weight * 0.035;
  addSweep(buffer, start, duration, from, to, 0.42 * weight, {
    attack: 0.0025,
    curve: 2.65,
  });
  addSweep(buffer, start + 0.004, duration * 0.72, from * 1.48, to * 1.36, 0.13 * weight, {
    attack: 0.0015,
    curve: 3.2,
  });
  addNoise(buffer, random, start, 0.018, 0.09 * weight, 0.1, 5.8);
}

function addHappyRebound(buffer, random, start, weight, pitch) {
  addBubblePop(buffer, random, start, weight, pitch, true);
  addWoodKnock(buffer, random, start + 0.014, weight * 0.28, pitch * 1.12);
}

function addWhoosh(buffer, random, start, duration, amplitude, rising = true) {
  const startIndex = Math.max(0, Math.floor(start * SAMPLE_RATE));
  const endIndex = Math.min(buffer.length, Math.ceil((start + duration) * SAMPLE_RATE));
  let fast = 0;
  let slow = 0;
  for (let index = startIndex; index < endIndex; index += 1) {
    const localTime = index / SAMPLE_RATE - start;
    const progress = localTime / duration;
    const white = random() * 2 - 1;
    fast += (white - fast) * (0.08 + progress * 0.18);
    slow += (white - slow) * 0.025;
    const band = fast - slow;
    const shape = Math.sin(Math.PI * progress) ** 1.5;
    const direction = rising ? 0.55 + progress * 0.45 : 1 - progress * 0.45;
    buffer[index] += band * amplitude * shape * direction;
  }
}

function addTableThump(buffer, random, start, weight = 1, pitch = 1) {
  // Palm/board-on-table contact: broad low body, a short damped wooden tap and
  // very little narrow resonance. This intentionally avoids the corky toy-block
  // partial stack used by the earlier family.
  addNoise(buffer, random, start, 0.022 + weight * 0.008, 0.24 * weight, 0.055, 4.8);
  addSweep(buffer, start, 0.12 + weight * 0.055, 112 * pitch, 78 * pitch, 0.92 * weight, {
    attack: 0.001,
    curve: 2.35,
    triangle: true,
  });
  addSweep(buffer, start + 0.0015, 0.082 + weight * 0.035, 188 * pitch, 138 * pitch, 0.38 * weight, {
    attack: 0.0008,
    curve: 3.1,
  });
  addSweep(buffer, start + 0.0025, 0.045, 720 * pitch, 510 * pitch, 0.075 * weight, {
    attack: 0.0005,
    curve: 4.6,
  });
}

function addPlushWhoom(buffer, random, start, duration, amplitude, rising = true) {
  const startIndex = Math.max(0, Math.floor(start * SAMPLE_RATE));
  const endIndex = Math.min(buffer.length, Math.ceil((start + duration) * SAMPLE_RATE));
  let softNoise = 0;
  for (let index = startIndex; index < endIndex; index += 1) {
    const localTime = index / SAMPLE_RATE - start;
    const progress = Math.min(1, localTime / duration);
    const white = random() * 2 - 1;
    softNoise += (white - softNoise) * 0.018;
    const shape = Math.sin(Math.PI * progress) ** 1.35;
    const direction = rising ? 0.62 + progress * 0.38 : 1 - progress * 0.38;
    buffer[index] += softNoise * amplitude * shape * direction;
  }
  addSweep(
    buffer,
    start + 0.002,
    duration * 0.92,
    (rising ? 145 : 285),
    (rising ? 285 : 138),
    amplitude * 0.52,
    { attack: 0.008, curve: 2.15 },
  );
}

function addWarmRewardLift(buffer, start, weight = 1, pitch = 1) {
  addSweep(buffer, start, 0.1 + weight * 0.035, 205 * pitch, 430 * pitch, 0.34 * weight, {
    attack: 0.004,
    curve: 2.55,
  });
  addSweep(buffer, start + 0.018, 0.085, 310 * pitch, 245 * pitch, 0.13 * weight, {
    attack: 0.003,
    curve: 3.1,
  });
}

function finalize(buffer, targetPeakDb) {
  const fadeSamples = Math.min(buffer.length, Math.floor(SAMPLE_RATE * 0.008));
  for (let index = 0; index < buffer.length; index += 1) {
    buffer[index] = Math.tanh(buffer[index] * 1.12);
  }
  for (let offset = 0; offset < fadeSamples; offset += 1) {
    const index = buffer.length - fadeSamples + offset;
    buffer[index] *= 1 - offset / fadeSamples;
  }
  const mean = buffer.reduce((sum, value) => sum + value, 0) / Math.max(1, buffer.length);
  let peak = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    buffer[index] -= mean;
    peak = Math.max(peak, Math.abs(buffer[index]));
  }
  const targetPeak = 10 ** (targetPeakDb / 20);
  const scale = peak > 0 ? targetPeak / peak : 1;
  for (let index = 0; index < buffer.length; index += 1) buffer[index] *= scale;
}

function writeWav(filePath, samples) {
  const dataSize = samples.length * 2;
  const output = Buffer.alloc(44 + dataSize);
  output.write('RIFF', 0);
  output.writeUInt32LE(36 + dataSize, 4);
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
  output.writeUInt32LE(dataSize, 40);
  samples.forEach((sample, index) => {
    const value = Math.max(-1, Math.min(1, sample));
    output.writeInt16LE(Math.round(value * (value < 0 ? 32768 : 32767)), 44 + index * 2);
  });
  fs.writeFileSync(filePath, output);
}

const definitions = [
  ...Array.from({ length: 3 }, (_, i) => ({ family: 'tile-pickup', variant: i + 1, duration: 0.12, peak: -8.5 })),
  ...Array.from({ length: 2 }, (_, i) => ({ family: 'invalid-drop', variant: i + 1, duration: 0.155, peak: -10.5 })),
  ...Array.from({ length: 4 }, (_, i) => ({ family: 'stack-light', variant: i + 1, duration: 0.185, peak: -6.5 })),
  ...Array.from({ length: 3 }, (_, i) => ({ family: 'stack-heavy', variant: i + 1, duration: 0.25, peak: -5 })),
  ...Array.from({ length: 3 }, (_, i) => ({ family: 'spawn-pop', variant: i + 1, duration: 0.175, peak: -7.5 })),
  ...Array.from({ length: 3 }, (_, i) => ({ family: 'combo-step', variant: i + 1, duration: 0.135, peak: -8.5 })),
  ...Array.from({ length: 2 }, (_, i) => ({ family: 'combo-milestone', variant: i + 1, duration: 0.265, peak: -6 })),
  ...Array.from({ length: 3 }, (_, i) => ({ family: 'hud-tap', variant: i + 1, duration: 0.075, peak: -10.5 })),
  ...Array.from({ length: 2 }, (_, i) => ({ family: 'hud-sheet-open', variant: i + 1, duration: 0.2, peak: -8 })),
  ...Array.from({ length: 2 }, (_, i) => ({ family: 'hud-sheet-close', variant: i + 1, duration: 0.165, peak: -9 })),
  ...Array.from({ length: 2 }, (_, i) => ({ family: 'carrier-arrive', variant: i + 1, duration: 0.25, peak: -6.5 })),
  ...Array.from({ length: 2 }, (_, i) => ({ family: 'carrier-open', variant: i + 1, duration: 0.205, peak: -7.5 })),
  ...Array.from({ length: 2 }, (_, i) => ({ family: 'carrier-release', variant: i + 1, duration: 0.17, peak: -7.5 })),
  ...Array.from({ length: 3 }, (_, i) => ({ family: 'carrier-land', variant: i + 1, duration: 0.245, peak: -5 })),
  ...Array.from({ length: 2 }, (_, i) => ({ family: 'carrier-close', variant: i + 1, duration: 0.185, peak: -8 })),
];

const triggerByFamily = {
  'tile-pickup': 'accepted ordinary-cube pickup',
  'invalid-drop': 'rejected ordinary-cube release as snap-back begins',
  'stack-light': 'accepted shallow ordinary stack contact',
  'stack-heavy': 'accepted deeper ordinary stack contact',
  'spawn-pop': 'ordinary replacement cube visible landing/pop',
  'combo-step': 'ordinary combo increment',
  'combo-milestone': 'larger ordinary combo milestone',
  'hud-tap': 'accepted gameplay HUD hit area',
  'hud-sheet-open': 'gameplay HUD sheet begins opening',
  'hud-sheet-close': 'gameplay HUD sheet begins closing',
  'carrier-arrive': 'Arcade reward crate enters and settles above the board',
  'carrier-open': 'Arcade reward crate begins opening',
  'carrier-release': 'reward die becomes visible and leaves the crate',
  'carrier-land': 'reward die contacts its board cell',
  'carrier-close': 'Arcade reward crate begins closing',
};

function synthesize(definition) {
  const name = `${definition.family}-${String(definition.variant).padStart(2, '0')}`;
  const random = randomSource(hashSeed(name));
  const buffer = new Float64Array(Math.ceil(definition.duration * SAMPLE_RATE));
  const variation = 0.965 + random() * 0.07;

  switch (definition.family) {
    case 'tile-pickup':
      addPlushWhoom(buffer, random, 0, 0.112, 0.72, true);
      addSweep(buffer, 0.006, 0.09, 178 * variation, 335 * variation, 0.16, {
        attack: 0.008,
        curve: 2.7,
      });
      break;
    case 'invalid-drop':
      addPlushWhoom(buffer, random, 0, 0.145, 0.68, false);
      addSweep(buffer, 0.01, 0.12, 245 * variation, 125 * variation, 0.13, {
        attack: 0.01,
        curve: 2.85,
      });
      break;
    case 'stack-light':
      addTableThump(buffer, random, 0.001, 0.68, (0.97 + random() * 0.05) * variation);
      addNoise(buffer, random, 0.004, 0.038, 0.075, 0.09, 4.1);
      break;
    case 'stack-heavy':
      addTableThump(buffer, random, 0.001, 0.96, (0.78 + random() * 0.04) * variation);
      addTableThump(buffer, random, 0.026 + random() * 0.006, 0.24, 1.08 * variation);
      addNoise(buffer, random, 0.004, 0.05, 0.09, 0.075, 4.0);
      break;
    case 'spawn-pop':
      addTableThump(buffer, random, 0.001, 0.4, 1.05 * variation);
      addPlushWhoom(buffer, random, 0, 0.105, 0.24, true);
      addWarmRewardLift(buffer, 0.048 + random() * 0.006, 0.34, 1.12 * variation);
      break;
    case 'combo-step':
      addTableThump(buffer, random, 0.001, 0.24, 1.18 * variation);
      addWarmRewardLift(buffer, 0.012, 0.38, 1.12 * variation);
      break;
    case 'combo-milestone':
      addTableThump(buffer, random, 0.001, 0.48, 0.96 * variation);
      addWarmRewardLift(buffer, 0.012, 0.62, 1.02 * variation);
      addWarmRewardLift(buffer, 0.096, 0.34, 1.22 * variation);
      break;
    case 'hud-tap':
      addWoodKnock(buffer, random, 0.001, 0.18, 1.48 * variation);
      addBubblePop(buffer, random, 0.002, 0.24, 1.22 * variation, false);
      break;
    case 'hud-sheet-open':
      addWhoosh(buffer, random, 0, 0.105, 0.27, true);
      addBubblePop(buffer, random, 0.001, 0.42, 1.06 * variation, true);
      addWoodKnock(buffer, random, 0.083, 0.34, 1.24 * variation);
      break;
    case 'hud-sheet-close':
      addBubblePop(buffer, random, 0.002, 0.34, 1.02 * variation, false);
      addWhoosh(buffer, random, 0, 0.092, 0.22, false);
      addWoodKnock(buffer, random, 0.075, 0.28, 1.02 * variation);
      break;
    case 'carrier-arrive':
      addWoodKnock(buffer, random, 0.001, 0.72, 0.76 * variation);
      addWhoosh(buffer, random, 0, 0.09, 0.21, false);
      addHappyRebound(buffer, random, 0.082, 0.27, 0.98 * variation);
      break;
    case 'carrier-open':
      addNoise(buffer, random, 0, 0.065, 0.13, 0.07, 2.6);
      addWoodKnock(buffer, random, 0.002, 0.38, 1.1 * variation);
      addBubblePop(buffer, random, 0.035, 0.44, 0.95 * variation, true);
      break;
    case 'carrier-release':
      addBubblePop(buffer, random, 0.001, 0.72, 1.03 * variation, true);
      addWhoosh(buffer, random, 0, 0.085, 0.25, true);
      addHappyRebound(buffer, random, 0.072, 0.24, 1.34 * variation);
      break;
    case 'carrier-land':
      addWoodKnock(buffer, random, 0.001, 0.94, 0.72 * variation);
      addWoodKnock(buffer, random, 0.031, 0.38, 1.12 * variation);
      addBubblePop(buffer, random, 0.005, 0.3, 0.76 * variation, false);
      addHappyRebound(buffer, random, 0.088, 0.28, 1.03 * variation);
      break;
    case 'carrier-close':
      addBubblePop(buffer, random, 0.001, 0.3, 0.96 * variation, false);
      addNoise(buffer, random, 0, 0.062, 0.12, 0.07, 2.8);
      addWoodKnock(buffer, random, 0.071, 0.42, 0.9 * variation);
      break;
    default:
      throw new Error(`Unknown sound family: ${definition.family}`);
  }

  finalize(buffer, definition.peak);
  return { name, buffer };
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const manifest = {
  version: 4,
  status: 'runtime-wired',
  format: { codec: 'PCM', sampleRate: SAMPLE_RATE, bitDepth: 16, channels: 1 },
  exclusions: ['wild-special', 'board-transition', 'results-tutorial', 'generic-cta'],
  files: [],
};

for (const definition of definitions) {
  const { name, buffer } = synthesize(definition);
  const fileName = `${name}.wav`;
  writeWav(path.join(OUTPUT_DIR, fileName), buffer);
  manifest.files.push({
    file: fileName,
    family: definition.family,
    intendedTrigger: triggerByFamily[definition.family],
    variant: definition.variant,
    durationMs: Math.round((buffer.length / SAMPLE_RATE) * 1000),
    targetPeakDbfs: definition.peak,
  });
}

fs.writeFileSync(
  path.join(OUTPUT_DIR, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

const groupedFiles = Object.groupBy(manifest.files, (entry) => entry.family);
const auditionGroups = Object.entries(groupedFiles).map(([family, entries]) => `
  <section>
    <h2>${family}</h2>
    ${(entries ?? []).map((entry) => `
      <label>
        <span>${entry.file}</span>
        <audio controls preload="metadata" src="${encodeURI(entry.file)}"></audio>
      </label>`).join('')}
  </section>`).join('');

fs.writeFileSync(path.join(OUTPUT_DIR, 'audition.html'), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Stack to Six - Gameplay Board SFX candidates v4</title>
  <style>
    :root { color-scheme: light; font-family: system-ui, sans-serif; background: #f4eadb; color: #493628; }
    body { max-width: 760px; margin: 0 auto; padding: 24px; }
    h1 { margin-bottom: 6px; }
    p { line-height: 1.45; }
    section { background: #fffaf1; border: 1px solid #d9c3a8; border-radius: 18px; padding: 14px 16px; margin: 16px 0; }
    h2 { margin: 0 0 10px; font-size: 18px; }
    label { display: grid; grid-template-columns: minmax(150px, 1fr) minmax(260px, 2fr); gap: 12px; align-items: center; padding: 8px 0; }
    audio { width: 100%; }
    @media (max-width: 560px) { label { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <h1>Gameplay Board SFX - candidates v4</h1>
  <p>Ordinary board moves now inherit the warm Merge-6 wood/body language. Pickup and return use low, soft plush-mat huuh/whouh sweeps without water-drop bubbles or bright treble. The accepted v3 stack thump-taps remain unchanged. HUD, carrier, Wild/Special, Board Transition, Results/Tutorial and generic CTA sounds stay outside this pass.</p>
  ${auditionGroups}
</body>
</html>
`);

console.log(`Generated ${manifest.files.length} Stack to Six gameplay-board candidates in ${OUTPUT_DIR}`);
