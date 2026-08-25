import { Assets } from 'pixi.js';
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
import { isUsablePixiImageTexture, reloadPixiImageTexture } from './pixi-image-texture-health.js';

export type BoardAssetWarmupMode = 'arcade' | 'journey' | 'unknown';

export type BoardAssetWarmupOptions = {
  mode?: BoardAssetWarmupMode;
  boardNumber?: number;
  reason?: string;
  timeoutMs?: number;
};

const CORE_BOARD_ASSETS = [
  ASSET_TILE,
  ASSET_NUMBERS,
  ASSET_NUMBERS2,
  ASSET_NUMBERS3,
  ASSET_NUMBERS4,
  ASSET_WILD,
  ASSET_WILD_MAGNET,
  ASSET_WILD_JUICE,
  ASSET_WILD_TNT,
  // Stars collector and wild-star runtime both try @3x first.
  './assets/small-star@3x.png',
] as const;

const CORE_HUD_ASSETS = [
  './assets/close-icon.png',
  './assets/hud/star-hud.png',
  './assets/hud/score-hud.png',
  './assets/hud/combo-hud.png',
  './assets/hud/extra-combo-hud.png',
  './assets/hud/mega-combo-hud.png',
  './assets/hud/help.png',
] as const;

const JOURNEY_BOTTOM_DECOR_COUNT = 12;
const journeyBottomDecorByBoard = new Map<number, number>();

export type JourneyBottomDecorAsset = Readonly<{
  key: string;
  oneX: string;
  twoX?: string;
}>;

const BEACH_FIRST_BOARD = 11;
const BEACH_LAST_BOARD = 20;
const AREA55_FIRST_BOARD = 21;
const AREA55_LAST_BOARD = 30;
const BEACH_HUD_HIGH_RES_FILE_BY_UNIT: Readonly<Partial<Record<number, string>>> = Object.freeze({
  1: 'beach-hud1@2x.png',
  2: 'beach-hud2@2x.png',
  3: 'beach-hud3@3x.png',
  4: 'beach-hud4@2x.png',
  5: 'beach-hud5@2x.png',
  6: 'beach-hud6@2x.png',
  7: 'beach-hud7@2x.png',
  8: 'beach-hud8@2x.png',
  10: 'beach-hud10@2x.png',
});

function getBeachHudAsset(unitIndex: number): JourneyBottomDecorAsset {
  const safeUnitIndex = Math.max(1, Math.min(10, Math.floor(unitIndex)));
  const assetBase = './assets/journey assets/beach/beach hud';
  const highResFile = BEACH_HUD_HIGH_RES_FILE_BY_UNIT[safeUnitIndex];
  return {
    key: `beach-hud${safeUnitIndex}`,
    oneX: `${assetBase}/beach-hud${safeUnitIndex}.png`,
    ...(highResFile ? { twoX: `${assetBase}/${highResFile}` } : {}),
  };
}

function getArea55HudAsset(unitIndex: number): JourneyBottomDecorAsset {
  const safeUnitIndex = Math.max(1, Math.min(10, Math.floor(unitIndex)));
  const assetBase = './assets/journey assets/robo/robo hud';
  return {
    key: `area55-hud${safeUnitIndex}`,
    oneX: `${assetBase}/area${safeUnitIndex}.png`,
    twoX: `${assetBase}/area${safeUnitIndex}@2x.png`,
  };
}

export function getJourneyBottomDecorIndexForBoard(boardNumber?: number): number {
  const safeBoardNumber = Math.max(1, Math.floor(Number(boardNumber) || 1));
  const existing = journeyBottomDecorByBoard.get(safeBoardNumber);
  if (existing) return existing;
  const selected = Math.floor(Math.random() * JOURNEY_BOTTOM_DECOR_COUNT) + 1;
  journeyBottomDecorByBoard.set(safeBoardNumber, selected);
  return selected;
}

