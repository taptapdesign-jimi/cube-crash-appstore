#!/usr/bin/env node
/* global console */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(
  process.env.STACK_TO_SIX_ADAPTIVE_OUTPUT
    || 'assets/sound/wip/adaptive-music-v1',
);
const ANALYSIS = JSON.parse(fs.readFileSync(path.join(ROOT, 'analysis.json'), 'utf8'));

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function parseWav(bytes) {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('not RIFF/WAVE');
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
  if (!fmt || !data) throw new Error('missing fmt/data');
  const format = bytes.readUInt16LE(fmt.offset);
  const channels = bytes.readUInt16LE(fmt.offset + 2);
  const sampleRate = bytes.readUInt32LE(fmt.offset + 4);
  const bitDepth = bytes.readUInt16LE(fmt.offset + 14);
  if (format !== 1 || channels !== 2 || sampleRate !== 48_000 || bitDepth !== 24) {
    throw new Error(`unexpected format=${format} channels=${channels} rate=${sampleRate} bits=${bitDepth}`);
  }
  return { data, channels, sampleRate, bitDepth };
}

function readInt24(bytes, offset) {
  let value = bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
  if (value & 0x800000) value -= 0x1000000;
  return value / 8388608;
}

function validateCandidate(candidate) {
  const filename = path.join(ROOT, candidate.file);
  const bytes = fs.readFileSync(filename);
  const wav = parseWav(bytes);
  if (sha256(bytes) !== candidate.sha256) throw new Error(`${candidate.file}: hash mismatch`);
  const bytesPerFrame = wav.channels * wav.bitDepth / 8;
  const frames = Math.floor(wav.data.size / bytesPerFrame);
  const duration = frames / wav.sampleRate;
  if (Math.abs(duration - candidate.durationSeconds) > 1 / wav.sampleRate) {
    throw new Error(`${candidate.file}: duration mismatch`);
  }

  let peak = 0;
  let sum = 0;
  let dcLeft = 0;
  let dcRight = 0;
  let previousLeft = 0;
  let previousRight = 0;
  const differences = [];
  let firstLeft = 0;
  let firstRight = 0;
  let lastLeft = 0;
  let lastRight = 0;
  for (let frame = 0, offset = wav.data.offset; frame < frames; frame += 1, offset += bytesPerFrame) {
    const left = readInt24(bytes, offset);
    const right = readInt24(bytes, offset + 3);
    if (frame === 0) {
      firstLeft = left;
      firstRight = right;
    } else if (frame % 97 === 0) {
      differences.push(Math.max(Math.abs(left - previousLeft), Math.abs(right - previousRight)));
    }
    previousLeft = left;
    previousRight = right;
    lastLeft = left;
    lastRight = right;
    peak = Math.max(peak, Math.abs(left), Math.abs(right));
    sum += left * left + right * right;
    dcLeft += left;
    dcRight += right;
  }
  differences.sort((a, b) => a - b);
  const normalJump = differences[Math.floor(differences.length * 0.99)] || 1e-9;
  const seamJump = Math.max(Math.abs(firstLeft - lastLeft), Math.abs(firstRight - lastRight));
  const peakDb = 20 * Math.log10(Math.max(1e-12, peak));
  const rmsDb = 20 * Math.log10(Math.max(1e-12, Math.sqrt(sum / (frames * 2))));
  const dc = Math.max(Math.abs(dcLeft / frames), Math.abs(dcRight / frames));
  if (peakDb > -3.35) throw new Error(`${candidate.file}: unsafe peak ${peakDb.toFixed(2)} dBFS`);
  if (dc > 0.005) throw new Error(`${candidate.file}: DC offset ${dc}`);
  if (seamJump > Math.max(0.02, normalJump * 2)) {
    throw new Error(`${candidate.file}: loop seam jump ${seamJump} exceeds normal ${normalJump}`);
  }
  return { duration, peakDb, rmsDb, dc, seamJump, normalJump };
}

const source = fs.readFileSync(path.resolve(ANALYSIS.source));
if (sha256(source) !== ANALYSIS.sourceSha256) throw new Error('Preserved theme source hash changed.');
for (const candidate of ANALYSIS.candidates) {
  const result = validateCandidate(candidate);
  console.log(`PASS ${candidate.file}`, result);
}
console.log('PASS: adaptive music candidates are valid, unclipped, bounded and loop-safe.');
