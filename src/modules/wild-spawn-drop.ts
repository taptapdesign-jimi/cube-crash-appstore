import { gsap } from 'gsap';
import { Assets, Sprite, Texture } from 'pixi.js';
import animationManager from './animation-manager.js';
import { ASSET_WILD, ASSET_WILD_MAGNET, ASSET_WILD_JUICE, ASSET_WILD_TNT } from './constants.js';
import { isArcadeHomeRunMode } from './run-mode.js';
import { getSpecialDiceVariantForTile, getSpecialDiceVisualConfig } from './special-dice-registry.ts';

type Point = { x: number; y: number };

type WildSpawnDropOptions = {
  app: any;
  tile: any;
  assetPath?: string;
  from: Point | null;
  tileSize: number;
  onImpact?: () => void;
};

const trackTimeline = (opts?: any) => animationManager.trackExternalTimeline(gsap.timeline(opts));

const BACKPACK_PLAYBACK_SOURCES = Array.from({ length: 20 }, (_, index) => `./assets/animations/backpack/backpack-${index + 1}.png`);
const CRATE_IN_SOURCES = Array.from({ length: 10 }, (_, index) => `./assets/animations/crate/box-${index + 1}.png`);
const CRATE_PLAYBACK_SOURCES = [...CRATE_IN_SOURCES, ...CRATE_IN_SOURCES.slice().reverse()];

const BACKPACK_ENTER_DURATION = 0.28;
const BACKPACK_FRAME_DURATION = 0.0375;
const BACKPACK_CLOSE_FRAME_DURATION = BACKPACK_FRAME_DURATION * 0.6;
const BACKPACK_FRAME_10_HOLD = 0.2;
const BACKPACK_FRAME_COUNT = BACKPACK_PLAYBACK_SOURCES.length;
const BACKPACK_WILD_REVEAL_TIME = BACKPACK_ENTER_DURATION + BACKPACK_FRAME_DURATION * 6;
const BACKPACK_WILD_POP_DURATION = 0.36;
const BACKPACK_WILD_TRAVEL_START = BACKPACK_WILD_REVEAL_TIME + BACKPACK_WILD_POP_DURATION;
const BACKPACK_SEQUENCE_END_TIME = BACKPACK_ENTER_DURATION + BACKPACK_FRAME_DURATION * 10 + BACKPACK_FRAME_10_HOLD + BACKPACK_CLOSE_FRAME_DURATION * 10;
const BACKPACK_TEXTURE_WIDTH = 379;
const CRATE_TEXTURE_WIDTH = 290;
const BACKPACK_BODY_CLASS = 'cc-wild-backpack-active';
const BACKPACK_DIVIDER_STYLE_ID = 'cc-wild-backpack-divider-mask-style';
const WILD_DROP_HANDOFF_LOCK_MS = 140;
const WILD_SPAWN_CONTAINER_Z_INDEX = 2_100_000;
const WILD_SPAWN_TILE_Z_INDEX = WILD_SPAWN_CONTAINER_Z_INDEX + 1;

let assetsPreloadPromise: Promise<void> | null = null;
const activeDropCleanups = new Set<() => void>();

function preloadWildSpawnDropAssets(): Promise<void> {
  if (assetsPreloadPromise) return assetsPreloadPromise;
  assetsPreloadPromise = Assets.load([...BACKPACK_PLAYBACK_SOURCES, ...CRATE_IN_SOURCES])
    .then(() => undefined)
    .catch(() => undefined);
  return assetsPreloadPromise;
}

