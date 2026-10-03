import { Assets, type Texture } from 'pixi.js';
import {
  isUsablePixiImageTexture,
  pinPixiImageTexture,
  reloadPixiImageTexture,
} from './pixi-image-texture-health.js';

export type VisualAssetTextureHandle = Readonly<{
  assetPath: string;
  rendererGeneration: number;
  texture: Texture;
}>;

export class StaleVisualAssetGenerationError extends Error {
  readonly assetPath: string;
  readonly requestedGeneration: number;
  readonly currentGeneration: number;

  constructor(assetPath: string, requestedGeneration: number, currentGeneration: number) {
    super(
      `Visual asset resolved for stale renderer generation: ${assetPath} `
      + `(requested ${requestedGeneration}, current ${currentGeneration})`,
    );
    this.name = 'StaleVisualAssetGenerationError';
    this.assetPath = assetPath;
    this.requestedGeneration = requestedGeneration;
    this.currentGeneration = currentGeneration;
  }
}

type InFlightAcquisition = {
  rendererGeneration: number;
  promise: Promise<VisualAssetTextureHandle>;
};

/**
 * Owns image-backed Pixi texture acquisition across WebGL renderer generations.
 *
 * Pixi can retain a resolved loader/cache entry whose dimensions still look
 * valid after WebKit has discarded its GPU pixels. After a generation change,
 * the first borrow of every path therefore performs the public unload/reload
 * sequence. Requests for the same path/generation share that work, and a newer
 * generation waits for older in-flight work before touching the same cache key.
 */
export class VisualAssetBroker {
  private rendererGeneration = 0;
  private lastInvalidationReason = 'initial';
  private readonly healthyGenerationByAsset = new Map<string, number>();
  private readonly inFlightByAsset = new Map<string, InFlightAcquisition>();

  getRendererGeneration(): number {
    return this.rendererGeneration;
  }

  getLastInvalidationReason(): string {
    return this.lastInvalidationReason;
  }

  invalidateRendererGeneration(reason: string): number {
    this.rendererGeneration += 1;
    this.lastInvalidationReason = reason || 'unspecified';
    return this.rendererGeneration;
  }

  isHandleCurrent(handle: VisualAssetTextureHandle | null | undefined): boolean {
    return !!handle
      && handle.rendererGeneration === this.rendererGeneration
      && this.healthyGenerationByAsset.get(handle.assetPath) === this.rendererGeneration
      && isUsablePixiImageTexture(handle.texture);
  }

  acquireTexture(assetPath: string): Promise<VisualAssetTextureHandle> {
    if (!assetPath) return Promise.reject(new Error('Visual asset path is required'));

    const requestedGeneration = this.rendererGeneration;
    const existing = this.inFlightByAsset.get(assetPath);
    if (existing?.rendererGeneration === requestedGeneration) return existing.promise;

    const priorWork = existing?.promise;
    let acquisition!: InFlightAcquisition;
    const promise = (async () => {
      // Assets.unload/load must not race an older load for the same cache key.
      if (priorWork) {
        try { await priorWork; } catch {}
      }

      const requiresGenerationReload = requestedGeneration > 0
        && this.healthyGenerationByAsset.get(assetPath) !== requestedGeneration;
      const texture = requiresGenerationReload
        ? await reloadPixiImageTexture(assetPath)
        : await Assets.load<Texture>(assetPath);

      if (!isUsablePixiImageTexture(texture)) {
        throw new Error(`Visual asset is not render-ready: ${assetPath}`);
      }
      if (requestedGeneration !== this.rendererGeneration) {
        throw new StaleVisualAssetGenerationError(
          assetPath,
          requestedGeneration,
          this.rendererGeneration,
        );
      }

      pinPixiImageTexture(texture);
      this.healthyGenerationByAsset.set(assetPath, requestedGeneration);
      return { assetPath, rendererGeneration: requestedGeneration, texture };
    })().finally(() => {
      if (this.inFlightByAsset.get(assetPath) === acquisition) {
        this.inFlightByAsset.delete(assetPath);
      }
    });

    acquisition = { rendererGeneration: requestedGeneration, promise };
    this.inFlightByAsset.set(assetPath, acquisition);
    return promise;
  }

  resetForTests(): void {
    this.rendererGeneration = 0;
    this.lastInvalidationReason = 'initial';
    this.healthyGenerationByAsset.clear();
    this.inFlightByAsset.clear();
  }
}

export const visualAssetBroker = new VisualAssetBroker();

export const acquireVisualAssetTexture = (assetPath: string): Promise<VisualAssetTextureHandle> => (
  visualAssetBroker.acquireTexture(assetPath)
);

export const invalidateVisualAssetRendererGeneration = (reason: string): number => (
  visualAssetBroker.invalidateRendererGeneration(reason)
);

export const getVisualAssetRendererGeneration = (): number => (
  visualAssetBroker.getRendererGeneration()
);

export const isVisualAssetTextureHandleCurrent = (
  handle: VisualAssetTextureHandle | null | undefined,
): boolean => visualAssetBroker.isHandleCurrent(handle);
