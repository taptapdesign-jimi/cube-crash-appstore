#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUTPUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../assets/sound/navigation-v2',
);
const manifest = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'manifest.json'), 'utf8'));
const failures = [];

for (const entry of manifest.files) {
  const filePath = path.join(OUTPUT_DIR, entry.file);
  if (!fs.existsSync(filePath)) {
    failures.push(`${entry.file}: missing`);
    continue;
  }
  const wav = fs.readFileSync(filePath);
  const dataSize = wav.readUInt32LE(40);
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') failures.push(`${entry.file}: invalid WAV`);
  if (wav.readUInt16LE(20) !== 1 || wav.readUInt16LE(22) !== 1 || wav.readUInt32LE(24) !== 48_000 || wav.readUInt16LE(34) !== 16) {
    failures.push(`${entry.file}: expected mono PCM 48kHz/16-bit`);
  }
  if (dataSize !== wav.length - 44) failures.push(`${entry.file}: invalid PCM data size`);

  const sampleCount = dataSize / 2;
  let peak = 0;
  let sum = 0;
  let sumSquares = 0;
  let firstReadable = -1;
  let tailPeak = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = wav.readInt16LE(44 + index * 2) / 32768;
    peak = Math.max(peak, Math.abs(sample));
    sum += sample;
    sumSquares += sample * sample;
    if (firstReadable < 0 && Math.abs(sample) >= 0.01) firstReadable = index;
    if (index >= sampleCount - 144) tailPeak = Math.max(tailPeak, Math.abs(sample));
  }
  const durationMs = sampleCount / 48;
  const peakDbfs = 20 * Math.log10(Math.max(peak, 1e-9));
  const rmsDbfs = 20 * Math.log10(Math.max(Math.sqrt(sumSquares / sampleCount), 1e-9));
  const onsetMs = firstReadable / 48;
  const dc = Math.abs(sum / sampleCount);
  if (Math.abs(durationMs - entry.durationMs) > 0.05) failures.push(`${entry.file}: duration ${durationMs.toFixed(2)}ms`);
  if (peakDbfs > -6.7 || peakDbfs < -7.7) failures.push(`${entry.file}: peak ${peakDbfs.toFixed(2)}dBFS`);
  if (rmsDbfs > -15 || rmsDbfs < -30) failures.push(`${entry.file}: RMS ${rmsDbfs.toFixed(2)}dBFS`);
  if (onsetMs > 2.5) failures.push(`${entry.file}: onset ${onsetMs.toFixed(2)}ms`);
  if (dc > 0.0015) failures.push(`${entry.file}: DC ${dc.toFixed(5)}`);
  if (tailPeak > 0.015) failures.push(`${entry.file}: tail peak ${tailPeak.toFixed(4)}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`PASS: ${manifest.files.length} short muted wooden Exit WAVs, mono PCM 48kHz/16-bit, bounded onset/peak/RMS/DC/tail.`);
}
