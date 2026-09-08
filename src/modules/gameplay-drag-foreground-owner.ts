import { refreshAnimatedSpecialArtworkDepth } from './animated-special-artwork-layer.ts';

let activeOwners = 0;

export type GameplayDragBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function setGameplayDragBounds(bounds: GameplayDragBounds | null): void {
  try { (window as any).__ccGameplayDragBounds = bounds; } catch {}
  try { refreshAnimatedSpecialArtworkDepth(); } catch {}
}

function syncGameplayDragForeground(): void {
  const active = activeOwners > 0;
  try { (window as any).__ccGameplayDragActive = active; } catch {}
  try { document.body?.classList.toggle('gameplay-drag-active', active); } catch {}
  try { refreshAnimatedSpecialArtworkDepth(); } catch {}
}

/**
 * Keeps the Pixi canvas above the DOM HUD for exactly the lifetime of a real
 * drag. Reference counting prevents an interrupted/stale drag manager from
 * lowering the shared canvas while a newer owner still holds the pointer.
 */
export function acquireGameplayDragForeground(): () => void {
  activeOwners += 1;
  syncGameplayDragForeground();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeOwners = Math.max(0, activeOwners - 1);
    if (activeOwners === 0) {
      try { (window as any).__ccGameplayDragBounds = null; } catch {}
    }
    syncGameplayDragForeground();
  };
}

export function getGameplayDragForegroundOwnerCount(): number {
  return activeOwners;
}
