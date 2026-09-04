import {
  getSpecialDiceFinaleFlagsForMerge,
  getSpecialDiceFinaleFxForMerge,
  getSpecialDiceFinaleFxForTile,
  getCompatibleSpecialDiceVariant,
  getSpecialDiceGameplayFxForMerge,
  getSpecialDiceGameplayFxForTile,
  getSpecialDiceGameplayReleaseAtSpawnRatio,
  getSpecialDiceInputReleaseAtRatio,
  getSpecialDiceInputReleaseAtRatioForFx,
  getSpecialDiceInputReleaseMode,
  getSpecialDiceInputReleaseModeForFx,
  getSpecialDiceIdleBubbleColors,
  getSpecialDiceJuiceDropProfile,
  getSpecialDiceShardColors,
  getSpecialDiceSplashOptions,
  getSpecialDiceTrailColors,
  getSpecialDiceVariant,
  getSpecialDiceVariantForTile,
  isSpecialDiceDirectWildLikeTile,
  isSpecialDiceGameplayResolvingLikeTile,
  isSpecialDiceJuiceLikeTile,
  isSpecialDiceMagnetLikeTile,
  isSpecialDiceStarLikeTile,
  isSpecialDiceTntLikeTile,
  pickSpecialDiceVariantForWildSpawn,
  applySpecialDiceVariantToTile,
  clearSpecialDiceIdentity,
  isSpecialDiceResolutionOwned,
  markSpecialDiceResolutionOwned,
  releaseSpecialDiceResolution,
} from '../special-dice-registry';
const makeTile = (overrides: Partial<any> = {}) => ({
  special: null,
  _ccSpecialDiceVariant: null,
  specialDiceVariant: null,
  ...overrides,
});

test('consumed Honey cannot retain or resurrect special identity', () => {
  const honey: any = makeTile({
    special: 'wild-magnet',
    isWild: true,
    isWildFace: true,
    _ccWildSpecial: 'wild-magnet',
  });
  applySpecialDiceVariantToTile(honey, getSpecialDiceVariant('honey'));
  markSpecialDiceResolutionOwned(honey);

  expect(isSpecialDiceResolutionOwned(honey)).toBe(true);
  clearSpecialDiceIdentity(honey);

  expect(honey).toMatchObject({ special: null, isWild: false, isWildFace: false });
  expect(honey._ccWildSpecial).toBeUndefined();
  expect(honey._ccSpecialDiceVariant).toBeUndefined();
  expect(honey.specialDiceVariant).toBeUndefined();
  expect(honey._ccSpecialDiceArchetype).toBeUndefined();
  expect(getSpecialDiceVariantForTile(honey)).toBeNull();

  releaseSpecialDiceResolution(honey);
  expect(isSpecialDiceResolutionOwned(honey)).toBe(false);
});

test('variant archetype drives final merge FX for future special dice', () => {
  const cubero = makeTile({ special: 'wild' });
  applySpecialDiceVariantToTile(cubero, getSpecialDiceVariant('cubero'));

  const beachBall = makeTile({ special: 'wild-tnt' });
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
  expect(getSpecialDiceGameplayFxForMerge({
    src: beachBall,
    dst: makeTile(),
    srcSpecial: beachBall.special,
    dstSpecial: null,
  })).toBe('tnt');
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
  const beachBall = makeTile({ special: 'wild-tnt' });
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

  const beachBall = makeTile({ special: 'wild-tnt' });
  applySpecialDiceVariantToTile(beachBall, getSpecialDiceVariant('beach-ball'));
  expect(isSpecialDiceMagnetLikeTile(beachBall)).toBe(false);
  expect(getSpecialDiceGameplayFxForTile(beachBall)).toBe('tnt');
  expect(getSpecialDiceFinaleFxForTile(beachBall)).toBe('juice');
});

