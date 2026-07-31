import { shouldDeferEndgameForActiveDrag } from '../active-drag-endgame-policy.ts';

describe('active drag endgame policy', () => {
  test('defers endgame for a live drag without applying a wall-clock timeout', () => {
    const tile = { destroyed: false };

    expect(shouldDeferEndgameForActiveDrag(tile)).toBe(true);
    expect(shouldDeferEndgameForActiveDrag(tile)).toBe(true);
  });

  test('allows endgame after drag ownership is gone or the tile is destroyed', () => {
    expect(shouldDeferEndgameForActiveDrag(null)).toBe(false);
    expect(shouldDeferEndgameForActiveDrag({ destroyed: true })).toBe(false);
  });
});
