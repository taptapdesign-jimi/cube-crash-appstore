import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SOURCE = path.resolve('assets/sound/soundtrack/SIx theme.wav');
const OUTPUT_DIR = path.resolve('assets/sound/soundtrack/theme-loop-v1');
const OUTPUT = path.join(OUTPUT_DIR, 'SIx-theme-seamless-loop.wav');
const INTRO_OUTPUT = path.join(OUTPUT_DIR, 'SIx-theme-original-intro-bridge.wav');
const RUNTIME_OUTPUT = path.join(OUTPUT_DIR, 'SIx-theme-runtime-intro-loop.wav');
const SAMPLE_RATE = 48_000;
const BPM = 116.6;
const LOOP_BARS = 28;
const CROSSFADE_BARS = 1;
const BAR_FRAMES = Math.round((60 / BPM) * 4 * SAMPLE_RATE);
const OUTPUT_FRAMES = LOOP_BARS * BAR_FRAMES;
const CROSSFADE_FRAMES = CROSSFADE_BARS * BAR_FRAMES;
const SOURCE_FRAMES = OUTPUT_FRAMES + CROSSFADE_FRAMES;
const TARGET_PEAK_DB = -1.5;

function fail(message) {
  throw new Error(message);
}

function readPcm16StereoWav(filename) {
  const bytes = fs.readFileSync(filename);
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
    fail('Source is not a RIFF/WAVE file.');
  }

  let offset = 12;
  let format = null;
  let data = null;
  while (offset + 8 <= bytes.length) {
    const id = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === 'fmt ') {
      format = {
        audioFormat: bytes.readUInt16LE(start),
        channels: bytes.readUInt16LE(start + 2),
        sampleRate: bytes.readUInt32LE(start + 4),
        bitsPerSample: bytes.readUInt16LE(start + 14),
      };
    } else if (id === 'data') {
      data = bytes.subarray(start, start + size);
    }
    offset = start + size + (size % 2);
  }

  if (!format || !data) fail('Source is missing fmt or data chunks.');
  if (
    format.audioFormat !== 1 ||
    format.channels !== 2 ||
    format.sampleRate !== SAMPLE_RATE ||
    format.bitsPerSample !== 16
  ) {
    fail(`Expected 48 kHz 16-bit stereo PCM, received ${JSON.stringify(format)}.`);
  }

  const frames = data.length / 4;
  if (frames < SOURCE_FRAMES) {
    fail(`Source is too short: need ${SOURCE_FRAMES} frames, received ${frames}.`);
  }
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame += 1) {
    left[frame] = data.readInt16LE(frame * 4) / 32768;
    right[frame] = data.readInt16LE(frame * 4 + 2) / 32768;
  }
  return { bytes, data, left, right };
}

function createCircularLoop(source) {
  const bodyFrames = OUTPUT_FRAMES - CROSSFADE_FRAMES;
  const left = new Float32Array(OUTPUT_FRAMES);
  const right = new Float32Array(OUTPUT_FRAMES);
  left.set(source.left.subarray(CROSSFADE_FRAMES, CROSSFADE_FRAMES + bodyFrames));
  right.set(source.right.subarray(CROSSFADE_FRAMES, CROSSFADE_FRAMES + bodyFrames));

  for (let frame = 0; frame < CROSSFADE_FRAMES; frame += 1) {
    const progress = frame / Math.max(1, CROSSFADE_FRAMES - 1);
    const tailGain = Math.cos(progress * Math.PI * 0.5);
    const headGain = Math.sin(progress * Math.PI * 0.5);
    const tailFrame = OUTPUT_FRAMES + frame;
    const outputFrame = bodyFrames + frame;
    left[outputFrame] = source.left[tailFrame] * tailGain + source.left[frame] * headGain;
    right[outputFrame] = source.right[tailFrame] * tailGain + source.right[frame] * headGain;
  }
  return { left, right };
}

function normalizePeak(audio) {
  let peak = 0;
  for (let frame = 0; frame < audio.left.length; frame += 1) {
    peak = Math.max(peak, Math.abs(audio.left[frame]), Math.abs(audio.right[frame]));
  }
  const targetPeak = 10 ** (TARGET_PEAK_DB / 20);
  const gain = peak > targetPeak ? targetPeak / peak : 1;
  if (gain !== 1) {
    for (let frame = 0; frame < audio.left.length; frame += 1) {
      audio.left[frame] *= gain;
      audio.right[frame] *= gain;
    }
  }
  return gain;
}

function createRuntimeIntroLoop(source, loop, introGain) {
  const left = new Float32Array(BAR_FRAMES + loop.left.length);
  const right = new Float32Array(BAR_FRAMES + loop.right.length);
  for (let frame = 0; frame < BAR_FRAMES; frame += 1) {
    left[frame] = source.left[frame] * introGain;
    right[frame] = source.right[frame] * introGain;
  }
  left.set(loop.left, BAR_FRAMES);
  right.set(loop.right, BAR_FRAMES);
  return { left, right };
}

function analyze(audio) {
  let peak = 0;
  let sumSquares = 0;
  let sum = 0;
  for (let frame = 0; frame < audio.left.length; frame += 1) {
    const left = audio.left[frame];
    const right = audio.right[frame];
    peak = Math.max(peak, Math.abs(left), Math.abs(right));
    sumSquares += left * left + right * right;
    sum += left + right;
  }
  const sampleCount = audio.left.length * 2;
  const seamJump = Math.max(
    Math.abs(audio.left[0] - audio.left[audio.left.length - 1]),
    Math.abs(audio.right[0] - audio.right[audio.right.length - 1]),
  );
  return {
    peakDb: 20 * Math.log10(Math.max(peak, Number.EPSILON)),
    rmsDb: 20 * Math.log10(Math.max(Math.sqrt(sumSquares / sampleCount), Number.EPSILON)),
    dcOffset: sum / sampleCount,
    seamJump,
  };
}

