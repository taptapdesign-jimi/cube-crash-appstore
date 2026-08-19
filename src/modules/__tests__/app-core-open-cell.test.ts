import { adaptSpawnBounce, openAtCellCore } from '../app-core-open-cell';

function makeTile(c = 0, r = 0) {
  return {
    gridX: c,
    gridY: r,
    locked: true,
    destroyed: false,
    visible: true,
    alpha: 1,
    value: 0,
    special: null,
    isWild: false,
    isWildFace: false,
    stackDepth: 1,
    eventMode: 'none',
    scale: { x: 1, y: 1, set(x: number, y: number) { this.x = x; this.y = y; } },
    base: { alpha: 1 },
    rotG: { alpha: 1 },
    overlay: { alpha: 1, visible: false },
    num: { alpha: 1 },
    pips: { alpha: 1, visible: true },
    removeAllListeners: jest.fn(),
    destroy: jest.fn(function (this: any) { this.destroyed = true; }),
  } as any;
}

function makeHarness(initialHolder = makeTile()) {
  const grid = [[initialHolder]];
  const tiles = [initialHolder];
  const board = { removeChild: jest.fn() };
  const created: any[] = [];
  const makeBoard = {
    createTile: jest.fn(({ c, r }: any) => {
      const tile = makeTile(c, r);
      created.push(tile);
      grid[r][c] = tile;
      tiles.push(tile);
      return tile;
    }),
    setValue: jest.fn((tile: any, value: number) => { tile.value = value; }),
    syncTileZIndex: jest.fn(),
  };
  const spawnBounce = jest.fn((
    _tile: any,
    onComplete: (() => void) | null,
    _options?: any,
    _onInterrupt?: (() => void) | null,
  ) => onComplete?.());

  return {
    grid,
    tiles,
    board,
    created,
    makeBoard,
    spawnBounce,
    run: (options: any = {}) => openAtCellCore({
      c: 0,
      r: 0,
      options: { value: 2, ...options },
      grid,
      board,
      tiles,
      makeBoard,
      devWarn: jest.fn(),
      bindTileWithFallback: jest.fn(),
      applyWildSkinLocal: jest.fn(),
      startWildShimmer: jest.fn(),
      startWildJuiceBubbles: jest.fn(),
      startWildStars: jest.fn(),
      startTntIdleParticles: jest.fn(),
      startTntIdleShake: jest.fn(),
      spawnBounce,
      gsap: { killTweensOf: jest.fn() },
    }),
  };
}

describe('openAtCellCore lifecycle contract', () => {
  test('adapts the production spawn helper without losing completion ownership', () => {
    const rawSpawnBounce = jest.fn((_tile, _gsap, _options, done, _interrupted) => done?.());
    const gsapOwner = { timeline: jest.fn() };
    const canonicalSpawnBounce = adaptSpawnBounce(rawSpawnBounce, gsapOwner);
    const done = jest.fn();
    const tile = makeTile();
    const options = { startScale: 0.3 };

    canonicalSpawnBounce(tile, done, options);

    expect(rawSpawnBounce).toHaveBeenCalledWith(tile, gsapOwner, options, done, undefined);
    expect(done).toHaveBeenCalledTimes(1);
  });

  test('animated regular spawn resolves through the canonical spawnBounce callback signature', async () => {
    const harness = makeHarness();

    await expect(harness.run()).resolves.toBe(true);

    expect(harness.spawnBounce).toHaveBeenCalledTimes(1);
    expect(typeof harness.spawnBounce.mock.calls[0][1]).toBe('function');
    expect(harness.spawnBounce.mock.calls[0][2]).toEqual(expect.objectContaining({ startScale: 0.30 }));
    expect(harness.grid[0][0].value).toBe(2);
  });

  test('forceFreshPlaceholder retires the old holder and animates a new grid owner', async () => {
    const oldHolder = makeTile();
    const harness = makeHarness(oldHolder);

    await expect(harness.run({ forceFreshPlaceholder: true })).resolves.toBe(true);

    expect(oldHolder.destroyed).toBe(true);
    expect(harness.board.removeChild).toHaveBeenCalledWith(oldHolder);
    expect(harness.makeBoard.createTile).toHaveBeenCalledTimes(1);
    expect(harness.grid[0][0]).toBe(harness.created[0]);
    expect(harness.tiles).toEqual([harness.created[0]]);
    expect(harness.spawnBounce).toHaveBeenCalledWith(
      harness.created[0],
      expect.any(Function),
      expect.objectContaining({ keepFullOpacity: true }),
      expect.any(Function),
    );
  });

  test('rejects exactly once when lifecycle cleanup interrupts the bounce', async () => {
    const harness = makeHarness();
    let interrupt: (() => void) | null = null;
    harness.spawnBounce.mockImplementation((_tile, _complete, _options, onInterrupt) => {
      interrupt = onInterrupt || null;
    });

    const spawn = harness.run();
    const cancelled = expect(spawn).rejects.toMatchObject({ name: 'OpenCellCancelledError' });
    interrupt?.();

    await cancelled;
  });
});
