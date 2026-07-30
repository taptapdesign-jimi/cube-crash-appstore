import {
  createGameplayTileCartoonVariant,
  GAMEPLAY_TILE_CARTOON_MOTION,
} from '../gameplay-tile-cartoon-motion.js';

describe('gameplay tile cartoon motion profile', () => {
  test('provides random stretch and squash variants for both gameplay modes', () => {
    for (const mode of ['stack', 'idle'] as const) {
      expect(createGameplayTileCartoonVariant(mode, 0).kind).toBe('stretch');
      expect(createGameplayTileCartoonVariant(mode, 0.99).kind).toBe('squash');
    }
  });

  test('keeps the stack response visible but bounded', () => {
    const stretch = createGameplayTileCartoonVariant('stack', 0);
    const squash = createGameplayTileCartoonVariant('stack', 1);

    expect(stretch.peak.scaleY).toBeGreaterThanOrEqual(1.09);
    expect(squash.peak.scaleX).toBeGreaterThanOrEqual(1.09);
    expect(Math.max(stretch.peak.scaleY, squash.peak.scaleX)).toBeLessThanOrEqual(1.11);
  });

  test('keeps idle gentler and exposes one central tuning surface', () => {
    const idleStretch = createGameplayTileCartoonVariant('idle', 0);
    const idleSquash = createGameplayTileCartoonVariant('idle', 1);
    const activeDuration =
      idleStretch.anticipation.durationSeconds +
      idleStretch.peak.durationSeconds +
      idleStretch.rebound.durationSeconds +
      idleStretch.settleDurationSeconds;

    expect(idleStretch.peak.scaleY).toBeGreaterThan(1.07);
    expect(idleSquash.peak.scaleX).toBeGreaterThan(1.07);
    expect(activeDuration).toBeLessThan(0.6);
    expect(GAMEPLAY_TILE_CARTOON_MOTION.stack.strength).toBe(1);
    expect(GAMEPLAY_TILE_CARTOON_MOTION.idle.strength).toBe(1);
  });
});
