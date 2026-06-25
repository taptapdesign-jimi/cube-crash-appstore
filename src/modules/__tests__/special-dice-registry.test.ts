import {
  getSpecialDiceFinaleFlagsForMerge,
  getSpecialDiceFinaleFxForMerge,
  getSpecialDiceInputReleaseAtRatio,
  getSpecialDiceInputReleaseAtRatioForFx,
  getSpecialDiceInputReleaseModeForFx,
  getSpecialDiceSplashOptions,
  getSpecialDiceVariant,
  isSpecialDiceDirectWildLikeTile,
  isSpecialDiceJuiceLikeTile,
  isSpecialDiceMagnetLikeTile,
  isSpecialDiceStarLikeTile,
  isSpecialDiceTntLikeTile,
  applySpecialDiceVariantToTile,
} from '../special-dice-registry';

const makeTile = (overrides: Partial<any> = {}) => ({
  special: null,
  _ccSpecialDiceVariant: null,
  specialDiceVariant: null,
  ...overrides,
});

test('variant archetype drives final merge FX for future special dice', () => {
  const cubero = makeTile({ special: 'wild' });
  applySpecialDiceVariantToTile(cubero, getSpecialDiceVariant('cubero'));

  const beachBall = makeTile({ special: 'wild-juice' });
  applySpecialDiceVariantToTile(beachBall, getSpecialDiceVariant('beach-ball'));

  expect(getSpecialDiceFinaleFxForMerge({
    src: cubero,
    dst: makeTile(),
    srcSpecial: cubero.special,
    dstSpecial: null,
  })).toBe('star');

  expect(getSpecialDiceFinaleFxForMerge({
    src: beachBall,
    dst: makeTile(),
    srcSpecial: beachBall.special,
    dstSpecial: null,
  })).toBe('juice');
});

test('finale FX priority remains deterministic for special-vs-special edge cases', () => {
  expect(getSpecialDiceFinaleFxForMerge({
    src: makeTile({ special: 'wild-juice' }),
    dst: makeTile({ special: 'wild-tnt' }),
    srcSpecial: 'wild-juice',
    dstSpecial: 'wild-tnt',
  })).toBe('tnt');

  expect(getSpecialDiceFinaleFxForMerge({
    src: makeTile({ special: 'wild' }),
    dst: makeTile({ special: 'wild-magnet' }),
    srcSpecial: 'wild',
    dstSpecial: 'wild-magnet',
  })).toBe('magnet');
});

test('finale flags expose archetype-driven merge behavior', () => {
  const beachBall = makeTile({ special: 'wild-juice' });
  applySpecialDiceVariantToTile(beachBall, getSpecialDiceVariant('beach-ball'));

  expect(getSpecialDiceFinaleFlagsForMerge({
    src: beachBall,
    dst: makeTile(),
    srcSpecial: beachBall.special,
    dstSpecial: null,
  })).toEqual({
    fx: 'juice',
    isWild: true,
    isStar: false,
    isJuice: true,
    isMagnet: false,
    isTnt: false,
  });

  expect(getSpecialDiceFinaleFlagsForMerge({
    src: makeTile(),
    dst: makeTile(),
  })).toEqual({
    fx: null,
    isWild: false,
    isStar: false,
    isJuice: false,
    isMagnet: false,
    isTnt: false,
  });
});

test('magnet-like helper follows core type and future variant archetype', () => {
  expect(isSpecialDiceMagnetLikeTile(makeTile({ special: 'wild-magnet' }))).toBe(true);

  const futureMagnet = makeTile({
    special: 'wild-magnet',
    _ccSpecialDiceArchetype: 'wild-magnet',
  });
  expect(isSpecialDiceMagnetLikeTile(futureMagnet)).toBe(true);

  const beachBall = makeTile({ special: 'wild-juice' });
  applySpecialDiceVariantToTile(beachBall, getSpecialDiceVariant('beach-ball'));
  expect(isSpecialDiceMagnetLikeTile(beachBall)).toBe(false);
});

test('archetype helpers classify star, juice, tnt, and direct wild behavior', () => {
  const cubero = makeTile({ special: 'wild' });
  applySpecialDiceVariantToTile(cubero, getSpecialDiceVariant('cubero'));
  const beachBall = makeTile({ special: 'wild-juice' });
  applySpecialDiceVariantToTile(beachBall, getSpecialDiceVariant('beach-ball'));
  const tnt = makeTile({ special: 'wild-tnt' });
  const magnet = makeTile({ special: 'wild-magnet', isWild: true, isWildFace: true });

  expect(isSpecialDiceStarLikeTile(cubero)).toBe(true);
  expect(isSpecialDiceJuiceLikeTile(beachBall)).toBe(true);
  expect(isSpecialDiceTntLikeTile(tnt)).toBe(true);

  expect(isSpecialDiceDirectWildLikeTile(cubero)).toBe(true);
  expect(isSpecialDiceDirectWildLikeTile(beachBall)).toBe(true);
  expect(isSpecialDiceDirectWildLikeTile(tnt)).toBe(true);
  expect(isSpecialDiceDirectWildLikeTile(magnet)).toBe(false);
});

test('special dice input release policy is archetype-driven', () => {
  const cubero = getSpecialDiceVariant('cubero');
  const beachBall = getSpecialDiceVariant('beach-ball');

  expect(getSpecialDiceInputReleaseAtRatio(cubero)).toBe(0.25);
  expect(getSpecialDiceInputReleaseAtRatio(beachBall)).toBe(0.30);
  expect(getSpecialDiceInputReleaseAtRatioForFx('magnet')).toBe(0.25);
  expect(getSpecialDiceInputReleaseAtRatioForFx('tnt')).toBe(0.7);
  expect(getSpecialDiceInputReleaseModeForFx('magnet')).toBe('after-gameplay-resolve');
  expect(getSpecialDiceInputReleaseModeForFx('tnt')).toBe('after-gameplay-resolve');
  expect(getSpecialDiceInputReleaseModeForFx('juice')).toBe('timeline-ratio');

  expect(getSpecialDiceSplashOptions(cubero)).toMatchObject({
    inputReleaseAtRatio: 0.25,
  });
});
