#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUTPUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../assets/sound/gameplay-board/candidates-v4',
);
const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const failures = [];

for (const entry of manifest.files) {
  const filePath = path.join(OUTPUT_DIR, entry.file);
  if (!fs.existsSync(filePath)) {
    failures.push(`${entry.file}: missing`);
    continue;
  }

  const wav = fs.readFileSync(filePath);
  const riff = wav.toString('ascii', 0, 4);
  const wave = wav.toString('ascii', 8, 12);
  const audioFormat = wav.readUInt16LE(20);
  const channels = wav.readUInt16LE(22);
  const sampleRate = wav.readUInt32LE(24);
  const bitDepth = wav.readUInt16LE(34);
  const dataSize = wav.readUInt32LE(40);
  if (riff !== 'RIFF' || wave !== 'WAVE' || audioFormat !== 1) failures.push(`${entry.file}: invalid PCM WAV header`);
  if (channels !== 1 || sampleRate !== 48_000 || bitDepth !== 16) failures.push(`${entry.file}: expected mono 48kHz 16-bit`);
  if (dataSize !== wav.length - 44) failures.push(`${entry.file}: invalid data size`);

  const sampleCount = dataSize / 2;
  let peak = 0;
  let sum = 0;
  let sumSquares = 0;
  let tailPeak = 0;
  let firstReadableSample = -1;
  const tailStart = Math.max(0, sampleCount - Math.floor(sampleRate * 0.003));
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = wav.readInt16LE(44 + index * 2) / 32768;
    peak = Math.max(peak, Math.abs(sample));
    sum += sample;
    sumSquares += sample * sample;
    if (firstReadableSample < 0 && Math.abs(sample) >= 0.01) firstReadableSample = index;
    if (index >= tailStart) tailPeak = Math.max(tailPeak, Math.abs(sample));
  }
  const peakDbfs = 20 * Math.log10(Math.max(peak, 1e-9));
  const rmsDbfs = 20 * Math.log10(Math.max(Math.sqrt(sumSquares / sampleCount), 1e-9));
  const dc = Math.abs(sum / sampleCount);
  const durationMs = Math.round((sampleCount / sampleRate) * 1000);
  const onsetMs = firstReadableSample < 0 ? Infinity : (firstReadableSample / sampleRate) * 1000;

  if (Math.abs(durationMs - entry.durationMs) > 1) failures.push(`${entry.file}: duration mismatch`);
  if (peakDbfs > -4 || peakDbfs < -12.5) failures.push(`${entry.file}: peak ${peakDbfs.toFixed(2)} dBFS outside candidate range`);
  if (rmsDbfs < -42) failures.push(`${entry.file}: effectively silent`);
  if (onsetMs > 6) failures.push(`${entry.file}: readable onset starts at ${onsetMs.toFixed(2)}ms`);
  if (dc > 0.002) failures.push(`${entry.file}: DC offset ${dc.toFixed(5)}`);
  if (tailPeak > 0.035) failures.push(`${entry.file}: tail does not fade cleanly`);
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`PASS: ${manifest.files.length} mono PCM WAV candidates, 48kHz/16-bit, bounded peak/DC/tails.`);
}
