#!/usr/bin/env node
/* global Buffer, console */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SAMPLE_RATE = 48_000;
const CHANNELS = 2;
const PACKAGE_VERSION = Number(process.env.STACK_TO_SIX_THEME_PACKAGE_VERSION || 2);
const SOURCE = path.resolve(
  process.env.STACK_TO_SIX_THEME_SOURCE
    || 'assets/sound/soundtrack/TapTapDesign-Stacktosixtheme.wav',
);
const ADAPTIVE_ANALYSIS_PATH = path.resolve(
  process.env.STACK_TO_SIX_ADAPTIVE_ANALYSIS
    || 'assets/sound/wip/adaptive-music-v2/analysis.json',
);
const ADAPTIVE_ANALYSIS = JSON.parse(fs.readFileSync(ADAPTIVE_ANALYSIS_PATH, 'utf8'));
const BPM = ADAPTIVE_ANALYSIS.detectedTempoBpm;
const BEAT_PHASE_SECONDS = ADAPTIVE_ANALYSIS.detectedBeatPhaseSeconds;
const BAR_SECONDS = 240 / BPM;
const OUTPUT_DIR = path.resolve(
  process.env.STACK_TO_SIX_RESULT_OUTPUT
    || 'assets/sound/wip/theme-result-v2',
);

function fail(message) {
  throw new Error(message);
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function readPcm16StereoWav(filename) {
  const bytes = fs.readFileSync(filename);
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
    fail('Expected a RIFF/WAVE source.');
  }
  let fmt = null;
  let data = null;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const id = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const payload = offset + 8;
    if (id === 'fmt ') fmt = { offset: payload, size };
    if (id === 'data') data = { offset: payload, size };
    offset = payload + size + (size & 1);
  }
  if (!fmt || !data) fail('Source is missing fmt/data chunks.');
  const format = bytes.readUInt16LE(fmt.offset);
  const channels = bytes.readUInt16LE(fmt.offset + 2);
  const sampleRate = bytes.readUInt32LE(fmt.offset + 4);
  const bitDepth = bytes.readUInt16LE(fmt.offset + 14);
  if (format !== 1 || channels !== CHANNELS || sampleRate !== SAMPLE_RATE || bitDepth !== 16) {
    fail(`Unexpected source format=${format} channels=${channels} rate=${sampleRate} bits=${bitDepth}`);
  }
  const frames = Math.floor(data.size / 4);
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  for (let frame = 0, offset = data.offset; frame < frames; frame += 1, offset += 4) {
    left[frame] = bytes.readInt16LE(offset) / 32768;
    right[frame] = bytes.readInt16LE(offset + 2) / 32768;
  }
  return { bytes, left, right };
}

function onePoleCoefficient(cutoff) {
  return 1 - Math.exp(-2 * Math.PI * cutoff / SAMPLE_RATE);
}

function extractSaxForward(source, startSeconds, durationSeconds, profile) {
  const start = Math.round(startSeconds * SAMPLE_RATE);
  const frames = Math.min(
    Math.round(durationSeconds * SAMPLE_RATE),
    source.left.length - start,
  );
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  const lowCoefficient = onePoleCoefficient(220);
  const highCoefficient = onePoleCoefficient(4_800);
  let lowState = 0;
  let highState = 0;

  for (let i = 0; i < frames; i += 1) {
    const sourceLeft = source.left[start + i];
    const sourceRight = source.right[start + i];
    const mid = (sourceLeft + sourceRight) * 0.5;
    const side = (sourceLeft - sourceRight) * 0.5;
    lowState += lowCoefficient * (mid - lowState);
    highState += highCoefficient * (mid - highState);
    const low = lowState;
    const lead = highState - lowState;
    const air = mid - highState;
    const shapedMid = low * profile.low + lead * profile.lead + air * profile.air;
    left[i] = shapedMid + side * profile.side;
    right[i] = shapedMid - side * profile.side;
  }
  return { left, right };
}

