#!/usr/bin/env node
/* global Buffer, console, process */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SAMPLE_RATE = 48_000;
const CHANNELS = 2;
const SOURCE = path.resolve(
  process.env.STACK_TO_SIX_THEME_SOURCE
    || 'assets/sound/soundtrack/stack to six theme.wav',
);
const OUTPUT_DIR = path.resolve(
  process.env.STACK_TO_SIX_ADAPTIVE_OUTPUT
    || 'assets/sound/wip/adaptive-music-v1',
);
const VLC = '/Applications/VLC.app/Contents/MacOS/VLC';

function fail(message) {
  throw new Error(message);
}

function readRiffChunks(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    fail('Expected a RIFF/WAVE source.');
  }
  const chunks = new Map();
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    if (dataOffset + size > buffer.length) break;
    chunks.set(id, { offset: dataOffset, size });
    offset = dataOffset + size + (size & 1);
  }
  return chunks;
}

function decodeSourceToPcm() {
  const sourceBytes = fs.readFileSync(SOURCE);
  const sourceChunks = readRiffChunks(sourceBytes);
  const fmt = sourceChunks.get('fmt ');
  const data = sourceChunks.get('data');
  if (!fmt || !data) fail('Source has no WAVE fmt/data chunk.');

  const audioFormat = sourceBytes.readUInt16LE(fmt.offset);
  const channels = sourceBytes.readUInt16LE(fmt.offset + 2);
  const sampleRate = sourceBytes.readUInt32LE(fmt.offset + 4);
  const bitDepth = sourceBytes.readUInt16LE(fmt.offset + 14);
  if (
    audioFormat === 1
    && channels === CHANNELS
    && sampleRate === SAMPLE_RATE
    && bitDepth === 16
  ) {
    const frameCount = Math.floor(data.size / (CHANNELS * 2));
    const left = new Float32Array(frameCount);
    const right = new Float32Array(frameCount);
    for (let frame = 0, byte = data.offset; frame < frameCount; frame += 1, byte += 4) {
      left[frame] = sourceBytes.readInt16LE(byte) / 32768;
      right[frame] = sourceBytes.readInt16LE(byte + 2) / 32768;
    }
    return {
      left,
      right,
      sourceBytes,
      sourceTechnicalNote: '48 kHz 16-bit stereo PCM lossless WAV master',
    };
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-to-six-adaptive-music-'));
  const extractedMp3 = path.join(tempRoot, 'theme.mp3');
  const decodedWav = path.join(tempRoot, 'theme-pcm.wav');
  fs.writeFileSync(extractedMp3, sourceBytes.subarray(data.offset, data.offset + data.size));

  const result = spawnSync(VLC, [
    '-I', 'dummy',
    '--play-and-exit',
    extractedMp3,
    '--sout', `#transcode{acodec=s16l,channels=2,samplerate=${SAMPLE_RATE}}:std{access=file,mux=wav,dst=${decodedWav}}`,
  ], { encoding: 'utf8' });
  if (result.status !== 0 || !fs.existsSync(decodedWav)) {
    fail(`VLC decode failed: ${result.stderr || result.stdout || `exit ${result.status}`}`);
  }

  const pcmBytes = fs.readFileSync(decodedWav);
  const chunks = readRiffChunks(pcmBytes);
  const decodedFmt = chunks.get('fmt ');
  const pcm = chunks.get('data');
  if (!decodedFmt || !pcm) fail('Decoded WAVE is missing fmt or data.');
  const decodedAudioFormat = pcmBytes.readUInt16LE(decodedFmt.offset);
  const decodedChannels = pcmBytes.readUInt16LE(decodedFmt.offset + 2);
  const decodedSampleRate = pcmBytes.readUInt32LE(decodedFmt.offset + 4);
  const decodedBitDepth = pcmBytes.readUInt16LE(decodedFmt.offset + 14);
  if (
    decodedAudioFormat !== 1
    || decodedChannels !== CHANNELS
    || decodedSampleRate !== SAMPLE_RATE
    || decodedBitDepth !== 16
  ) {
    fail(`Unexpected decoded format: format=${decodedAudioFormat}, channels=${decodedChannels}, rate=${decodedSampleRate}, bits=${decodedBitDepth}`);
  }

  const frameCount = Math.floor(pcm.size / (CHANNELS * 2));
  const left = new Float32Array(frameCount);
  const right = new Float32Array(frameCount);
  for (let frame = 0, byte = pcm.offset; frame < frameCount; frame += 1, byte += 4) {
    left[frame] = pcmBytes.readInt16LE(byte) / 32768;
    right[frame] = pcmBytes.readInt16LE(byte + 2) / 32768;
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
  return {
    left,
    right,
    sourceBytes,
    sourceTechnicalNote: 'MPEG Layer III stream decoded from a RIFF/WAVE container',
  };
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * fraction)))];
}

