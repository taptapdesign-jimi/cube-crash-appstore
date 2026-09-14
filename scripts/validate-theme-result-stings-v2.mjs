#!/usr/bin/env node
/* global console */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(
  process.env.STACK_TO_SIX_RESULT_OUTPUT
    || 'assets/sound/wip/theme-result-v2',
);
const ANALYSIS = JSON.parse(fs.readFileSync(path.join(ROOT, 'analysis.json'), 'utf8'));

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function readInt24(bytes, offset) {
  let value = bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
  if (value & 0x800000) value -= 0x1000000;
  return value / 8388608;
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

function validateCandidate(candidate) {
  const bytes = fs.readFileSync(path.join(ROOT, candidate.file));
  const wav = parseWav(bytes);
  if (sha256(bytes) !== candidate.sha256) throw new Error(`${candidate.file}: hash mismatch`);
  const bytesPerFrame = wav.channels * wav.bitDepth / 8;
  const frames = Math.floor(wav.data.size / bytesPerFrame);
  const duration = frames / wav.sampleRate;
  let peak = 0;
  let sum = 0;
  let dcLeft = 0;
  let dcRight = 0;
  let clippedSamples = 0;
  for (let frame = 0, offset = wav.data.offset; frame < frames; frame += 1, offset += bytesPerFrame) {
    const left = readInt24(bytes, offset);
    const right = readInt24(bytes, offset + 3);
    peak = Math.max(peak, Math.abs(left), Math.abs(right));
    sum += left * left + right * right;
    dcLeft += left;
    dcRight += right;
    if (Math.abs(left) >= 0.999999 || Math.abs(right) >= 0.999999) clippedSamples += 1;
  }
  const peakDb = 20 * Math.log10(Math.max(1e-12, peak));
  const rmsDb = 20 * Math.log10(Math.max(1e-12, Math.sqrt(sum / (frames * 2))));
  const dc = Math.max(Math.abs(dcLeft / frames), Math.abs(dcRight / frames));
  const firstLeft = Math.abs(readInt24(bytes, wav.data.offset));
  const firstRight = Math.abs(readInt24(bytes, wav.data.offset + 3));
  const lastOffset = wav.data.offset + (frames - 1) * bytesPerFrame;
  const lastLeft = Math.abs(readInt24(bytes, lastOffset));
  const lastRight = Math.abs(readInt24(bytes, lastOffset + 3));
  if (Math.abs(duration - candidate.durationSeconds) > 1 / wav.sampleRate) {
    throw new Error(`${candidate.file}: duration mismatch`);
  }
  if (peakDb > -3.35) throw new Error(`${candidate.file}: unsafe peak ${peakDb.toFixed(2)} dBFS`);
  if (dc > 0.005) throw new Error(`${candidate.file}: DC offset ${dc}`);
  if (clippedSamples > 0) throw new Error(`${candidate.file}: ${clippedSamples} clipped frames`);
  if (Math.max(firstLeft, firstRight, lastLeft, lastRight) > 0.001) {
    throw new Error(`${candidate.file}: edge fade does not reach silence`);
  }
  return { duration, peakDb, rmsDb, dc, clippedSamples };
}

for (const candidate of ANALYSIS.candidates) {
  console.log(`PASS ${candidate.file}`, validateCandidate(candidate));
}
console.log('PASS: theme result candidates are valid, unclipped and click-safe.');
