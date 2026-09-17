import { refreshAnimatedSpecialArtworkDepth } from './animated-special-artwork-layer.ts';

let activeOwners = 0;

/** Preserve immediate DOM artwork pose/depth refresh without unused bounds reads. */
export function refreshGameplayDragForeground(): void {
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
    syncGameplayDragForeground();
  };
}

export function getGameplayDragForegroundOwnerCount(): number {
  return activeOwners;
}
