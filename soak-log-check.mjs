#!/usr/bin/env node
import fs from 'node:fs';

function usage() {
  console.log('Usage: node soak-log-check.mjs <log-file-path>');
  process.exit(1);
}

const inputPath = process.argv[2];
if (!inputPath) usage();

let raw = '';
try {
  raw = fs.readFileSync(inputPath, 'utf8');
} catch (err) {
  console.error(`Failed to read log file: ${inputPath}`);
  process.exit(1);
}

const lines = raw.split(/\r?\n/);

const metrics = {
  tntPeaksMb: [],
  transitionPeaksMb: [],
  biggestSpikes: [],
  heapReadingsMb: [],
  addressModeUErrors: 0,
  nullTextureErrors: 0,
  unhandledErrors: 0,
  bubbleTimeouts: 0,
  boardTransitions: 0,
};

const tntPeakRegex = /Mem \[tnt_peak_[ab]_[^\]]*]: ([+-]?\d+(?:\.\d+)?) MB/;
const transitionRegex = /Mem \[(?:3_transition_overlay_shown|4_transition_complete)\]: ([+-]?\d+(?:\.\d+)?) MB/;
const biggestSpikeRegex = /NAJVEĆI MEMORY SPIKE: \[([^\]]+)] \(\+?([+-]?\d+(?:\.\d+)?) MB\)/;
const heapRegex = /\(heap:\s*(\d+(?:\.\d+)?) MB\)/;

for (const line of lines) {
  const tntMatch = line.match(tntPeakRegex);
  if (tntMatch) metrics.tntPeaksMb.push(Number(tntMatch[1]));

  const transitionMatch = line.match(transitionRegex);
  if (transitionMatch) metrics.transitionPeaksMb.push(Number(transitionMatch[1]));

  const biggestMatch = line.match(biggestSpikeRegex);
  if (biggestMatch) {
    metrics.biggestSpikes.push({
      label: biggestMatch[1],
      mb: Number(biggestMatch[2]),
    });
  }

  const heapMatch = line.match(heapRegex);
  if (heapMatch) metrics.heapReadingsMb.push(Number(heapMatch[1]));

  if (/addressModeU/i.test(line)) metrics.addressModeUErrors += 1;
  if (/Cannot read properties of null/i.test(line) && /(texture|style)/i.test(line)) metrics.nullTextureErrors += 1;
  if (/Unhandled (Promise Rejection|Error)|uncaught/i.test(line)) metrics.unhandledErrors += 1;
  if (/Bubbles explosion wait timeout/i.test(line)) metrics.bubbleTimeouts += 1;
  if (/board-transition-screen: Memory sampling started/.test(line)) metrics.boardTransitions += 1;
}

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function max(values) {
  if (!values.length) return 0;
  return Math.max(...values);
}

const tntPeakMax = max(metrics.tntPeaksMb);
const tntPeakAvg = avg(metrics.tntPeaksMb);
const transitionPeakMax = max(metrics.transitionPeaksMb);
const heapMin = metrics.heapReadingsMb.length ? Math.min(...metrics.heapReadingsMb) : 0;
const heapMax = metrics.heapReadingsMb.length ? Math.max(...metrics.heapReadingsMb) : 0;
const heapSpread = heapMax - heapMin;

const releaseSafe =
  metrics.addressModeUErrors === 0 &&
  metrics.nullTextureErrors === 0 &&
  metrics.unhandledErrors === 0 &&
  tntPeakMax <= 6.0 &&
  transitionPeakMax <= 2.0;

console.log('=== Soak Log Check ===');
console.log(`File: ${inputPath}`);
console.log(`Board transitions: ${metrics.boardTransitions}`);
console.log(`TNT peak max: ${tntPeakMax.toFixed(2)} MB`);
console.log(`TNT peak avg: ${tntPeakAvg.toFixed(2)} MB`);
console.log(`Transition peak max: ${transitionPeakMax.toFixed(2)} MB`);
console.log(`Heap range: ${heapMin.toFixed(2)} -> ${heapMax.toFixed(2)} MB (spread ${heapSpread.toFixed(2)} MB)`);
console.log(`addressModeU errors: ${metrics.addressModeUErrors}`);
console.log(`null texture/style errors: ${metrics.nullTextureErrors}`);
console.log(`unhandled errors: ${metrics.unhandledErrors}`);
console.log(`bubble timeout count: ${metrics.bubbleTimeouts}`);
console.log(`release-safe: ${releaseSafe ? 'YES' : 'NO'}`);

if (!releaseSafe) {
  process.exitCode = 2;
}
