import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function summarizeProbe(log) {
  const lines = log.split(/\r?\n/);
  const complete = lines.filter(line => line.startsWith('[JIMI_NATIVE_PROBE] COMPLETE '));
  if (complete.length !== 1 || lines.some(line => line.includes('[JIMI_NATIVE_PROBE] ABORT'))) {
    throw new Error('Require exactly one complete capture and no abort');
  }
  const rows = JSON.parse(complete[0].slice('[JIMI_NATIVE_PROBE] COMPLETE '.length));
  const order = ['native', 'web-waapi', 'web-raf', 'web-raf', 'web-waapi', 'native'];
  const validSamples = values => Array.isArray(values) && values.length > 0 &&
    values.every(value => Number.isFinite(value) && value >= 0);
  if (rows.length !== 24 || rows.some((row, i) => row.trial !== i || row.mode !== order[i % 6] ||
      typeof row.artwork !== 'boolean' || row.artwork !== rows[0].artwork ||
      !validSamples(row.nativeCallbackGapsMs) ||
      (row.mode !== 'native' && (row.web?.trial !== i || !validSamples(row.web.rafGapsMs))))) {
    throw new Error('Incomplete, mixed, reordered or invalid sample set');
  }
  const stats = values => {
    const sorted = [...values].sort((a, b) => a - b);
    return { samples: sorted.length, p95Ms: sorted[Math.floor((sorted.length - 1) * 0.95)],
      worstMs: sorted.at(-1), over25Ms: sorted.filter(x => x > 25).length,
      over34Ms: sorted.filter(x => x > 34).length };
  };
  return { artwork: rows[0].artwork, note: 'Callback cadence only; not presented FPS or route-reveal latency',
    modes: [...new Set(order)].map(mode => {
      const selected = rows.filter(row => row.mode === mode);
      return { mode, trials: selected.length,
        sharedNativeCallback: stats(selected.flatMap(row => row.nativeCallbackGapsMs)),
        nativeWorstByTrial: selected.map(row => Math.max(...row.nativeCallbackGapsMs)),
        ...(mode !== 'native' ? { supplementaryWebRAF: stats(selected.flatMap(row => row.web.rafGapsMs)),
          webWorstByTrial: selected.map(row => Math.max(...row.web.rafGapsMs)) } : {}) };
    }) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(summarizeProbe(readFileSync(process.argv[2], 'utf8')), null, 2));
}
