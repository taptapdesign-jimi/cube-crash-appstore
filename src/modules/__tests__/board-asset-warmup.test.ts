import fs from 'fs';
import path from 'path';
import {
  applyJourneyBottomDecorSource,
  warmJourneyBottomDecor,
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

  test('keeps the existing randomized Forest bottom resolver outside Beach', () => {
    const decorIndex = getJourneyBottomDecorIndexForBoard(1);
    expect(getJourneyBottomDecorAssetForBoard(1)).toEqual({
      key: `forest-bottom${decorIndex}`,
      oneX: `./assets/journey assets/bottom${decorIndex}.png`,
      twoX: `./assets/journey assets/bottom${decorIndex}@2x.png`,
    });
  });

  test('never loads DOM decor into Pixi for any Journey board', () => {
    for (let board = 1; board <= 30; board++) {
      expect(getBoardGameWarmupAssets('journey', board).some(asset => asset.includes('journey assets'))).toBe(false);
    }
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


describe('DOM decor warmup', () => {
  test('waits for the selected Journey decor to decode before declaring it warm', async () => {
    let finishDecode!: () => void;
    const image = document.createElement('img');
    Object.defineProperty(image, 'decode', {
      configurable: true,
      value: jest.fn(() => new Promise<void>((resolve) => { finishDecode = resolve; })),
    });
    const spy = jest.spyOn(window, 'Image').mockImplementation(() => image);
    try {
      let settled = false;
      const warmup = warmJourneyBottomDecor(25).then(() => { settled = true; });
      image.dispatchEvent(new Event('load'));
      await Promise.resolve();
      expect(settled).toBe(false);
      finishDecode();
      await warmup;
      expect(image.decode).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  test('releases a stalled DOM warmup so later entry can retry', async () => {
    jest.useFakeTimers();
    const images: HTMLImageElement[] = [];
    const spy = jest.spyOn(window, 'Image').mockImplementation(() => {
      const image = document.createElement('img');
      images.push(image);
      return image;
    });
    try {
      const first = warmJourneyBottomDecor(23);
      jest.advanceTimersByTime(2600);
      await first;
      expect(images[0].onload).toBeNull();
      const retry = warmJourneyBottomDecor(23);
      expect(images).toHaveLength(2);
      images[1].dispatchEvent(new Event('load'));
      await retry;
    } finally { spy.mockRestore(); jest.useRealTimers(); }
  });

  test('shares the exact runtime srcset and deduplicates concurrent selected artwork', async () => {
    const images: HTMLImageElement[] = [];
    const spy = jest.spyOn(window, 'Image').mockImplementation(() => {
      const image = document.createElement('img');
      images.push(image);
      return image;
    });
    try {
      const first = warmJourneyBottomDecor(24);
      expect(warmJourneyBottomDecor(24)).toBe(first);
      expect(images).toHaveLength(1);
      const actual = document.createElement('img');
      applyJourneyBottomDecorSource(actual, getJourneyBottomDecorAssetForBoard(24));
      expect(images[0].srcset).toBe(actual.srcset);
      expect(images[0].src).toBe(actual.src);
      images[0].dispatchEvent(new Event('load'));
      await first;
      const retry = warmJourneyBottomDecor(24);
      expect(images).toHaveLength(2);
      images[1].dispatchEvent(new Event('error'));
      await retry;
    } finally { spy.mockRestore(); }
  });
});
