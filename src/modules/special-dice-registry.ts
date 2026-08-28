// Registry for collectible/special dice skins that reuse existing wild mechanics.
// Add future dice here by choosing an archetype and providing texture/FX assets.

export type CoreWildType = 'wild' | 'wild-juice' | 'wild-magnet' | 'wild-tnt';
export type SpecialDiceArchetype = 'wild-star' | 'wild-juice' | 'wild-magnet' | 'wild-tnt';
export type SpecialDiceFinaleFx = 'star' | 'juice' | 'magnet' | 'tnt';
export type SpecialDiceInputReleaseMode = 'timeline-ratio' | 'after-gameplay-resolve';

export type SpecialDiceFinaleFlags = {
  fx: SpecialDiceFinaleFx | null;
  isWild: boolean;
  isStar: boolean;
  isJuice: boolean;
  isMagnet: boolean;
  isTnt: boolean;
};

export type SpecialDiceVariantDefinition = {
  id: string;
  archetype: SpecialDiceArchetype;
  // Gameplay archetype and authored finale may intentionally differ. This
  // keeps an accepted skin animation while allowing it to reuse another
  // special's board mechanics.
  visualFinaleFx?: SpecialDiceFinaleFx;
  texture: string;
  splashText: string;
  splashColor: string;
  splashColors?: string[];
  splashLetterColors?: string[];
  splashLetterOpacityRange?: readonly [number, number];
  splashSplitIndex?: number;
  shardColor?: number;
  shardColors?: number[];
  trailColors?: number[];
  idleBubbleColors?: number[];
  finaleScene?: 'bottle-ocean' | 'spaceship-abduction';
  explosionSpriteSources?: string[];
  explosionScale?: number;
  explosionHorizontalScale?: number;
  explosionVerticalStretch?: number;
  lastExplosionFrameOnExitOnly?: boolean;
  hideExplosionFrameIndicesAtExitStart?: number[];
  visualWidth?: number;
  visualHeight?: number;
  visualFit?: 'height';
  hitAreaSize?: 'tile';
  idleOrbit?: boolean;
  idleMotion?: 'float' | 'beach-ball-bounce' | 'bottle-float' | 'cubero-hop' | 'mushroom-pop' | 'robo-sprite-cycle' | 'spaceship-hover';
  idleSpriteSources?: string[];
  juiceDropProfile?: 'beach-ball' | 'mushroom' | 'robo';
  finaleAccentSpriteSources?: string[];
  orbitParticleSources?: string[];
  burstParticleSources?: string[];
  burstMotion?: {
    count?: number;
    speedScale?: number;
    cuberoFlight?: boolean;
    gravityFall?: boolean;
    flagWave?: boolean;
    sizeBoostChance?: number;
    sizeBoostMax?: number;
    baseSizeScale?: number;
    staggerSpanScale?: number;
    waveTimes?: number[];
    waveStrength?: number;
    waveDurationScale?: number;
    mixBlendMode?: string;
    beeFlight?: boolean;
    depthLayered?: boolean;
  };
  arcadeTestOrder?: number;
  inputReleaseAtRatio?: number;
  gameplayReleaseAtSpawnRatio?: number;
};

const SPECIAL_DICE_INPUT_RELEASE_RATIO_BY_FX: Record<SpecialDiceFinaleFx, number> = {
  // TNT and magnet have gameplay-critical board movement/pulls, keep these conservative.
  tnt: 0.7,
  magnet: 0.25,
  // Star/juice text and particles are visual-tail once the initial impact is established.
  star: 0.25,
  juice: 0.30,
};

const SPECIAL_DICE_INPUT_RELEASE_MODE_BY_FX: Record<SpecialDiceFinaleFx, SpecialDiceInputReleaseMode> = {
  star: 'timeline-ratio',
  juice: 'timeline-ratio',
  magnet: 'after-gameplay-resolve',
  tnt: 'after-gameplay-resolve',
};

const cuberoKrpaSources = [
  './assets/shop/cubero/krpa1.png',
  './assets/shop/cubero/krpa2.png',
  './assets/shop/cubero/krpa3.png',
  './assets/shop/cubero/krpa4.png',
  './assets/shop/cubero/krpa5.png',
  './assets/shop/cubero/krpa6.png',
  './assets/shop/cubero/krpa7.png',
];


const beachBallExplosionSources = [
  './assets/shop/ball/ball1.png',
  './assets/shop/ball/ball2.png',
  './assets/shop/ball/ball3.png',
  './assets/shop/ball/ball4.png',
  './assets/shop/ball/ball5.png',
  './assets/shop/ball/ball6.png',
];

