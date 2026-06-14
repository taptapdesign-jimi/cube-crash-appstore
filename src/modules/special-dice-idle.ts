// @ts-nocheck
import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { getSpecialDiceVariantForTile } from './special-dice-registry.ts';

const trackTimeline = (opts: any = {}) => animationManager.trackExternalTimeline(gsap.timeline(opts));

export function stopSpecialDiceIdleMotion(tile: any): void {
  try {
    const tl = tile?._ccSpecialDiceIdleTl;
    if (tl) {
      try { tl.kill(); } catch {}
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
    }
    if (tile) {
      delete tile._ccSpecialDiceIdleHost;
      delete tile._ccSpecialDiceIdleBase;
    }
  } catch {}
}

export function startSpecialDiceIdleMotion(tile: any): void {
  try {
    const variant = getSpecialDiceVariantForTile(tile);
    if (!tile || tile.destroyed || variant?.id !== 'cubero') return;
    if (tile._ccWildSpawnDropping === true) return;

    stopSpecialDiceIdleMotion(tile);

    const host = tile.rotG || tile;
    if (!host || host.destroyed) return;
    const base = {
      x: host.x || 0,
      y: host.y || 0,
      rotation: host.rotation || 0,
      scaleX: host.scale?.x ?? 1,
      scaleY: host.scale?.y ?? 1,
    };
    tile._ccSpecialDiceIdleHost = host;
    tile._ccSpecialDiceIdleBase = base;

    const tl = trackTimeline({ repeat: -1, repeatDelay: 0.12 });
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
    tile._ccSpecialDiceIdleTl = tl;
  } catch {}
}
