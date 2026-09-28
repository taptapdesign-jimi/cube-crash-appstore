import { UPDATE_PRIORITY } from 'pixi.js';
import { STATE } from './app-state.ts';
import { retireFailedSpecialTickerOwner } from './special-ticker-error.ts';

/** Check the motion host, not base.renderable: direct art deliberately hides base. */
export function isSpecialDiceIdlePaintable(tile: any): boolean {
  if (!tile || (typeof document !== 'undefined' && document.hidden)) return false;
  // Screen owners write these explicit presentation styles. Reading inline
  // state avoids a per-die computed-style/layout query on every frame.
  for (let element: HTMLElement | null = STATE.app?.canvas ?? null; element; element = element.parentElement) {
    if (element.hidden || element.style.display === 'none' || element.style.visibility === 'hidden') return false;
    if (element.style.opacity !== '' && Number(element.style.opacity) <= 0.001) return false;
  }
  for (let current = tile.rotG || tile; current; current = current.parent) {
    if (current.destroyed || current.visible === false || current.renderable === false) return false;
    if (typeof current.alpha === 'number' && current.alpha <= 0.001) return false;
  }
  // Some compatibility/test tiles expose rotG without a real parent link.
  return !tile.destroyed && tile.visible !== false && tile.renderable !== false
    && !(typeof tile.alpha === 'number' && tile.alpha <= 0.001);
}

type VisibilityOwner = (paintable: boolean) => void;
type TileOwners = { owners: Map<VisibilityOwner, (() => void) | undefined>; paintable: boolean };
const tiles = new Map<any, TileOwners>();
let ticker: any = null;
const VISIBILITY_RECONCILE_INTERVAL_MS = 250;
let visibilityElapsedMs = 0;

function releaseRuntimeIfUnused(): void {
  if (tiles.size) return;
  try { ticker?.remove(updateIdleVisibility); } catch {}
  ticker = null;
  visibilityElapsedMs = 0;
  document.removeEventListener('visibilitychange', updateIdleVisibility);
}

function retireVisibilityOwner(tile: any, entry: TileOwners, owner: VisibilityOwner, error: unknown): void {
  const cleanup = entry.owners.get(owner);
  entry.owners.delete(owner);
  if (!entry.owners.size && tiles.get(tile) === entry) tiles.delete(tile);
  retireFailedSpecialTickerOwner('idle-visibility', error, () => cleanup?.());
}

function notifyVisibilityOwner(tile: any, entry: TileOwners, owner: VisibilityOwner, paintable: boolean): void {
  try { owner(paintable); }
  catch (error) { retireVisibilityOwner(tile, entry, owner, error); }
}

function reconcileIdleVisibility(): void {
  tiles.forEach((entry, tile) => {
    try {
      const paintable = isSpecialDiceIdlePaintable(tile);
      if (entry.paintable !== paintable) {
        entry.paintable = paintable;
        entry.owners.forEach((_cleanup, owner) => notifyVisibilityOwner(tile, entry, owner, paintable));
      }
      if (tile.destroyed) tiles.delete(tile);
    } catch (error) {
      entry.owners.forEach((_cleanup, owner) => retireVisibilityOwner(tile, entry, owner, error));
    }
  });
  releaseRuntimeIfUnused();
}

function updateIdleVisibility(tickerOrEvent?: any): void {
  const rawElapsed = Number(tickerOrEvent?.elapsedMS);
  if (Number.isFinite(rawElapsed) && rawElapsed >= 0) {
    visibilityElapsedMs += Math.min(100, rawElapsed);
    if (visibilityElapsedMs < VISIBILITY_RECONCILE_INTERVAL_MS) return;
    visibilityElapsedMs %= VISIBILITY_RECONCILE_INTERVAL_MS;
  } else {
    // Browser visibility events and explicit test/owner refreshes reconcile
    // immediately. Only the shared Pixi sampling path is cadence-bounded.
    visibilityElapsedMs = 0;
  }
  reconcileIdleVisibility();
}

