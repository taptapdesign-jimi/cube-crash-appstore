import { Assets, Texture } from 'pixi.js';
import { logger } from '../core/logger.js';
import {
  ASSET_NUMBERS,
  ASSET_NUMBERS2,
  ASSET_NUMBERS3,
  ASSET_NUMBERS4,
  ASSET_TILE,
  ASSET_WILD,
  ASSET_WILD_JUICE,
  ASSET_WILD_MAGNET,
  ASSET_WILD_TNT,
} from '../modules/constants.js';
import { SPECIAL_DICE_VARIANTS } from '../modules/special-dice-registry.js';

export type BoardAssetWarmupMode = 'arcade' | 'journey' | 'unknown';

export type BoardAssetWarmupOptions = {
  mode?: BoardAssetWarmupMode;
  boardNumber?: number;
  reason?: string;
  timeoutMs?: number;
};

const CORE_BOARD_ASSETS = [
  ASSET_TILE,
  './assets/tile@2x.png',
  ASSET_NUMBERS,
  './assets/tile_numbers@2x.png',
  ASSET_NUMBERS2,
  './assets/tile_numbers2@2x.png',
  ASSET_NUMBERS3,
  './assets/tile_numbers3@2x.png',
  ASSET_NUMBERS4,
  './assets/tile_numbers4@2x.png',
  './assets/ghost-placeholder.png',
  './assets/ghost-placeholder@2x.png',
  './assets/ghost-placeholder@3x.png',
  ASSET_WILD,
  './assets/wild@2x.png',
  './assets/wild@3x.png',
  ASSET_WILD_MAGNET,
  './assets/wild-magnet@2x.png',
  './assets/wild-magnet@3x.png',
  ASSET_WILD_JUICE,
  './assets/wild-juice@2x.png',
  './assets/wild-juice@3x.png',
  ASSET_WILD_TNT,
  './assets/shop/explosion pack/tnt@2x.png',
  './assets/shop/explosion pack/tnt@3x.png',
  './assets/small-star.png',
  './assets/small-star@2x.png',
  './assets/small-star@3x.png',
] as const;

const CORE_HUD_ASSETS = [
  './assets/close-icon.png',
  './assets/close-icon@2x.png',
  './assets/close-icon@3x.png',
  './assets/hud/star-hud.png',
  './assets/hud/star-hud@2x.png',
  './assets/hud/star-hud@3x.png',
  './assets/hud/score-hud.png',
  './assets/hud/score-hud@2x.png',
  './assets/hud/score-hud@3x.png',
  './assets/hud/combo-hud.png',
  './assets/hud/combo-hud@2x.png',
  './assets/hud/combo-hud@3x.png',
  './assets/hud/extra-combo-hud.png',
  './assets/hud/extra-combo-hud@2x.png',
  './assets/hud/extra-combo-hud@3x.png',
  './assets/hud/mega-combo-hud.png',
  './assets/hud/mega-combo-hud@2x.png',
  './assets/hud/mega-combo-hud@3x.png',
  './assets/hud/help.png',
] as const;

const JOURNEY_BOARD_ASSETS = [
  './assets/journey assets/bottom1.png',
  './assets/journey assets/bottom1@2x.png',
  './assets/journey assets/bottom2.png',
  './assets/journey assets/bottom2@2x.png',
  './assets/journey assets/bottom3.png',
  './assets/journey assets/bottom3@2x.png',
  './assets/journey assets/bottom4.png',
  './assets/journey assets/bottom4@2x.png',
  './assets/journey assets/bottom5.png',
  './assets/journey assets/bottom5@2x.png',
  './assets/journey assets/bottom6.png',
  './assets/journey assets/bottom6@2x.png',
  './assets/journey assets/bottom7.png',
  './assets/journey assets/bottom7@2x.png',
  './assets/journey assets/bottom8.png',
  './assets/journey assets/bottom8@2x.png',
  './assets/journey assets/bottom9.png',
  './assets/journey assets/bottom9@2x.png',
  './assets/journey assets/bottom10.png',
  './assets/journey assets/bottom10@2x.png',
  './assets/journey assets/bottom11.png',
  './assets/journey assets/bottom11@2x.png',
  './assets/journey assets/bottom12.png',
  './assets/journey assets/bottom12@2x.png',
] as const;