function maskBoardIndicatorDividersForBackpack(): () => void {
  try {
    if (typeof document === 'undefined') return () => {};
    if (!document.getElementById(BACKPACK_DIVIDER_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = BACKPACK_DIVIDER_STYLE_ID;
      style.textContent = `
        body.${BACKPACK_BODY_CLASS} #hud-board-indicator > div:not(#hud-board-indicator-label) {
          opacity: 0 !important;
        }
      `;
      document.head.appendChild(style);
    }
    const w = window as any;
    w.__ccWildBackpackDividerMaskCount = Math.max(0, (w.__ccWildBackpackDividerMaskCount || 0) + 1);
    document.body.classList.add(BACKPACK_BODY_CLASS);
    document.getElementById('app')?.classList.add(BACKPACK_BODY_CLASS);
    return () => {
      try {
        const win = window as any;
        win.__ccWildBackpackDividerMaskCount = Math.max(0, (win.__ccWildBackpackDividerMaskCount || 0) - 1);
        if (win.__ccWildBackpackDividerMaskCount <= 0) {
          document.body.classList.remove(BACKPACK_BODY_CLASS);
          document.getElementById('app')?.classList.remove(BACKPACK_BODY_CLASS);
        }
      } catch {}
    };
  } catch {}
  return () => {};
}

function setWildSpawnDropActive(active: boolean): void {
  try {
    const w = window as any;
    const count = Math.max(0, (w.__ccWildSpawnDropActiveCount || 0) + (active ? 1 : -1));
    w.__ccWildSpawnDropActiveCount = count;
    w.__ccWildSpawnDropInProgress = count > 0;
  } catch {}
}

function getBackpackSpawnPoint(app: any, stage: any, tileSize: number): Point {
  const screen = app?.screen || app?.renderer?.screen || {};
  const width = Number(screen.width) || Number(app?.renderer?.width) || 390;
  const height = Number(screen.height) || Number(app?.renderer?.height) || 844;
  const globalPoint = {
    x: width - tileSize * 1.15,
    y: height - tileSize * 1.35 + 32,
  };
  return toParentPoint(stage, globalPoint);
}

function getBackpackWildExitPoint(backpackPoint: Point, stageScale: number): Point {
  return {
    x: backpackPoint.x - 34 * stageScale,
    y: backpackPoint.y - 96 * stageScale,
  };
}

function forceSpawnVisualAboveHud(stage: any, displayObject: any, zIndex: number): void {
  try {
    if (!stage || !displayObject || displayObject.destroyed) return;
    if (displayObject.parent !== stage) {
      try { displayObject.parent?.removeChild?.(displayObject); } catch {}
      stage.addChild(displayObject);
    }
    stage.sortableChildren = true;
    displayObject.zIndex = zIndex;
    try { stage.sortChildren?.(); } catch {}
  } catch {}
}

function createBackpackSpawn(stage: any, point: Point, tileSize: number, baseZ: number): () => void {
  let cleaned = false;
  let backpack: any = null;
  let frameTimeline: gsap.core.Timeline | null = null;
  let bounceTimeline: gsap.core.Timeline | null = null;
  const restoreBoardIndicatorDividers = maskBoardIndicatorDividersForBackpack();
  try {
    const useArcadeCrate = isArcadeHomeRunMode();
    const playbackSources = useArcadeCrate ? CRATE_PLAYBACK_SOURCES : BACKPACK_PLAYBACK_SOURCES;
    const textureWidth = useArcadeCrate ? CRATE_TEXTURE_WIDTH : BACKPACK_TEXTURE_WIDTH;
    stage.sortableChildren = true;
    const texture = Assets.get(playbackSources[0]) || Texture.from(playbackSources[0]);
    backpack = new Sprite(texture);
    backpack.label = useArcadeCrate ? 'wild-spawn-crate' : 'wild-spawn-backpack';
    backpack.eventMode = 'none';
    backpack.cursor = 'default';
    backpack.zIndex = baseZ;
    backpack.alpha = 0;
    backpack.visible = true;
    backpack.renderable = true;
    backpack.anchor?.set?.(0.5, 0.72);
    backpack.x = point.x;
    backpack.y = point.y + tileSize * 2.2;
    const rotationSign = Math.random() < 0.5 ? -1 : 1;
    const rotationDegrees = 4 + Math.random();
    const restingRotation = rotationSign * rotationDegrees * (Math.PI / 180);
    backpack.rotation = restingRotation;
    const backpackScale = ((tileSize * 2.15 * 1.15) / textureWidth) * (useArcadeCrate ? 0.95 : 1);
    backpack.scale.set(backpackScale * 0.82, backpackScale * 0.82);
    stage.addChild(backpack);
    forceSpawnVisualAboveHud(stage, backpack, baseZ);

    bounceTimeline = trackTimeline({
      onUpdate: () => forceSpawnVisualAboveHud(stage, backpack, baseZ),
    });
    bounceTimeline
      .to(backpack, { alpha: 1, duration: 0.08, ease: 'power2.out' }, 0)
      .to(backpack, { y: point.y, duration: BACKPACK_ENTER_DURATION, ease: 'back.out(2.3)' }, 0)
      .to(backpack.scale, { x: backpackScale * 1.18, y: backpackScale * 0.84, duration: 0.13, ease: 'power2.out' }, 0)
      .to(backpack.scale, { x: backpackScale * 0.9, y: backpackScale * 1.12, duration: 0.1, ease: 'power2.inOut' }, 0.11)
      .to(backpack.scale, { x: backpackScale * 1.05, y: backpackScale * 0.97, duration: 0.1, ease: 'power2.out' }, 0.2)
      .to(backpack.scale, { x: backpackScale, y: backpackScale, duration: 0.16, ease: 'elastic.out(1, 0.72)' }, 0.29);

    frameTimeline = trackTimeline();
    frameTimeline.to({}, { duration: BACKPACK_ENTER_DURATION, ease: 'none' });
    playbackSources.forEach((source, index) => {
      if (!frameTimeline) return;
      frameTimeline.call(() => {
        if (!backpack || backpack.destroyed) return;
        forceSpawnVisualAboveHud(stage, backpack, baseZ);
        backpack.texture = Assets.get(source) || Texture.from(source);
      });
      const closingStartIndex = Math.ceil(playbackSources.length / 2);
      const frameDuration = index >= closingStartIndex ? BACKPACK_CLOSE_FRAME_DURATION : BACKPACK_FRAME_DURATION;
      frameTimeline.to({}, { duration: frameDuration, ease: index >= closingStartIndex ? 'sine.inOut' : 'none' });
      if (index === 9) {
        frameTimeline.to({}, { duration: BACKPACK_FRAME_10_HOLD, ease: 'none' });
      }
    });
    frameTimeline
      .call(() => {
        if (!backpack || backpack.destroyed) return;
        backpack.texture = Assets.get(playbackSources[playbackSources.length - 1]) || Texture.from(playbackSources[playbackSources.length - 1]);
      })
      .set(backpack.scale, { x: backpackScale, y: backpackScale })
      .to(backpack.scale, { x: 0, y: 0, duration: 0.24, ease: 'back.in(2.2)' })
      .to(backpack, { alpha: 0, duration: 0.1, ease: 'power1.in' }, '>-0.2');
  } catch {}

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    activeDropCleanups.delete(cleanup);
    try { frameTimeline?.kill(); } catch {}
    try { bounceTimeline?.kill(); } catch {}
    try { gsap.killTweensOf(backpack); } catch {}
    try { gsap.killTweensOf(backpack?.scale); } catch {}
    try { restoreBoardIndicatorDividers(); } catch {}
    try {
      if (backpack?.parent) backpack.parent.removeChild(backpack);
      backpack?.destroy?.();
    } catch {}
    backpack = null;
  };
  activeDropCleanups.add(cleanup);
  trackTimeline({ onComplete: cleanup }).to({}, { duration: BACKPACK_SEQUENCE_END_TIME + 0.32 });
  return cleanup;
}

