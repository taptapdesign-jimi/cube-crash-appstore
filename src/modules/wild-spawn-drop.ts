import { gsap } from 'gsap';
import { Assets, Sprite, Texture } from 'pixi.js';
import animationManager from './animation-manager.js';
import { ASSET_WILD, ASSET_WILD_MAGNET, ASSET_WILD_JUICE, ASSET_WILD_TNT } from './constants.js';

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

const CLOUD_SOURCES = [
  './assets/board transition/cloud1.png',
  './assets/board transition/cloud2.png',
  './assets/board transition/cloud3.png',
  './assets/board transition/cloud4.png',
];

const WILD_REVEAL_DELAY = 0.1;
const WILD_HOLD_AT_METER = 0.3;
const WILD_TRAVEL_START = WILD_REVEAL_DELAY + WILD_HOLD_AT_METER;
const CLOUD_BOUNCE_OUT_START = 0.3;
const CLOUD_DRIFT_DURATION = 0.66;
const CLOUD_EXIT_SCALE_DURATION = 0.34;
const CLOUD_EXIT_FADE_DURATION = 0.1;
const CLOUD_CLEANUP_DELAY = 0.92;

void Assets.load(CLOUD_SOURCES).catch(() => {});

function createSpawnClouds(stage: any, point: Point, tileSize: number, baseZ: number): () => void {
  const clouds: any[] = [];
  let cleaned = false;
  try {
    stage.sortableChildren = true;
    const count = 4;
    for (let i = 0; i < count; i += 1) {
      const source = CLOUD_SOURCES[i % CLOUD_SOURCES.length];
      const texture = Assets.get(source) || Texture.from(source);
      const cloud = new Sprite(texture);
      cloud.label = 'wild-spawn-cloud';
      cloud.eventMode = 'none';
      cloud.cursor = 'default';
      cloud.zIndex = baseZ;
      cloud.alpha = 0;
      cloud.visible = true;
      cloud.renderable = true;
      cloud.anchor?.set?.(0.5);
      const side = i % 2 === 0 ? -1 : 1;
      const size = tileSize * (2.03 + Math.random() * 0.39);
      cloud.width = size;
      cloud.height = size * 0.52;
      cloud.x = point.x + side * tileSize * (0.16 + Math.random() * 0.12);
      cloud.y = point.y + (Math.random() - 0.5) * tileSize * 0.26;
      cloud.rotation = (-0.08 + Math.random() * 0.16);
      const fullScaleX = cloud.scale.x;
      const fullScaleY = cloud.scale.y;
      cloud.scale.set(fullScaleX * 0.18, fullScaleY * 0.18);
      stage.addChild(cloud);
      clouds.push(cloud);

      const driftX = side * tileSize * (0.46 + Math.random() * 0.18);
      const driftY = (Math.random() - 0.5) * tileSize * 0.18;
      const appearDelay = i * 0.035;
      trackTimeline()
        .to(cloud, { alpha: 0.78, duration: 0.14, ease: 'power2.out' }, appearDelay)
        .to(cloud.scale, { x: fullScaleX, y: fullScaleY, duration: 0.22, ease: 'back.out(2.1)' }, appearDelay)
        .to(cloud, {
          x: cloud.x + driftX,
          y: cloud.y + driftY,
          rotation: cloud.rotation + side * (0.08 + Math.random() * 0.08),
          duration: CLOUD_DRIFT_DURATION,
          ease: 'sine.inOut',
        }, appearDelay)
        .to(cloud.scale, {
          x: fullScaleX * 1.1,
          y: fullScaleY * 1.1,
          duration: 0.08,
          ease: 'power2.out',
        }, CLOUD_BOUNCE_OUT_START + appearDelay)
        .to(cloud.scale, {
          x: fullScaleX * 0.08,
          y: fullScaleY * 0.08,
          duration: CLOUD_EXIT_SCALE_DURATION,
          ease: 'back.in(2.2)',
        }, CLOUD_BOUNCE_OUT_START + 0.08 + appearDelay)
        .to(cloud.scale, {
          x: 0,
          y: 0,
          duration: 0.06,
          ease: 'power1.in',
        }, CLOUD_BOUNCE_OUT_START + 0.08 + CLOUD_EXIT_SCALE_DURATION + appearDelay)
        .to(cloud, {
          alpha: 0,
          duration: CLOUD_EXIT_FADE_DURATION,
          ease: 'power1.in',
        }, CLOUD_BOUNCE_OUT_START + 0.08 + CLOUD_EXIT_SCALE_DURATION - CLOUD_EXIT_FADE_DURATION + appearDelay);
    }
  } catch {}

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clouds.forEach((cloud) => {
      try { gsap.killTweensOf(cloud); } catch {}
      try { gsap.killTweensOf(cloud.scale); } catch {}
      try {
        if (cloud.parent) cloud.parent.removeChild(cloud);
        cloud.destroy?.();
      } catch {}
    });
    clouds.length = 0;
  };
  trackTimeline({ onComplete: cleanup }).to({}, { duration: CLOUD_CLEANUP_DELAY });
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

