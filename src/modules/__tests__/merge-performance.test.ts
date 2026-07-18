import {
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
  });
});

test('marking a merge with no active trace is safe', () => {
  expect(() => markMergePerformance('contact')).not.toThrow();
});
