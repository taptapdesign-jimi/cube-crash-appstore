export type AnyMergePossibleFn = (tiles: any[]) => boolean;

export function shouldShowStackItHintForTiles(
  activeTiles: any[],
  anyMergePossible?: AnyMergePossibleFn
): boolean {
  if (!Array.isArray(activeTiles) || activeTiles.length < 2) return false;
  if (typeof anyMergePossible !== 'function') return false;

  const hasWild = activeTiles.some((tile: any) => (
    tile?.special === 'wild' ||
    tile?.special === 'wild-juice' ||
    tile?.special === 'wild-tnt'
  ));
  if (hasWild) return false;

  try {
    return anyMergePossible(activeTiles) === true;
  } catch {
    return false;
  }
}
