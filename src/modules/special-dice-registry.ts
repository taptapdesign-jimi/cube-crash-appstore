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
  texture: string;
  splashText: string;
  splashColor: string;
  splashColors?: string[];
  splashLetterColors?: string[];
  splashSplitIndex?: number;
  shardColor?: number;
  shardColors?: number[];
  trailColors?: number[];
  idleBubbleColors?: number[];
  finaleScene?: 'bottle-ocean';
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
  idleMotion?: 'float' | 'beach-ball-bounce' | 'bottle-float' | 'cubero-hop' | 'mushroom-pop';
  juiceDropProfile?: 'beach-ball' | 'mushroom';
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
    archetype: 'wild-juice',
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
  },
};

export function getSpecialDiceVariant(id?: string | null): SpecialDiceVariantDefinition | null {
  if (!id) return null;
  return SPECIAL_DICE_VARIANTS[id] || null;
}

export function getSpecialDiceVariantForTile(tile: any): SpecialDiceVariantDefinition | null {
  return getSpecialDiceVariant(tile?._ccSpecialDiceVariant || tile?.specialDiceVariant || null);
}

export function getCoreWildTypeForSpecialDiceVariant(variant?: SpecialDiceVariantDefinition | null): CoreWildType | null {
  if (!variant) return null;
  if (variant.archetype === 'wild-star') return 'wild';
  if (variant.archetype === 'wild-juice') return 'wild-juice';
  if (variant.archetype === 'wild-magnet') return 'wild-magnet';
  if (variant.archetype === 'wild-tnt') return 'wild-tnt';
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
  const variantFx = getSpecialDiceFinaleFxForArchetype(variant?.archetype || tile?._ccSpecialDiceArchetype);
  if (variantFx) return variantFx;
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
  return specialDiceTileMatchesFinaleFx(tile, 'magnet', coreWildTypeOverride);
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
  const fx = getSpecialDiceFinaleFxForTile(tile, coreWildTypeOverride);
  return fx !== null && getSpecialDiceInputReleaseModeForFx(fx) === 'after-gameplay-resolve';
}

export function isSpecialDiceDirectWildLikeTile(tile: any, coreWildTypeOverride?: CoreWildType | string | null): boolean {
  const fx = getSpecialDiceFinaleFxForTile(tile, coreWildTypeOverride);
  if (fx === 'star' || fx === 'juice' || fx === 'tnt') return true;
  const special = coreWildTypeOverride || tile?.special || tile?._ccWildSpecial || null;
  if (fx === 'magnet' || special === 'wild-magnet') return false;
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

export function getSpecialDiceJuiceDropProfile(tileOrVariant: any): 'beach-ball' | 'mushroom' | undefined {
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

export function pickSpecialDiceVariantForWildSpawn({
  isArcade,
  wildSpawnCount,
  arcadeStage,
  journeyBoard,
}: {
  isArcade: boolean;
  wildSpawnCount: number;
  arcadeStage?: number;
  journeyBoard?: number;
}): SpecialDiceVariantDefinition | null {
  if (!isArcade) {
    const board = Number.isFinite(journeyBoard) ? Math.trunc(journeyBoard as number) : 0;
    // Beach cycles Star → Juice → Beach Ball → Bottle on every stage. Ball
    // and Bottle use registry variants; the first two remain core wild types.
    // Core Magnet and TNT are intentionally absent from the Beach pool.
    if (board >= 11 && board <= 20) {
      const beachSlot = getBeachWildSlotForSpawn(board, wildSpawnCount);
      if (beachSlot === 2) return SPECIAL_DICE_VARIANTS['beach-ball'];
      if (beachSlot === 3) return SPECIAL_DICE_VARIANTS.bottle;
      return null;
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

export function getBeachWildSlotForSpawn(journeyBoard: number, wildSpawnCount: number): number {
  const board = Number.isFinite(journeyBoard) ? Math.trunc(journeyBoard) : 0;
  const count = Number.isFinite(wildSpawnCount) ? Math.max(0, Math.trunc(wildSpawnCount)) : 0;
  // Beach Stage 02 is global Journey board 12. Rotate only that stage's
  // four-item bag so Bottle is first, while retaining one of each special:
  // Bottle → Star → Juice → Beach Ball.
  return (count + (board === 12 ? 3 : 0)) % 4;
}