function writePcm24StereoWav(filename, audio) {
  const dataSize = audio.left.length * 2 * 3;
  const bytes = Buffer.alloc(44 + dataSize);
  bytes.write('RIFF', 0, 'ascii');
  bytes.writeUInt32LE(36 + dataSize, 4);
  bytes.write('WAVE', 8, 'ascii');
  bytes.write('fmt ', 12, 'ascii');
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(SAMPLE_RATE, 24);
  bytes.writeUInt32LE(SAMPLE_RATE * 2 * 3, 28);
  bytes.writeUInt16LE(2 * 3, 32);
  bytes.writeUInt16LE(24, 34);
  bytes.write('data', 36, 'ascii');
  bytes.writeUInt32LE(dataSize, 40);

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
}

function writePcm16StereoWav(filename, pcmData) {
  const bytes = Buffer.alloc(44 + pcmData.length);
  bytes.write('RIFF', 0, 'ascii');
  bytes.writeUInt32LE(36 + pcmData.length, 4);
  bytes.write('WAVE', 8, 'ascii');
  bytes.write('fmt ', 12, 'ascii');
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(SAMPLE_RATE, 24);
  bytes.writeUInt32LE(SAMPLE_RATE * 2 * 2, 28);
  bytes.writeUInt16LE(2 * 2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36, 'ascii');
  bytes.writeUInt32LE(pcmData.length, 40);
  pcmData.copy(bytes, 44);
  fs.writeFileSync(filename, bytes);
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function main() {
  if (!fs.existsSync(SOURCE)) fail(`Missing source: ${SOURCE}`);
  const source = readPcm16StereoWav(SOURCE);
  const sourceMeasurements = analyze(source);
  const loop = createCircularLoop(source);
  const normalizationGain = normalizePeak(loop);
  const runtime = createRuntimeIntroLoop(source, loop, normalizationGain);
  const measurements = analyze(loop);
  if (measurements.peakDb > -0.1) fail(`Loop clips or has unsafe peak: ${measurements.peakDb} dBFS.`);
  if (Math.abs(measurements.dcOffset) > 0.01) fail(`Loop DC offset is too high: ${measurements.dcOffset}.`);
  if (measurements.seamJump > 0.05) fail(`Loop seam jump is too large: ${measurements.seamJump}.`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  writePcm24StereoWav(OUTPUT, loop);
  writePcm16StereoWav(INTRO_OUTPUT, source.data.subarray(0, BAR_FRAMES * 2 * 4));
  writePcm24StereoWav(RUNTIME_OUTPUT, runtime);
  const outputBytes = fs.readFileSync(OUTPUT);
  const introOutputBytes = fs.readFileSync(INTRO_OUTPUT);
  const runtimeOutputBytes = fs.readFileSync(RUNTIME_OUTPUT);
  const report = {
    version: 1,
    status: 'runtime main-theme loop',
    source: path.relative(process.cwd(), SOURCE),
    sourceSha256: sha256(source.bytes),
    output: path.relative(process.cwd(), OUTPUT),
    outputSha256: sha256(outputBytes),
    introOutput: path.relative(process.cwd(), INTRO_OUTPUT),
    introOutputSha256: sha256(introOutputBytes),
    runtimeOutput: path.relative(process.cwd(), RUNTIME_OUTPUT),
    runtimeOutputSha256: sha256(runtimeOutputBytes),
    introPhraseDurationSeconds: BAR_FRAMES / SAMPLE_RATE,
    introBridgeDurationSeconds: (BAR_FRAMES * 2) / SAMPLE_RATE,
    runtimeDurationSeconds: runtime.left.length / SAMPLE_RATE,
    runtimeLoopStartSeconds: BAR_FRAMES / SAMPLE_RATE,
    runtimeLoopEndSeconds: runtime.left.length / SAMPLE_RATE,
    introBitDepth: 16,
    sampleRate: SAMPLE_RATE,
    channels: 2,
    bitDepth: 24,
    detectedTempoBpm: BPM,
    loopBars: LOOP_BARS,
    crossfadeBars: CROSSFADE_BARS,
    durationSeconds: OUTPUT_FRAMES / SAMPLE_RATE,
    crossfadeSeconds: CROSSFADE_FRAMES / SAMPLE_RATE,
    normalizationGain,
    sourcePeakDb: sourceMeasurements.peakDb,
    sourceRmsDb: sourceMeasurements.rmsDb,
    ...measurements,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'analysis.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'README.md'), [
    '# Stack to Six main theme loop v1',
    '',
    `- Preserved source: \`${report.source}\``,
    `- Sample-accurate intro + loop master: \`${report.runtimeOutput}\` (${report.runtimeDurationSeconds}s)`,
    `- One-time original intro bridge: \`${report.introOutput}\` (${report.introBridgeDurationSeconds}s)`,
    `- Web Audio loop region: ${report.runtimeLoopStartSeconds}s -> ${report.runtimeLoopEndSeconds}s`,
    `- Structure: ${LOOP_BARS} bars at ${BPM} BPM`,
    `- Seam: ${CROSSFADE_BARS}-bar equal-power circular overlap`,
    '- Runtime intent: native continuous loop with no end/restart fade',
    '- The original source bytes remain unchanged',
    '',
  ].join('\n'));
  console.log(JSON.stringify(report, null, 2));
}

main();
