import {
  beginBoardLifecycleTrace,
  completeBoardLifecycleTrace,
  markBoardLifecycle,
  resetBoardLifecycleTraceForTests,
} from '../../utils/board-lifecycle-performance';

describe('board lifecycle performance trace', () => {
  beforeEach(() => {
    resetBoardLifecycleTraceForTests();
    jest.spyOn(performance, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(140)
      .mockReturnValueOnce(190);
  });

  afterEach(() => jest.restoreAllMocks());

  test('records ordered milestone and segment durations through first input', () => {
    const trace = beginBoardLifecycleTrace('journey-transition', 11);
    markBoardLifecycle('boot-complete');
    const completed = completeBoardLifecycleTrace('first-input');

    expect(trace.boardNumber).toBe(11);
    expect(trace.frameWindows).toEqual([]);
    expect(completed?.completed).toBe(true);
    expect(completed?.totalMs).toBe(90);
    expect(completed?.milestones).toEqual([
      { name: 'begin', atMs: 0, deltaMs: 0 },
      { name: 'boot-complete', atMs: 40, deltaMs: 40 },
      { name: 'first-input', atMs: 90, deltaMs: 50 },
    ]);
  });
});
