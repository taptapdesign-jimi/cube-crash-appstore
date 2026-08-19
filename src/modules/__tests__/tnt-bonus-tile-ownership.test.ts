import {
  claimTntBonusTiles,
  isTntBonusTileOwned,
  releaseTntBonusTile,
  releaseTntBonusTiles,
} from '../tnt-bonus-tile-ownership';

describe('TNT bonus tile ownership', () => {
  test('reserves only exact live tiles and releases them idempotently', () => {
    const first: any = { value: 2 };
    const second: any = { value: 4 };
    const destroyed: any = { value: 1, destroyed: true };

    claimTntBonusTiles([first, second, destroyed, null]);
    expect(isTntBonusTileOwned(first)).toBe(true);
    expect(isTntBonusTileOwned(second)).toBe(true);
    expect(isTntBonusTileOwned(destroyed)).toBe(false);

    releaseTntBonusTile(first);
    releaseTntBonusTile(first);
    expect(isTntBonusTileOwned(first)).toBe(false);
    expect(isTntBonusTileOwned(second)).toBe(true);

    releaseTntBonusTiles([second, destroyed]);
    expect(isTntBonusTileOwned(second)).toBe(false);
  });
});
