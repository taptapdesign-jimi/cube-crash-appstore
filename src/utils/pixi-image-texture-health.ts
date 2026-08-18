import { Assets, Texture } from 'pixi.js';

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