const mushroomGrowthSources = [
  // Same original Mushroom die art, using its 2x source so a 160–200px finale
  // sprite stays crisp beside the supplied 1024px growth variants.
  './assets/shop/mushroom/mushroom@2x.png',
  ...Array.from(
    { length: 5 },
    (_, index) => `./assets/shop/mushroom/mushroom${index + 1}.png`,
  ),
];

const roboCubeIdleSources = Array.from(
  { length: 4 },
  (_, index) => `./assets/shop/robo/robo-cube${index + 1}.png`,
);
const roboFinaleSources1x = Array.from(
  { length: 12 },
  (_, index) => `./assets/shop/robo/robo${index + 1}.png`,
);
const roboFinaleSources2x = Array.from(
  { length: 12 },
  (_, index) => `./assets/shop/robo/robo${index + 1}@2x.png`,
);
const roboNeonSources1x = Array.from(
  { length: 4 },
  (_, index) => `./assets/shop/robo/neon${index + 1}.png`,
);
const roboNeonSources2x = Array.from(
  { length: 4 },
  (_, index) => `./assets/shop/robo/neon${index + 1}@2x.png`,
);

const flowerExplosionSources1x = Array.from(
  { length: 9 },
  (_, index) => `./assets/shop/bush/bush${index + 1}.png`,
);
const flowerExplosionSources2x = Array.from(
  { length: 9 },
  (_, index) => `./assets/shop/bush/bush${index + 1}@2x.png`,
);
const flowerBurstSources1x = Array.from(
  { length: 6 },
  (_, index) => `./assets/shop/bush/flowr${index + 1}.png`,
);
const flowerBurstSources2x = Array.from(
  { length: 6 },
  (_, index) => `./assets/shop/bush/flowr${index + 1}@2x.png`,
);
const honeyBeeSources1x = Array.from(
  { length: 7 },
  (_, index) => `./assets/shop/honey/bee${index + 1}.png`,
);
const honeyBeeSources2x = Array.from(
  { length: 7 },
  (_, index) => `./assets/shop/honey/bee${index + 1}@2x.png`,
);
const useHighResolutionSpecialDiceFx = typeof navigator !== 'undefined'
  && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export const SPECIAL_DICE_VARIANTS: Record<string, SpecialDiceVariantDefinition> = {
  spaceship: {
    id: 'spaceship',
    archetype: 'wild-magnet',
    texture: useHighResolutionSpecialDiceFx
      ? './assets/shop/spaceship/spaceship@2x.png'
      : './assets/shop/spaceship/spaceship.png',
    splashText: 'WOOMBUU',
    splashColor: '#75C4C3',
    splashColors: ['#75C4C3', '#58D9EA'],
    splashSplitIndex: 3,
    // Match the Beach Ball Boooing letters: each glyph renders at 80-100%
    // color alpha while retaining the existing enter/exit opacity animation.
    splashLetterOpacityRange: [0.8, 1],
    shardColor: 0xF2CDA8,
    shardColors: [0xF2CDA8, 0x8AEEFE],
    trailColors: [0xF8DCBF, 0xEFBE8F, 0x7CFBFD, 0x8AEEFE],
    finaleScene: 'spaceship-abduction',
    visualWidth: 147.456,
    visualHeight: 147.456,
    hitAreaSize: 'tile',
    idleOrbit: false,
    idleMotion: 'spaceship-hover',
    inputReleaseAtRatio: 0.25,
  },
  bottle: {
    id: 'bottle',
    archetype: 'wild-magnet',
    texture: useHighResolutionSpecialDiceFx
      ? './assets/shop/bottle/glass bottle@2x.png'
      : './assets/shop/bottle/glass bottle.png',
    splashText: 'S.O.S.',
    splashColor: '#75DDDF',
    splashColors: ['#75DDDF'],
    shardColor: 0xB1DCC9,
    shardColors: [0xB1DCC9, 0xFFCE77],
    trailColors: [0xFDCA89, 0xD8E9CA, 0xC8ECD0, 0xAEE9E6],
    idleBubbleColors: [0xCCF3F1, 0xFFFFFF],
    finaleScene: 'bottle-ocean',
    hitAreaSize: 'tile',
    idleOrbit: false,
    idleMotion: 'bottle-float',
    inputReleaseAtRatio: 0.25,
  },
  honey: {
    id: 'honey',
    archetype: 'wild-magnet',
    texture: './assets/shop/honey/honey.png',
    splashText: 'BUZZING!',
    splashColor: '#FFC14F',
    splashColors: ['#FFC14F', '#D0784D'],
    splashSplitIndex: 4,
    shardColor: 0xF1BA79,
    shardColors: [0xF1BA79, 0xFDCF58],
    trailColors: [0xFBD099, 0xFEE4B8, 0xFDCD55, 0xF9AF3A],
    idleBubbleColors: [0xF7D58A, 0xF2BB4F],
    burstParticleSources: useHighResolutionSpecialDiceFx
      ? honeyBeeSources2x
      : honeyBeeSources1x,
    burstMotion: {
      count: 16,
      beeFlight: true,
      mixBlendMode: 'normal',
    },
    hitAreaSize: 'tile',
    idleOrbit: false,
    inputReleaseAtRatio: 0.25,
  },
  flower: {
    id: 'flower',
    archetype: 'wild-tnt',
    texture: './assets/shop/bush/flower.png',
    splashText: 'BLOOMING!',
    splashColor: '#FEF8EA',
    splashColors: ['#FFFEFA', '#FEF8EA'],
    splashSplitIndex: 3.5,
    shardColor: 0xFC8C75,
    shardColors: [0xFFCDC7, 0xFC8C75],
    trailColors: [0xFFE4D4, 0xFFBBAD, 0xF9999F, 0xFFD257],
    explosionSpriteSources: useHighResolutionSpecialDiceFx
      ? flowerExplosionSources2x
      : flowerExplosionSources1x,
    explosionScale: 0.9775,
    explosionHorizontalScale: 0.84,
    explosionVerticalStretch: 1,
    hideExplosionFrameIndicesAtExitStart: [0, 1],
    burstParticleSources: useHighResolutionSpecialDiceFx
      ? flowerBurstSources2x
      : flowerBurstSources1x,
    burstMotion: {
      count: 9,
      speedScale: 0.92,
      baseSizeScale: 1.428,
      staggerSpanScale: 1,
      waveTimes: [0.1, 0.905, 1.71],
      mixBlendMode: 'normal',
      depthLayered: true,
    },
    hitAreaSize: 'tile',
    idleOrbit: false,
    inputReleaseAtRatio: 0.7,
  },
  mushroom: {
    id: 'mushroom',
    archetype: 'wild-juice',
    texture: './assets/shop/mushroom/mushroom.png',
    splashText: 'SHROOMY',
    splashColor: '#FD7D5F',
    splashColors: ['#FD7D5F'],
    shardColor: 0xE7B392,
    shardColors: [0xE7B392, 0xFF7B60],
    trailColors: [0xFFE1C8, 0xFFEDD9, 0xFF9A80, 0xFF7D61],
    explosionSpriteSources: mushroomGrowthSources,
    hitAreaSize: 'tile',
    idleOrbit: false,
    idleMotion: 'mushroom-pop',
    juiceDropProfile: 'mushroom',
    inputReleaseAtRatio: 0.30,
  },
  'robo-cube': {
    id: 'robo-cube',
    archetype: 'wild-juice',
    texture: './assets/shop/robo/robo-cube1.png',
    splashText: 'BIBI - RIBI',
    splashColor: '#A68B7C',
    splashColors: ['#A68B7C'],
    shardColor: 0x91F2FF,
    shardColors: [0x91F2FF, 0xFAC388],
    trailColors: [0xFED49C, 0xE99D5F, 0xAA9482, 0x8AEEFE],
    explosionSpriteSources: useHighResolutionSpecialDiceFx
      ? roboFinaleSources2x
      : roboFinaleSources1x,
    finaleAccentSpriteSources: useHighResolutionSpecialDiceFx
      ? roboNeonSources2x
      : roboNeonSources1x,
    hitAreaSize: 'tile',
    idleOrbit: false,
    idleMotion: 'robo-sprite-cycle',
    idleSpriteSources: roboCubeIdleSources,
    juiceDropProfile: 'robo',
    inputReleaseAtRatio: 0.30,
  },
  cubero: {
    id: 'cubero',
    archetype: 'wild-star',
    texture: './assets/shop/cubero/cubero.png',
    splashText: 'Hiyaa!',
    splashColor: '#FE9130',
    shardColor: 0xFE9130,
    visualWidth: 170,
    visualHeight: 128,
    hitAreaSize: 'tile',
    idleOrbit: false,
    idleMotion: 'cubero-hop',
    orbitParticleSources: cuberoKrpaSources,
    burstParticleSources: cuberoKrpaSources,
    burstMotion: {
      count: 14,
      speedScale: 1.55,
      flagWave: true,
      sizeBoostChance: 0.55,
      sizeBoostMax: 1.4,
      waveStrength: 1.35,
      waveDurationScale: 1.05,
      mixBlendMode: 'normal',
    },
    arcadeTestOrder: 2,
    inputReleaseAtRatio: 0.25,
  },
  'beach-ball': {
    id: 'beach-ball',
    archetype: 'wild-tnt',
    visualFinaleFx: 'juice',
    texture: './assets/shop/ball/ball.png',
    splashText: 'Boooing',
    splashColor: '#E09FEF',
    splashLetterColors: ['#DD94EB', '#DD94EB', '#FDEB8C', '#FDEB8C', '#4BC9FC', '#4BC9FC', '#FD979D'],
    shardColor: 0xE09FEF,
    shardColors: [0xDD94EB, 0x4BC9FC, 0xFDEB8C, 0xFD979D],
    trailColors: [0x4BC9FC, 0xDD94EB, 0xFDA4A7, 0xFDEB8C],
    explosionSpriteSources: beachBallExplosionSources,
    hitAreaSize: 'tile',
    idleOrbit: false,
    idleMotion: 'beach-ball-bounce',
    juiceDropProfile: 'beach-ball',
    arcadeTestOrder: 1,
    inputReleaseAtRatio: 0.30,
    // Keep the whole-board separation readable for roughly the same hold as
    // Cubero's short blast before TNT gameplay begins returning the tiles.
    // Ball's 1.3s spawn phase makes 55% about 715ms instead of the rejected
    // near-immediate 104ms handoff at 8%.
    gameplayReleaseAtSpawnRatio: 0.55,
  },
};

