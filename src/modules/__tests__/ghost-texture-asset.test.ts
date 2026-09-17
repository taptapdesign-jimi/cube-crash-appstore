import { getGhostTextureAsset } from '../../utils/ghost-texture-asset';
import { getBoardGameWarmupAssets } from '../../utils/board-asset-warmup';

test.each([[1, ''], [1.49, ''], [1.5, '@2x'], [2, '@2x'], [2.5, '@3x'], [3, '@3x']])('preserves board density %s', (dpr, suffix) => {
  const asset = `./assets/ghost-placeholder${suffix}.png`;
  expect(getGhostTextureAsset(Number(dpr))).toBe(asset);
  expect(getBoardGameWarmupAssets('arcade', 1, Number(dpr)).filter(path => path.includes('ghost-placeholder'))).toEqual([asset]);
});
