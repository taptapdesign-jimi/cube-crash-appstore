/**
 * Memory spike tracker - identifies exactly which step causes the largest memory increase.
 * Samples at each labeled step, tracks max positive delta, logs the culprit at the end.
 * Use performance.memory (Chrome) - not available in Safari, logs will be skipped.
 */

let lastSample: number | null = null;
let maxDelta = 0;
let maxLabel = '';

export function initMemorySpikeTracker(): void {
  lastSample = null;
  maxDelta = 0;
  maxLabel = '';
  sampleMemorySpike('0_baseline');
}

/**
 * Sample memory after a step. Computes delta from previous sample.
 * Positive delta = this step allocated. Tracks the step with biggest positive delta.
 */
export function sampleMemorySpike(label: string): void {
  const mem = (performance as any)?.memory;
  if (!mem || typeof mem.usedJSHeapSize !== 'number') return;
  const curr = mem.usedJSHeapSize;
  if (lastSample !== null) {
    const delta = curr - lastSample;
    const deltaMB = delta / 1024 / 1024;
    const currMB = curr / 1024 / 1024;
    const sign = deltaMB >= 0 ? '+' : '';
    console.log(`📊 Mem [${label}]: ${sign}${deltaMB.toFixed(2)} MB (heap: ${currMB.toFixed(0)} MB)`);
    if (delta > maxDelta) {
      maxDelta = delta;
      maxLabel = label;
    }
  }
  lastSample = curr;
}

/**
 * Log the single biggest memory spike and reset for next run.
 */
export function reportBiggestMemorySpike(): void {
  if (maxLabel && maxDelta > 0) {
    const mb = (maxDelta / 1024 / 1024).toFixed(2);
    console.log(`🔥 NAJVEĆI MEMORY SPIKE: [${maxLabel}] (+${mb} MB)`);
  } else if (lastSample === null && maxLabel === '') {
    console.log('📊 Memory spike tracker: performance.memory nije dostupan (samo Chrome)');
  }
  lastSample = null;
  maxDelta = 0;
  maxLabel = '';
}