export function getSpecialDiceVariant(id?: string | null): SpecialDiceVariantDefinition | null {
  if (!id) return null;
  return SPECIAL_DICE_VARIANTS[id] || null;
}

export function getSpecialDiceVariantForTile(tile: any): SpecialDiceVariantDefinition | null {
  return getSpecialDiceVariant(tile?._ccSpecialDiceVariant || tile?.specialDiceVariant || null);
}

/** Beach water-themed dice use a round bubble drag trail; every other die keeps its established trail. */
export function usesRoundBubbleDragTrail(tile: any): boolean {
  const variantId = getSpecialDiceVariantForTile(tile)?.id;
  if (variantId) return variantId === 'beach-ball' || variantId === 'bottle';
  return tile?.special === 'wild-juice' || tile?._ccWildSpecial === 'wild-juice';
}

export function getCoreWildTypeForSpecialDiceVariant(variant?: SpecialDiceVariantDefinition | null): CoreWildType | null {
  if (!variant) return null;
  if (variant.archetype === 'wild-star') return 'wild';
  if (variant.archetype === 'wild-juice') return 'wild-juice';
  if (variant.archetype === 'wild-magnet') return 'wild-magnet';
  if (variant.archetype === 'wild-tnt') return 'wild-tnt';
  return null;
}

