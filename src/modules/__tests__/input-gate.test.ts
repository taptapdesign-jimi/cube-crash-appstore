import {
  canStartTileDrag,
  clearInputGateLocks,
  setInputGateLock,
  startInputGateLockForAnimation,
} from '../input-gate';

describe('input gate', () => {
  beforeEach(() => {
    clearInputGateLocks();
    delete (window as any).__ccTntAnimationActive;
    delete (window as any).__ccTntDragBlocked;
    delete (window as any).__ccWildMagnetPullInProgress;
    delete (window as any).__ccActiveMagnetPullCleanup;
  });

  afterEach(() => {
    clearInputGateLocks();
  });

  test('wild-only animation lock blocks wild dice but allows regular dice', () => {
    setInputGateLock('sparkle-text', true, { ttlMs: 1000, scope: 'wild-only' });

    expect(canStartTileDrag({ tile: { value: 6 }, isWildTile: true })).toMatchObject({
      allowed: false,
      reasons: ['sparkle-text'],
    });
    expect(canStartTileDrag({ tile: { value: 3 }, isWildTile: false })).toMatchObject({
      allowed: true,
      reasons: [],
    });
  });

  test('all-scope locks block any drag', () => {
    setInputGateLock('tnt-boom', true, { ttlMs: 1000, scope: 'all' });

    expect(canStartTileDrag({ tile: { value: 2 }, isWildTile: false }).allowed).toBe(false);
    expect(canStartTileDrag({ tile: { value: 6 }, isWildTile: true }).allowed).toBe(false);
  });

  test('legacy tnt flag is normalized through the gate decision', () => {
    (window as any).__ccTntAnimationActive = true;
    (window as any).__ccTntDragBlocked = true;

    expect(canStartTileDrag({ tile: { value: 2 }, isWildTile: false })).toMatchObject({
      allowed: false,
      reasons: ['tnt-boom'],
    });
  });

  test('stale tnt drag flag clears when tnt animation is no longer active', () => {
    (window as any).__ccTntAnimationActive = false;
    (window as any).__ccTntDragBlocked = true;

    expect(canStartTileDrag({ tile: { value: 2 }, isWildTile: false })).toMatchObject({
      allowed: true,
      reasons: [],
    });
    expect((window as any).__ccTntDragBlocked).toBe(false);
  });

  test('released tnt input gate allows drag while visual tail is still active', () => {
    (window as any).__ccTntAnimationActive = true;
    (window as any).__ccTntDragBlocked = false;

    expect(canStartTileDrag({ tile: { value: 2 }, isWildTile: false })).toMatchObject({
      allowed: true,
      reasons: [],
    });
  });

  test('animation ratio lock releases before visual tail duration ends', () => {
    jest.useFakeTimers();
    try {
      startInputGateLockForAnimation('juice-bubbles', 1000, { releaseAtRatio: 0.30, scope: 'wild-only' });

      expect(canStartTileDrag({ tile: { special: 'wild-juice' }, isWildTile: true }).allowed).toBe(false);
      jest.advanceTimersByTime(299);
      expect(canStartTileDrag({ tile: { special: 'wild-juice' }, isWildTile: true }).allowed).toBe(false);
      jest.advanceTimersByTime(1);
      expect(canStartTileDrag({ tile: { special: 'wild-juice' }, isWildTile: true })).toMatchObject({
        allowed: true,
        reasons: [],
      });
    } finally {
      jest.useRealTimers();
    }
  });

  test('sparkle visual lock releases early enough for chaining another wild drag', () => {
    jest.useFakeTimers();
    try {
      startInputGateLockForAnimation('sparkle-text', 1000, { releaseAtRatio: 0.25, scope: 'wild-only' });

      expect(canStartTileDrag({ tile: { special: 'wild' }, isWildTile: true }).allowed).toBe(false);
      jest.advanceTimersByTime(249);
      expect(canStartTileDrag({ tile: { special: 'wild' }, isWildTile: true }).allowed).toBe(false);
      jest.advanceTimersByTime(1);
      expect(canStartTileDrag({ tile: { special: 'wild' }, isWildTile: true })).toMatchObject({
        allowed: true,
        reasons: [],
      });
    } finally {
      jest.useRealTimers();
    }
  });

  test('tile-local unsafe states block drag centrally', () => {
    expect(canStartTileDrag({ tile: { locked: true }, isWildTile: false }).reasons).toContain('locked-tile');
    expect(canStartTileDrag({ tile: { locked: true, special: 'wild-juice' }, isWildTile: true })).toMatchObject({
      allowed: true,
      reasons: [],
    });
    expect(canStartTileDrag({ tile: { _ccWildSpawnDropping: true }, isWildTile: true }).reasons).toContain('wild-spawn-dropping');
    expect(canStartTileDrag({ tile: { _ccWildSpawnHandoffLock: true }, isWildTile: true }).reasons).toContain('wild-spawn-handoff');
    expect(canStartTileDrag({ tile: { _wildMagnetAffected: true }, isWildTile: false }).reasons).toContain('magnet-affected-tile');
    expect(canStartTileDrag({
      tile: { special: 'wild-magnet', _ccSpecialDiceVariant: 'honey', _ccSpecialDiceResolving: true },
      isWildTile: true,
    }).reasons).toContain('special-dice-resolving');
  });

  test('visual-tail lock can be released independently after gameplay resolves', () => {
    setInputGateLock('magnet-pull', true, { ttlMs: 1000, scope: 'all' });
    setInputGateLock('magnetic-text', true, { ttlMs: 1000, scope: 'wild-only' });

    expect(canStartTileDrag({ tile: { value: 6 }, isWildTile: true }).reasons).toEqual([
      'magnet-pull',
      'magnetic-text',
    ]);

    setInputGateLock('magnet-pull', false);
    setInputGateLock('magnetic-text', false);

    expect(canStartTileDrag({ tile: { value: 6 }, isWildTile: true })).toMatchObject({
      allowed: true,
      reasons: [],
    });
  });

  test('a visual-tail release cannot bypass the shared special transaction lock', () => {
    jest.useFakeTimers();
    try {
      setInputGateLock('special-transaction', true, { ttlMs: 5000, scope: 'all' });
      startInputGateLockForAnimation('sparkle-text', 1000, { releaseAtRatio: 0.25, scope: 'wild-only' });

      jest.advanceTimersByTime(250);
      expect(canStartTileDrag({ tile: { special: 'wild' }, isWildTile: true })).toMatchObject({
        allowed: false,
        reasons: ['special-transaction'],
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