const TNT_ANIMATION_ASSETS = Array.from({ length: 12 }, (_, index) => {
  const frame = index + 1;
  return [
    `./assets/shop/explosion pack/animation/tnt${frame}.png`,
    `./assets/shop/explosion pack/animation/tnt${frame}@2x.png`,
  ];
}).flat();

function getSpecialDiceAssets(): string[] {
  const assets: string[] = [];
  Object.values(SPECIAL_DICE_VARIANTS).forEach((variant) => {
    if (variant.texture) assets.push(variant.texture);
    if (variant.texture && !variant.texture.includes('@2x')) {
      const dot = variant.texture.lastIndexOf('.');
      if (dot > 0) assets.push(`${variant.texture.slice(0, dot)}@2x${variant.texture.slice(dot)}`);
    }
    variant.explosionSpriteSources?.forEach((source) => assets.push(source));
    variant.orbitParticleSources?.forEach((source) => assets.push(source));
    variant.burstParticleSources?.forEach((source) => assets.push(source));
  });
  return assets;
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function textureSource(tex: any): any {
  return tex?.source ?? tex?.baseTexture ?? null;
}

function isUsableTexture(tex: any): boolean {
  if (!tex || tex === Texture.EMPTY || tex.destroyed) return false;
  const src = textureSource(tex);
  if (src?.destroyed || src?.valid === false) return false;
  const width = tex.width || src?.width || tex.orig?.width || 0;
  const height = tex.height || src?.height || tex.orig?.height || 0;
  return width > 1 && height > 1;
}

function removeStaleTexture(assetPath: string): void {
  try {
    const cache = (Assets as any)?.cache;
    try { cache?.delete?.(assetPath); } catch {}
    try { cache?.remove?.(assetPath); } catch {}
  } catch {}
  try { (Texture as any).removeFromCache?.(assetPath); } catch {}
}

function getWarmupAssets(mode: BoardAssetWarmupMode): string[] {
  const modeAssets = mode === 'journey' ? JOURNEY_BOARD_ASSETS : [];
  return unique([
    ...CORE_BOARD_ASSETS,
    ...CORE_HUD_ASSETS,
    ...modeAssets,
    ...TNT_ANIMATION_ASSETS,
    ...getSpecialDiceAssets(),
  ]);
}

let warmupPromise: Promise<void> | null = null;

export function warmBoardGameAssets(options: BoardAssetWarmupOptions = {}): Promise<void> {
  const mode = options.mode || 'unknown';
  const reason = options.reason || 'unknown';
  const timeoutMs = Math.max(250, options.timeoutMs ?? 1800);

  if (warmupPromise) return warmupPromise;

  warmupPromise = (async () => {
    const assets = getWarmupAssets(mode);
    const missingOrStale: string[] = [];

    for (const assetPath of assets) {
      let tex: any = null;
      try { tex = Assets.get(assetPath); } catch {}
      if (isUsableTexture(tex)) continue;
      removeStaleTexture(assetPath);
      missingOrStale.push(assetPath);
    }

    if (missingOrStale.length === 0) return;

    logger.info(`🎮 Board asset warmup (${mode}) loading ${missingOrStale.length} asset(s)`, {
      reason,
      boardNumber: options.boardNumber,
    });

    const loadOne = async (assetPath: string): Promise<void> => {
      try {
        let tex: any = await Assets.load(assetPath);
        if (!isUsableTexture(tex)) {
          removeStaleTexture(assetPath);
          tex = Texture.from(assetPath);
        }
      } catch (error) {
        logger.warn('⚠️ Board asset warmup skipped asset; runtime guard will retry', { assetPath, error });
      }
    };

    const loadPromise = Promise.allSettled(missingOrStale.map(loadOne));
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(resolve, timeoutMs);
    });

    await Promise.race([loadPromise.then(() => undefined), timeoutPromise]);
  })().finally(() => {
    warmupPromise = null;
  });

  return warmupPromise;
}

export function warmBoardGameAssetsSoon(options: BoardAssetWarmupOptions = {}): void {
  const run = () => {
    void warmBoardGameAssets(options).catch((error) => {
      logger.warn('⚠️ Board asset warmup failed softly', error);
    });
  };

  if (typeof window !== 'undefined' && typeof (window as any).requestIdleCallback === 'function') {
    (window as any).requestIdleCallback(run, { timeout: 1000 });
  } else {
    setTimeout(run, 0);
  }
}
