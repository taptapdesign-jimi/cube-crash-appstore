import {
  getSpecialDiceFaceAnchorY,
  getSpecialDiceTexturePath,
  getSpecialDiceVisualConfig,
  usesSpecialDiceIdleBubbles,
} from './special-dice-registry.ts';
import { startSpecialDiceIdleMotion } from './special-dice-idle.ts';
import { isPlainWildStarBouncyTile } from './wild-star-bouncy-artwork.ts';
import { isWildLikeSpecial } from './final-merge-rules.ts';
import { applyGameplayTextureFiltering } from './gameplay-texture-filtering.ts';
import {
  isUsablePixiImageTexture,
  pinPixiImageTexture,
  reloadPixiImageTexture,
} from '../utils/pixi-image-texture-health.ts';
import {
  acquireVisualAssetTexture,
  getVisualAssetRendererGeneration,
  isVisualAssetTextureHandleCurrent,
  type VisualAssetTextureHandle,
} from '../utils/visual-asset-broker.ts';

type WildSkinDeps = {
  Assets: { get: (key: string) => any; load?: (key: string) => Promise<any> };
  Texture: any;
  Rectangle: any;
  ASSET_WILD: string;
  ASSET_WILD_MAGNET: string;
  ASSET_WILD_JUICE: string;
  ASSET_WILD_TNT: string;
  TILE: number;
  startWildShimmer: (tile: any) => void;
  startWildJuiceBubbles: (tile: any) => void;
  startWildStars: (tile: any, opts?: any) => void;
  startMagnetIdleParticles: (tile: any) => void;
  startTntIdleParticles: (tile: any) => void;
  startTntIdleShake: (tile: any) => void;
  stopTntIdleParticles: (tile: any) => void;
  stopTntIdleShake: (tile: any) => void;
  trackAppAnimationFrame: (fn: () => void) => any;
  devWarn: (...args: any[]) => void;
  acquireVisualAssetTexture?: (assetPath: string) => Promise<VisualAssetTextureHandle>;
  getVisualAssetRendererGeneration?: () => number;
  isVisualAssetTextureHandleCurrent?: (handle: VisualAssetTextureHandle) => boolean;
  reloadPixiImageTexture?: (assetPath: string) => Promise<any>;
};

