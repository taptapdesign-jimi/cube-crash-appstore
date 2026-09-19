import {
  beginMergePerformanceTrace,
  captureMergePerformanceMarker,
  finishMergePerformanceTrace,
  getMergePerformanceWindowMs,
  markMergePerformance,
  resetMergePerformanceForTests,
  summarizeMergeFrames,
} from '../../utils/merge-performance';

jest.mock('../../utils/runtime-diagnostics-policy', () => ({
  areContinuousRuntimeDiagnosticsEnabled: () => (window as any).__ccContinuousRuntimeDiagnostics === true,
  areDetailedRuntimeDiagnosticsEnabled: () => (window as any).__ccDetailedRuntimeDiagnostics === true,
}));

afterEach(() => resetMergePerformanceForTests());

test('merge frame summary reports slow-frame thresholds', () => {
  expect(summarizeMergeFrames([16, 18, 21, 29, 36])).toEqual({
    sampleCount: 5,
    averageFrameMs: 24,
    worstFrameMs: 36,
    framesOver20Ms: 3,
    framesOver28Ms: 2,
    framesOver34Ms: 1,
    framesOver50Ms: 0,
  });
});

test('keeps the frame trace alive through the complete Fish finale', () => {
  expect(getMergePerformanceWindowMs({
    kind: 'wild-merge',
    sourceValue: 0,
    targetValue: 6,
    sourceVariantId: 'fish',
  })).toBe(4000);
  expect(getMergePerformanceWindowMs({
    kind: 'regular-stack',
    sourceValue: 2,
    targetValue: 3,
  })).toBe(700);
  expect(getMergePerformanceWindowMs({
    kind: 'wild-merge',
    sourceValue: 0,
    targetValue: 3,
    sourceVariantId: 'bee',
  })).toBe(2200);
});

test('marking a merge with no active trace is safe', () => {
  expect(() => markMergePerformance('contact')).not.toThrow();
});

describe('diagnostic ownership and long stalls', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (window as any).__ccDetailedRuntimeDiagnostics = true;
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => {
    resetMergePerformanceForTests();
    delete (window as any).__ccDetailedRuntimeDiagnostics;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('reports a 354ms gap without silently clamping it to 250ms', () => {
    let callback: FrameRequestCallback | undefined;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((next) => { callback = next; return 1; });
    jest.spyOn(performance, 'now').mockReturnValue(0);
    beginMergePerformanceTrace({ kind: 'wild-merge', sourceValue: 6, targetValue: 4 });
    callback?.(354);
    const summary = finishMergePerformanceTrace();
    expect(summary?.worstFrameMs).toBe(354);
    expect(summary?.framesOver50Ms).toBe(1);
  });

  test('a retired merge continuation cannot add a phase to the following merge', () => {
    beginMergePerformanceTrace({ kind: 'wild-merge', sourceValue: 6, targetValue: 4 });
    const old = captureMergePerformanceMarker();
    old('absorb-complete');
    expect(finishMergePerformanceTrace()?.milestones.map((x) => x.name)).toContain('absorb-complete');
    beginMergePerformanceTrace({ kind: 'regular-stack', sourceValue: 1, targetValue: 2 });
    old('source-removal-end');
    expect(finishMergePerformanceTrace()?.milestones.map((x) => x.name)).not.toContain('source-removal-end');
  });

  test('compact thermal capture does not start a per-merge RAF trace', () => {
    delete (window as any).__ccDetailedRuntimeDiagnostics;
    (window as any).__ccPerformanceDiagnostics = true;
    const frameRequest = jest.spyOn(window, 'requestAnimationFrame');

    expect(beginMergePerformanceTrace({ kind: 'regular-stack', sourceValue: 1, targetValue: 2 })).toBe(0);
    expect(frameRequest).not.toHaveBeenCalled();
    delete (window as any).__ccPerformanceDiagnostics;
  });
});
