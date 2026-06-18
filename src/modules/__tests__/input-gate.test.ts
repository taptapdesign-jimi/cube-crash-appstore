import {
  canStartTileDrag,
  clearInputGateLocks,
  setInputGateLock,
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

  test('tile-local unsafe states block drag centrally', () => {
    expect(canStartTileDrag({ tile: { locked: true }, isWildTile: false }).reasons).toContain('locked-tile');
    expect(canStartTileDrag({ tile: { _ccWildSpawnDropping: true }, isWildTile: true }).reasons).toContain('wild-spawn-dropping');
    expect(canStartTileDrag({ tile: { _wildMagnetAffected: true }, isWildTile: false }).reasons).toContain('magnet-affected-tile');
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
});
