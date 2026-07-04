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
  renderer?: any;
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

const RESIDENT_BOARD_TEXTURE_ASSETS = [
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
] as const;

const RESIDENT_BOARD_TEXTURE_SET = new Set<string>(RESIDENT_BOARD_TEXTURE_ASSETS as readonly string[]);
const RESIDENT_NEAREST_TEXTURE_SET = new Set<string>([
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
]);

const pinnedBoardTextures = new Map<string, Texture>();
let guardedRenderer: any = null;

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

function optimizeResidentTexture(assetPath: string, tex: any): void {
  if (!tex || !RESIDENT_NEAREST_TEXTURE_SET.has(assetPath)) return;
  try {
    const src = textureSource(tex);
    if (src) src.scaleMode = 'nearest';
  } catch {}
}

function pinResidentTexture(assetPath: string, tex: any): void {
  if (!RESIDENT_BOARD_TEXTURE_SET.has(assetPath) || !isUsableTexture(tex)) return;
  optimizeResidentTexture(assetPath, tex);
  pinnedBoardTextures.set(assetPath, tex);
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

export function protectBoardTextureRenderer(appOrRenderer?: any, reason: string = 'unknown'): void {
  const renderer = appOrRenderer?.renderer ?? appOrRenderer ?? guardedRenderer;
  if (!renderer) return;
  guardedRenderer = renderer;

  try {
    const gc = renderer.textureGC;
    if (gc) {
      // Pixi v8 textureGC is frame-count based. Keep board-critical textures resident
      // across long Journey/DOM sessions; generic cleanup still owns runtime objects.
      if (typeof gc.maxIdle === 'number') gc.maxIdle = Math.max(gc.maxIdle, 60 * 60 * 24);
      if (typeof gc.checkCountMax === 'number') gc.checkCountMax = Math.max(gc.checkCountMax, 60 * 60);
      if ('active' in gc) gc.active = false;
    }
  } catch (error) {
    logger.warn('⚠️ Failed to protect board texture renderer', 'board-asset-warmup', { reason, error });
  }
}

export async function warmPinnedBoardTextures(appOrRenderer?: any, reason: string = 'unknown', timeoutMs: number = 360): Promise<void> {
  const renderer = appOrRenderer?.renderer ?? appOrRenderer ?? guardedRenderer;
  if (!renderer || pinnedBoardTextures.size === 0) return;
  protectBoardTextureRenderer(renderer, reason);

  const uploads: Promise<unknown>[] = [];
  pinnedBoardTextures.forEach((tex, assetPath) => {
    if (!isUsableTexture(tex)) {
      pinnedBoardTextures.delete(assetPath);
      return;
    }

    try { renderer.texture?.bind?.(textureSource(tex) ?? tex); } catch {}
    try {
      const uploaded = renderer.prepare?.upload?.(tex);
      if (uploaded && typeof uploaded.then === 'function') uploads.push(uploaded);
    } catch {}
  });

  if (uploads.length === 0) return;
  await Promise.race([
    Promise.allSettled(uploads),
    new Promise<void>((resolve) => setTimeout(resolve, Math.max(80, timeoutMs))),
  ]);
}

export function getPinnedBoardTexture(assetPath: string): Texture | null {
  const tex = pinnedBoardTextures.get(assetPath);
  return isUsableTexture(tex) ? tex : null;
}

export async function ensureBoardTexturesResident(options: BoardAssetWarmupOptions = {}): Promise<void> {
  const reason = options.reason || 'unknown';
  protectBoardTextureRenderer(options.renderer, reason);

  await warmBoardGameAssets({
    ...options,
    reason,
    timeoutMs: Math.max(350, options.timeoutMs ?? 1600),
  });

  const missingOrStale = RESIDENT_BOARD_TEXTURE_ASSETS.filter((assetPath) => {
    const pinned = pinnedBoardTextures.get(assetPath);
    let cached: any = null;
    try { cached = Assets.get(assetPath); } catch {}
    if (isUsableTexture(cached)) {
      pinResidentTexture(assetPath, cached);
      return false;
    }
    return !isUsableTexture(pinned);
  });

  if (missingOrStale.length > 0) {
    logger.warn('⚠️ Reloading resident board textures', 'board-asset-warmup', {
      reason,
      count: missingOrStale.length,
      assets: missingOrStale,
    });
  }

  await Promise.allSettled(missingOrStale.map(async (assetPath) => {
    removeStaleTexture(assetPath);
    try {
      const tex = await Assets.load(assetPath);
      pinResidentTexture(assetPath, tex);
      return;
    } catch (error) {
      logger.warn('⚠️ Resident board texture reload failed; trying Texture.from fallback', 'board-asset-warmup', {
        reason,
        assetPath,
        error,
      });
    }

    try {
      const tex = Texture.from(assetPath);
      pinResidentTexture(assetPath, tex);
    } catch (error) {
      logger.warn('⚠️ Resident board texture fallback failed', 'board-asset-warmup', { reason, assetPath, error });
    }
  }));

  await warmPinnedBoardTextures(options.renderer, reason, Math.min(520, Math.max(160, options.timeoutMs ?? 360)));
}

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
      if (isUsableTexture(tex)) {
        pinResidentTexture(assetPath, tex);
        continue;
      }
      removeStaleTexture(assetPath);
      missingOrStale.push(assetPath);
    }

    if (missingOrStale.length === 0) return;

    logger.info(`🎮 Board asset warmup (${mode}) loading ${missingOrStale.length} asset(s)`, 'board-asset-warmup', {
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
        pinResidentTexture(assetPath, tex);
      } catch (error) {
        logger.warn('⚠️ Board asset warmup skipped asset; runtime guard will retry', 'board-asset-warmup', { assetPath, error });
      }
    };

    const loadPromise = Promise.allSettled(missingOrStale.map(loadOne));
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(resolve, timeoutMs);
    });

    await Promise.race([loadPromise.then(() => undefined), timeoutPromise]);
    await warmPinnedBoardTextures(options.renderer, reason, Math.min(360, timeoutMs));
  })().finally(() => {
    warmupPromise = null;
  });

  return warmupPromise;
}

export function ensureBoardTexturesResidentSoon(options: BoardAssetWarmupOptions = {}): void {
  const run = () => {
    void ensureBoardTexturesResident(options).catch((error) => {
      logger.warn('⚠️ Resident board texture guard failed softly', 'board-asset-warmup', error);
    });
  };

  if (typeof window !== 'undefined' && typeof (window as any).requestIdleCallback === 'function') {
    (window as any).requestIdleCallback(run, { timeout: 800 });
  } else {
    setTimeout(run, 0);
  }
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
