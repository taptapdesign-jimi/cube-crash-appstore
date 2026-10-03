import {
  getGameplayDieRenderParityFingerprint,
  inspectGameplayDieRenderParity,
} from '../gameplay-die-render-parity';

function makeDie(overrides: Record<string, any> = {}) {
  const board = overrides.board ?? {};
  const tile: any = {
    uid: 41,
    gridX: 2,
    gridY: 3,
    value: 5,
    locked: false,
    destroyed: false,
    visible: true,
    renderable: true,
    alpha: 1,
    parent: board,
    eventMode: 'static',
    interactive: true,
    hitArea: { x: -64, y: -64, width: 128, height: 128 },
    ...overrides,
  };
  const host: any = { parent: tile };
  tile.base = overrides.base ?? {
    parent: host,
    destroyed: false,
    visible: true,
    renderable: true,
    alpha: 1,
    width: 128,
    height: 128,
    texture: { healthy: true },
    _ccTextureAssetPath: './assets/numbers.png',
    _ccVisualAssetRendererGeneration: 7,
  };
  return { board, tile };
}

const inspect = (dice: any[], board: any, overrides: Record<string, any> = {}) => (
  inspectGameplayDieRenderParity({
    boardRevision: 12,
    rendererGeneration: 7,
    board,
    logicalDice: dice,
    getExpectedAssetPath: () => './assets/numbers.png',
    isTextureUsable: (texture) => texture?.healthy === true,
    ...overrides,
  })
);

test('indexes one healthy logical die with render, generation and hit-test parity', () => {
  const { board, tile } = makeDie();
  const snapshot = inspect([tile], board);

  expect(snapshot.healthy).toBe(true);
  expect(snapshot.issues).toEqual([]);
  expect(snapshot.records).toEqual([expect.objectContaining({
    dieId: '41',
    boardRevision: 12,
    rendererGeneration: 7,
    attached: true,
    presented: true,
    textureHealthy: true,
    hitTestEligible: true,
  })]);
});

test.each([
  ['detached-die', (tile: any) => { tile.parent = {}; }],
  ['hidden-die', (tile: any) => { tile.visible = false; }],
  ['missing-visual-carrier', (tile: any) => { tile.base = null; }],
  ['detached-visual-carrier', (tile: any) => { tile.base.parent = {}; }],
  ['unusable-visual-texture', (tile: any) => { tile.base.texture.healthy = false; }],
  ['unexpected-asset', (tile: any) => { tile.base._ccTextureAssetPath = './assets/tile.png'; }],
  ['stale-renderer-generation', (tile: any) => { tile.base._ccVisualAssetRendererGeneration = 6; }],
  ['invalid-visual-bounds', (tile: any) => { tile.base.width = 0; }],
  ['disabled-hit-target', (tile: any) => { tile.eventMode = 'none'; }],
  ['missing-hit-area', (tile: any) => { tile.hitArea = null; }],
] as const)('reports %s without mutating the logical die', (reason, mutate) => {
  const { board, tile } = makeDie();
  mutate(tile);
  const beforeValue = tile.value;

  const snapshot = inspect([tile], board);

  expect(snapshot.healthy).toBe(false);
  expect(snapshot.issues.map((issue) => issue.reason)).toContain(reason);
  expect(tile.value).toBe(beforeValue);
});

test('every logical die receives a stable unique identity record', () => {
  const first = makeDie();
  const second = makeDie({ board: first.board, gridX: 4, gridY: 1 });
  second.tile.uid = first.tile.uid;

  const snapshot = inspect([first.tile, second.tile], first.board);

  expect(snapshot.issues).toEqual(expect.arrayContaining([
    expect.objectContaining({ dieId: '41', reason: 'duplicate-die-id' }),
  ]));
  expect(snapshot.records).toHaveLength(2);
});

test('direct-art Special can nominate its actual visible carrier without weakening regular dice', () => {
  const { board, tile } = makeDie({ special: 'wild', _ccSpecialDiceVariant: 'kanta' });
  tile.base.renderable = false;
  const directArt = {
    parent: tile,
    destroyed: false,
    visible: true,
    renderable: true,
    alpha: 1,
    width: 96,
    height: 128,
    texture: { healthy: true },
    _ccTextureAssetPath: './assets/shop/kanta/04.png',
    _ccVisualAssetRendererGeneration: 7,
  };

  const snapshot = inspect([tile], board, {
    getExpectedAssetPath: () => './assets/shop/kanta/04.png',
    getVisualCarrier: () => directArt,
  });

  expect(snapshot.healthy).toBe(true);
  expect(snapshot.records[0]).toMatchObject({ logicalKind: 'kanta', presented: true });
});

test('fingerprint changes when generation, presentation or hit-test truth changes', () => {
  const { board, tile } = makeDie();
  const first = inspect([tile], board);
  tile.eventMode = 'none';
  const second = inspect([tile], board);

  expect(getGameplayDieRenderParityFingerprint(first))
    .not.toBe(getGameplayDieRenderParityFingerprint(second));
});
