export interface DragShadowPose {
  x: number;
  y: number;
}

export interface DragShadowAppearance {
  alpha: number;
  scale: number;
  strength: number;
}

export function resolveDragShadowRevealDistance(
  directionX: number,
  directionY: number,
  tileSize: number,
): number {
  if (![directionX, directionY, tileSize].every(Number.isFinite) || tileSize <= 0) {
    return 0;
  }

  // Match the original generated-shadow motion: a small, nearly constant
  // displacement whose direction comes from the already low-pass-filtered
  // drag velocity. The PNG must not accumulate travel or orbit independently.
  return Math.hypot(directionX, directionY) > 0 ? tileSize * 0.10 : 0;
}

export function resolveDragShadowAppearance(
  _directionX: number,
  _directionY: number,
  tilt: number,
  maximumTilt = 0.16,
): DragShadowAppearance {
  // Keep the authored PNG quiet. The old Graphics shadow changed direction,
  // not opacity, with speed; only tilt may add a very small uniform lift.
  const tiltStrength = Number.isFinite(tilt) && Number.isFinite(maximumTilt) && maximumTilt > 0
    ? Math.max(0, Math.min(1, Math.abs(tilt) / maximumTilt))
    : 0;
  const strength = tiltStrength;
  return {
    alpha: 0.18,
    scale: 1 + (0.08 * strength),
    strength,
  };
}

export function resolveTiltedTileVisualCenter(tilt: number, tileSize: number): DragShadowPose {
  if (!Number.isFinite(tilt) || !Number.isFinite(tileSize) || tileSize <= 0) {
    return { x: 0, y: 0 };
  }
  const halfTile = tileSize * 0.5;
  return {
    x: -Math.sin(tilt) * halfTile,
    y: -halfTile + (Math.cos(tilt) * halfTile),
  };
}

export function resolveDragShadowPose(directionX: number, directionY: number, distance: number): DragShadowPose {
  const length = Math.hypot(directionX, directionY);
  if (!Number.isFinite(length) || length <= 0 || !Number.isFinite(distance)) {
    return { x: 0, y: 0 };
  }

  return {
    x: (directionX / length) * distance,
    y: (directionY / length) * distance,
  };
}