test('archetype helpers classify star, juice, tnt, and direct wild behavior', () => {
  const cubero = makeTile({ special: 'wild' });
  applySpecialDiceVariantToTile(cubero, getSpecialDiceVariant('cubero'));
  const beachBall = makeTile({ special: 'wild-tnt' });
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
  expect(getSpecialDiceGameplayReleaseAtSpawnRatio(beachBall)).toBe(0);
  expect(getSpecialDiceGameplayReleaseAtSpawnRatio(cubero)).toBeUndefined();
  expect(getSpecialDiceInputReleaseMode(beachBall)).toBe('after-gameplay-resolve');
  expect(getSpecialDiceJuiceDropProfile(beachBall)).toBe('beach-ball');
  expect(getSpecialDiceInputReleaseAtRatioForFx('magnet')).toBe(0.25);
  expect(getSpecialDiceInputReleaseAtRatioForFx('tnt')).toBe(0.7);
  expect(getSpecialDiceInputReleaseModeForFx('magnet')).toBe('after-gameplay-resolve');
  expect(getSpecialDiceInputReleaseModeForFx('tnt')).toBe('after-gameplay-resolve');
  expect(getSpecialDiceInputReleaseModeForFx('juice')).toBe('timeline-ratio');

  expect(getSpecialDiceSplashOptions(cubero)).toMatchObject({
    inputReleaseAtRatio: 0.25,
  });
});

test.each(['wild-juice', 'wild-magnet'])('legacy %s Beach Ball save remains loadable and canonicalizes to TNT', (legacyCoreType) => {
  const legacyVariant = getCompatibleSpecialDiceVariant('beach-ball', legacyCoreType);
  expect(legacyVariant?.id).toBe('beach-ball');
  expect(legacyVariant?.archetype).toBe('wild-tnt');
});

test('gameplay-resolving helper follows input release policy for current and future specials', () => {
  expect(isSpecialDiceGameplayResolvingLikeTile(makeTile({ special: 'wild-tnt' }))).toBe(true);
  expect(isSpecialDiceGameplayResolvingLikeTile(makeTile({ special: 'wild-magnet' }))).toBe(true);
  expect(isSpecialDiceGameplayResolvingLikeTile(makeTile({ special: 'wild' }))).toBe(false);
  expect(isSpecialDiceGameplayResolvingLikeTile(makeTile({ special: 'wild-juice' }))).toBe(false);
  expect(isSpecialDiceGameplayResolvingLikeTile(makeTile({
    special: 'wild-tnt',
    _ccSpecialDiceArchetype: 'wild-tnt',
  }))).toBe(true);
  expect(isSpecialDiceGameplayResolvingLikeTile(makeTile({
    special: 'wild-magnet',
    _ccSpecialDiceArchetype: 'wild-magnet',
  }))).toBe(true);
  const beachBall = makeTile({ special: 'wild-tnt' });
  applySpecialDiceVariantToTile(beachBall, getSpecialDiceVariant('beach-ball'));
  expect(isSpecialDiceGameplayResolvingLikeTile(beachBall)).toBe(true);
});

test('archetype preserves TNT finale when generic special field is missing', () => {
  const tnt = makeTile({
    special: null,
    isWild: true,
    _ccSpecialDiceArchetype: 'wild-tnt',
  });

  expect(getSpecialDiceFinaleFxForTile(tnt)).toBe('tnt');
  expect(isSpecialDiceTntLikeTile(tnt)).toBe(true);
});