/** One check per tile on the existing app ticker; no per-owner timer or RAF. */
export function watchSpecialDiceIdleVisibility(tile: any, owner: VisibilityOwner, onFailure?: () => void) {
  if (!tiles.size) document.addEventListener('visibilitychange', updateIdleVisibility);
  let entry = tiles.get(tile);
  if (!entry) {
    entry = { owners: new Map(), paintable: isSpecialDiceIdlePaintable(tile) };
    tiles.set(tile, entry);
  }
  entry.owners.set(owner, onFailure);
  const nextTicker = STATE.app?.ticker;
  if (nextTicker && ticker !== nextTicker) {
    ticker?.remove(updateIdleVisibility);
    ticker = nextTicker;
    ticker.add(updateIdleVisibility, undefined, UPDATE_PRIORITY.HIGH);
  }
  let released = false;
  notifyVisibilityOwner(tile, entry, owner, entry.paintable);
  releaseRuntimeIfUnused();
  return {
    refresh: () => {
      if (released || tiles.get(tile) !== entry || !entry!.owners.has(owner)) return false;
      try {
        const paintable = isSpecialDiceIdlePaintable(tile);
        notifyVisibilityOwner(tile, entry!, owner, paintable);
        return entry!.owners.has(owner) && paintable;
      } catch (error) {
        retireVisibilityOwner(tile, entry!, owner, error);
        return false;
      } finally { releaseRuntimeIfUnused(); }
    },
    release: () => {
      if (released) return;
      released = true;
      entry!.owners.delete(owner);
      if (!entry!.owners.size && tiles.get(tile) === entry) tiles.delete(tile);
      releaseRuntimeIfUnused();
    },
  };
}

type IdleAnimation = {
  paused(): boolean;
  pause(): unknown;
  resume(): unknown;
  kill?(): unknown;
  eventCallback?(name: string, callback?: (...args: any[]) => void): any;
};

/** Suspend only animations this feature was running; retain their playheads. */
export function createSpecialIdleAnimationVisibility(tile: any, canResume = () => true) {
  const animations = new Set<IdleAnimation>();
  const suspended = new Set<IdleAnimation>();
  const retireAnimations = () => {
    animations.forEach(animation => { try { animation.kill?.(); } catch {} });
    animations.clear();
    suspended.clear();
  };
  let paintable = true;
  const visibility = watchSpecialDiceIdleVisibility(tile, next => {
    paintable = next;
    animations.forEach(animation => {
      try {
        if (!next && !animation.paused()) {
          suspended.add(animation);
          animation.pause();
        } else if (next && canResume() && suspended.delete(animation)) {
          animation.resume();
        }
      } catch (error) {
        animations.delete(animation);
        suspended.delete(animation);
        retireFailedSpecialTickerOwner('idle-animation-visibility', error, () => animation.kill?.());
      }
    });
  }, retireAnimations);
  return {
    track<T extends IdleAnimation>(animation: T): T {
      if (animations.has(animation)) return animation;
      animations.add(animation);
      for (const name of ['onComplete', 'onInterrupt']) {
        const previous = animation.eventCallback?.(name);
        animation.eventCallback?.(name, function (...args: any[]) {
          animations.delete(animation);
          suspended.delete(animation);
          previous?.apply(this, args);
        });
      }
      if (!paintable && !animation.paused()) {
        suspended.add(animation);
        animation.pause();
      }
      return animation;
    },
    forget(animation: IdleAnimation): void {
      animations.delete(animation);
      suspended.delete(animation);
    },
    refresh: visibility.refresh,
    release(): void {
      visibility.release();
      animations.clear();
      suspended.clear();
    },
  };
}

export function getSpecialDiceIdleVisibilityStats() {
  return { tiles: tiles.size, owners: [...tiles.values()].reduce((sum, entry) => sum + entry.owners.size, 0), tickerAttached: ticker !== null };
}
