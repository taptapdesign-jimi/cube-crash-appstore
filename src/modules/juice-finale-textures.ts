import { Assets, type Texture } from 'pixi.js';
import { isUsablePixiImageTexture, reloadPixiImageTexture } from '../utils/pixi-image-texture-health.ts';
import {
  getSpecialDiceExplosionSpriteSources,
  getSpecialDiceFinaleAccentSpriteSources,
  getSpecialDiceFinaleFxForTile,
} from './special-dice-registry.ts';

export const BUBBLE_SPRITE_PATHS = [
  './assets/shop/juice/bubbles pack/bubble1.png',
  './assets/shop/juice/bubbles pack/bubble 2.png',
  './assets/shop/juice/bubbles pack/bubble 3.png',
  './assets/shop/juice/bubbles pack/bubble 4.png',
  './assets/shop/juice/bubbles pack/bubble 5.png',
  './assets/shop/juice/bubbles pack/bubble 6.png',
  './assets/shop/juice/bubbles pack/bubble 7.png',
  './assets/shop/juice/bubbles pack/bubble 8.png',
];

type Current = () => boolean;
type TextureRequest<T> = {
  path: string;
  consumers: Current[];
  promise: Promise<T | null>;
  resolve: (texture: T | null) => void;
};

/** One bounded queue for entry, drop and finale. Pixi remains the texture cache. */
export function createFinaleTextureLoader<T>(load: (path: string) => Promise<T>, concurrency = 4) {
  const pending = new Map<string, TextureRequest<T>>();
  const queue: TextureRequest<T>[] = [];
  const limit = Math.max(1, Math.floor(concurrency));
  let active = 0;

  const drain = () => {
    while (active < limit && queue.length) {
      const request = queue.shift()!;
      if (!request.consumers.some((isCurrent) => isCurrent())) {
        pending.delete(request.path);
        request.resolve(null);
        continue;
      }
      active += 1;
      const finish = (texture: T | null) => {
        active -= 1;
        pending.delete(request.path);
        request.resolve(texture);
        drain();
      };
      void Promise.resolve().then(() => request.consumers.some((isCurrent) => isCurrent()) ? load(request.path) : null)
        .then(finish, () => finish(null)); // An unavailable optional sprite is skipped.
    }
  };

  return async (paths: readonly string[], isCurrent: Current = () => true): Promise<T[]> => {
    if (!isCurrent()) return [];
    const requests = paths.map((path) => {
      const existing = pending.get(path);
      if (existing) {
        existing.consumers.push(isCurrent);
        return existing.promise;
      }
      let resolve!: TextureRequest<T>['resolve'];
      const promise = new Promise<T | null>((settle) => { resolve = settle; });
      const request = { path, consumers: [isCurrent], promise, resolve };
      pending.set(path, request);
      queue.push(request);
      return promise;
    });
    drain();
    const textures = await Promise.all(requests);
    return isCurrent() ? textures.filter((texture): texture is Awaited<T> => texture !== null) : [];
  };
}

export const loadJuiceFinaleTextures = createFinaleTextureLoader<Texture>(async (path) => {
  const texture = await Assets.load<Texture>(path);
  return isUsablePixiImageTexture(texture) ? texture : reloadPixiImageTexture(path);
});

export function getLiveJuiceFinaleTextureSources(tiles: readonly any[]): string[] {
  const paths = new Set<string>();
  for (const tile of tiles) {
    if (!tile || tile.destroyed || getSpecialDiceFinaleFxForTile(tile) !== 'juice') continue;
    for (const path of getSpecialDiceExplosionSpriteSources(tile) || BUBBLE_SPRITE_PATHS) paths.add(path);
    for (const path of getSpecialDiceFinaleAccentSpriteSources(tile) || []) paths.add(path);
  }
  return [...paths];
}

export async function preloadLiveJuiceFinaleTextures(tiles: readonly any[], isCurrent: Current): Promise<void> {
  if (!isCurrent()) return;
  await loadJuiceFinaleTextures(getLiveJuiceFinaleTextureSources(tiles), isCurrent);
}