function toParentPoint(parent: any, point: Point): Point {
  try {
    if (parent && typeof parent.toLocal === 'function') {
      const local = parent.toLocal(point);
      if (local && Number.isFinite(local.x) && Number.isFinite(local.y)) {
        return { x: local.x, y: local.y };
      }
    }
  } catch {}
  return point;
}

function setTileDropInputEnabled(tile: any, enabled: boolean): void {
  try {
    if (!tile || tile.destroyed) return;
    const mode = enabled ? 'static' : 'none';
    tile.eventMode = mode;
    tile.interactive = enabled;
    tile.interactiveChildren = enabled;
    tile.cursor = enabled ? 'pointer' : 'default';
    if (tile.rotG && tile.rotG !== tile) {
      tile.rotG.eventMode = mode;
      tile.rotG.interactive = enabled;
      tile.rotG.interactiveChildren = false;
      tile.rotG.cursor = enabled ? 'pointer' : 'default';
    }
  } catch {}
}

function toGlobalPoint(container: any, point: Point): Point {
  try {
    if (container && typeof container.toGlobal === 'function') {
      const global = container.toGlobal(point);
      if (global && Number.isFinite(global.x) && Number.isFinite(global.y)) {
        return { x: global.x, y: global.y };
      }
    }
  } catch {}
  return point;
}

