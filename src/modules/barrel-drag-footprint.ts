// Match the Beach Ball's 128px resting contact footprint while the visible
// Barrel artwork stays at its requested smaller size.
export const BARREL_FOOTPRINT_SCALE = 1;

export function getBarrelDragFootprint(
  center: { x: number; y: number },
  tileSize: number,
  scaleX = 1,
  scaleY = 1,
) {
  const w = tileSize * BARREL_FOOTPRINT_SCALE * Math.abs(scaleX);
  const h = tileSize * BARREL_FOOTPRINT_SCALE * Math.abs(scaleY);
  return { x: center.x - w / 2, y: center.y - h / 2, w, h };
}