export function getJourneyBottomDecorAssetForBoard(boardNumber?: number): JourneyBottomDecorAsset {
  const safeBoardNumber = Math.max(1, Math.floor(Number(boardNumber) || 1));
  if (safeBoardNumber >= BEACH_FIRST_BOARD && safeBoardNumber <= BEACH_LAST_BOARD) {
    const unitIndex = safeBoardNumber - BEACH_FIRST_BOARD + 1;
    return getBeachHudAsset(unitIndex);
  }
  if (safeBoardNumber >= AREA55_FIRST_BOARD && safeBoardNumber <= AREA55_LAST_BOARD) {
    const unitIndex = safeBoardNumber - AREA55_FIRST_BOARD + 1;
    return getArea55HudAsset(unitIndex);
  }

  const decorIndex = getJourneyBottomDecorIndexForBoard(safeBoardNumber);
  return {
    key: `forest-bottom${decorIndex}`,
    oneX: `./assets/journey assets/bottom${decorIndex}.png`,
    twoX: `./assets/journey assets/bottom${decorIndex}@2x.png`,
  };
}

function getJourneyBoardAssets(boardNumber?: number): string[] {
  const decorAsset = getJourneyBottomDecorAssetForBoard(boardNumber);
  return [decorAsset.oneX, decorAsset.twoX].filter((asset): asset is string => Boolean(asset));
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function getCachedTexture(assetPath: string): any {
  try {
    const cache = (Assets as any)?.cache;
    if (typeof cache?.has !== 'function' || !cache.has(assetPath)) return null;
    return cache.get(assetPath);
  } catch {
    return null;
  }
}

function getGhostAssetForPixelRatio(pixelRatio: number): string {
  if (pixelRatio >= 3) return './assets/ghost-placeholder@3x.png';
  if (pixelRatio >= 2) return './assets/ghost-placeholder@2x.png';
  return './assets/ghost-placeholder.png';
}

export function getBoardGameWarmupAssets(
  mode: BoardAssetWarmupMode,
  boardNumber?: number,
  pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
): string[] {
  const modeAssets = mode === 'journey' ? getJourneyBoardAssets(boardNumber) : [];
  return unique([
    ...CORE_BOARD_ASSETS,
    getGhostAssetForPixelRatio(pixelRatio),
    ...CORE_HUD_ASSETS,
    ...modeAssets,
  ]);
}

let activeWarmupLoadPromise: Promise<void> | null = null;

export function warmBoardGameAssets(options: BoardAssetWarmupOptions = {}): Promise<void> {
  const mode = options.mode || 'unknown';
  const reason = options.reason || 'unknown';
  const timeoutMs = Math.max(250, options.timeoutMs ?? 1800);

  if (!activeWarmupLoadPromise) {
    activeWarmupLoadPromise = (async () => {
      const assets = getBoardGameWarmupAssets(mode, options.boardNumber);
      const missingOrStale: string[] = [];

      for (const assetPath of assets) {
        const tex = getCachedTexture(assetPath);
        if (isUsablePixiImageTexture(tex)) continue;
        missingOrStale.push(assetPath);
      }

      if (missingOrStale.length === 0) return;

      logger.info(`🎮 Board asset warmup (${mode}) loading ${missingOrStale.length} asset(s)`, 'board-asset-warmup', {
        reason,
        boardNumber: options.boardNumber,
      });

      const loadOne = async (assetPath: string): Promise<void> => {
        try {
          const cached = getCachedTexture(assetPath);
          if (isUsablePixiImageTexture(cached)) return;
          await reloadPixiImageTexture(assetPath);
        } catch (error) {
          logger.warn('⚠️ Board asset warmup skipped asset; runtime guard will retry', 'board-asset-warmup', { assetPath, error });
        }
      };

      await Promise.allSettled(missingOrStale.map(loadOne));
    })().finally(() => {
      activeWarmupLoadPromise = null;
    });
  }

  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(resolve, timeoutMs);
  });
  return Promise.race([activeWarmupLoadPromise, timeoutPromise]);
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