function analyzeEnvelope(left, right) {
  const hop = 480;
  const blockCount = Math.floor(left.length / hop);
  const logEnergy = new Float64Array(blockCount);
  const midRatio = new Float64Array(blockCount);
  let previousMono = 0;
  const transient = new Float64Array(blockCount);

  for (let block = 0; block < blockCount; block += 1) {
    let energy = 0;
    let midEnergy = 0;
    let sideEnergy = 0;
    let differenceEnergy = 0;
    const start = block * hop;
    for (let frame = start; frame < start + hop; frame += 4) {
      const l = left[frame];
      const r = right[frame];
      const mid = (l + r) * 0.5;
      const side = (l - r) * 0.5;
      const difference = mid - previousMono;
      energy += mid * mid + side * side;
      midEnergy += mid * mid;
      sideEnergy += side * side;
      differenceEnergy += difference * difference;
      previousMono = mid;
    }
    logEnergy[block] = Math.log10(1e-10 + energy / (hop / 4));
    midRatio[block] = midEnergy / Math.max(1e-10, midEnergy + sideEnergy);
    transient[block] = Math.log10(1e-10 + differenceEnergy / (hop / 4));
  }

  const onset = new Float64Array(blockCount);
  for (let block = 2; block < blockCount; block += 1) {
    const energyRise = logEnergy[block] - Math.min(logEnergy[block - 1], logEnergy[block - 2]);
    const transientRise = transient[block] - Math.min(transient[block - 1], transient[block - 2]);
    onset[block] = Math.max(0, energyRise) + Math.max(0, transientRise) * 0.65;
  }
  return { hop, logEnergy, midRatio, onset };
}

function estimateTempo(envelope) {
  const hopSeconds = envelope.hop / SAMPLE_RATE;
  let best = { bpm: 120, score: -Infinity };
  for (let bpm = 82; bpm <= 148; bpm += 0.1) {
    const lag = Math.round(60 / bpm / hopSeconds);
    let score = 0;
    let weight = 0;
    for (let i = lag + 800; i < envelope.onset.length - 400; i += 1) {
      const local = envelope.onset[i];
      score += local * envelope.onset[i - lag];
      weight += local;
    }
    score /= Math.max(1e-9, weight);
    if (score > best.score) best = { bpm, score };
  }
  return Math.round(best.bpm * 10) / 10;
}

function estimateBeatPhase(envelope, bpm) {
  const blocksPerBeat = 60 / bpm * SAMPLE_RATE / envelope.hop;
  const bins = 240;
  let best = { phase: 0, score: -Infinity };
  for (let bin = 0; bin < bins; bin += 1) {
    const phase = blocksPerBeat * bin / bins;
    let score = 0;
    for (let beat = 8; ; beat += 1) {
      const index = Math.round(phase + beat * blocksPerBeat);
      if (index >= envelope.onset.length - 400) break;
      score += envelope.onset[index];
      score += (envelope.onset[index - 1] + envelope.onset[index + 1]) * 0.45;
    }
    if (score > best.score) best = { phase, score };
  }
  return best.phase * envelope.hop / SAMPLE_RATE;
}

function segmentStats(envelope, startSeconds, durationSeconds) {
  const first = Math.max(0, Math.round(startSeconds * SAMPLE_RATE / envelope.hop));
  const last = Math.min(envelope.logEnergy.length, Math.round((startSeconds + durationSeconds) * SAMPLE_RATE / envelope.hop));
  let energy = 0;
  let center = 0;
  let activity = 0;
  for (let i = first; i < last; i += 1) {
    energy += envelope.logEnergy[i];
    center += envelope.midRatio[i];
    activity += envelope.onset[i];
  }
  const count = Math.max(1, last - first);
  return { energy: energy / count, center: center / count, activity: activity / count };
}

function boundaryDistance(envelope, startSeconds, endSeconds) {
  const span = 1.5;
  const a = segmentStats(envelope, startSeconds, span);
  const b = segmentStats(envelope, endSeconds - span, span);
  return Math.abs(a.energy - b.energy) * 1.8
    + Math.abs(a.center - b.center) * 1.2
    + Math.abs(a.activity - b.activity) * 0.8;
}

