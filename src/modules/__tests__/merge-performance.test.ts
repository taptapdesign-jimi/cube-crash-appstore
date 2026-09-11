import {
  getMergePerformanceWindowMs,
  markMergePerformance,
  resetMergePerformanceForTests,
  summarizeMergeFrames,
} from '../../utils/merge-performance';

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