test('Forest progression introduces Mushroom 02, Flower 03, Honey 04 and TNT 07', () => {
  expect(pickSpecialDiceVariantForWildSpawn({
    isArcade: false,
    journeyBoard: 1,
    wildSpawnCount: 0,
    worldIntroRoll: 0.99,
  })).toBeNull();

  const mushroom = pickSpecialDiceVariantForWildSpawn({
    isArcade: false,
    journeyBoard: 2,
    wildSpawnCount: 0,
    worldIntroRoll: 0.99,
  });
  expect(mushroom).toMatchObject({
    id: 'mushroom',
    archetype: 'wild-juice',
    texture: './assets/shop/mushroom/mushroom.png',
    splashText: 'SHROOMY',
    splashColors: ['#FD7D5F'],
    idleMotion: 'mushroom-pop',
    juiceDropProfile: 'mushroom',
  });
  expect(getSpecialDiceTrailColors(mushroom)).toEqual([0xFFE1C8, 0xFFEDD9, 0xFF9A80, 0xFF7D61]);
  expect(getSpecialDiceShardColors(mushroom)).toEqual([0xE7B392, 0xFF7B60]);
  expect(mushroom?.explosionSpriteSources).toEqual([
    './assets/shop/mushroom/mushroom@2x.png',
    './assets/shop/mushroom/mushroom1.png',
    './assets/shop/mushroom/mushroom2.png',
    './assets/shop/mushroom/mushroom3.png',
    './assets/shop/mushroom/mushroom4.png',
    './assets/shop/mushroom/mushroom5.png',
  ]);

  const flower = pickSpecialDiceVariantForWildSpawn({
    isArcade: false,
    journeyBoard: 3,
    wildSpawnCount: 0,
    worldIntroRoll: 0.99,
  });

  expect(flower).toMatchObject({
    id: 'flower',
    archetype: 'wild-tnt',
    texture: './assets/shop/bush/flower.png',
    splashText: 'BLOOMING!',
    splashColors: ['#FFFEFA', '#FEF8EA'],
    splashSplitIndex: 3.5,
  });
  expect(flower?.explosionSpriteSources).toHaveLength(9);
  expect(flower?.explosionSpriteSources).not.toContain('./assets/shop/bush/bush10.png');
  expect(flower?.explosionSpriteSources).not.toContain('./assets/shop/bush/bush10@2x.png');
  expect(getSpecialDiceTrailColors(flower)).toEqual([0xFFE4D4, 0xFFBBAD, 0xF9999F, 0xFFD257]);
  expect(getSpecialDiceShardColors(flower)).toEqual([0xFFCDC7, 0xFC8C75]);
  const honey = pickSpecialDiceVariantForWildSpawn({
    isArcade: false,
    journeyBoard: 4,
    wildSpawnCount: 0,
    worldIntroRoll: 0.99,
  });
  expect(honey).toMatchObject({
    id: 'honey',
    archetype: 'wild-magnet',
    texture: './assets/shop/honey/honey.png',
    splashText: 'BUZZING!',
    splashColors: ['#FFC14F', '#D0784D'],
    splashSplitIndex: 4,
  });
  expect(getSpecialDiceIdleBubbleColors(honey)).toEqual([0xF7D58A, 0xF2BB4F]);
  expect(getSpecialDiceTrailColors(honey)).toEqual([0xFBD099, 0xFEE4B8, 0xFDCD55, 0xF9AF3A]);
  expect(getSpecialDiceShardColors(honey)).toEqual([0xF1BA79, 0xFDCF58]);
  expect(honey?.burstParticleSources).toHaveLength(7);

  // TNT is the core texture, not a collectible skin, so its variant is null.
  expect(pickSpecialDiceVariantForWildSpawn({
    isArcade: false,
    journeyBoard: 7,
    wildSpawnCount: 0,
    worldIntroRoll: 0,
  })).toBeNull();
});

test('later Forest Stages keep only earned Forest skins and never generic visual variants', () => {
  expect(pickSpecialDiceVariantForWildSpawn({
    isArcade: false,
    journeyBoard: 2,
    wildSpawnCount: 1,
    worldIntroRoll: 0.75,
  })).toMatchObject({ id: 'mushroom' });
  expect(pickSpecialDiceVariantForWildSpawn({
    isArcade: false,
    journeyBoard: 3,
    wildSpawnCount: 1,
    worldIntroRoll: 0.9,
  })).toMatchObject({ id: 'flower' });
  expect(pickSpecialDiceVariantForWildSpawn({
    isArcade: false,
    journeyBoard: 6,
    wildSpawnCount: 1,
    worldIntroRoll: 0.9,
  })).toMatchObject({ id: 'honey' });
  expect(pickSpecialDiceVariantForWildSpawn({
    isArcade: false,
    journeyBoard: 10,
    wildSpawnCount: 1,
    worldIntroRoll: 0.5,
  })).toMatchObject({ id: 'flower' });
});

test('later Beach stages map one shared random slot to Star, Juice, Beach Ball, or Bottle', () => {
  for (let journeyBoard = 12; journeyBoard <= 20; journeyBoard += 1) {
    const variants = [0, 1, 2, 3].map((beachWildSlot) => pickSpecialDiceVariantForWildSpawn({
      isArcade: false,
      journeyBoard,
      wildSpawnCount: 999,
      beachWildSlot,
    })?.id ?? null);
    expect(variants).toEqual([null, null, 'beach-ball', 'bottle']);
  }

  for (const beachWildSlot of [0, 1, 2, 3]) {
    expect(pickSpecialDiceVariantForWildSpawn({
      isArcade: false,
      journeyBoard: 11,
      wildSpawnCount: 99,
      beachWildSlot,
    })).toBeNull();
  }

  for (const journeyBoard of [1, 2, 10, 21, 30]) {
    expect(pickSpecialDiceVariantForWildSpawn({
      isArcade: false,
      journeyBoard,
      wildSpawnCount: 0,
    })?.id).not.toBe('bottle');
    expect(pickSpecialDiceVariantForWildSpawn({
      isArcade: false,
      journeyBoard,
      wildSpawnCount: 3,
    })?.id).not.toBe('bottle');
  }
});
