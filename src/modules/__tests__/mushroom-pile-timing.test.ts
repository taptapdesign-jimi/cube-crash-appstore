import {
  MUSHROOM_PILE_DURATION_REDUCTION_SECONDS,
  MUSHROOM_PILE_DURATION_SECONDS,
  MUSHROOM_PILE_PREVIOUS_DURATION_SECONDS,
  MUSHROOM_PILE_TIME_SCALE,
} from '../mushroom-pile-timing';

describe('Mushroom pile timing', () => {
  test('shortens the complete rise-stack-exit choreography by exactly one second', () => {
    expect(MUSHROOM_PILE_PREVIOUS_DURATION_SECONDS).toBeCloseTo(2.86, 10);
    expect(MUSHROOM_PILE_DURATION_REDUCTION_SECONDS).toBe(1);
    expect(MUSHROOM_PILE_DURATION_SECONDS).toBeCloseTo(1.86, 10);
    expect(MUSHROOM_PILE_PREVIOUS_DURATION_SECONDS - MUSHROOM_PILE_DURATION_SECONDS).toBe(1);
    expect(MUSHROOM_PILE_TIME_SCALE).toBeCloseTo(1.86 / 2.86, 10);
  });
});
