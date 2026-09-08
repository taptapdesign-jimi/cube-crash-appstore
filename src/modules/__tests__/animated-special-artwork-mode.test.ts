import {
  acquireAnimatedSpecialArtworkMode,
  getAnimatedSpecialArtworkMode,
  getAnimatedSpecialArtworkModeStats,
  releaseAnimatedSpecialArtworkMode,
} from '../animated-special-artwork-mode';

describe('animated special artwork SVG/PNG mode', () => {
  const ownedTiles: object[] = [];

  afterEach(() => {
    ownedTiles.forEach(releaseAnimatedSpecialArtworkMode);
    expect(getAnimatedSpecialArtworkModeStats()).toEqual({
      assignments: 0,
      families: 0,
      svg: 0,
      png: 0,
    });
  });

  function tile(): object {
    const value = {};
    ownedTiles.push(value);
    return value;
  }

  test('always animates the first live tile in each SVG family', () => {
    const ball = tile();
    const juice = tile();

    expect(acquireAnimatedSpecialArtworkMode(ball, 'ball', () => 0.99)).toBe('svg');
    expect(acquireAnimatedSpecialArtworkMode(juice, 'juice', () => 0.99)).toBe('svg');
    expect(getAnimatedSpecialArtworkModeStats()).toEqual({
      assignments: 2,
      families: 2,
      svg: 2,
      png: 0,
    });
  });

  test('splits later non-Star same-family copies 50/50 between phased SVG and PNG', () => {
    const first = tile();
    const svgDuplicate = tile();
    const pngDuplicate = tile();

    expect(acquireAnimatedSpecialArtworkMode(first, 'ball', () => 0.99)).toBe('svg');
    expect(acquireAnimatedSpecialArtworkMode(svgDuplicate, 'ball', () => 0.49)).toBe('svg');
    expect(acquireAnimatedSpecialArtworkMode(pngDuplicate, 'ball', () => 0.50)).toBe('png');
    expect(getAnimatedSpecialArtworkModeStats()).toEqual({
      assignments: 3,
      families: 1,
      svg: 2,
      png: 1,
    });
  });

  test('keeps every Wild Star copy on a separately phased SVG', () => {
    const first = tile();
    const second = tile();
    const third = tile();

    expect(acquireAnimatedSpecialArtworkMode(first, 'wild-star', () => 0.99)).toBe('svg');
    expect(acquireAnimatedSpecialArtworkMode(second, 'wild-star', () => 0.99)).toBe('svg');
    expect(acquireAnimatedSpecialArtworkMode(third, 'wild-star', () => 0.99)).toBe('svg');
    expect(getAnimatedSpecialArtworkModeStats()).toEqual({
      assignments: 3,
      families: 1,
      svg: 3,
      png: 0,
    });
  });

  test('keeps one decision for the tile lifetime and releases it on cleanup', () => {
    const first = tile();
    const duplicate = tile();
    acquireAnimatedSpecialArtworkMode(first, 'flower');

    expect(acquireAnimatedSpecialArtworkMode(duplicate, 'flower', () => 0.9)).toBe('png');
    expect(acquireAnimatedSpecialArtworkMode(duplicate, 'flower', () => 0.1)).toBe('png');
    expect(getAnimatedSpecialArtworkMode(duplicate)).toBe('png');

    releaseAnimatedSpecialArtworkMode(duplicate);
    expect(getAnimatedSpecialArtworkMode(duplicate)).toBeNull();
  });

  test('makes the next arriving copy SVG when only PNG copies remain', () => {
    const first = tile();
    const pngDuplicate = tile();
    const replacement = tile();
    acquireAnimatedSpecialArtworkMode(first, 'juice');
    acquireAnimatedSpecialArtworkMode(pngDuplicate, 'juice', () => 0.9);
    releaseAnimatedSpecialArtworkMode(first);

    expect(acquireAnimatedSpecialArtworkMode(replacement, 'juice', () => 0.9)).toBe('svg');
  });
});