function getGlobalScale(container: any): number {
  try {
    const wt = container?.worldTransform;
    const sx = Number.isFinite(wt?.a) ? Math.hypot(wt.a, wt.b || 0) : Number.NaN;
    const sy = Number.isFinite(wt?.d) ? Math.hypot(wt.c || 0, wt.d) : Number.NaN;
    const scale = Number.isFinite(sx) && Number.isFinite(sy) ? (sx + sy) * 0.5 : Number.isFinite(sx) ? sx : Number.isFinite(sy) ? sy : 1;
    return Math.max(0.2, Math.min(2, scale || 1));
  } catch {}
  return 1;
}

function setTileDropScale(tile: any, sx: number, sy: number): void {
  try {
    const specialVisual = getSpecialDiceVisualConfig(tile);
    if (specialVisual?.visualWidth && specialVisual?.visualHeight) {
      const uniform = (sx + sy) * 0.5;
      tile.scale?.set?.(uniform, uniform);
      return;
    }
  } catch {}
  tile.scale?.set?.(sx, sy);
}

function isCuberoDropTile(tile: any): boolean {
  try {
    return getSpecialDiceVariantForTile(tile)?.id === 'cubero';
  } catch {}
  return false;
}

function forceDropTileAboveStage(stage: any, tile: any): void {
  forceSpawnVisualAboveHud(stage, tile, WILD_SPAWN_TILE_Z_INDEX);
}

function revealTile(tile: any): void {
  try {
    if (!tile || tile.destroyed) return;
    delete tile._ccWildSpawnDropping;
    tile.visible = true;
    tile.alpha = 1;
    setTileDropInputEnabled(tile, true);
    if (tile.rotG) tile.rotG.alpha = 1;
    if (tile.base) tile.base.alpha = 1;
    if (tile.overlay) {
      tile.overlay.alpha = 1;
      tile.overlay.visible = false;
    }
    if (tile.num) tile.num.alpha = 1;
    if (tile.pips) tile.pips.alpha = 1;
  } catch {}
}

function specialFromAssetPath(assetPath?: string): string {
  if (assetPath === ASSET_WILD_MAGNET) return 'wild-magnet';
  if (assetPath === ASSET_WILD_JUICE) return 'wild-juice';
  if (assetPath === ASSET_WILD_TNT) return 'wild-tnt';
  if (assetPath === ASSET_WILD) return 'wild';
  return 'wild';
}

function repairWildIdentity(tile: any, assetPath?: string): void {
  try {
    if (!tile || tile.destroyed) return;
    const expectedSpecial = specialFromAssetPath(assetPath);
    const currentSpecial = typeof tile.special === 'string' ? tile.special : '';
    const isKnownWild = currentSpecial === 'wild' || currentSpecial === 'wild-magnet' || currentSpecial === 'wild-juice' || currentSpecial === 'wild-tnt';
    if (isKnownWild || tile.isWild === true || tile.isWildFace === true) {
      tile.special = isKnownWild ? currentSpecial : expectedSpecial;
      tile._ccWildSpecial = tile.special;
      tile.isWild = true;
      tile.isWildFace = true;
      tile.value = 6;
      if (tile.pips) {
        tile.pips.visible = false;
        tile.pips.clear?.();
      }
      if (tile.num) tile.num.visible = false;
      if (tile.overlay) tile.overlay.visible = false;
      if (tile.shadow) tile.shadow.visible = false;
    }
  } catch {}
}