export function getCompatibleSpecialDiceVariant(
  id: string | null | undefined,
  coreWildType: string | null | undefined,
): SpecialDiceVariantDefinition | null {
  const variant = getSpecialDiceVariant(id);
  if (!variant || !coreWildType) return null;
  if (getCoreWildTypeForSpecialDiceVariant(variant) === coreWildType) return variant;
  // Save compatibility for Beach Balls created under their earlier Juice and
  // Magnet gameplay archetypes. Restore canonicalizes the core special to TNT.
  if (variant.id === 'beach-ball' && (coreWildType === 'wild-juice' || coreWildType === 'wild-magnet')) {
    return variant;
  }
  return null;
}

export function getSpecialDiceFinaleFxForCoreWildType(coreWildType?: CoreWildType | string | null): SpecialDiceFinaleFx | null {
  if (coreWildType === 'wild-tnt') return 'tnt';
  if (coreWildType === 'wild-magnet') return 'magnet';
  if (coreWildType === 'wild-juice') return 'juice';
  if (coreWildType === 'wild') return 'star';
  return null;
}

export function getSpecialDiceFinaleFxForArchetype(archetype?: SpecialDiceArchetype | string | null): SpecialDiceFinaleFx | null {
  if (archetype === 'wild-tnt') return 'tnt';
  if (archetype === 'wild-magnet') return 'magnet';
  if (archetype === 'wild-juice') return 'juice';
  if (archetype === 'wild-star') return 'star';
  return null;
}

export function getSpecialDiceFinaleFxForTile(tile: any, coreWildTypeOverride?: CoreWildType | string | null): SpecialDiceFinaleFx | null {
  const variant = getSpecialDiceVariantForTile(tile);
  if (variant?.visualFinaleFx) return variant.visualFinaleFx;
  return getSpecialDiceGameplayFxForTile(tile, coreWildTypeOverride);
}

