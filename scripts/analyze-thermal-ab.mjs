#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function usage() {
  console.error('Usage: node scripts/analyze-thermal-ab.mjs A_CONSOLE.log B_CONSOLE.log [OUTPUT.json]');
  process.exit(2);
}

function parsePayload(line, prefix) {
  const index = line.indexOf(prefix);
  if (index < 0) return null;
  const start = line.indexOf('{', index + prefix.length);
  if (start < 0) return null;
  try { return JSON.parse(line.slice(start).replace(/\r$/, '')); } catch { return null; }
}

function summarize(filename) {
  const lines = fs.readFileSync(filename, 'utf8').split(/\n/);
  const thermal = lines.map(line => parsePayload(line, '[CC_NATIVE_THERMAL]')).filter(Boolean);
  const soak = lines.map(line => parsePayload(line, '[CC_SOAK]')).filter(row => row?.frameTiming);
  const resource = soak.filter(row => row.gameplayAudio);
  const firstUptime = thermal[0]?.systemUptimeSeconds ?? null;
  const onset = state => {
    const row = thermal.find(sample => sample.thermalState === state);
    return row && firstUptime !== null ? row.systemUptimeSeconds - firstUptime : null;
  };
  const frameSamples = soak.reduce((sum, row) => sum + row.frameTiming.samples, 0);
  const weightedIntervalMs = frameSamples
    ? soak.reduce((sum, row) => sum + row.frameTiming.averageMs * row.frameTiming.samples, 0) / frameSamples
    : null;
  const firstAudio = resource[0]?.gameplayAudio;
  const lastAudio = resource.at(-1)?.gameplayAudio;
  const specialExposureWindows = soak.filter(row => Object.keys(row.gameplay?.specials ?? {}).length > 0).length;
  const activeBoardWindows = soak.filter(row => row.gameplay?.tickerStarted === true).length;
  const terminalLeakWindows = soak.filter(row => row.gameplay?.terminalSuspended === true
    && ((row.gameplay?.specialIdle?.owners ?? 0) > 0 || row.gameplay?.tickerStarted === true)).length;
  return {
    file: path.resolve(filename),
    conditions: thermal[0] ? {
      batteryPercent: thermal[0].batteryPercent,
      batteryState: thermal[0].batteryState,
      brightnessPercent: thermal[0].brightnessPercent,
      lowPowerMode: thermal[0].lowPowerMode,
    } : null,
    durationSeconds: firstUptime === null || !thermal.length
      ? null
      : thermal.at(-1).systemUptimeSeconds - firstUptime,
    thermal: {
      first: thermal[0]?.thermalState ?? null,
      last: thermal.at(-1)?.thermalState ?? null,
      fairOnsetSeconds: onset('fair'),
      seriousOnsetSeconds: onset('serious'),
      criticalOnsetSeconds: onset('critical'),
      samples: thermal.length,
    },
    frames: {
      windows: soak.length,
      samples: frameSamples,
      weightedCallbackIntervalMs: weightedIntervalMs,
      worstCallbackIntervalMs: soak.length ? Math.max(...soak.map(row => row.frameTiming.worstMs)) : null,
      over34Ms: soak.reduce((sum, row) => sum + row.frameTiming.over34Ms, 0),
      over250Ms: soak.reduce((sum, row) => sum + row.frameTiming.over250Ms, 0),
    },
    workload: {
      activeBoardWindows,
      specialExposureWindows,
      terminalLeakWindows,
    },
    audio: firstAudio && lastAudio ? {
      sampleRate: lastAudio.sampleRate,
      decodedBytesEnd: lastAudio.decodedBytes,
      evictionsDelta: lastAudio.evictedBuffers - firstAudio.evictedBuffers,
      evictedBytesDelta: lastAudio.evictedBytes - firstAudio.evictedBytes,
      redecodesDelta: lastAudio.redecodedBuffers - firstAudio.redecodedBuffers,
      failedBuffersEnd: lastAudio.failedBuffers,
      pendingBuffersEnd: lastAudio.pendingBuffers,
      activeVoicesEnd: lastAudio.activeVoices,
    } : null,
  };
}

if (process.argv.length < 4) usage();
const arms = { A: summarize(process.argv[2]), B: summarize(process.argv[3]) };
const comparable = arms.A.conditions && arms.B.conditions
  ? Object.keys(arms.A.conditions).filter(key => arms.A.conditions[key] !== arms.B.conditions[key])
  : ['missing-conditions'];
const result = {
  verdict: comparable.length ? 'INVALID_CONDITIONS' : 'READY_FOR_CAUSAL_REVIEW',
  conditionDifferences: comparable,
  arms,
  interpretation: [
    'RAF callback intervals are not presented GPU FPS.',
    'Thermal state is categorical and lags workload.',
    'A causal audio claim also requires diagnostic proof of zero decode/start/preload work in arm B.',
    'Compare matched route, Special exposure and interaction counts before interpreting thermal onset.',
  ],
};
const output = `${JSON.stringify(result, null, 2)}\n`;
if (process.argv[4]) fs.writeFileSync(process.argv[4], output);
process.stdout.write(output);