function applyEdgeFades(audio, fadeInSeconds, fadeOutSeconds) {
  const fadeInFrames = Math.min(audio.left.length, Math.round(fadeInSeconds * SAMPLE_RATE));
  const fadeOutFrames = Math.min(audio.left.length, Math.round(fadeOutSeconds * SAMPLE_RATE));
  for (let i = 0; i < fadeInFrames; i += 1) {
    const gain = Math.sin((i / Math.max(1, fadeInFrames - 1)) * Math.PI * 0.5);
    audio.left[i] *= gain;
    audio.right[i] *= gain;
  }
  for (let i = 0; i < fadeOutFrames; i += 1) {
    const outputIndex = audio.left.length - fadeOutFrames + i;
    const gain = Math.cos((i / Math.max(1, fadeOutFrames - 1)) * Math.PI * 0.5);
    audio.left[outputIndex] *= gain;
    audio.right[outputIndex] *= gain;
  }
}

function tapeDown(source, startRate, endRate) {
  const averageRate = (startRate + endRate) * 0.5;
  const outputFrames = Math.floor(source.left.length / averageRate);
  const left = new Float32Array(outputFrames);
  const right = new Float32Array(outputFrames);
  let sourcePosition = 0;
  for (let frame = 0; frame < outputFrames; frame += 1) {
    const progress = frame / Math.max(1, outputFrames - 1);
    const eased = progress * progress * (3 - 2 * progress);
    const rate = startRate + (endRate - startRate) * eased;
    const first = Math.min(source.left.length - 1, Math.floor(sourcePosition));
    const second = Math.min(source.left.length - 1, first + 1);
    const blend = sourcePosition - first;
    left[frame] = source.left[first] * (1 - blend) + source.left[second] * blend;
    right[frame] = source.right[first] * (1 - blend) + source.right[second] * blend;
    sourcePosition = Math.min(source.left.length - 1, sourcePosition + rate);
  }
  return { left, right };
}

function normalize(audio, targetRmsDb, targetPeakDb) {
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < audio.left.length; i += 1) {
    const left = audio.left[i];
    const right = audio.right[i];
    sum += left * left + right * right;
    peak = Math.max(peak, Math.abs(left), Math.abs(right));
  }
  const rms = Math.sqrt(sum / Math.max(1, audio.left.length * 2));
  const targetRms = 10 ** (targetRmsDb / 20);
  const targetPeak = 10 ** (targetPeakDb / 20);
  const gain = Math.min(
    targetRms / Math.max(1e-9, rms),
    targetPeak / Math.max(1e-9, peak),
  );
  for (let i = 0; i < audio.left.length; i += 1) {
    audio.left[i] *= gain;
    audio.right[i] *= gain;
  }
  return {
    gain,
    rmsDb: 20 * Math.log10(Math.max(1e-9, rms * gain)),
    peakDb: 20 * Math.log10(Math.max(1e-9, peak * gain)),
  };
}

