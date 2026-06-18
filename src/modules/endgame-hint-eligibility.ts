import { isWildLikeTile } from './final-merge-rules.ts';

export type AnyMergePossibleFn = (tiles: any[]) => boolean;

export function shouldShowStackItHintForTiles(
  activeTiles: any[],
  anyMergePossible?: AnyMergePossibleFn
): boolean {
  if (!Array.isArray(activeTiles) || activeTiles.length < 2) return false;
  if (typeof anyMergePossible !== 'function') return false;

  const hasWild = activeTiles.some((tile: any) => isWildLikeTile(tile));
  if (hasWild) return false;

  try {
    return anyMergePossible(activeTiles) === true;
  } catch {
    return false;
  }
}
