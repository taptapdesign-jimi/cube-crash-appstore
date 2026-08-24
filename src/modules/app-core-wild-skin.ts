import {
  getSpecialDiceTexturePath,
  getSpecialDiceVisualConfig,
  isSpecialDiceJuiceLikeTile,
} from './special-dice-registry.ts';
import { startSpecialDiceIdleMotion } from './special-dice-idle.ts';
import { isWildLikeSpecial } from './final-merge-rules.ts';
import { applyGameplayTextureFiltering } from './gameplay-texture-filtering.ts';
import {
  isUsablePixiImageTexture,
  pinPixiImageTexture,
  reloadPixiImageTexture,
} from '../utils/pixi-image-texture-health.ts';

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
};

export function applyWildSkinLocalCore(tile: any, deps: WildSkinDeps){
  const {
    Assets,
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
  try {
    if (isWildLikeSpecial(tile.special)) {
      tile._ccWildSpecial = tile.special;
    }
    // 🔥 CRITICAL: Use appropriate texture based on special type
    // Wild-juice / wild-tnt use their own textures
    let assetPath = ASSET_WILD;
    if (tile.special === 'wild-magnet') {
      assetPath = ASSET_WILD_MAGNET;
    } else if (tile.special === 'wild-juice') {
      assetPath = ASSET_WILD_JUICE;
    } else if (tile.special === 'wild-tnt') {
      assetPath = ASSET_WILD_TNT;
    }
    assetPath = getSpecialDiceTexturePath(tile, assetPath);
    const requestedAssetPath = assetPath;

    if (!tile) return;
    const host = tile.rotG || tile;
    let base = tile.base;
    if (!base){
      base = host.children?.find((c: any) => c.texture instanceof (Texture as any)) || null;
      if (base) tile.base = base;
    }
    const specialVisual = getSpecialDiceVisualConfig(tile);
    const applyResolvedTexture = (resolvedTexture: any): boolean => {
      if (!base || tile.destroyed || !isUsablePixiImageTexture(resolvedTexture)) return false;
      pinPixiImageTexture(resolvedTexture);
      // Force set texture even if it's already set (prevents texture loss)
      base.texture = resolvedTexture;
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
      if (specialVisual?.hitAreaSize === 'tile') {
        const half = TILE / 2;
        const hitArea = new Rectangle(-half, -half, TILE, TILE);
        tile.hitArea = hitArea;
        if (host) host.hitArea = hitArea;
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

    // Never attach Texture.from(path)'s unresolved placeholder to a live Pixi
    // sprite. Pixi 8 may invalidate that placeholder's source after a failed or
    // superseded load, and the batch renderer then crashes while reading uid or
    // alphaMode. Keep the tile's current safe texture until a decoded source is
    // available.
    applyResolvedTexture(Assets.get(requestedAssetPath));
    if (specialVisual && typeof Assets.load === 'function') {
      void Assets.load(requestedAssetPath).then((loadedTexture: any) => {
        if (tile.destroyed) return;
        if (getSpecialDiceTexturePath(tile, '') !== requestedAssetPath) return;
        const resolvedTexture = loadedTexture || Assets.get(requestedAssetPath);
        if (!applyResolvedTexture(resolvedTexture)) {
          void reloadPixiImageTexture(requestedAssetPath).then((reloadedTexture) => {
            if (tile.destroyed) return;
            if (getSpecialDiceTexturePath(tile, '') !== requestedAssetPath) return;
            applyResolvedTexture(reloadedTexture);
          }).catch((error: unknown) => {
            devWarn('⚠️ Special dice texture source recovery failed', { requestedAssetPath, error });
          });
        }
      }).catch((error: unknown) => {
        devWarn('⚠️ Special dice texture decode retry failed', { requestedAssetPath, error });
      });
    }
    
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
      if ((tile as any)._ccDeferWildIdleFx === true) return;
      startWildShimmer(tile); // Use shimmer instead of bounce
      // Orbitirajuće zvjezdice SAMO za wild zvjezdicu (special === 'wild'); nikad za drugi wild
      if (isSpecialDiceJuiceLikeTile(tile)) {
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
  } catch {}
}
