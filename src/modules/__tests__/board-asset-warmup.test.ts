import fs from 'fs';
import path from 'path';
import {
  getBoardGameWarmupAssets,
  getJourneyBottomDecorAssetForBoard,
  getJourneyBottomDecorIndexForBoard,
} from '../../utils/board-asset-warmup';

describe('board asset warmup scope', () => {
  test('keeps the selected Journey bottom decor stable for a board', () => {
    const first = getJourneyBottomDecorIndexForBoard(1);
    const second = getJourneyBottomDecorIndexForBoard(1);

    expect(first).toBeGreaterThanOrEqual(1);
    expect(first).toBeLessThanOrEqual(12);
    expect(second).toBe(first);
  });

  test('maps every Beach Unit to its matching beach-hud1 through beach-hud10 asset', () => {
    for (let boardNumber = 11; boardNumber <= 20; boardNumber += 1) {
      const unit = boardNumber - 10;
      const asset = getJourneyBottomDecorAssetForBoard(boardNumber);
      expect(asset.key).toBe(`beach-hud${unit}`);
      expect(asset.oneX).toBe(`./assets/journey assets/beach/beach hud/beach-hud${unit}.png`);
      expect(fs.existsSync(path.resolve(process.cwd(), asset.oneX.replace(/^\.\//, '')))).toBe(true);
      if (unit === 9) {
        expect(asset.twoX).toBeUndefined();
      } else {
        const expectedHighRes = unit === 3 ? 'beach-hud3@3x.png' : `beach-hud${unit}@2x.png`;
        expect(asset.twoX).toBe(`./assets/journey assets/beach/beach hud/${expectedHighRes}`);
        expect(fs.existsSync(path.resolve(process.cwd(), asset.twoX!.replace(/^\.\//, '')))).toBe(true);
      }
    }
  });

  test('maps every Area 55 Unit to its matching area1 through area10 Robo HUD asset', () => {
    for (let boardNumber = 21; boardNumber <= 30; boardNumber += 1) {
      const unit = boardNumber - 20;
      const asset = getJourneyBottomDecorAssetForBoard(boardNumber);
      expect(asset).toEqual({
        key: `area55-hud${unit}`,
        oneX: `./assets/journey assets/robo/robo hud/area${unit}.png`,
        twoX: `./assets/journey assets/robo/robo hud/area${unit}@2x.png`,
      });
      expect(fs.existsSync(path.resolve(process.cwd(), asset.oneX.replace(/^\.\//, '')))).toBe(true);
      expect(fs.existsSync(path.resolve(process.cwd(), asset.twoX!.replace(/^\.\//, '')))).toBe(true);
    }
  });

  test('warms only the selected Beach HUD instead of Forest bottoms and deferred FX', () => {
    const assets = getBoardGameWarmupAssets('journey', 11);
    const decorAssets = assets.filter((asset) => asset.includes('beach-hud') || asset.includes('/bottom'));

    expect(decorAssets).toEqual([
      './assets/journey assets/beach/beach hud/beach-hud1.png',
      './assets/journey assets/beach/beach hud/beach-hud1@2x.png',
    ]);
    expect(assets.some((asset) => asset.includes('/animation/tnt'))).toBe(false);
    expect(assets.some((asset) => asset.includes('/cubero/krpa'))).toBe(false);
    expect(assets.some((asset) => asset.includes('/ball/ball1'))).toBe(false);
  });

  test('keeps the existing randomized Forest bottom resolver outside Beach', () => {
    const decorIndex = getJourneyBottomDecorIndexForBoard(1);
    expect(getJourneyBottomDecorAssetForBoard(1)).toEqual({
      key: `forest-bottom${decorIndex}`,
      oneX: `./assets/journey assets/bottom${decorIndex}.png`,
      twoX: `./assets/journey assets/bottom${decorIndex}@2x.png`,
    });
  });

  test('uses the shared World resolver for the runtime image and encoded 2x srcset', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../app-core.ts'), 'utf8');
    expect(source).toContain('getJourneyBottomDecorAssetForBoard(Number(boardKey))');
    expect(source).toContain('const oneXUrl = encodeURI(decorAsset.oneX)');
    expect(source).toContain('img.srcset = decorAsset.twoX');
    expect(source).toContain('? `${oneXUrl} 1x, ${encodeURI(decorAsset.twoX)} 2x`');
    expect(source).toContain(': `${oneXUrl} 1x`');
    expect(source).not.toContain('getJourneyGameBottomDecorUrl');
  });

  test('warms only the exact selected Beach Unit HUD resolutions', () => {
    expect(getBoardGameWarmupAssets('journey', 13).filter((asset) => asset.includes('beach-hud'))).toEqual([
      './assets/journey assets/beach/beach hud/beach-hud3.png',
      './assets/journey assets/beach/beach hud/beach-hud3@3x.png',
    ]);
    expect(getBoardGameWarmupAssets('journey', 19).filter((asset) => asset.includes('beach-hud'))).toEqual([
      './assets/journey assets/beach/beach hud/beach-hud9.png',
    ]);
    expect(getBoardGameWarmupAssets('journey', 20).filter((asset) => asset.includes('beach-hud'))).toEqual([
      './assets/journey assets/beach/beach hud/beach-hud10.png',
      './assets/journey assets/beach/beach hud/beach-hud10@2x.png',
    ]);
  });

  test('warms only the exact selected Area 55 Unit HUD resolutions', () => {
    expect(getBoardGameWarmupAssets('journey', 21).filter((asset) => asset.includes('/robo hud/'))).toEqual([
      './assets/journey assets/robo/robo hud/area1.png',
      './assets/journey assets/robo/robo hud/area1@2x.png',
    ]);
    expect(getBoardGameWarmupAssets('journey', 30).filter((asset) => asset.includes('/robo hud/'))).toEqual([
      './assets/journey assets/robo/robo hud/area10.png',
      './assets/journey assets/robo/robo hud/area10@2x.png',
    ]);
  });

  test('does not add Journey decor to Arcade warmup', () => {
    const assets = getBoardGameWarmupAssets('arcade', 11);

    expect(assets.some((asset) => asset.includes('journey assets/bottom'))).toBe(false);
  });

  test('warms canonical Pixi textures and only the matching ghost resolution', () => {
    const assets = getBoardGameWarmupAssets('arcade', 1, 3);

    expect(assets).toContain('./assets/tile.png');
    expect(assets).toContain('./assets/shadow.png');
    expect(assets).not.toContain('./assets/tile@2x.png');
    expect(assets).not.toContain('./assets/tile@3x.png');
    expect(assets).toContain('./assets/ghost-placeholder@3x.png');
    expect(assets).not.toContain('./assets/ghost-placeholder.png');
    expect(assets).not.toContain('./assets/ghost-placeholder@2x.png');
  });
});