function chooseSections(envelope, bpm, beatPhaseSeconds, totalSeconds) {
  const beatSeconds = 60 / bpm;
  const barSeconds = beatSeconds * 4;
  const loopBars = 24;
  const crossfadeBars = 1;
  const outputDuration = loopBars * barSeconds;
  const sourceDuration = outputDuration + crossfadeBars * barSeconds;
  const candidates = [];

  const preferredFirstBar = totalSeconds >= sourceDuration + 4 + barSeconds * 4
    ? 4
    : 0;
  for (let bar = preferredFirstBar; ; bar += 1) {
    const start = beatPhaseSeconds + bar * barSeconds;
    if (start + sourceDuration > totalSeconds - 0.5) break;
    const stats = segmentStats(envelope, start, sourceDuration);
    const seam = boundaryDistance(envelope, start, start + sourceDuration);
    candidates.push({ bar, start, ...stats, seam });
  }
  if (candidates.length < 1) fail('Theme is too short for one complete loop candidate.');

  const energies = candidates.map((candidate) => candidate.energy);
  const lowEnergy = percentile(energies, 0.25);
  const highEnergy = percentile(energies, 0.75);
  const calm = [...candidates].sort((a, b) => (
    Math.abs(a.energy - lowEnergy) * 1.6 + a.center * 0.65 + a.seam * 1.5
  ) - (
    Math.abs(b.energy - lowEnergy) * 1.6 + b.center * 0.65 + b.seam * 1.5
  ))[0];
  const activePool = candidates.filter((candidate) => Math.abs(candidate.start - calm.start) >= barSeconds * 6);
  const active = [...(activePool.length ? activePool : candidates)].sort((a, b) => (
    Math.abs(a.energy - highEnergy) * 1.2 + a.center * 0.35 + a.seam * 1.5
  ) - (
    Math.abs(b.energy - highEnergy) * 1.2 + b.center * 0.35 + b.seam * 1.5
  ))[0];
  return { calm, active, beatSeconds, barSeconds, loopBars, outputDuration, sourceDuration };
}

function onePoleCoefficient(cutoff) {
  return 1 - Math.exp(-2 * Math.PI * cutoff / SAMPLE_RATE);
}

function processSection(left, right, startSeconds, sourceDuration, profile) {
  const start = Math.round(startSeconds * SAMPLE_RATE);
  const frames = Math.round(sourceDuration * SAMPLE_RATE);
  const outLeft = new Float32Array(frames);
  const outRight = new Float32Array(frames);
  const lowCoefficient = onePoleCoefficient(250);
  const highCoefficient = onePoleCoefficient(4_200);
  let lowState = 0;
  let highState = 0;

  for (let i = 0; i < frames; i += 1) {
    const l = left[start + i] ?? 0;
    const r = right[start + i] ?? 0;
    const mid = (l + r) * 0.5;
    const side = (l - r) * 0.5;
    lowState += lowCoefficient * (mid - lowState);
    highState += highCoefficient * (mid - highState);
    const low = lowState;
    const band = highState - lowState;
    const air = mid - highState;
    const shapedMid = low * profile.lowGain + band * profile.leadBandGain + air * profile.airGain;
    outLeft[i] = shapedMid + side * profile.sideGain;
    outRight[i] = shapedMid - side * profile.sideGain;
  }
  return { left: outLeft, right: outRight };
}

function makeSeamlessLoop(processed, outputDuration, crossfadeDuration) {
  const outputFrames = Math.round(outputDuration * SAMPLE_RATE);
  const crossfadeFrames = Math.round(crossfadeDuration * SAMPLE_RATE);
  const bodyFrames = outputFrames - crossfadeFrames;
  const left = new Float32Array(outputFrames);
  const right = new Float32Array(outputFrames);

  left.set(processed.left.subarray(crossfadeFrames, crossfadeFrames + bodyFrames), 0);
  right.set(processed.right.subarray(crossfadeFrames, crossfadeFrames + bodyFrames), 0);
  for (let i = 0; i < crossfadeFrames; i += 1) {
    const t = i / Math.max(1, crossfadeFrames - 1);
    const tailGain = Math.cos(t * Math.PI * 0.5);
    const headGain = Math.sin(t * Math.PI * 0.5);
    const tailIndex = outputFrames + i;
    const outputIndex = bodyFrames + i;
    left[outputIndex] = processed.left[tailIndex] * tailGain + processed.left[i] * headGain;
    right[outputIndex] = processed.right[tailIndex] * tailGain + processed.right[i] * headGain;
  }
  return { left, right };
}

