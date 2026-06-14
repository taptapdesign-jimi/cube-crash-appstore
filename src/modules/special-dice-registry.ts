// Registry for collectible/special dice skins that reuse existing wild mechanics.
// Add future dice here by choosing an archetype and providing texture/FX assets.

export type CoreWildType = 'wild' | 'wild-juice' | 'wild-magnet' | 'wild-tnt';
export type SpecialDiceArchetype = 'wild-star' | 'wild-juice' | 'wild-magnet' | 'wild-tnt';

export type SpecialDiceVariantDefinition = {
  id: string;
  archetype: SpecialDiceArchetype;
  texture: string;
  splashText: string;
  splashColor: string;
  visualWidth?: number;
  visualHeight?: number;
  visualFit?: 'height';
  hitAreaSize?: 'tile';
  idleOrbit?: boolean;
  orbitParticleSources?: string[];
  burstParticleSources?: string[];
  burstMotion?: {
    count?: number;
    speedScale?: number;
    flagWave?: boolean;
    sizeBoostChance?: number;
    sizeBoostMax?: number;
    waveStrength?: number;
    waveDurationScale?: number;
    mixBlendMode?: string;
  };
  arcadeTestFirst?: boolean;
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

export const SPECIAL_DICE_VARIANTS: Record<string, SpecialDiceVariantDefinition> = {
  cubero: {
    id: 'cubero',
    archetype: 'wild-star',
    texture: './assets/shop/cubero/cubero.png',
    splashText: 'Hiyaa!',
    splashColor: '#FE9130',
    visualWidth: 170,
    visualHeight: 128,
    hitAreaSize: 'tile',
    idleOrbit: false,
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
    arcadeTestFirst: true,
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

export function applySpecialDiceVariantToTile(tile: any, variant?: SpecialDiceVariantDefinition | null): void {
  if (!tile || !variant) return;
  tile._ccSpecialDiceVariant = variant.id;
  tile.specialDiceVariant = variant.id;
  tile._ccSpecialDiceArchetype = variant.archetype;
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
    burstSources: variant.burstParticleSources,
    burstMotion: variant.burstMotion,
  };
}

export function pickSpecialDiceVariantForWildSpawn({
  isArcade,
  wildSpawnCount,
}: {
  isArcade: boolean;
  wildSpawnCount: number;
}): SpecialDiceVariantDefinition | null {
  if (!isArcade || wildSpawnCount !== 0) return null;
  return Object.values(SPECIAL_DICE_VARIANTS).find((variant) => variant.arcadeTestFirst) || null;
}
