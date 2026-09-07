import { gsap } from 'gsap';

/** Release board-enter ownership without retaining an interrupted tween frame. */
export function settleBoardPopInTileTransform(tile: any): void {
  if (!tile || tile.destroyed) return;
  try { gsap.killTweensOf(tile); } catch {}
  try { gsap.killTweensOf(tile.scale); } catch {}
  tile.visible = true;
  tile.renderable = true;
  if (tile.scale?.set) tile.scale.set(1, 1);
  else if (tile.scale) {
    tile.scale.x = 1;
    tile.scale.y = 1;
  }
  if (tile.locked) tile.alpha = tile.value > 0 ? 0 : 0.25;
  else tile.alpha = 1;
  if (tile.rotG && !tile.rotG.destroyed) tile.rotG.alpha = 1;
  if (tile.base && !tile.base.destroyed) tile.base.alpha = 1;
  if (tile.overlay && !tile.overlay.destroyed) {
    tile.overlay.alpha = 1;
    tile.overlay.visible = false;
  }
  if (tile.num && !tile.num.destroyed) tile.num.alpha = 1;
  if (tile.pips && !tile.pips.destroyed) tile.pips.alpha = 1;
}
