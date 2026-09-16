export type AnimatedSpecialArtworkFamily =
  | 'ball'
  | 'juice'
  | 'wild-star'
  | 'fish'
  | 'robo'
  | 'mushroom'
  | 'flower'
  | 'barell';

export type AnimatedSpecialArtworkMode = 'svg' | 'png';

type ArtworkAssignment = {
  family: AnimatedSpecialArtworkFamily;
  mode: AnimatedSpecialArtworkMode;
};

const assignments = new Map<object, ArtworkAssignment>();
const liveTilesByFamily = new Map<AnimatedSpecialArtworkFamily, Set<object>>();
const ALWAYS_ANIMATED_FAMILIES = new Set<AnimatedSpecialArtworkFamily>([
  'ball',
  'juice',
  'wild-star',
  'fish',
  'robo',
  'mushroom',
  'flower',
  'barell',
]);

function removeAssignment(tile: object, assignment: ArtworkAssignment): void {
  assignments.delete(tile);
  const familyTiles = liveTilesByFamily.get(assignment.family);
  familyTiles?.delete(tile);
  if (familyTiles?.size === 0) liveTilesByFamily.delete(assignment.family);
}

/**
 * Keeps one visual mode for the lifetime of a board tile. The first live tile
 * in each family is always animated. Current animated families keep every copy
 * on an independently phased clock. The legacy `svg` mode label remains only
 * for routing compatibility; optimized owners can render shared Pixi artwork.
 */
export function acquireAnimatedSpecialArtworkMode(
  tile: object,
  family: AnimatedSpecialArtworkFamily,
  random: () => number = Math.random,
): AnimatedSpecialArtworkMode {
  const existing = assignments.get(tile);
  if (existing?.family === family) return existing.mode;
  if (existing) removeAssignment(tile, existing);

  let familyTiles = liveTilesByFamily.get(family);
  if (!familyTiles) {
    familyTiles = new Set<object>();
    liveTilesByFamily.set(family, familyTiles);
  }
  const hasLiveSvg = Array.from(familyTiles).some(
    (liveTile) => assignments.get(liveTile)?.mode === 'svg',
  );
  const mode: AnimatedSpecialArtworkMode = !hasLiveSvg
    || ALWAYS_ANIMATED_FAMILIES.has(family)
    || random() < 0.5
    ? 'svg'
    : 'png';
  assignments.set(tile, { family, mode });
  familyTiles.add(tile);
  return mode;
}

export function getAnimatedSpecialArtworkMode(
  tile: object | null | undefined,
): AnimatedSpecialArtworkMode | null {
  if (!tile) return null;
  return assignments.get(tile)?.mode ?? null;
}

export function releaseAnimatedSpecialArtworkMode(tile: object | null | undefined): void {
  if (!tile) return;
  const assignment = assignments.get(tile);
  if (assignment) removeAssignment(tile, assignment);
}

export function releaseAnimatedSpecialArtworkFamily(
  family: AnimatedSpecialArtworkFamily,
): void {
  const familyTiles = liveTilesByFamily.get(family);
  if (!familyTiles) return;
  Array.from(familyTiles).forEach((tile) => {
    const assignment = assignments.get(tile);
    if (assignment?.family === family) assignments.delete(tile);
  });
  liveTilesByFamily.delete(family);
}

export function getAnimatedSpecialArtworkModeStats() {
  let svg = 0;
  let png = 0;
  assignments.forEach((assignment) => {
    if (assignment.mode === 'svg') svg += 1;
    else png += 1;
  });
  return {
    assignments: assignments.size,
    families: liveTilesByFamily.size,
    svg,
    png,
  };
}