function revealTile(tile: any): void {
  try {
    if (!tile || tile.destroyed) return;
    delete tile._ccWildSpawnDropping;
    tile.visible = true;
    tile.alpha = 1;
    tile.eventMode = 'static';
    tile.cursor = 'pointer';
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

export function animateWildSpawnDropFromMeter({
  app,
  tile,
  assetPath,
  from,
  tileSize,
  onImpact,
}: WildSpawnDropOptions): Promise<void> {
  return new Promise((resolve) => {
    const stage = app?.stage;
    repairWildIdentity(tile, assetPath);
    if (!stage || !tile || tile.destroyed) {
      revealTile(tile);
      resolve();
      return;
    }

    const parent = tile.parent || stage;
    const target = {
      x: Number(tile.x),
      y: Number(tile.y),
    };
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y) || !from) {
      revealTile(tile);
      try {
        gsap.killTweensOf(tile.scale);
        tile.scale?.set?.(0.3, 0.3);
        trackTimeline({ onComplete: resolve })
          .to(tile.scale, { x: 1.1, y: 1.1, duration: 0.18, ease: 'back.out(2.2)' })
          .to(tile.scale, { x: 0.96, y: 0.96, duration: 0.1, ease: 'power2.inOut' })
          .to(tile.scale, { x: 1, y: 1, duration: 0.18, ease: 'elastic.out(1, 0.72)' });
      } catch {
        resolve();
      }
      return;
    }

    const start = toParentPoint(stage, from);
    const targetGlobal = toGlobalPoint(parent, target);
    const stageTarget = toParentPoint(stage, targetGlobal);
    const stageVisualScale = getGlobalScale(parent);
    const originalZIndex = tile.zIndex;
    const originalRotation = tile.rotation || 0;
    const cleanupSpawnClouds = createSpawnClouds(stage, start, tileSize * stageVisualScale, 99_999);
    try {
      tile._ccWildSpawnDropping = true;
      try { gsap.killTweensOf(tile); } catch {}
      try { gsap.killTweensOf(tile.scale); } catch {}
      if (tile.parent !== stage) {
        try { tile.parent?.removeChild?.(tile); } catch {}
        stage.addChild(tile);
      }
      stage.sortableChildren = true;
      tile.zIndex = 100_000;
      tile.visible = false;
      tile.alpha = 0;
      tile.eventMode = 'none';
      tile.cursor = 'default';
      tile.x = start.x;
      tile.y = start.y;
      tile.rotation = originalRotation + (-0.04 + Math.random() * 0.08);
      tile.scale?.set?.(stageVisualScale * 0.18, stageVisualScale * 0.18);
      if (tile.rotG) tile.rotG.alpha = 1;
      if (tile.base) tile.base.alpha = 1;
    } catch {}

    const dx = stageTarget.x - start.x;
    const dy = stageTarget.y - start.y;
    const arcLift = Math.max(54, Math.min(112, Math.abs(dy) * 0.16 + 38));
    const side = dx >= 0 ? 1 : -1;
    const control = {
      x: start.x + dx * 0.48 + side * (10 + Math.random() * 12),
      y: start.y + dy * 0.22 - arcLift,
    };
    const travel = { p: 0 };

    let completed = false;
    let spawnRevealTimeline: gsap.core.Timeline | null = null;
    const restoreTile = () => {
      try {
        try { spawnRevealTimeline?.kill(); } catch {}
        spawnRevealTimeline = null;
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
        delete tile._ccWildSpawnDropping;
        cleanupSpawnClouds();
        revealTile(tile);
      } catch {}
    };
    const finish = () => {
      if (completed) return;
      completed = true;
      restoreTile();
      resolve();
    };
    const completeTravel = () => {
      if (completed) return;
      completed = true;
      resolve();
    };

    try {
      spawnRevealTimeline = trackTimeline();
      spawnRevealTimeline
        .to({}, { duration: WILD_REVEAL_DELAY })
        .call(() => {
          if (completed || !tile || tile.destroyed) return;
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
        })
        .to(tile.scale, {
          x: stageVisualScale * 1.22,
          y: stageVisualScale * 1.08,
          duration: 0.16,
          ease: 'back.out(3.1)',
        })
        .to(tile.scale, {
          x: stageVisualScale * 0.94,
          y: stageVisualScale * 0.98,
          duration: 0.08,
          ease: 'power2.inOut',
        })
        .to(tile.scale, {
          x: stageVisualScale,
          y: stageVisualScale,
          duration: 0.2,
          ease: 'elastic.out(1, 0.72)',
        });
    } catch {}

    const tl = trackTimeline({
      onInterrupt: () => {
        finish();
      },
    });

    tl.to({}, {
      duration: WILD_TRAVEL_START,
      ease: 'none',
      onStart: () => {
        try {
          tile.x = start.x;
          tile.y = start.y;
        } catch {}
      },
      onUpdate: () => {
        try {
          tile.x = start.x;
          tile.y = start.y;
        } catch {}
      },
    });

    tl.to(travel, {
      p: 1,
      duration: 0.54,
      ease: 'power3.inOut',
      onStart: () => {
        try {
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
          tile.scale?.set?.(stageVisualScale * 1.24, stageVisualScale * 1.1);
        } catch {}
      },
      onUpdate: () => {
        const p = travel.p;
        const inv = 1 - p;
        tile.x = inv * inv * start.x + 2 * inv * p * control.x + p * p * stageTarget.x;
        tile.y = inv * inv * start.y + 2 * inv * p * control.y + p * p * stageTarget.y;
        tile.rotation = originalRotation + side * Math.sin(p * Math.PI) * 0.18;
        const arcPulse = Math.sin(p * Math.PI) * 0.04;
        const cartoonBounce = Math.sin(p * Math.PI * 7.5) * (1 - p * 0.25) * 0.075;
        const squash = Math.sin(p * Math.PI * 7.5 + Math.PI * 0.5) * (1 - p * 0.35) * 0.03;
        const spawnT = Math.min(1, p / 0.34);
        const spawnPop = Math.max(0, 1 - spawnT) * 0.24;
        const spawnBounce = Math.sin(spawnT * Math.PI * 2.25) * Math.max(0, 1 - spawnT) * 0.09;
        const sx = stageVisualScale * (1 + spawnPop + spawnBounce + arcPulse + cartoonBounce + squash);
        const sy = stageVisualScale * (1 + spawnPop * 0.68 - spawnBounce * 0.5 + arcPulse - cartoonBounce * 0.45 - squash * 0.55);
        tile.scale?.set?.(sx, sy);
      },
      onComplete: () => {
        try {
          if (tile.parent !== parent) {
            try { tile.parent?.removeChild?.(tile); } catch {}
            parent.addChild(tile);
          }
          tile.x = target.x;
          tile.y = target.y;
          tile.zIndex = originalZIndex;
          repairWildIdentity(tile, assetPath);
        } catch {}
        try {
          tile.visible = true;
          tile.alpha = 1;
          tile.eventMode = 'none';
          tile.cursor = 'default';
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
          tile.scale?.set?.(0.76, 0.76);
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
        trackTimeline({
          onComplete: () => {
            repairWildIdentity(tile, assetPath);
            revealTile(tile);
            completeTravel();
          },
          onInterrupt: () => {
            finish();
          },
        })
          .to(tile.scale, { x: 1.18, y: 1.18, duration: 0.12, ease: 'back.out(3)' })
          .to(tile.scale, { x: 0.9, y: 0.9, duration: 0.07, ease: 'power2.inOut' })
          .to(tile.scale, { x: 1.06, y: 1.06, duration: 0.08, ease: 'power2.out' })
          .to(tile.scale, { x: 1, y: 1, duration: 0.16, ease: 'elastic.out(1, 0.7)' });
      },
    });
  });
}
