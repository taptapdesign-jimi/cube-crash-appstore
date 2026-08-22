// @ts-nocheck
import { gsap } from 'gsap';
import { Container, Graphics } from 'pixi.js';
import animationManager from './animation-manager.js';
import { getSpecialDiceVariantForTile } from './special-dice-registry.ts';
import { startHoneyBeeIdleOrbit } from './honey-bee-idle-orbit.ts';

const trackTimeline = (opts: any = {}) => animationManager.trackExternalTimeline(gsap.timeline(opts));

export function stopSpecialDiceIdleMotion(tile: any): void {
  try {
    try { tile?._ccHoneyBeeIdleOrbit?.dispose?.(); } catch {}
    if (tile) delete tile._ccHoneyBeeIdleOrbit;
    const smokeTimelines = Array.isArray(tile?._ccMushroomSmokeTimelines)
      ? tile._ccMushroomSmokeTimelines
      : [];
    smokeTimelines.forEach((timeline: any) => {
      try { animationManager.killExternalTimeline(timeline); } catch {
        try { timeline.kill(); } catch {}
      }
    });
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
      delete tile._ccMushroomSmokeTimelines;
      delete tile._ccMushroomSmokeContainer;
      delete tile._ccSpecialDiceIdleHost;
      delete tile._ccSpecialDiceIdleBase;
    }
  } catch {}
}

export function setSpecialDiceIdleDragging(tile: any, dragging: boolean): boolean {
  const controller = tile?._ccHoneyBeeIdleOrbit;
  if (!controller?.setDragging) return false;
  controller.setDragging(dragging);
  return true;
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

export function startSpecialDiceIdleMotion(tile: any): void {
  try {
    const variant = getSpecialDiceVariantForTile(tile);
    if (!tile || tile.destroyed || (!variant?.idleMotion && variant?.id !== 'honey')) return;
    if (tile._ccWildSpawnDropping === true) return;

    if (variant.id === 'honey' && tile._ccHoneyBeeIdleOrbit) {
      tile._ccHoneyBeeIdleOrbit.setDragging?.(false);
      return;
    }

    stopSpecialDiceIdleMotion(tile);

    if (variant.id === 'honey') {
      tile._ccHoneyBeeIdleOrbit = startHoneyBeeIdleOrbit(tile);
      return;
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

    if (variant.idleMotion === 'mushroom-pop') {
      const smokeContainer = new Container();
      smokeContainer.label = 'mushroom-idle-smoke';
      smokeContainer.zIndex = -1;
      smokeContainer.eventMode = 'none';
      smokeContainer.sortableChildren = false;
      try { host.sortableChildren = true; } catch {}
      host.addChild(smokeContainer);
      try { host.sortChildren?.(); } catch {}
      const smokeTimelines: any[] = [];
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
        const smokeTl = trackTimeline({ repeat: -1, delay: index * 0.24, repeatDelay: 0.66 });
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
        smokeTimelines.push(smokeTl);
      }
      tile._ccMushroomSmokeContainer = smokeContainer;
      tile._ccMushroomSmokeTimelines = smokeTimelines;
    }

    const repeatDelay = variant.idleMotion === 'beach-ball-bounce'
      ? 0
      : variant.idleMotion === 'mushroom-pop'
        ? 0.72
        : 0.12;
    const tl = trackTimeline({ repeat: -1, repeatDelay });
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