export function getSpecialDiceGameplayFxForTile(tile: any, coreWildTypeOverride?: CoreWildType | string | null): SpecialDiceFinaleFx | null {
  const variant = getSpecialDiceVariantForTile(tile);
  const gameplayFx = getSpecialDiceFinaleFxForArchetype(variant?.archetype || tile?._ccSpecialDiceArchetype);
  if (gameplayFx) return gameplayFx;
  return getSpecialDiceFinaleFxForCoreWildType(coreWildTypeOverride || tile?.special || tile?._ccWildSpecial || null);
}

export function specialDiceTileMatchesFinaleFx(
  tile: any,
  fx: SpecialDiceFinaleFx,
  coreWildTypeOverride?: CoreWildType | string | null,
): boolean {
  return getSpecialDiceFinaleFxForTile(tile, coreWildTypeOverride) === fx;
}

export function isSpecialDiceMagnetLikeTile(tile: any, coreWildTypeOverride?: CoreWildType | string | null): boolean {
  return getSpecialDiceGameplayFxForTile(tile, coreWildTypeOverride) === 'magnet';
}

export function isSpecialDiceStarLikeTile(tile: any, coreWildTypeOverride?: CoreWildType | string | null): boolean {
  return specialDiceTileMatchesFinaleFx(tile, 'star', coreWildTypeOverride);
}

export function isSpecialDiceJuiceLikeTile(tile: any, coreWildTypeOverride?: CoreWildType | string | null): boolean {
  return specialDiceTileMatchesFinaleFx(tile, 'juice', coreWildTypeOverride);
}

export function isSpecialDiceTntLikeTile(tile: any, coreWildTypeOverride?: CoreWildType | string | null): boolean {
  return specialDiceTileMatchesFinaleFx(tile, 'tnt', coreWildTypeOverride);
}

export function isSpecialDiceGameplayResolvingLikeTile(tile: any, coreWildTypeOverride?: CoreWildType | string | null): boolean {
  const fx = getSpecialDiceGameplayFxForTile(tile, coreWildTypeOverride);
  return fx !== null && getSpecialDiceInputReleaseModeForFx(fx) === 'after-gameplay-resolve';
}

export function isSpecialDiceDirectWildLikeTile(tile: any, coreWildTypeOverride?: CoreWildType | string | null): boolean {
  if (isSpecialDiceMagnetLikeTile(tile, coreWildTypeOverride)) return false;
  const fx = getSpecialDiceFinaleFxForTile(tile, coreWildTypeOverride);
  if (fx === 'star' || fx === 'juice' || fx === 'tnt') return true;
  const special = coreWildTypeOverride || tile?.special || tile?._ccWildSpecial || null;
  if (special === 'wild-magnet') return false;
  if (typeof special === 'string' && special.startsWith('wild') && special !== 'wild-magnet') return true;
  return tile?.isWild === true || tile?.isWildFace === true;
}

export function getSpecialDiceFinaleFxForMerge({
  src,
  dst,
  srcSpecial,
  dstSpecial,
}: {
  src?: any;
  dst?: any;
  srcSpecial?: CoreWildType | string | null;
  dstSpecial?: CoreWildType | string | null;
}): SpecialDiceFinaleFx | null {
  const srcFx = getSpecialDiceFinaleFxForTile(src, srcSpecial);
  const dstFx = getSpecialDiceFinaleFxForTile(dst, dstSpecial);
  const candidates = [srcFx, dstFx];

  // If a future special-vs-special edge case reaches this path, use the most
  // cinematic/mechanically constrained finale first.
  if (candidates.includes('tnt')) return 'tnt';
  if (candidates.includes('magnet')) return 'magnet';
  if (candidates.includes('juice')) return 'juice';
  if (candidates.includes('star')) return 'star';
  return null;
}

export function getSpecialDiceGameplayFxForMerge({
  src,
  dst,
  srcSpecial,
  dstSpecial,
}: {
  src?: any;
  dst?: any;
  srcSpecial?: CoreWildType | string | null;
  dstSpecial?: CoreWildType | string | null;
}): SpecialDiceFinaleFx | null {
  const srcFx = getSpecialDiceGameplayFxForTile(src, srcSpecial);
  const dstFx = getSpecialDiceGameplayFxForTile(dst, dstSpecial);
  const candidates = [srcFx, dstFx];

  if (candidates.includes('tnt')) return 'tnt';
  if (candidates.includes('magnet')) return 'magnet';
  if (candidates.includes('juice')) return 'juice';
  if (candidates.includes('star')) return 'star';
  return null;
}

