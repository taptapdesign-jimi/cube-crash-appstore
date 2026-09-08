#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const SOURCE_DIR = path.join(PROJECT_ROOT, 'assets/sound/gameplay-v4');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'assets/sound/navigation-v1');
const FILES = ['hud-sheet-close-01.wav', 'hud-sheet-close-02.wav'];

function findChunk(wav, id) {
  let offset = 12;
  while (offset + 8 <= wav.length) {
    const chunkId = wav.toString('ascii', offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    if (chunkId === id) return { offset: offset + 8, size };
    offset += 8 + size + (size % 2);
  }
  throw new Error(`Missing ${id} WAV chunk`);
}

function reversePcmFrames(wav) {
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Expected a RIFF/WAVE file');
  }
  const format = findChunk(wav, 'fmt ');
  const audioFormat = wav.readUInt16LE(format.offset);
  const channels = wav.readUInt16LE(format.offset + 2);
  const bitsPerSample = wav.readUInt16LE(format.offset + 14);
  if (audioFormat !== 1 || bitsPerSample !== 16) {
    throw new Error(`Expected PCM16 WAV, received format=${audioFormat} bits=${bitsPerSample}`);
  }

  const data = findChunk(wav, 'data');
  const frameBytes = channels * 2;
  if (data.size % frameBytes !== 0) throw new Error('PCM data is not frame-aligned');

  const reversed = Buffer.from(wav);
  const frameCount = data.size / frameBytes;
  for (let destination = 0; destination < frameCount; destination += 1) {
    const source = frameCount - destination - 1;
    wav.copy(
      reversed,
      data.offset + destination * frameBytes,
      data.offset + source * frameBytes,
      data.offset + (source + 1) * frameBytes,
    );
  }
  return reversed;
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const manifest = {
  family: 'modal-exit-reverse',
  version: 1,
  description: 'Sample-accurate reverse variants of the accepted HUD sheet Close cues.',
  files: [],
};

FILES.forEach((sourceName, index) => {
  const outputName = `modal-exit-reverse-${String(index + 1).padStart(2, '0')}.wav`;
  const source = fs.readFileSync(path.join(SOURCE_DIR, sourceName));
  fs.writeFileSync(path.join(OUTPUT_DIR, outputName), reversePcmFrames(source));
  manifest.files.push({ output: outputName, source: `../gameplay-v4/${sourceName}` });
});

fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${FILES.length} reversed modal Exit sounds in ${OUTPUT_DIR}`);
