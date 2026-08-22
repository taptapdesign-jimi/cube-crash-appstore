import {
  evaluateBoardFrameBudget,
  IOS_SUSTAINED_LOAD_REDUCTION_AFTER_MS,
  shouldUseSustainedLoadReduction,
} from '../board-frame-budget';

describe('board frame budget', () => {
  test('keeps full effects during stable 60fps gameplay', () => {
    expect(evaluateBoardFrameBudget(Array(90).fill(16.7)).reducedFx).toBe(false);
  });

  test('reduces secondary effects when hot-device frames accumulate', () => {
    const result = evaluateBoardFrameBudget([...Array(70).fill(18), ...Array(20).fill(35)]);
    expect(result.reducedFx).toBe(true);
    expect(result.framesOver28Ms).toBe(20);
  });

  test('allows recovery when an already reduced board becomes stable', () => {
    expect(evaluateBoardFrameBudget(Array(90).fill(16.7), true).reducedFx).toBe(false);
  });

  test('reduces effects after sustained iPhone gameplay even while frame pacing is stable', () => {
    const result = evaluateBoardFrameBudget(Array(90).fill(16.7), false, true);
    expect(result.reducedFx).toBe(true);
    expect(result.sustainedLoadReduction).toBe(true);
  });

  test('activates sustained reduction only on iOS after the thermal threshold', () => {
    expect(shouldUseSustainedLoadReduction(IOS_SUSTAINED_LOAD_REDUCTION_AFTER_MS - 1, true)).toBe(false);
    expect(shouldUseSustainedLoadReduction(IOS_SUSTAINED_LOAD_REDUCTION_AFTER_MS, true)).toBe(true);
    expect(shouldUseSustainedLoadReduction(IOS_SUSTAINED_LOAD_REDUCTION_AFTER_MS * 2, false)).toBe(false);
  });
});
