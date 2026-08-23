import { Assets, Rectangle, Texture } from 'pixi.js';

export interface PixiTextureGpuProbeResult {
  status: 'healthy' | 'blank' | 'unavailable' | 'error';
  samples: number;
  nonTransparentPixels: number;
  maxAlpha: number;
  error?: string;
}

const reloadsByAsset = new Map<string, Promise<Texture>>();

function getTextureSource(texture: any): any {
  return texture?.source ?? texture?.baseTexture ?? null;
}

function getResourceDimension(resource: any, axis: 'width' | 'height'): number {
  if (!resource) return 0;
  const candidates = axis === 'width'
    ? [resource.naturalWidth, resource.videoWidth, resource.displayWidth, resource.width]
    : [resource.naturalHeight, resource.videoHeight, resource.displayHeight, resource.height];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

/**
 * Core board/HUD assets are image-backed Pixi textures. Width/height metadata can
 * survive after WebKit has released the actual ImageBitmap, so resource presence
 * and dimensions are part of the readiness contract.
 */
export function isUsablePixiImageTexture(texture: any): texture is Texture {
  if (!texture || texture === Texture.EMPTY || texture.destroyed) return false;
  const source = getTextureSource(texture);
  if (!source || source.destroyed || source.valid === false) return false;
  const resource = source.resource;
  if (!resource) return false;
  if (typeof HTMLImageElement !== 'undefined' && resource instanceof HTMLImageElement) {
    if (!resource.complete || resource.naturalWidth <= 1 || resource.naturalHeight <= 1) return false;
  }
  const resourceWidth = getResourceDimension(resource, 'width');
  const resourceHeight = getResourceDimension(resource, 'height');
  if (resourceWidth <= 1 || resourceHeight <= 1) return false;
  const textureWidth = Number(texture.width || source.width || texture.orig?.width || 0);
  const textureHeight = Number(texture.height || source.height || texture.orig?.height || 0);
  return textureWidth > 1 && textureHeight > 1;
}

export function pinPixiImageTexture(texture: any): void {
  const source = getTextureSource(texture);
  if (source) source.autoGarbageCollect = false;
}

/**
 * Reads three tiny regions from the actual renderer texture. This intentionally
 * goes beyond resource metadata: WKWebView can retain ImageBitmap dimensions
 * after its backing pixels have been purged. The bounded 3 x 8 x 8 readback is
 * used only at lifecycle barriers, never from a ticker or animation frame.
 */
export function probePixiImageTextureGpuPixels(
  renderer: any,
  texture: any,
  sampleSize = 8,
): PixiTextureGpuProbeResult {
  if (!isUsablePixiImageTexture(texture)) {
    return { status: 'blank', samples: 0, nonTransparentPixels: 0, maxAlpha: 0 };
  }
  if (typeof renderer?.extract?.pixels !== 'function') {
    return { status: 'unavailable', samples: 0, nonTransparentPixels: 0, maxAlpha: 0 };
  }

  const frame = texture.frame;
  const frameWidth = Math.max(1, Math.floor(Number(frame?.width ?? texture.width) || 1));
  const frameHeight = Math.max(1, Math.floor(Number(frame?.height ?? texture.height) || 1));
  const size = Math.max(1, Math.min(Math.floor(sampleSize), frameWidth, frameHeight));
  const frameX = Number(frame?.x) || 0;
  const frameY = Number(frame?.y) || 0;
  const positions = [0.25, 0.5, 0.75];
  let samples = 0;
  let nonTransparentPixels = 0;
  let maxAlpha = 0;

  try {
    for (const ratio of positions) {
      const x = frameX + Math.max(0, Math.min(frameWidth - size, Math.round(frameWidth * ratio - size / 2)));
      const y = frameY + Math.max(0, Math.min(frameHeight - size, Math.round(frameHeight * ratio - size / 2)));
      const probeTexture = new Texture({
        source: texture.source,
        frame: new Rectangle(x, y, size, size),
        label: `cc-gpu-health-probe-${samples + 1}`,
      });
      try {
        const output = renderer.extract.pixels(probeTexture);
        const pixels = output?.pixels;
        if (!pixels || typeof pixels.length !== 'number') {
          throw new Error('Pixi renderer returned no pixel buffer');
        }
        for (let index = 3; index < pixels.length; index += 4) {
          const alpha = Number(pixels[index]) || 0;
          if (alpha > 4) nonTransparentPixels += 1;
          if (alpha > maxAlpha) maxAlpha = alpha;
        }
        samples += 1;
      } finally {
        // Pixi 8 Texture.destroy(false) preserves the shared source but does
        // not detach this temporary texture's resize listener from it.
        try { texture.source?.off?.('resize', probeTexture.update, probeTexture); } catch {}
        probeTexture.destroy(false);
      }
    }
  } catch (error) {
    return {
      status: 'error',
      samples,
      nonTransparentPixels,
      maxAlpha,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    status: nonTransparentPixels > 0 ? 'healthy' : 'blank',
    samples,
    nonTransparentPixels,
    maxAlpha,
  };
}

function removeCachedAssetReferences(assetPath: string): void {
  try {
    const cache = (Assets as any)?.cache;
    try { cache?.remove?.(assetPath); } catch {}
    try { cache?.delete?.(assetPath); } catch {}
  } catch {}
  try { (Texture as any).removeFromCache?.(assetPath); } catch {}
}

/**
 * Assets.cache deletion alone is insufficient in Pixi 8 because Loader keeps a
 * resolved promise cache. Assets.unload is the public operation that clears both.
 * Calls are serialized per path so two lifecycle guards cannot unload each other.
 */
export function reloadPixiImageTexture(assetPath: string): Promise<Texture> {
  const existing = reloadsByAsset.get(assetPath);
  if (existing) return existing;

  const reload = (async () => {
    try { await Assets.unload(assetPath); } catch {}
    removeCachedAssetReferences(assetPath);
    const texture = await Assets.load<Texture>(assetPath);
    if (!isUsablePixiImageTexture(texture)) {
      throw new Error(`Pixi image texture is not render-ready after reload: ${assetPath}`);
    }
    pinPixiImageTexture(texture);
    return texture;
  })().finally(() => {
    reloadsByAsset.delete(assetPath);
  });

  reloadsByAsset.set(assetPath, reload);
  return reload;
}
