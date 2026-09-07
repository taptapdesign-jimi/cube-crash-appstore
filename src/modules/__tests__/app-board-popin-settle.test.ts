/** @jest-environment jsdom */

import { settleBoardPopInTileTransform } from '../board-popin-transform';

describe('board pop-in transform ownership', () => {
  test('an interrupted composite special always releases at canonical outer geometry', () => {
    const scale = {
      x: 0.38,
      y: 0.57,
      set(x: number, y: number) {
        this.x = x;
        this.y = y;
      },
    };
    const tile: any = {
      destroyed: false,
      visible: true,
      renderable: true,
      alpha: 0.4,
      value: 6,
      locked: false,
      scale,
      rotG: { destroyed: false, alpha: 0.5 },
      base: { destroyed: false, alpha: 0.5 },
      overlay: { destroyed: false, alpha: 0.5, visible: true },
      num: { destroyed: false, alpha: 0.5 },
      pips: { destroyed: false, alpha: 0.5 },
      _ccSpecialDiceVariant: 'kanta',
    };

    settleBoardPopInTileTransform(tile);

    expect(scale).toMatchObject({ x: 1, y: 1 });
    expect(tile).toMatchObject({ visible: true, renderable: true, alpha: 1 });
    expect(tile.rotG.alpha).toBe(1);
    expect(tile.base.alpha).toBe(1);
    expect(tile.overlay).toMatchObject({ alpha: 1, visible: false });
  });
});
