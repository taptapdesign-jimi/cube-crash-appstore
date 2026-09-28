/** @jest-environment jsdom */

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { drawPips, drawStack, syncTileZIndex } from '../board';

describe('board presentation batching', () => {
  afterEach(() => jest.restoreAllMocks());

  test('coalesces stack and pip work for one tile into one presentation frame', () => {
    let paint: FrameRequestCallback | null = null;
    const raf = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      paint = callback;
      return 1;
    });
    const tile: any = new Container();
    tile.value = 4;
    tile.stackDepth = 2;
    tile.locked = false;
    tile.rotG = tile.addChild(new Container());
    tile.base = tile.rotG.addChild(new Sprite(Texture.WHITE));
    tile.stackG = tile.rotG.addChild(new Container());
    tile.pips = tile.rotG.addChild(new Graphics());

    drawStack(tile);
    drawPips(tile);
    drawStack(tile);
    expect(raf).toHaveBeenCalledTimes(1);
    paint?.(performance.now());
    expect(tile.stackG).not.toBeNull();
    expect(tile.pips.context).toBeDefined();
    tile.destroy({ children: true });
  });

  test('marks sortable depth dirty without synchronously sorting the full board', () => {
    const tile: any = { destroyed: false, locked: false, zIndex: 0 };
    const board = { sortDirty: false, sortChildren: jest.fn() };
    syncTileZIndex(tile, board);
    expect(tile.zIndex).toBe(20);
    expect(board.sortDirty).toBe(true);
    expect(board.sortChildren).not.toHaveBeenCalled();
  });
});
