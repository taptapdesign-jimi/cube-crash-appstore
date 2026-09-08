#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const CANDIDATE_DIR = path.join(PROJECT_ROOT, 'assets/sound/gameplay-board/candidates-v5');
const RUNTIME_DIR = path.join(PROJECT_ROOT, 'assets/sound/gameplay-v5');
const manifest = JSON.parse(fs.readFileSync(path.join(CANDIDATE_DIR, 'manifest.json'), 'utf8'));
const failures = [];

if (manifest.files.length !== 38) failures.push(`expected 38 files, found ${manifest.files.length}`);
for (const entry of manifest.files) {
  const candidatePath = path.join(CANDIDATE_DIR, entry.file);
  const runtimePath = path.join(RUNTIME_DIR, entry.file);
  if (!fs.existsSync(candidatePath) || !fs.existsSync(runtimePath)) {
    failures.push(`${entry.file}: missing candidate or runtime copy`);
    continue;
  }
  const wav = fs.readFileSync(candidatePath);
  const runtime = fs.readFileSync(runtimePath);
  if (!wav.equals(runtime)) failures.push(`${entry.file}: runtime copy differs from master`);
  const dataSize = wav.readUInt32LE(40);
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') failures.push(`${entry.file}: invalid WAV`);
  if (wav.readUInt16LE(20) !== 1 || wav.readUInt16LE(22) !== 1 || wav.readUInt32LE(24) !== 48_000 || wav.readUInt16LE(34) !== 16) failures.push(`${entry.file}: expected mono PCM 48kHz/16-bit`);
  if (dataSize !== wav.length - 44) failures.push(`${entry.file}: invalid data size`);

  const count = dataSize / 2;
  let peak = 0;
  let sum = 0;
  let sumSquares = 0;
  let onset = -1;
  let tailPeak = 0;
  for (let index = 0; index < count; index += 1) {
    const sample = wav.readInt16LE(44 + index * 2) / 32768;
    peak = Math.max(peak, Math.abs(sample));
    sum += sample;
    sumSquares += sample * sample;
    if (onset < 0 && Math.abs(sample) >= 0.01) onset = index;
    if (index >= count - 144) tailPeak = Math.max(tailPeak, Math.abs(sample));
  }
  const durationMs = count / 48;
  const peakDbfs = 20 * Math.log10(Math.max(peak, 1e-9));
  const rmsDbfs = 20 * Math.log10(Math.max(Math.sqrt(sumSquares / count), 1e-9));
  const dc = Math.abs(sum / count);
  if (Math.abs(durationMs - entry.durationMs) > 0.05) failures.push(`${entry.file}: duration mismatch`);
  if (Math.abs(peakDbfs - entry.peakDbfs) > 0.12) failures.push(`${entry.file}: peak ${peakDbfs.toFixed(2)}dBFS`);
  if (rmsDbfs < -32 || rmsDbfs > -12) failures.push(`${entry.file}: RMS ${rmsDbfs.toFixed(2)}dBFS`);
  if (onset < 0 || onset / 48 > 2.5) failures.push(`${entry.file}: delayed onset`);
  if (dc > 0.0015) failures.push(`${entry.file}: DC ${dc.toFixed(5)}`);
  if (tailPeak > 0.015) failures.push(`${entry.file}: tail ${tailPeak.toFixed(4)}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('PASS: 38 gameplay-v5 wooden WAVs, exact runtime copies, mono PCM 48kHz/16-bit, bounded duration/onset/peak/RMS/DC/tail.');
}
