import { evaluateBoardFrameBudget } from '../board-frame-budget';

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
});
