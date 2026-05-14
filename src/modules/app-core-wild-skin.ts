type WildSkinDeps = {
  Assets: { get: (key: string) => any };
  Texture: any;
  Rectangle: any;
  SCALE_MODES: any;
  ASSET_WILD: string;
  ASSET_WILD_MAGNET: string;
  ASSET_WILD_JUICE: string;
  ASSET_WILD_TNT: string;
  TILE: number;
  startWildShimmer: (tile: any) => void;
  startWildJuiceBubbles: (tile: any) => void;
  startWildStars: (tile: any) => void;
  startMagnetIdleParticles: (tile: any) => void;
  startTntIdleParticles: (tile: any) => void;
  startTntIdleShake: (tile: any) => void;
  trackAppAnimationFrame: (fn: () => void) => any;
  devWarn: (...args: any[]) => void;
};

export function applyWildSkinLocalCore(tile: any, deps: WildSkinDeps){
  const {
    Assets,
    Texture,
    Rectangle,
    SCALE_MODES,
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
    trackAppAnimationFrame,
    devWarn,
  } = deps;
  try {
    if (tile.special === 'wild' || tile.special === 'wild-magnet' || tile.special === 'wild-juice' || tile.special === 'wild-tnt') {
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
    
    const tex = Assets.get(assetPath) || Texture.from(assetPath);
    if (!tex || !tile) return;
    const host = tile.rotG || tile;
    let base = tile.base;
    if (!base){
      base = host.children?.find((c: any) => c.texture instanceof (Texture as any)) || null;
      if (base) tile.base = base;
    }
    
    // 🔥 CRITICAL: Always set wild-juice texture and ensure it's visible
    // This MUST be called every time to ensure texture is never lost
    if (base && tex && tex !== Texture.EMPTY){ 
      // Force set texture even if it's already set (prevents texture loss)
      base.texture = tex; 
      const faceSize = tile.special === 'wild-magnet' ? TILE * 0.96 : TILE;
      base.width = faceSize;
      base.height = faceSize;
      base.tint = 0xFFFFFF; 
      base.alpha = 1;
      base.visible = true;
      // Optimize texture for pixel-perfect rendering (Pixi v8: use source + 'nearest')
      const texSrc = base.texture && ((base.texture as { source?: { scaleMode?: any } }).source ?? (base.texture as { baseTexture?: { scaleMode?: any } }).baseTexture);
      if (texSrc) texSrc.scaleMode = 'nearest';
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
      if (tile.special === 'wild-juice') {
        startWildJuiceBubbles(tile);
      } else if (tile.special === 'wild-tnt') {
        startTntIdleParticles(tile);
        startTntIdleShake(tile);
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
    } catch {}
  } catch {}
}
