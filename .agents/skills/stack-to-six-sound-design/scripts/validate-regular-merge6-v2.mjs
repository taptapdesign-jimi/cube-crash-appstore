#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outputDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../assets/sound/merge 6/regular-merge6-v2',
);
const manifest = JSON.parse(fs.readFileSync(path.join(outputDir, 'manifest.json'), 'utf8'));
const failures = [];
const suppliedBasePath = path.join(outputDir, 'cartoon-bouncy-base.mp3');

if (!fs.existsSync(suppliedBasePath) || fs.statSync(suppliedBasePath).size === 0) {
  failures.push('cartoon-bouncy-base.mp3: missing or empty');
}

for (const entry of manifest.files) {
  const filePath = path.join(outputDir, entry.file);
  if (!fs.existsSync(filePath)) {
    failures.push(`${entry.file}: missing`);
    continue;
  }
  const wav = fs.readFileSync(filePath);
  const channels = wav.readUInt16LE(22);
  const sampleRate = wav.readUInt32LE(24);
  const bitDepth = wav.readUInt16LE(34);
  const sampleCount = wav.readUInt32LE(40) / 2;
  let peak = 0;
  let sum = 0;
  let sumSquares = 0;
  let firstReadableSample = -1;
  let tailPeak = 0;
  const tailStart = sampleCount - Math.floor(sampleRate * 0.004);
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = wav.readInt16LE(44 + index * 2) / 32768;
    peak = Math.max(peak, Math.abs(sample));
    sum += sample;
    sumSquares += sample * sample;
    if (firstReadableSample < 0 && Math.abs(sample) >= 0.01) firstReadableSample = index;
    if (index >= tailStart) tailPeak = Math.max(tailPeak, Math.abs(sample));
  }
  const durationMs = sampleCount / sampleRate * 1000;
  const peakDbfs = 20 * Math.log10(Math.max(peak, 1e-9));
  const rmsDbfs = 20 * Math.log10(Math.max(Math.sqrt(sumSquares / sampleCount), 1e-9));
  const onsetMs = firstReadableSample / sampleRate * 1000;
  const dc = Math.abs(sum / sampleCount);
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') failures.push(`${entry.file}: invalid WAV`);
  if (channels !== 1 || sampleRate !== 48_000 || bitDepth !== 16) failures.push(`${entry.file}: expected mono 48kHz/16-bit`);
  if (durationMs < 380 || durationMs > 430) failures.push(`${entry.file}: duration ${durationMs.toFixed(1)}ms`);
  if (peakDbfs > -4.5 || peakDbfs < -5.2) failures.push(`${entry.file}: peak ${peakDbfs.toFixed(2)}dBFS`);
  if (rmsDbfs < -24 || rmsDbfs > -12) failures.push(`${entry.file}: RMS ${rmsDbfs.toFixed(2)}dBFS`);
  if (onsetMs > 3) failures.push(`${entry.file}: onset ${onsetMs.toFixed(2)}ms`);
  if (dc > 0.002) failures.push(`${entry.file}: DC ${dc.toFixed(5)}`);
  if (tailPeak > 0.035) failures.push(`${entry.file}: tail peak ${tailPeak.toFixed(4)}`);
}

if (manifest.files.length !== 4) failures.push(`expected 4 variants, found ${manifest.files.length}`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('PASS: 4 Regular Merge-6 v2 mono PCM WAVs, immediate onset, bounded level/DC/tail.');
}