export function getSpecialDiceFinaleFlagsForMerge(input: {
  src?: any;
  dst?: any;
  srcSpecial?: CoreWildType | string | null;
  dstSpecial?: CoreWildType | string | null;
}): SpecialDiceFinaleFlags {
  const fx = getSpecialDiceFinaleFxForMerge(input);
  return {
    fx,
    isWild: fx !== null,
    isStar: fx === 'star',
    isJuice: fx === 'juice',
    isMagnet: fx === 'magnet',
    isTnt: fx === 'tnt',
  };
}

export function applySpecialDiceVariantToTile(tile: any, variant?: SpecialDiceVariantDefinition | null): void {
  if (!tile || !variant) return;
  tile._ccSpecialDiceVariant = variant.id;
  tile.specialDiceVariant = variant.id;
  tile._ccSpecialDiceArchetype = variant.archetype;
}

// Gameplay-resolving specials (currently magnet/TNT archetypes) own their tile
// until their board mutation has completed. Visual-tail input release may unlock
// the rest of the board, but it must never make this consumed tile draggable or
// selectable as a drop target again.
export function markSpecialDiceResolutionOwned(tile: any): void {
  if (!tile || tile.destroyed) return;
  tile._ccSpecialDiceResolving = true;
}

export function isSpecialDiceResolutionOwned(tile: any): boolean {
  return !!tile && !tile.destroyed && tile._ccSpecialDiceResolving === true;
}

export function clearSpecialDiceIdentity(tile: any): void {
  if (!tile) return;
  delete tile._ccSpecialDiceVariant;
  delete tile.specialDiceVariant;
  delete tile._ccSpecialDiceArchetype;
  delete tile._ccWildSpecial;
  tile.special = null;
  tile.isWild = false;
  tile.isWildFace = false;
}

export function releaseSpecialDiceResolution(tile: any): void {
  if (!tile) return;
  delete tile._ccSpecialDiceResolving;
}

export function getSpecialDiceTexturePath(tile: any, fallback: string): string {
  return getSpecialDiceVariantForTile(tile)?.texture || fallback;
}

export function getSpecialDiceVisualConfig(tile: any): { visualWidth?: number; visualHeight?: number; visualFit?: 'height'; hitAreaSize?: 'tile' } | null {
  const variant = getSpecialDiceVariantForTile(tile);
  if (!variant) return null;
  return {
    visualWidth: variant.visualWidth,
    visualHeight: variant.visualHeight,
    visualFit: variant.visualFit,
    hitAreaSize: variant.hitAreaSize,
  };
}

export function getSpecialDiceSplashOptions(tileOrVariant: any): any | null {
  const variant = tileOrVariant?.texture && tileOrVariant?.splashText
    ? tileOrVariant
    : getSpecialDiceVariantForTile(tileOrVariant);
  if (!variant) return null;
  return {
    text: variant.splashText,
    color: variant.splashColor,
    colors: variant.splashColors,
    letterOpacityRange: variant.splashLetterOpacityRange,
    splitIndex: variant.splashSplitIndex,
    lastFrameOnExitOnly: variant.lastExplosionFrameOnExitOnly,
    frameScale: variant.explosionScale,
    frameHorizontalScale: variant.explosionHorizontalScale,
    frameVerticalStretch: variant.explosionVerticalStretch,
    hideFrameIndicesAtExitStart: variant.hideExplosionFrameIndicesAtExitStart,
    burstSources: variant.burstParticleSources,
    burstMotion: variant.burstMotion,
    finaleScene: variant.finaleScene,
    inputReleaseAtRatio: getSpecialDiceInputReleaseAtRatio(variant),
  };
}

export function getSpecialDiceSplashLetterColors(tileOrVariant: any): string[] | undefined {
  const variant = tileOrVariant?.texture && tileOrVariant?.splashText
    ? tileOrVariant
    : getSpecialDiceVariantForTile(tileOrVariant);
  if (Array.isArray(variant?.splashLetterColors) && variant.splashLetterColors.length) {
    return variant.splashLetterColors;
  }
  const options = getSpecialDiceSplashOptions(tileOrVariant);
  if (!Array.isArray(options?.colors) || options.colors.length < 2) return undefined;
  const text = Array.from(String(options.text || ''));
  const splitIndex = Number.isFinite(options.splitIndex) ? Number(options.splitIndex) : text.length;
  return text.map((_, index) => index < splitIndex ? options.colors[0] : options.colors[1]);
}