export function applyWildSkinLocalCore(tile: any, deps: WildSkinDeps): Promise<boolean> {
  const {
    Texture,
    Rectangle,
    ASSET_WILD,
    ASSET_WILD_MAGNET,
    ASSET_WILD_JUICE,
    ASSET_WILD_TNT,
    TILE,
    startWildShimmer,
    startWildJuiceBubbles,
    startWildStars,
    startMagnetIdleParticles,
    startTntIdleParticles,
    startTntIdleShake,
    stopTntIdleParticles,
    stopTntIdleShake,
    trackAppAnimationFrame,
    devWarn,
  } = deps;
  const acquireSpecialTexture = deps.acquireVisualAssetTexture ?? acquireVisualAssetTexture;
  const getRendererGeneration = deps.getVisualAssetRendererGeneration
    ?? getVisualAssetRendererGeneration;
  const isCurrentTextureHandle = deps.isVisualAssetTextureHandleCurrent
    ?? isVisualAssetTextureHandleCurrent;
  const reloadSpecialTexture = deps.reloadPixiImageTexture ?? reloadPixiImageTexture;
  try {
    if (isWildLikeSpecial(tile.special)) {
      tile._ccWildSpecial = tile.special;
    }
    // 🔥 CRITICAL: Use appropriate texture based on special type
    // Wild-juice / wild-tnt use their own textures
    const getCurrentSpecialTexturePath = (): string => {
      let coreAssetPath = ASSET_WILD;
      if (tile.special === 'wild-magnet') {
        coreAssetPath = ASSET_WILD_MAGNET;
      } else if (tile.special === 'wild-juice') {
        coreAssetPath = ASSET_WILD_JUICE;
      } else if (tile.special === 'wild-tnt') {
        coreAssetPath = ASSET_WILD_TNT;
      }
      return getSpecialDiceTexturePath(tile, coreAssetPath);
    };
    const requestedAssetPath = getCurrentSpecialTexturePath();

    if (!tile) return Promise.resolve(false);
    const host = tile.rotG || tile;
    let base = tile.base;
    if (!base){
      base = host.children?.find((c: any) => c.texture instanceof (Texture as any)) || null;
      if (base) tile.base = base;
    }
    const specialVisual = getSpecialDiceVisualConfig(tile);
    const applySpecialHitArea = () => {
      if (specialVisual?.hitAreaSize !== 'tile') return;
      const half = TILE / 2;
      const hitArea = new Rectangle(-half, -half, TILE, TILE);
      tile.hitArea = hitArea;
      if (host) host.hitArea = hitArea;
    };
    // Input geometry belongs to the logical variant, not texture readiness.
    // Preserve it synchronously while the current safe face remains painted.
    applySpecialHitArea();
    const applyResolvedTexture = (resolvedTexture: any): boolean => {
      if (!base || tile.destroyed || !isUsablePixiImageTexture(resolvedTexture)) return false;
      pinPixiImageTexture(resolvedTexture);
      // Force set texture even if it's already set (prevents texture loss)
      base.texture = resolvedTexture;
      base.anchor?.set?.(0.5, getSpecialDiceFaceAnchorY(tile, base));
      const faceSize = tile.special === 'wild-magnet' ? TILE * 0.96 : TILE;
      if (specialVisual?.visualWidth && specialVisual?.visualHeight) {
        base.width = specialVisual.visualWidth;
        base.height = specialVisual.visualHeight;
      } else if (specialVisual?.visualFit === 'height') {
        const textureHeight = resolvedTexture?.orig?.height || resolvedTexture?.height || faceSize;
        const uniformScale = faceSize / Math.max(1, textureHeight);
        base.scale.set(uniformScale);
      } else if (specialVisual?.visualWidth) {
        const textureWidth = resolvedTexture?.orig?.width || resolvedTexture?.width || faceSize;
        const uniformScale = specialVisual.visualWidth / Math.max(1, textureWidth);
        base.scale.set(uniformScale);
      } else {
        base.width = faceSize;
        base.height = faceSize;
      }
      try {
        base.eventMode = 'none';
        base.cursor = 'default';
      } catch {}
      base.tint = 0xFFFFFF; 
      base.alpha = 1;
      base.visible = true;
      applyGameplayTextureFiltering(base.texture);
      return true;
    };

    // Never attach Texture.from(path), a raw Pixi cache hit, or a handle from a
    // retired renderer generation to a live die. Keep the tile's current safe
    // texture until the broker returns a generation-owned decoded source.
    const requestedRendererGeneration = getRendererGeneration();
    const acquireCurrentSpecialTexture = async (): Promise<VisualAssetTextureHandle | null> => {
      try {
        return await acquireSpecialTexture(requestedAssetPath);
      } catch (error) {
        // A context change owns its own fresh request. An older continuation
        // must never purge or repaint the newer generation's cache entry.
        if (
          tile.destroyed
          || getCurrentSpecialTexturePath() !== requestedAssetPath
          || getRendererGeneration() !== requestedRendererGeneration
        ) return null;
        try {
          // Preserve the previous one-shot decode recovery, but route the
          // resulting texture through the broker again before it may paint.
          await reloadSpecialTexture(requestedAssetPath);
          if (
            tile.destroyed
            || getCurrentSpecialTexturePath() !== requestedAssetPath
            || getRendererGeneration() !== requestedRendererGeneration
          ) return null;
          return await acquireSpecialTexture(requestedAssetPath);
        } catch (recoveryError) {
          devWarn('⚠️ Special dice texture source recovery failed', {
            requestedAssetPath,
            error: recoveryError,
            initialError: error,
          });
          return null;
        }
      }
    };

    const textureReady = acquireCurrentSpecialTexture().then((handle) => {
      if (!handle || tile.destroyed) return false;
      if (getCurrentSpecialTexturePath() !== requestedAssetPath) return false;
      if (!isCurrentTextureHandle(handle)) return false;
      if (!applyResolvedTexture(handle.texture)) {
        devWarn('⚠️ Special dice texture handle was not paintable', { requestedAssetPath });
        return false;
      }
      base._ccTextureAssetPath = handle.assetPath;
      base._ccVisualAssetRendererGeneration = handle.rendererGeneration;
      return true;
    }).catch((error: unknown) => {
      devWarn('⚠️ Special dice texture decode retry failed', { requestedAssetPath, error });
      return false;
    });
    
    // 🔥 CRITICAL: Hide pips and num for wild tiles
    if (tile.num) tile.num.visible = false;
    if (tile.pips) {
      tile.pips.visible = false;
      tile.pips.clear?.(); // Clear pips to prevent them from showing
    }
    tile.isWildFace = true;
    try {
      if (tile.shadow) tile.shadow.visible = false;
    } catch {}
  
    // Wild-magnet grab reliability: ensure hit area and pointer mode are solid
    if (tile.special === 'wild-magnet') {
      const hostMagnet = tile.rotG || tile;
      const hitSize = TILE * 1.10; // 🔥 INCREASED: 10% larger hit box for easier tap (was 1.05)
      const half = hitSize / 2;
      const hitArea = new Rectangle(-half, -half, hitSize, hitSize);
      tile.hitArea = hitArea;
      if (hostMagnet) hostMagnet.hitArea = hitArea;
      // 🔥 CRITICAL: Ensure eventMode is set to 'static' for touch events
      tile.eventMode = 'static';
      tile.cursor = 'pointer';
      if (hostMagnet && hostMagnet.eventMode !== 'static') {
        hostMagnet.eventMode = 'static';
        hostMagnet.cursor = 'pointer';
      }
      // 🔥 CRITICAL: Ensure all children have eventMode = 'none' to prevent blocking touch events
      if (tile.children) {
        tile.children.forEach((child: any) => {
          if (child && child !== hostMagnet) {
            try {
              child.eventMode = 'none';
              child.cursor = 'default';
              if (child.interactiveChildren !== undefined) {
                child.interactiveChildren = false;
              }
            } catch {}
          }
        });
      }
    }
  
    try {
      if ((tile as any)._ccDeferWildIdleFx === true) return textureReady;
      // The authored Star SVG owns its own masked gloss. Keep the legacy Pixi
      // shimmer for every other special, but do not run a hidden duplicate on
      // the exact generic Wild Star.
      if (!isPlainWildStarBouncyTile(tile)) startWildShimmer(tile);
      // Orbitirajuće zvjezdice SAMO za wild zvjezdicu (special === 'wild'); nikad za drugi wild
      if (usesSpecialDiceIdleBubbles(tile)) {
        // A visual variant may intentionally keep Juice idle animation while
        // reusing another gameplay archetype (Beach Ball currently uses TNT).
        stopTntIdleParticles(tile);
        stopTntIdleShake(tile);
        startWildJuiceBubbles(tile);
      } else if (tile.special === 'wild-tnt') {
        if ((tile as any)._ccDeferTntIdleFx !== true) {
          startTntIdleParticles(tile);
          startTntIdleShake(tile);
        }
      } else if (tile.special === 'wild') {
        startWildStars(tile);
      }
      // 🔥 NEW: Start magnet idle particles animation (24% intensity)
      // 🔥 CRITICAL: Start particles AFTER ensuring eventMode is set correctly
      if (tile.special === 'wild-magnet') {
        // Use requestAnimationFrame to ensure tile is fully set up before starting particles
        trackAppAnimationFrame(() => {
          try {
            startMagnetIdleParticles(tile);
          } catch (err) {
            devWarn('⚠️ Failed to start magnet idle particles:', err);
          }
        });
      }
      startSpecialDiceIdleMotion(tile);
    } catch {}
    return textureReady;
  } catch {
    return Promise.resolve(false);
  }
}