export async function animateWildSpawnDropFromMeter({
  app,
  tile,
  assetPath,
  tileSize,
  onImpact,
}: WildSpawnDropOptions): Promise<void> {
  await preloadWildSpawnDropAssets();

  return new Promise((resolve) => {
    const stage = app?.stage;
    setWildSpawnDropActive(true);
    repairWildIdentity(tile, assetPath);
    if (!stage || !tile || tile.destroyed) {
      revealTile(tile);
      setWildSpawnDropActive(false);
      resolve();
      return;
    }

    const parent = tile.parent || stage;
    const target = {
      x: Number(tile.x),
      y: Number(tile.y),
    };
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) {
      revealTile(tile);
      try {
        gsap.killTweensOf(tile.scale);
        tile.scale?.set?.(0.3, 0.3);
        trackTimeline({ onComplete: () => { setWildSpawnDropActive(false); resolve(); } })
          .to(tile.scale, { x: 1.1, y: 1.1, duration: 0.18, ease: 'back.out(2.2)' })
          .to(tile.scale, { x: 0.96, y: 0.96, duration: 0.1, ease: 'power2.inOut' })
          .to(tile.scale, { x: 1, y: 1, duration: 0.18, ease: 'elastic.out(1, 0.72)' });
      } catch {
        setWildSpawnDropActive(false);
        resolve();
      }
      return;
    }

    const stageVisualScale = getGlobalScale(parent);
    const backpackPoint = getBackpackSpawnPoint(app, stage, tileSize * stageVisualScale);
    const wildStartPoint = { x: backpackPoint.x, y: backpackPoint.y };
    if (isArcadeHomeRunMode()) {
      const arcadeCrateLiftRatio = 0.1 + 58 / Math.max(1, tileSize);
      const arcadeCrateLeftRatio = 24 / Math.max(1, tileSize);
      backpackPoint.x -= tileSize * arcadeCrateLeftRatio * stageVisualScale;
      backpackPoint.y -= tileSize * arcadeCrateLiftRatio * stageVisualScale;
      wildStartPoint.y -= tileSize * arcadeCrateLiftRatio * stageVisualScale;
    }
    const start = getBackpackWildExitPoint(wildStartPoint, stageVisualScale);
    if (isArcadeHomeRunMode()) {
      const arcadeWildStartLiftRatio = 48 / Math.max(1, tileSize);
      start.y -= tileSize * arcadeWildStartLiftRatio * stageVisualScale;
    }
    const targetGlobal = toGlobalPoint(parent, target);
    const stageTarget = toParentPoint(stage, targetGlobal);
    const originalZIndex = tile.zIndex;
    const originalRotation = tile.rotation || 0;
    const cleanupBackpackSpawn = createBackpackSpawn(
      stage,
      backpackPoint,
      tileSize * stageVisualScale,
      WILD_SPAWN_CONTAINER_Z_INDEX,
    );
    const launch = {
      x: start.x,
      y: start.y - 14 * stageVisualScale,
    };
    try {
      tile._ccWildSpawnDropping = true;
      try { gsap.killTweensOf(tile); } catch {}
      try { gsap.killTweensOf(tile.scale); } catch {}
      if (tile.parent !== stage) {
        try { tile.parent?.removeChild?.(tile); } catch {}
        stage.addChild(tile);
      }
      stage.sortableChildren = true;
	      forceDropTileAboveStage(stage, tile);
	      tile.visible = false;
	      tile.alpha = 0;
	      setTileDropInputEnabled(tile, false);
      tile.x = start.x;
      tile.y = start.y;
      tile.rotation = originalRotation + (-0.04 + Math.random() * 0.08);
      setTileDropScale(tile, stageVisualScale * 0.18, stageVisualScale * 0.18);
      if (tile.rotG) tile.rotG.alpha = 1;
      if (tile.base) tile.base.alpha = 1;
    } catch {}

    const dx = stageTarget.x - launch.x;
    const dy = stageTarget.y - launch.y;
    const arcLift = Math.max(54, Math.min(112, Math.abs(dy) * 0.16 + 38));
    const side = dx >= 0 ? 1 : -1;
    const control = {
      x: launch.x + dx * 0.48 + side * (10 + Math.random() * 12),
      y: launch.y + dy * 0.22 - arcLift,
    };
    const travel = { p: 0 };

    let completed = false;
    let spawnRevealTimeline: gsap.core.Timeline | null = null;
    let travelTimeline: gsap.core.Timeline | null = null;
    let impactTimeline: gsap.core.Timeline | null = null;
    const restoreTile = () => {
      try {
        try { spawnRevealTimeline?.kill(); } catch {}
        spawnRevealTimeline = null;
        try { travelTimeline?.kill(); } catch {}
        travelTimeline = null;
        try { impactTimeline?.kill(); } catch {}
        impactTimeline = null;
        gsap.killTweensOf(tile);
        gsap.killTweensOf(tile.scale);
        if (tile.parent !== parent) {
          try { tile.parent?.removeChild?.(tile); } catch {}
          parent.addChild(tile);
        }
        tile.x = target.x;
        tile.y = target.y;
        tile.rotation = originalRotation;
        tile.zIndex = originalZIndex;
	        tile.scale?.set?.(1, 1);
	        repairWildIdentity(tile, assetPath);
	        tile._ccWildSpawnHandoffLock = true;
	        delete tile._ccWildSpawnDropping;
	        cleanupBackpackSpawn();
	        revealTile(tile);
	        setTileDropInputEnabled(tile, false);
	        setTimeout(() => {
	          try {
	            if (!tile || tile.destroyed) return;
	            delete tile._ccWildSpawnHandoffLock;
	            setTileDropInputEnabled(tile, true);
	          } catch {}
	        }, WILD_DROP_HANDOFF_LOCK_MS);
	        setWildSpawnDropActive(false);
	      } catch {}
	    };
    const finish = () => {
      if (completed) return;
      completed = true;
      activeDropCleanups.delete(finish);
      restoreTile();
      resolve();
    };
    const completeTravel = () => {
      if (completed) return;
      completed = true;
      activeDropCleanups.delete(finish);
      setWildSpawnDropActive(false);
      resolve();
    };
    activeDropCleanups.add(finish);

    try {
      const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
      const easeInOut = (value: number) => 0.5 - Math.cos(clamp01(value) * Math.PI) * 0.5;
      const easeOutBack = (value: number, amount = 2.4) => {
        const t = clamp01(value) - 1;
        return 1 + (amount + 1) * t * t * t + amount * t * t;
      };
      const lerp = (fromValue: number, toValue: number, t: number) => fromValue + (toValue - fromValue) * t;
      const popState = { p: 0 };
      const popStartY = start.y + 16 * stageVisualScale;
      const popMidY = start.y + 2 * stageVisualScale;
      const popTopY = start.y - 24 * stageVisualScale;

      spawnRevealTimeline = trackTimeline();
      spawnRevealTimeline
        .to({}, { duration: BACKPACK_WILD_REVEAL_TIME })
        .call(() => {
          if (completed || !tile || tile.destroyed) return;
          forceDropTileAboveStage(stage, tile);
          tile.visible = true;
          tile.alpha = 0;
          tile.x = start.x;
          tile.y = popStartY;
          setTileDropScale(tile, stageVisualScale * 0.5, stageVisualScale * 0.5);
          if (tile.rotG) tile.rotG.alpha = 1;
          if (tile.base) tile.base.alpha = 1;
          if (tile.overlay) {
            tile.overlay.alpha = 1;
            tile.overlay.visible = false;
          }
          if (tile.num) tile.num.alpha = 1;
          if (tile.pips) tile.pips.alpha = 1;
        })
        .to(popState, {
          p: 1,
          duration: BACKPACK_WILD_POP_DURATION,
          ease: 'none',
          onUpdate: () => {
            if (!tile || tile.destroyed) return;
            const p = popState.p;
            tile.alpha = clamp01(p / 0.28);
            tile.x = start.x;

            let y = launch.y;
            let sx = stageVisualScale * 0.8;
            let sy = stageVisualScale * 0.8;
            if (p < 0.34) {
              const t = easeInOut(p / 0.34);
              y = lerp(popStartY, popMidY, t);
              sx = stageVisualScale * lerp(0.5, 0.62, t);
              sy = stageVisualScale * lerp(0.5, 0.58, t);
            } else if (p < 0.78) {
              const t = easeOutBack((p - 0.34) / 0.44, 2.45);
              y = lerp(popMidY, popTopY, t);
              sx = stageVisualScale * lerp(0.62, 0.9, t);
              sy = stageVisualScale * lerp(0.58, 0.82, t);
            } else {
              const t = easeInOut((p - 0.78) / 0.22);
              y = lerp(popTopY, launch.y, t);
              sx = stageVisualScale * lerp(0.9, 0.8, t);
              sy = stageVisualScale * lerp(0.82, 0.8, t);
            }

            tile.y = y;
            setTileDropScale(tile, sx, sy);
          },
          onComplete: () => {
            if (!tile || tile.destroyed) return;
            tile.alpha = 1;
            tile.x = launch.x;
            tile.y = launch.y;
            setTileDropScale(tile, stageVisualScale * 0.8, stageVisualScale * 0.8);
          },
        });
    } catch {}

    const tl = trackTimeline({
      onInterrupt: () => {
        finish();
      },
    });
    travelTimeline = tl;

    tl.to({}, {
      duration: BACKPACK_WILD_TRAVEL_START,
      ease: 'none',
      onStart: () => {
        try {
          forceDropTileAboveStage(stage, tile);
          tile.x = start.x;
          if (!tile.visible) tile.y = launch.y;
        } catch {}
      },
    });

    tl.to(travel, {
      p: 1,
      duration: 0.54,
      ease: 'power3.inOut',
      onStart: () => {
        try {
          forceDropTileAboveStage(stage, tile);
          tile.visible = true;
          tile.alpha = 1;
          if (tile.rotG) tile.rotG.alpha = 1;
          if (tile.base) tile.base.alpha = 1;
          if (tile.overlay) {
            tile.overlay.alpha = 1;
            tile.overlay.visible = false;
          }
          if (tile.num) tile.num.alpha = 1;
          if (tile.pips) tile.pips.alpha = 1;
          setTileDropScale(tile, stageVisualScale * 0.8, stageVisualScale * 0.8);
        } catch {}
      },
      onUpdate: () => {
        const p = travel.p;
        if (isCuberoDropTile(tile) && (p < 0.04 || p > 0.96)) {
          forceDropTileAboveStage(stage, tile);
        }
        const inv = 1 - p;
        tile.x = inv * inv * launch.x + 2 * inv * p * control.x + p * p * stageTarget.x;
        tile.y = inv * inv * launch.y + 2 * inv * p * control.y + p * p * stageTarget.y;
        tile.rotation = originalRotation + side * Math.sin(p * Math.PI) * 0.18;
        const arcPulse = Math.sin(p * Math.PI) * 0.04;
        const cartoonBounce = Math.sin(p * Math.PI * 7.5) * (1 - p * 0.25) * 0.075;
        const squash = Math.sin(p * Math.PI * 7.5 + Math.PI * 0.5) * (1 - p * 0.35) * 0.03;
        const spawnT = Math.min(1, p / 0.34);
        const spawnPop = Math.max(0, 1 - spawnT) * 0.1;
        const spawnBounce = Math.sin(spawnT * Math.PI * 2.25) * Math.max(0, 1 - spawnT) * 0.05;
        const sx = stageVisualScale * (1 + spawnPop + spawnBounce + arcPulse + cartoonBounce + squash);
        const sy = stageVisualScale * (1 + spawnPop * 0.68 - spawnBounce * 0.5 + arcPulse - cartoonBounce * 0.45 - squash * 0.55);
        setTileDropScale(tile, sx, sy);
      },
      onComplete: () => {
        try {
          forceDropTileAboveStage(stage, tile);
          tile.x = stageTarget.x;
          tile.y = stageTarget.y;
          forceDropTileAboveStage(stage, tile);
          repairWildIdentity(tile, assetPath);
        } catch {}
        try {
	          tile.visible = true;
	          tile.alpha = 1;
	          setTileDropInputEnabled(tile, false);
          if (tile.rotG) tile.rotG.alpha = 1;
          if (tile.base) tile.base.alpha = 1;
          if (tile.overlay) {
            tile.overlay.alpha = 1;
            tile.overlay.visible = false;
          }
          if (tile.num) tile.num.alpha = 1;
          if (tile.pips) tile.pips.alpha = 1;
        } catch {}
        try {
          setTileDropScale(tile, stageVisualScale * 0.76, stageVisualScale * 0.76);
        } catch {}
        try {
          const sortParent = tile.parent || parent;
          if (sortParent) sortParent.sortableChildren = true;
        } catch {}
        try {
          if (typeof window !== 'undefined' && typeof (window as any).triggerHapticImpact === 'function') {
            (window as any).triggerHapticImpact('medium');
          }
        } catch {}
        try { onImpact?.(); } catch {}
        forceDropTileAboveStage(stage, tile);
        impactTimeline = trackTimeline({
          onUpdate: () => {
            forceDropTileAboveStage(stage, tile);
          },
          onComplete: () => {
            repairWildIdentity(tile, assetPath);
            try {
              if (tile.parent !== parent) {
                try { tile.parent?.removeChild?.(tile); } catch {}
                parent.addChild(tile);
              }
              tile.x = target.x;
              tile.y = target.y;
              tile.rotation = originalRotation;
              tile.scale?.set?.(1, 1);
              tile.zIndex = originalZIndex;
              const sortParent = tile.parent || parent;
              if (sortParent) {
                sortParent.sortableChildren = true;
                sortParent.sortChildren?.();
              }
            } catch {}
	            tile._ccWildSpawnHandoffLock = true;
	            revealTile(tile);
	            setTileDropInputEnabled(tile, false);
	            setTimeout(() => {
	              try {
	                if (!tile || tile.destroyed) return;
	                delete tile._ccWildSpawnHandoffLock;
	                setTileDropInputEnabled(tile, true);
	              } catch {}
	            }, WILD_DROP_HANDOFF_LOCK_MS);
	            completeTravel();
          },
          onInterrupt: () => {
            finish();
          },
        });
        impactTimeline
          .to(tile.scale, { x: stageVisualScale * 1.18, y: stageVisualScale * 1.18, duration: 0.12, ease: 'back.out(3)' })
          .to(tile.scale, { x: stageVisualScale * 0.9, y: stageVisualScale * 0.9, duration: 0.07, ease: 'power2.inOut' })
          .to(tile.scale, { x: stageVisualScale * 1.06, y: stageVisualScale * 1.06, duration: 0.08, ease: 'power2.out' })
          .to(tile.scale, { x: stageVisualScale, y: stageVisualScale, duration: 0.16, ease: 'elastic.out(1, 0.7)' });
      },
    });
  });
}

export function cleanupWildSpawnDropAnimations(): void {
  const cleanups = Array.from(activeDropCleanups);
  activeDropCleanups.clear();
  cleanups.forEach((cleanup) => {
    try { cleanup(); } catch {}
  });
  try {
    (window as any).__ccWildSpawnDropActiveCount = 0;
    (window as any).__ccWildSpawnDropInProgress = false;
    (window as any).__ccWildBackpackDividerMaskCount = 0;
    document.body.classList.remove(BACKPACK_BODY_CLASS);
    document.getElementById('app')?.classList.remove(BACKPACK_BODY_CLASS);
  } catch {}
}
