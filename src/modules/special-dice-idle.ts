// @ts-nocheck
import { gsap } from 'gsap';
import { Assets, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import animationManager from './animation-manager.js';
import { getSpecialDiceVariantForTile } from './special-dice-registry.ts';
import { startHoneyBeeIdleOrbit } from './honey-bee-idle-orbit.ts';
import { startRoboCubeIdle } from './robo-cube-idle.ts';
import { preloadSpaceshipFinaleAssets } from './spaceship-finale-scene.ts';
import { applyGameplayTextureFiltering } from './gameplay-texture-filtering.ts';
import { startBeeDiceIdle } from './bee-dice-idle.ts';
import { preloadBeeFinaleAssets } from './bee-finale-scene.ts';
import { startKantaDiceIdle } from './kanta-dice-idle.ts';
import {
  isUsablePixiImageTexture,
  pinPixiImageTexture,
} from '../utils/pixi-image-texture-health.ts';

const trackTimeline = (opts: any = {}) => animationManager.trackExternalTimeline(gsap.timeline(opts));

const SPACESHIP_ENGINE_PARTICLE_COUNT = 9;
export const SPACESHIP_IDLE_FRAME_SECONDS = 0.18;

type SpaceshipSpriteIdleController = {
  update: (elapsedSeconds: number) => void;
  dispose: () => void;
};

export function getSpaceshipIdleFrameIndex(
  elapsedSeconds: number,
  frameCount = 4,
): number {
  const count = Math.max(1, Math.floor(frameCount));
  return Math.floor(Math.max(0, elapsedSeconds) / SPACESHIP_IDLE_FRAME_SECONDS) % count;
}

function startSpaceshipSpriteIdle(tile: any, frameSources: string[]): SpaceshipSpriteIdleController | null {
  const base = tile?.base as Sprite | null;
  if (!base || base.destroyed || frameSources.length < 2) return null;

  let disposed = false;
  let textures: Texture[] = [];
  let latestElapsedSeconds = 0;
  let paintedFrameIndex = -1;
  const originalTexture = base.texture;
  const paintedWidth = base.width;
  const paintedHeight = base.height;

  const applyFrame = () => {
    if (disposed || tile?.destroyed || base.destroyed || textures.length < 2) return;
    const frameIndex = getSpaceshipIdleFrameIndex(latestElapsedSeconds, textures.length);
    if (frameIndex === paintedFrameIndex) return;
    const texture = textures[frameIndex];
    if (!isUsablePixiImageTexture(texture)) return;
    paintedFrameIndex = frameIndex;
    base.texture = texture;
    // Every supplied frame has the same square canvas, but preserving the
    // already-painted size also guards 1x/2x source selection and tile reuse.
    base.width = paintedWidth;
    base.height = paintedHeight;
    applyGameplayTextureFiltering(base.texture);
  };

  const controller: SpaceshipSpriteIdleController = {
    update: (elapsedSeconds: number) => {
      latestElapsedSeconds = Math.max(0, elapsedSeconds);
      applyFrame();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      const ownsCurrentFrame = textures.includes(base.texture);
      textures = [];
      if (!base.destroyed && ownsCurrentFrame && originalTexture) {
        base.texture = originalTexture;
        base.width = paintedWidth;
        base.height = paintedHeight;
        applyGameplayTextureFiltering(base.texture);
      }
    },
  };

  void Promise.allSettled(frameSources.map((source) => Assets.load(source)))
    .then((results) => {
      if (disposed || tile?.destroyed || tile?._ccSpaceshipSpriteIdle !== controller) return;
      textures = results
        .filter((result): result is PromiseFulfilledResult<Texture> => result.status === 'fulfilled')
        .map((result) => result.value)
        .filter(isUsablePixiImageTexture);
      if (textures.length < 2) {
        textures = [];
        return;
      }
      textures.forEach(pinPixiImageTexture);
      applyFrame();
    });

  return controller;
}

function startSpaceshipEngineIdle(tile: any, host: any): ((elapsedSeconds: number) => void) | null {
  if (!tile || !host || host.destroyed) return null;
  const particleContainer = new Container();
  particleContainer.label = 'spaceship-idle-engine-particles';
  particleContainer.zIndex = -2;
  particleContainer.eventMode = 'none';
  particleContainer.sortableChildren = false;
  particleContainer.position.set(0, 27);
  try { particleContainer.interactiveChildren = false; } catch {}
  try { host.sortableChildren = true; } catch {}
  host.addChild(particleContainer);
  try { host.sortChildren?.(); } catch {}

  const particles = Array.from({ length: SPACESHIP_ENGINE_PARTICLE_COUNT }, (_, index) => {
    const particle = new Graphics();
    const radius = 1.45 + (index % 3) * 0.55;
    particle.circle(0, 0, radius * 1.9).fill({ color: 0x4DEBFF, alpha: 0.20 });
    particle.circle(0, 0, radius).fill({ color: index % 2 === 0 ? 0x77F4FF : 0x35CFEA, alpha: 1 });
    particle.eventMode = 'none';
    particleContainer.addChild(particle);
    return {
      particle,
      phase: index / SPACESHIP_ENGINE_PARTICLE_COUNT,
      lane: ((index % 5) - 2) * 3.2,
      drift: index % 2 === 0 ? -1 : 1,
      travel: 12 + (index % 4) * 3,
      opacity: index % 2 === 0 ? 0.60 : 0.78,
    };
  });

  const update = (elapsedSeconds: number) => {
    const progress = (Math.max(0, elapsedSeconds) % 1.8) / 1.8;
    particles.forEach((state) => {
      const local = (progress + state.phase) % 1;
      const appear = Math.min(1, local / 0.16);
      const disappear = Math.min(1, (1 - local) / 0.30);
      const visibility = Math.min(appear, disappear);
      const sideWobble = Math.sin(local * Math.PI * 2 + state.phase * Math.PI) * 2.2;
      state.particle.x = state.lane * (0.32 + local * 0.68)
        + sideWobble
        + state.drift * local * 1.8;
      state.particle.y = local * state.travel;
      state.particle.alpha = state.opacity * visibility;
      const scale = 0.72 + (1 - local) * 0.48;
      state.particle.scale.set(scale);
    });
  };
  update(0);

  tile._ccSpaceshipEngineIdleContainer = particleContainer;
  return update;
}

export function stopSpecialDiceIdleMotion(tile: any): void {
  try {
    try { tile?._ccKantaDiceIdle?.dispose?.(); } catch {}
    if (tile) delete tile._ccKantaDiceIdle;
    try { tile?._ccRoboCubeIdle?.dispose?.(); } catch {}
    if (tile) delete tile._ccRoboCubeIdle;
    try { tile?._ccHoneyBeeIdleOrbit?.dispose?.(); } catch {}
    if (tile) delete tile._ccHoneyBeeIdleOrbit;
    try { tile?._ccBeeDiceIdle?.dispose?.(); } catch {}
    if (tile) delete tile._ccBeeDiceIdle;
    try { tile?._ccSpaceshipSpriteIdle?.dispose?.(); } catch {}
    if (tile) delete tile._ccSpaceshipSpriteIdle;
    if (tile?._ccSpaceshipEngineIdleContainer) {
      try {
        tile._ccSpaceshipEngineIdleContainer.parent?.removeChild(tile._ccSpaceshipEngineIdleContainer);
        tile._ccSpaceshipEngineIdleContainer.destroy?.({ children: true });
      } catch {}
    }
    const smokeTimeline = tile?._ccMushroomSmokeTimeline;
    if (smokeTimeline) {
      try { animationManager.killExternalTimeline(smokeTimeline); } catch {
        try { smokeTimeline.kill(); } catch {}
      }
    }
    if (tile?._ccMushroomSmokeContainer) {
      try {
        tile._ccMushroomSmokeContainer.parent?.removeChild(tile._ccMushroomSmokeContainer);
        tile._ccMushroomSmokeContainer.destroy?.({ children: true });
      } catch {}
    }
    const tl = tile?._ccSpecialDiceIdleTl;
    if (tl) {
      try { animationManager.killExternalTimeline(tl); } catch {
        try { tl.kill(); } catch {}
      }
      tile._ccSpecialDiceIdleTl = null;
    }
    const host = tile?._ccSpecialDiceIdleHost || tile?.rotG || tile;
    const base = tile?._ccSpecialDiceIdleBase;
    if (host && base) {
      gsap.killTweensOf(host);
      gsap.killTweensOf(host.scale);
      host.x = base.x;
      host.y = base.y;
      host.rotation = base.rotation;
      host.scale?.set?.(base.scaleX, base.scaleY);
      if (base.anchorX !== undefined && base.anchorY !== undefined && host.anchor?.set) {
        host.anchor.set(base.anchorX, base.anchorY);
      }
    }
    if (tile) {
      delete tile._ccMushroomSmokeTimeline;
      delete tile._ccMushroomSmokeContainer;
      delete tile._ccSpaceshipEngineIdleUpdate;
      delete tile._ccSpaceshipEngineIdleContainer;
      delete tile._ccSpecialDiceIdleHost;
      delete tile._ccSpecialDiceIdleBase;
    }
  } catch {}
}

export function setSpecialDiceIdleDragging(tile: any, dragging: boolean): boolean {
  const kantaController = tile?._ccKantaDiceIdle;
  if (kantaController?.setDragging) {
    kantaController.setDragging(dragging);
    return true;
  }
  const beeController = tile?._ccBeeDiceIdle;
  if (beeController?.setDragging) {
    beeController.setDragging(dragging);
    return true;
  }
  if (keepsSpecialDiceIdleRunningDuringDrag(tile)) {
    // Spaceship animation is painted on rotG/base, below the outer tile that
    // owns pointer translation. Keeping the existing owner alive preserves
    // hover, sprite frames and engine particles while either this tile or a
    // different tile is dragged.
    if (dragging && !tile?._ccSpecialDiceIdleTl) startSpecialDiceIdleMotion(tile);
    return true;
  }
  const roboController = tile?._ccRoboCubeIdle;
  if (roboController?.setDragging) {
    roboController.setDragging(dragging);
    return true;
  }
  const controller = tile?._ccHoneyBeeIdleOrbit;
  if (!controller?.setDragging) return false;
  controller.setDragging(dragging);
  return true;
}

export function keepsSpecialDiceIdleRunningDuringDrag(tile: any): boolean {
  return getSpecialDiceVariantForTile(tile)?.idleMotion === 'spaceship-hover';
}

export function updateSpecialDiceIdleDragMotion(
  tile: any,
  offsetX: number,
  offsetY: number,
  velocityX: number,
  velocityY: number,
): void {
  tile?._ccHoneyBeeIdleOrbit?.updateDragMotion?.(offsetX, offsetY, velocityX, velocityY);
}

export function refreshSpecialDiceIdleDragFacing(tile: any): void {
  tile?._ccBeeDiceIdle?.refreshFacing?.();
}

export function startSpecialDiceIdleMotion(tile: any): void {
  try {
    const variant = getSpecialDiceVariantForTile(tile);
    if (!tile || tile.destroyed || (!variant?.idleMotion && variant?.id !== 'honey')) return;
    if (tile._ccWildSpawnDropping === true) return;

    if (variant.id === 'honey' && tile._ccHoneyBeeIdleOrbit) {
      tile._ccHoneyBeeIdleOrbit.setDragging?.(false);
      return;
    }

    if (variant.idleMotion === 'bee-sprite-cycle' && tile._ccBeeDiceIdle) return;
    if (variant.idleMotion === 'kanta-rock' && tile._ccKantaDiceIdle) return;

    // Drop/snap-back callbacks defensively call start again. Spaceship never
    // pauses for drag, so reusing its live owner avoids a visible frame reset
    // and prevents a second timeline/particle field from being created.
    if (variant.idleMotion === 'spaceship-hover' && tile._ccSpecialDiceIdleTl) return;

    stopSpecialDiceIdleMotion(tile);

    if (variant.id === 'honey') {
      tile._ccHoneyBeeIdleOrbit = startHoneyBeeIdleOrbit(tile);
      return;
    }

    if (variant.idleMotion === 'kanta-rock') {
      const idleSources = Array.isArray(variant.idleSpriteSources) ? variant.idleSpriteSources : [];
      tile._ccKantaDiceIdle = startKantaDiceIdle(tile, idleSources);
      return;
    }

    if (variant.idleMotion === 'robo-sprite-cycle') {
      const idleSources = Array.isArray(variant.idleSpriteSources) ? variant.idleSpriteSources : [];
      const finaleSources = [
        ...(Array.isArray(variant.explosionSpriteSources) ? variant.explosionSpriteSources : []),
        ...(Array.isArray(variant.finaleAccentSpriteSources) ? variant.finaleAccentSpriteSources : []),
      ];
      tile._ccRoboCubeIdle = startRoboCubeIdle(tile, idleSources, finaleSources);
      return;
    }


    if (variant.idleMotion === 'bee-sprite-cycle') {
      void preloadBeeFinaleAssets();
      const idleSources = Array.isArray(variant.idleSpriteSources) ? variant.idleSpriteSources : [];
      tile._ccBeeDiceIdle = startBeeDiceIdle(tile, idleSources);
      return;
    }

    if (variant.idleMotion === 'spaceship-hover') {
      void preloadSpaceshipFinaleAssets();
    }

    const isBottleFloat = variant.idleMotion === 'bottle-float';
    const host = isBottleFloat && tile.base?.anchor?.set ? tile.base : tile.rotG;
    if (!host || host.destroyed) return;
    const base = {
      x: host.x || 0,
      y: host.y || 0,
      rotation: host.rotation || 0,
      scaleX: host.scale?.x ?? 1,
      scaleY: host.scale?.y ?? 1,
      anchorX: host.anchor?.x,
      anchorY: host.anchor?.y,
    };
    if (isBottleFloat && host.anchor?.set) {
      const originalAnchorX = Number.isFinite(base.anchorX) ? base.anchorX : 0.5;
      const originalAnchorY = Number.isFinite(base.anchorY) ? base.anchorY : 0.5;
      const displayedWidth = Number.isFinite(host.width) ? host.width : 0;
      const displayedHeight = Number.isFinite(host.height) ? host.height : 0;
      host.anchor.set(0.5, 1);
      // Preserve the exact painted position while moving the pivot to the
      // Bottle artwork's bottom centre.
      host.x = base.x + displayedWidth * (0.5 - originalAnchorX);
      host.y = base.y + displayedHeight * (1 - originalAnchorY);
    }
    const motionBase = {
      ...base,
      x: host.x || 0,
      y: host.y || 0,
    };
    tile._ccSpecialDiceIdleHost = host;
    tile._ccSpecialDiceIdleBase = base;

    if (variant.idleMotion === 'spaceship-hover') {
      const idleSources = Array.isArray(variant.idleSpriteSources) ? variant.idleSpriteSources : [];
      tile._ccSpaceshipSpriteIdle = startSpaceshipSpriteIdle(tile, idleSources);
      tile._ccSpaceshipEngineIdleUpdate = startSpaceshipEngineIdle(tile, host);
    }

    if (variant.idleMotion === 'mushroom-pop') {
      const smokeContainer = new Container();
      smokeContainer.label = 'mushroom-idle-smoke';
      smokeContainer.zIndex = -1;
      smokeContainer.eventMode = 'none';
      smokeContainer.sortableChildren = false;
      try { host.sortableChildren = true; } catch {}
      host.addChild(smokeContainer);
      try { host.sortChildren?.(); } catch {}
      const smokeTimeline = trackTimeline({ paused: true });
      const smokeColors = [0xFFF1E5, 0xFFE1D2, 0xF7C8B7];
      for (let index = 0; index < 3; index += 1) {
        const puff = new Graphics();
        const radius = 3.4 + index * 0.75;
        puff
          .circle(-radius * 0.7, 0, radius * 0.72)
          .circle(0, -radius * 0.28, radius)
          .circle(radius * 0.78, radius * 0.04, radius * 0.66)
          .fill({ color: smokeColors[index], alpha: 1 });
        puff.x = (index - 1) * 8;
        puff.y = 11 + index * 1.5;
        puff.alpha = 0;
        puff.scale.set(0.35);
        puff.eventMode = 'none';
        smokeContainer.addChild(puff);
        const drift = (index - 1) * 4 + (index === 1 ? 2 : 0);
        const smokeTl = gsap.timeline({ repeat: -1, repeatDelay: 0.66, paused: true });
        smokeTl.set(puff, { x: (index - 1) * 8, y: 11 + index * 1.5, alpha: 0 });
        smokeTl.set(puff.scale, { x: 0.35, y: 0.35 }, '<');
        smokeTl.to(puff, {
          x: puff.x + drift,
          y: puff.y - 5,
          alpha: 0.30,
          duration: 0.22,
          ease: 'power1.out',
        });
        smokeTl.to(puff.scale, { x: 0.82, y: 0.66, duration: 0.22, ease: 'power1.out' }, '<');
        smokeTl.to(puff, {
          x: puff.x + drift * 1.5,
          y: puff.y - 11,
          alpha: 0,
          duration: 0.48,
          ease: 'sine.out',
        });
        smokeTl.to(puff.scale, { x: 1.16, y: 0.90, duration: 0.48, ease: 'sine.out' }, '<');
        smokeTimeline.add(smokeTl, index * 0.24);
        smokeTl.paused(false);
      }
      smokeTimeline.play(0);
      tile._ccMushroomSmokeContainer = smokeContainer;
      tile._ccMushroomSmokeTimeline = smokeTimeline;
    }

    const repeatDelay = variant.idleMotion === 'beach-ball-bounce'
      ? 0
      : variant.idleMotion === 'mushroom-pop'
        ? 0.72
        : 0.12;
    let tl: any = null;
    tl = trackTimeline({
      repeat: -1,
      repeatDelay,
      onUpdate: variant.idleMotion === 'spaceship-hover'
        ? () => {
          const elapsedSeconds = tl?.totalTime?.() || 0;
          tile?._ccSpaceshipEngineIdleUpdate?.(elapsedSeconds);
          tile?._ccSpaceshipSpriteIdle?.update?.(elapsedSeconds);
        }
        : undefined,
    });
    if (variant.idleMotion === 'beach-ball-bounce') {
      tl.to(host, {
        y: base.y - 8,
        rotation: base.rotation,
        duration: 0.46,
        ease: 'sine.inOut',
      });
      tl.to(host, {
        y: base.y + 2,
        rotation: base.rotation,
        duration: 0.52,
        ease: 'sine.inOut',
      });
      tl.to(host, {
        y: base.y,
        rotation: base.rotation,
        duration: 0.34,
        ease: 'sine.inOut',
      });
    } else if (variant.idleMotion === 'spaceship-hover') {
      const hoverTiltRadians = 15 * Math.PI / 180;
      tl.to(host, {
        x: motionBase.x - 5,
        y: motionBase.y - 3,
        rotation: motionBase.rotation - hoverTiltRadians,
        duration: 1.1,
        ease: 'sine.inOut',
      });
      tl.to(host, {
        x: motionBase.x + 5,
        y: motionBase.y + 3,
        rotation: motionBase.rotation + hoverTiltRadians,
        duration: 2.2,
        ease: 'sine.inOut',
      });
      tl.to(host, {
        x: motionBase.x,
        y: motionBase.y,
        rotation: motionBase.rotation,
        duration: 1.1,
        ease: 'sine.inOut',
      });
    } else if (variant.idleMotion === 'bottle-float') {
      // Keep only 20% of the former ±24° sweep. With the pivot at the bottom
      // centre this reads as a small grounded rock instead of lateral travel.
      const bottleRockRadians = 4.8 * Math.PI / 180;
      tl.to(host, {
        y: motionBase.y - 3,
        rotation: motionBase.rotation - bottleRockRadians,
        duration: 1.8,
        ease: 'sine.inOut',
      });
      tl.to(host, {
        y: motionBase.y + 2,
        rotation: motionBase.rotation + bottleRockRadians,
        duration: 3.6,
        ease: 'sine.inOut',
      });
      tl.to(host, {
        y: motionBase.y,
        rotation: motionBase.rotation,
        duration: 1.8,
        ease: 'sine.inOut',
      });
    } else if (variant.idleMotion === 'mushroom-pop') {
      tl.to(host, {
        y: base.y - 2,
        duration: 0.10,
        ease: 'power2.out',
      });
      tl.to(host.scale, {
        x: base.scaleX * 0.94,
        y: base.scaleY * 1.06,
        duration: 0.10,
        ease: 'power2.out',
      }, '<');
      tl.to(host, {
        y: base.y - 7,
        duration: 0.20,
        ease: 'sine.out',
      });
      tl.to(host.scale, {
        x: base.scaleX * 1.02,
        y: base.scaleY * 0.98,
        duration: 0.20,
        ease: 'sine.out',
      }, '<');
      tl.to(host, {
        y: base.y + 1,
        duration: 0.16,
        ease: 'power2.in',
      });
      tl.to(host.scale, {
        x: base.scaleX * 1.07,
        y: base.scaleY * 0.91,
        duration: 0.16,
        ease: 'power2.in',
      }, '<');
      tl.to(host, { y: base.y, duration: 0.22, ease: 'back.out(2.1)' });
      tl.to(host.scale, {
        x: base.scaleX,
        y: base.scaleY,
        duration: 0.22,
        ease: 'back.out(2.1)',
      }, '<');
    } else if (variant.idleMotion === 'cubero-hop') {
      tl.to(host, {
        x: base.x - 2,
        y: base.y - 1,
        rotation: base.rotation - 0.045,
        duration: 0.28,
        ease: 'sine.inOut',
      });
      tl.to(host, {
        x: base.x - 1,
        y: base.y,
        rotation: base.rotation - 0.030,
        duration: 0.08,
        ease: 'power2.out',
      });
      tl.to(host, {
        x: base.x + 2,
        y: base.y - 1,
        rotation: base.rotation + 0.045,
        duration: 0.28,
        ease: 'sine.inOut',
      });
      tl.to(host, {
        x: base.x + 1,
        y: base.y,
        rotation: base.rotation + 0.030,
        duration: 0.08,
        ease: 'power2.out',
      });
      tl.to(host, {
        x: base.x,
        y: base.y,
        rotation: base.rotation,
        duration: 0.16,
        ease: 'sine.out',
      });
    } else {
      tl.to(host, {
        y: base.y - 4,
        rotation: base.rotation + 0.006,
        duration: 0.72,
        ease: 'sine.inOut',
      });
      tl.to(host, {
        y: base.y + 1,
        rotation: base.rotation - 0.004,
        duration: 0.72,
        ease: 'sine.inOut',
      });
      tl.to(host, {
        y: base.y,
        rotation: base.rotation,
        duration: 0.56,
        ease: 'sine.inOut',
      });
    }
    tile._ccSpecialDiceIdleTl = tl;
  } catch {}
}