export function getSpecialDiceJuiceDropProfile(tileOrVariant: any): 'beach-ball' | 'mushroom' | 'robo' | undefined {
  const variant = tileOrVariant?.texture && tileOrVariant?.splashText
    ? tileOrVariant
    : getSpecialDiceVariantForTile(tileOrVariant);
  return variant?.juiceDropProfile;
}

export function getSpecialDiceInputReleaseAtRatio(tileOrVariant: any): number | undefined {
  const variant = tileOrVariant?.texture && tileOrVariant?.splashText
    ? tileOrVariant
    : getSpecialDiceVariantForTile(tileOrVariant);
  if (Number.isFinite(variant?.inputReleaseAtRatio)) {
    return Math.min(0.95, Math.max(0.2, Number(variant.inputReleaseAtRatio)));
  }
  const fx = getSpecialDiceFinaleFxForArchetype(variant?.archetype);
  return fx ? SPECIAL_DICE_INPUT_RELEASE_RATIO_BY_FX[fx] : undefined;
}

export function getSpecialDiceGameplayReleaseAtSpawnRatio(tileOrVariant: any): number | undefined {
  const variant = tileOrVariant?.texture && tileOrVariant?.splashText
    ? tileOrVariant
    : getSpecialDiceVariantForTile(tileOrVariant);
  if (!Number.isFinite(variant?.gameplayReleaseAtSpawnRatio)) return undefined;
  return Math.min(1, Math.max(0, Number(variant.gameplayReleaseAtSpawnRatio)));
}

export function getSpecialDiceInputReleaseAtRatioForFx(fx?: SpecialDiceFinaleFx | null): number {
  return fx ? SPECIAL_DICE_INPUT_RELEASE_RATIO_BY_FX[fx] : 0.7;
}

export function getSpecialDiceInputReleaseModeForFx(fx?: SpecialDiceFinaleFx | null): SpecialDiceInputReleaseMode {
  return fx ? SPECIAL_DICE_INPUT_RELEASE_MODE_BY_FX[fx] : 'timeline-ratio';
}

export function getSpecialDiceInputReleaseMode(tileOrVariant: any): SpecialDiceInputReleaseMode {
  const variant = tileOrVariant?.texture && tileOrVariant?.splashText
    ? tileOrVariant
    : getSpecialDiceVariantForTile(tileOrVariant);
  const fx = getSpecialDiceFinaleFxForArchetype(variant?.archetype);
  return getSpecialDiceInputReleaseModeForFx(fx);
}

export function getSpecialDiceShardColor(tileOrVariant: any): number | undefined {
  const variant = tileOrVariant?.texture && tileOrVariant?.splashText
    ? tileOrVariant
    : getSpecialDiceVariantForTile(tileOrVariant);
  return variant?.shardColor;
}

export function getSpecialDiceShardColors(tileOrVariant: any): number[] | undefined {
  const variant = tileOrVariant?.texture && tileOrVariant?.splashText
    ? tileOrVariant
    : getSpecialDiceVariantForTile(tileOrVariant);
  return Array.isArray(variant?.shardColors) && variant.shardColors.length
    ? variant.shardColors
    : undefined;
}

export function getSpecialDiceTrailColors(tileOrVariant: any): number[] | null {
  const variant = tileOrVariant?.texture && tileOrVariant?.splashText
    ? tileOrVariant
    : getSpecialDiceVariantForTile(tileOrVariant);
  return Array.isArray(variant?.trailColors) && variant.trailColors.length
    ? variant.trailColors
    : null;
}

export function getSpecialDiceIdleBubbleColors(tileOrVariant: any): number[] | null {
  const variant = tileOrVariant?.texture && tileOrVariant?.splashText
    ? tileOrVariant
    : getSpecialDiceVariantForTile(tileOrVariant);
  return Array.isArray(variant?.idleBubbleColors) && variant.idleBubbleColors.length
    ? variant.idleBubbleColors
    : null;
}

export function getSpecialDiceExplosionSpriteSources(tileOrVariant: any): string[] | null {
  const variant = tileOrVariant?.texture && tileOrVariant?.splashText
    ? tileOrVariant
    : getSpecialDiceVariantForTile(tileOrVariant);
  return Array.isArray(variant?.explosionSpriteSources) && variant.explosionSpriteSources.length
    ? variant.explosionSpriteSources
    : null;
}

export function getSpecialDiceFinaleAccentSpriteSources(tileOrVariant: any): string[] | null {
  const variant = tileOrVariant?.texture && tileOrVariant?.splashText
    ? tileOrVariant
    : getSpecialDiceVariantForTile(tileOrVariant);
  return Array.isArray(variant?.finaleAccentSpriteSources) && variant.finaleAccentSpriteSources.length
    ? variant.finaleAccentSpriteSources
    : null;
}

