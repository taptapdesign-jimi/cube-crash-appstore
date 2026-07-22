import {
  consumeWildDragTrailPoints,
  createWildDragTrailCadenceState,
  resetWildDragTrailCadence,
} from '../wild-drag-trail-cadence';

const options = { spacingPx: 12, maxBurstsPerFrame: 2 };

test('emits evenly by distance instead of fixed time pulses', () => {
  const state = createWildDragTrailCadenceState();
  resetWildDragTrailCadence(state, 0, 0, 0);

  expect(consumeWildDragTrailPoints(state, 6, 0, 16, options)).toEqual([]);
  expect(consumeWildDragTrailPoints(state, 12, 0, 32, options)).toEqual([
    { x: 12, y: 0, speedPxPerMs: 0.375 },
  ]);
  expect(consumeWildDragTrailPoints(state, 24, 0, 48, options)).toEqual([
    { x: 24, y: 0, speedPxPerMs: 0.75 },
  ]);
});

test('caps coalesced jumps and drops excess backlog', () => {
  const state = createWildDragTrailCadenceState();
  resetWildDragTrailCadence(state, 0, 0, 0);

  const points = consumeWildDragTrailPoints(state, 80, 0, 16, options);
  expect(points).toHaveLength(2);
  expect(points.map((point) => point.x)).toEqual([12, 24]);
  expect(state.distanceCarry).toBe(8);

  expect(consumeWildDragTrailPoints(state, 84, 0, 32, options)).toHaveLength(1);
});

test('reset removes carry and prevents stale emissions in a new drag', () => {
  const state = createWildDragTrailCadenceState();
  resetWildDragTrailCadence(state, 0, 0, 0);
  consumeWildDragTrailPoints(state, 10, 0, 16, options);

  resetWildDragTrailCadence(state, 100, 100, 100);
  expect(consumeWildDragTrailPoints(state, 101, 100, 116, options)).toEqual([]);

  resetWildDragTrailCadence(state);
  expect(consumeWildDragTrailPoints(state, 200, 200, 200, options)).toEqual([]);
});