function normalize(audio, targetRmsDb, targetPeakDb = -3.5) {
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < audio.left.length; i += 1) {
    const l = audio.left[i];
    const r = audio.right[i];
    sum += l * l + r * r;
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
  }
  const rms = Math.sqrt(sum / Math.max(1, audio.left.length * 2));
  const targetRms = 10 ** (targetRmsDb / 20);
  const targetPeak = 10 ** (targetPeakDb / 20);
  const gain = Math.min(targetRms / Math.max(1e-9, rms), targetPeak / Math.max(1e-9, peak));
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
  const buffer = Buffer.allocUnsafe(44 + dataBytes);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(CHANNELS, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * CHANNELS * bytesPerSample, 28);
  buffer.writeUInt16LE(CHANNELS * bytesPerSample, 32);
  buffer.writeUInt16LE(24, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);
  let offset = 44;
  for (let i = 0; i < audio.left.length; i += 1) {
    for (const sample of [audio.left[i], audio.right[i]]) {
      let value = Math.round(Math.max(-1, Math.min(0.99999988, sample)) * 8388607);
      if (value < 0) value += 0x1000000;
      buffer[offset] = value & 0xff;
      buffer[offset + 1] = (value >> 8) & 0xff;
      buffer[offset + 2] = (value >> 16) & 0xff;
      offset += 3;
    }
  }
  fs.writeFileSync(filename, buffer);
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function renderCandidate(decoded, section, analysis, profile, filename) {
  const processed = processSection(
    decoded.left,
    decoded.right,
    section.start,
    analysis.sourceDuration,
    profile,
  );
  const loop = makeSeamlessLoop(processed, analysis.outputDuration, analysis.barSeconds);
  const levels = normalize(loop, profile.targetRmsDb);
  const outputPath = path.join(OUTPUT_DIR, filename);
  writePcm24Wav(outputPath, loop);
  return {
    file: filename,
    sourceStartSeconds: section.start,
    durationSeconds: loop.left.length / SAMPLE_RATE,
    centerBandGain: profile.leadBandGain,
    stereoSideGain: profile.sideGain,
    ...levels,
    sha256: sha256(fs.readFileSync(outputPath)),
  };
}

function main() {
  if (!fs.existsSync(SOURCE)) fail(`Missing source: ${SOURCE}`);
  if (!fs.existsSync(VLC)) fail(`Missing VLC decoder: ${VLC}`);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const decoded = decodeSourceToPcm();
  const envelope = analyzeEnvelope(decoded.left, decoded.right);
  const bpm = estimateTempo(envelope);
  const beatPhaseSeconds = estimateBeatPhase(envelope, bpm);
  const totalSeconds = decoded.left.length / SAMPLE_RATE;
  const analysis = chooseSections(envelope, bpm, beatPhaseSeconds, totalSeconds);

  const calm = renderCandidate(decoded, analysis.calm, analysis, {
    lowGain: 0.96,
    leadBandGain: 0.28,
    airGain: 0.66,
    sideGain: 1.08,
    targetRmsDb: -19,
  }, 'gameplay-bed-calm-01.wav');
  const active = renderCandidate(decoded, analysis.active, analysis, {
    lowGain: 1,
    leadBandGain: 0.46,
    airGain: 0.76,
    sideGain: 1.04,
    targetRmsDb: -17.5,
  }, 'gameplay-bed-active-01.wav');

  const report = {
    version: 1,
    status: 'WIP audition candidates; not integrated',
    source: path.relative(process.cwd(), SOURCE),
    sourceSha256: sha256(decoded.sourceBytes),
    sourceTechnicalNote: decoded.sourceTechnicalNote,
    sampleRate: SAMPLE_RATE,
    channels: CHANNELS,
    outputBitDepth: 24,
    detectedTempoBpm: bpm,
    detectedBeatPhaseSeconds: beatPhaseSeconds,
    loopBars: analysis.loopBars,
    crossfadeBars: 1,
    candidates: [calm, active],
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'analysis.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'README.md'), `# Stack to Six adaptive music prototype\n\nThese are audition candidates derived from the preserved source theme.\n\n- Source: \`${path.relative(process.cwd(), SOURCE)}\`\n- Source format: ${decoded.sourceTechnicalNote}\n- Detected working tempo: **${bpm.toFixed(1)} BPM**\n- Structure: **${analysis.loopBars} bars**, stereo, 48 kHz, 24-bit PCM WAV\n- Seam: one-bar equal-power musical overlap\n- Calm: stronger centre-band reduction to create SFX and result-sax headroom\n- Active: retains more thematic midrange for higher gameplay energy\n- Original theme bytes are unchanged\n`);
  console.log(JSON.stringify(report, null, 2));
}

main();