export const ROBO_WILD_VARIANT_CHANCE = 0.25;

export function shouldForceCoreTntAsFirstForestDie({
  isArcade,
  journeyBoard,
  wildSpawnCount,
}: {
  isArcade: boolean;
  journeyBoard?: number;
  wildSpawnCount: number;
}): boolean {
  return !isArcade
    && Math.trunc(Number(journeyBoard)) === 1
    && wildSpawnCount === 0;
}

export function pickSpecialDiceVariantForWildSpawn({
  isArcade,
  wildSpawnCount,
  arcadeStage,
  journeyBoard,
  beachWildSlot,
  roboWildRoll,
}: {
  isArcade: boolean;
  wildSpawnCount: number;
  arcadeStage?: number;
  journeyBoard?: number;
  beachWildSlot?: number;
  roboWildRoll?: number;
}): SpecialDiceVariantDefinition | null {
  if (!isArcade) {
    const board = Number.isFinite(journeyBoard) ? Math.trunc(journeyBoard as number) : 0;
    // Beach uses one weighted roll per spawn. Ball and Bottle are explicit
    // Magnet-gameplay variants; Star and Juice remain core wild types. Generic
    // Magnet and TNT are intentionally absent from the Beach fallback pool.
    if (board >= 11 && board <= 20) {
      const beachSlot = Number.isFinite(beachWildSlot)
        ? Math.max(0, Math.min(3, Math.trunc(beachWildSlot as number)))
        : pickBeachWildSlot();
      if (beachSlot === 2) return SPECIAL_DICE_VARIANTS['beach-ball'];
      if (beachSlot === 3) return SPECIAL_DICE_VARIANTS.bottle;
      return null;
    }
    // Robo World Cjelina 01 guarantees Spaceship first and Robo Cube second.
    // The new Magnet-family visual stays isolated from Forest, Beach, Arcade,
    // and the later Robo roll so it cannot dilute the accepted Robo chance.
    // Remaining Robo stages use one bounded roll per spawn; no other world or
    // Arcade route can consume this visual variant.
    if (board === 21) {
      if (wildSpawnCount === 0) return SPECIAL_DICE_VARIANTS.spaceship;
      if (wildSpawnCount === 1) return SPECIAL_DICE_VARIANTS['robo-cube'];
      return null;
    }
    if (board >= 22 && board <= 30) {
      const finiteRoll = Number.isFinite(roboWildRoll) ? Number(roboWildRoll) : Math.random();
      const roll = Math.max(0, Math.min(1 - Number.EPSILON, finiteRoll));
      return roll < ROBO_WILD_VARIANT_CHANCE ? SPECIAL_DICE_VARIANTS['robo-cube'] : null;
    }
    // Temporary Forest test profile belongs only to Cjelina 02. Do not let
    // its per-run spawn order leak into any other Forest/Beach/Area 55 board.
    if (board !== 2) return null;
    if (wildSpawnCount === 0) return SPECIAL_DICE_VARIANTS.flower;
    if (wildSpawnCount === 1) return SPECIAL_DICE_VARIANTS.honey;
    if (wildSpawnCount === 2) return SPECIAL_DICE_VARIANTS.mushroom;
    return null;
  }
  if (Number.isFinite(arcadeStage) && (arcadeStage as number) > 1) return null;
  const testVariants = Object.values(SPECIAL_DICE_VARIANTS)
    .filter((variant) => Number.isFinite(variant.arcadeTestOrder))
    .sort((a, b) => (a.arcadeTestOrder ?? 9999) - (b.arcadeTestOrder ?? 9999));
  return testVariants[wildSpawnCount] || null;
}

// Slots: 0 Star, 1 Juice, 2 Beach Ball, 3 Bottle.
export const BEACH_WILD_SLOT_WEIGHTS = Object.freeze([0.25, 0.25, 0.25, 0.25] as const);

export function pickBeachWildSlot(randomValue: number = Math.random()): number {
  const finiteRoll = Number.isFinite(randomValue) ? randomValue : 0;
  const roll = Math.max(0, Math.min(1 - Number.EPSILON, finiteRoll));
  let cumulative = 0;
  for (let slot = 0; slot < BEACH_WILD_SLOT_WEIGHTS.length; slot += 1) {
    cumulative += BEACH_WILD_SLOT_WEIGHTS[slot];
    if (roll < cumulative) return slot;
  }
  return BEACH_WILD_SLOT_WEIGHTS.length - 1;
}