function writePcm24Wav(filename, audio) {
  const bytesPerSample = 3;
  const dataBytes = audio.left.length * CHANNELS * bytesPerSample;
  const bytes = Buffer.allocUnsafe(44 + dataBytes);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(36 + dataBytes, 4);
  bytes.write('WAVE', 8);
  bytes.write('fmt ', 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(CHANNELS, 22);
  bytes.writeUInt32LE(SAMPLE_RATE, 24);
  bytes.writeUInt32LE(SAMPLE_RATE * CHANNELS * bytesPerSample, 28);
  bytes.writeUInt16LE(CHANNELS * bytesPerSample, 32);
  bytes.writeUInt16LE(24, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(dataBytes, 40);
  let offset = 44;
  for (let frame = 0; frame < audio.left.length; frame += 1) {
    for (const sample of [audio.left[frame], audio.right[frame]]) {
      let value = Math.round(Math.max(-1, Math.min(0.99999988, sample)) * 8388607);
      if (value < 0) value += 0x1000000;
      bytes[offset] = value & 0xff;
      bytes[offset + 1] = (value >> 8) & 0xff;
      bytes[offset + 2] = (value >> 16) & 0xff;
      offset += 3;
    }
  }
  fs.writeFileSync(filename, bytes);
  return bytes;
}

function render(filename, audio, levels, extra) {
  const outputPath = path.join(OUTPUT_DIR, filename);
  const bytes = writePcm24Wav(outputPath, audio);
  return {
    file: filename,
    durationSeconds: audio.left.length / SAMPLE_RATE,
    ...extra,
    ...levels,
    sha256: sha256(bytes),
  };
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const source = readPcm16StereoWav(SOURCE);

  // The final three bars contain the source's authored biggest sax return and
  // natural resolved ending, so the victory cue retains the recognizable hook.
  const totalSeconds = source.left.length / SAMPLE_RATE;
  const completeBars = Math.floor((totalSeconds - BEAT_PHASE_SECONDS) / BAR_SECONDS);
  const victoryStartBar = Math.max(0, completeBars - 3);
  const victoryStartSeconds = BEAT_PHASE_SECONDS + victoryStartBar * BAR_SECONDS;
  const victory = extractSaxForward(
    source,
    victoryStartSeconds,
    totalSeconds - victoryStartSeconds,
    { low: 0.58, lead: 1, air: 0.76, side: 0.62 },
  );
  applyEdgeFades(victory, 0.015, 0.22);
  const victoryLevels = normalize(victory, -17.25, -3.5);

  // A quieter early one-bar statement becomes a friendly fail sting through a
  // bounded cartoon tape-down. It shares the motif without sounding punitive.
  const failStartBar = Math.min(4, Math.max(0, completeBars - 2));
  const failStartSeconds = BEAT_PHASE_SECONDS + failStartBar * BAR_SECONDS;
  const failSource = extractSaxForward(
    source,
    failStartSeconds,
    BAR_SECONDS,
    { low: 0.52, lead: 1, air: 0.66, side: 0.48 },
  );
  const fail = tapeDown(failSource, 0.83, 0.57);
  applyEdgeFades(fail, 0.012, 0.34);
  const failLevels = normalize(fail, -19, -4.5);

  const report = {
    version: PACKAGE_VERSION,
    source: path.relative(process.cwd(), SOURCE),
    sourceSha256: sha256(source.bytes),
    sampleRate: SAMPLE_RATE,
    channels: CHANNELS,
    outputBitDepth: 24,
    tempoBpm: BPM,
    beatPhaseSeconds: BEAT_PHASE_SECONDS,
    candidates: [
      render(`saxophone-happy-theme-v${PACKAGE_VERSION}.wav`, victory, victoryLevels, {
        sourceStartBar: victoryStartBar,
        sourceStartSeconds: victoryStartSeconds,
        treatment: 'sax-forward final-theme cadence with natural resolved ending',
      }),
      render(`saxophone-fail-theme-v${PACKAGE_VERSION}.wav`, fail, failLevels, {
        sourceStartBar: failStartBar,
        sourceStartSeconds: failStartSeconds,
        treatment: 'sax-forward shared motif with playful bounded tape-down',
      }),
    ],
  };
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'analysis.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  fs.writeFileSync(path.join(OUTPUT_DIR, 'README.md'), `# Stack to Six theme result v${PACKAGE_VERSION}\n\nDerived from the preserved lossless \`${path.basename(SOURCE)}\` master.\n\n- Victory: sax-forward final cadence, preserving the optimistic hook and authored resolution.\n- Fail: the same theme family with a short friendly cartoon tape-down; playful, not punitive.\n- Both candidates are stereo 48 kHz 24-bit PCM WAV with click-free edge fades.\n- The original theme and prior result assets remain unchanged.\n`);
  console.log(JSON.stringify(report, null, 2));
}

main();
