import { Assets } from 'pixi.js';
import { ASSET_WILD_MAGNET } from './constants.js';
import {
  getSpecialDiceVariant,
  type SpecialDiceVariantDefinition,
} from './special-dice-registry.ts';

const exactVisualWarmups = new Map<string, Promise<void>>();
const domDecodeWarmups = new Map<string, Promise<void>>();
const decodedDomImages = new Map<string, HTMLImageElement>();

export function getArcadeStageOneNextSpecialVisualSource(
  arcadeStage: number,
  wildSpawnCount: number,
): string | null {
  if (arcadeStage !== 1) return null;
  if (wildSpawnCount === 0) return ASSET_WILD_MAGNET;
  if (wildSpawnCount !== 1) return null;
  const variant = getSpecialDiceVariant('bottle') as SpecialDiceVariantDefinition | null;
  return variant?.id === 'bottle' ? variant.texture || null : null;
}

function decodeDomImage(source: string): Promise<void> {
  const cached = domDecodeWarmups.get(source);
  if (cached) return cached;
  if (typeof Image === 'undefined') return Promise.resolve();

  const pending = new Promise<void>((resolve) => {
    const image = new Image();
    // WebKit may discard a decoded detached bitmap when the Image itself loses
    // its last strong reference. This owner warms only Magnet/Bottle, so keep a
    // strict two-image cache until the gameplay lifecycle resets the module.
    if (!decodedDomImages.has(source) && decodedDomImages.size >= 2) {
      const oldest = decodedDomImages.keys().next().value;
      if (oldest) decodedDomImages.delete(oldest);
    }
    decodedDomImages.set(source, image);
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      image.onload = null;
      image.onerror = null;
      resolve();
    };
    const handleLoad = () => {
      try {
        const decoded = image.decode?.();
        if (decoded && typeof decoded.then === 'function') {
          void decoded.then(settle, settle);
          return;
        }
      } catch {}
      settle();
    };
    image.onload = handleLoad;
    image.onerror = settle;
    image.decoding = 'async';
    image.src = source;
    if (image.complete && image.naturalWidth > 0) handleLoad();
  });
  domDecodeWarmups.set(source, pending);
  return pending;
}

export function preloadExactSpecialDropVisual(source: string): Promise<void> {
  if (!source) return Promise.resolve();
  const cached = exactVisualWarmups.get(source);
  if (cached) return cached;
  const pending = Promise.allSettled([
    Assets.load(source),
    decodeDomImage(source),
  ]).then(() => undefined);
  exactVisualWarmups.set(source, pending);
  return pending;
}

export function queueArcadeStageOneNextSpecialVisualWarmup({
  arcadeStage,
  wildSpawnCount,
  isCurrent,
}: {
  arcadeStage: number;
  wildSpawnCount: number;
  isCurrent: () => boolean;
}): void {
  const source = getArcadeStageOneNextSpecialVisualSource(arcadeStage, wildSpawnCount);
  if (!source || !isCurrent()) return;
  const warm = () => {
    if (!isCurrent()) return;
    void preloadExactSpecialDropVisual(source);
  };
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(warm);
  } else {
    warm();
  }
}

export function resetArcadeStageOneSpecialVisualWarmupForTests(): void {
  exactVisualWarmups.clear();
  domDecodeWarmups.clear();
  decodedDomImages.clear();
}

export function getArcadeStageOneDecodedImageCountForTests(): number {
  return decodedDomImages.size;
}
