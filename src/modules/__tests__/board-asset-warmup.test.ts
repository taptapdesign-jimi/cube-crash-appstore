import {
  getBoardGameWarmupAssets,
  getJourneyBottomDecorIndexForBoard,
} from '../../utils/board-asset-warmup';

describe('board asset warmup scope', () => {
  test('keeps the selected Journey bottom decor stable for a board', () => {
    const first = getJourneyBottomDecorIndexForBoard(11);
    const second = getJourneyBottomDecorIndexForBoard(11);

    expect(first).toBeGreaterThanOrEqual(1);
    expect(first).toBeLessThanOrEqual(12);
    expect(second).toBe(first);
  });

  test('warms only the selected Journey decor instead of every decor and deferred FX', () => {
    const decorIndex = getJourneyBottomDecorIndexForBoard(11);
    const assets = getBoardGameWarmupAssets('journey', 11);
    const bottomAssets = assets.filter((asset) => asset.includes('/bottom'));

    expect(bottomAssets).toEqual([
      `./assets/journey assets/bottom${decorIndex}.png`,
      `./assets/journey assets/bottom${decorIndex}@2x.png`,
    ]);
    expect(assets.some((asset) => asset.includes('/animation/tnt'))).toBe(false);
    expect(assets.some((asset) => asset.includes('/cubero/krpa'))).toBe(false);
    expect(assets.some((asset) => asset.includes('/ball/ball1'))).toBe(false);
  });

  test('does not add Journey decor to Arcade warmup', () => {
    const assets = getBoardGameWarmupAssets('arcade', 11);

    expect(assets.some((asset) => asset.includes('journey assets/bottom'))).toBe(false);
  });

  test('warms canonical Pixi textures and only the matching ghost resolution', () => {
    const assets = getBoardGameWarmupAssets('arcade', 1, 3);

    expect(assets).toContain('./assets/tile.png');
    expect(assets).not.toContain('./assets/tile@2x.png');
    expect(assets).not.toContain('./assets/tile@3x.png');
    expect(assets).toContain('./assets/ghost-placeholder@3x.png');
    expect(assets).not.toContain('./assets/ghost-placeholder.png');
    expect(assets).not.toContain('./assets/ghost-placeholder@2x.png');
  });
});
