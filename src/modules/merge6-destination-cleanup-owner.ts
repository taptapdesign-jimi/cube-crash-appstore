export const MERGE6_CLEANUP_TOKEN_KEY = '_ccMerge6CleanupToken' as const;

/**
 * Gives every non-final regular merge-6 destination an immutable cleanup owner.
 *
 * The token lives on the tile so delayed callbacks can prove they still own that
 * exact object. No tile references are retained here, which keeps board teardown
 * and interrupted animations free from registry leaks.
 */
export class Merge6DestinationCleanupOwner {
  private nextToken = 1;

  claim(tile: any): number | null {
    if (!tile || tile.destroyed) return null;

    const token = this.nextToken++;
    tile[MERGE6_CLEANUP_TOKEN_KEY] = token;

    this.protect(tile, token);

    return token;
  }

  protect(tile: any, token: number | null | undefined): boolean {
    if (!this.owns(tile, token)) return false;

    // The merge result remains visible for its impact FX, but it must never be
    // draggable while asynchronous spawn/cleanup choreography still owns it.
    tile.eventMode = 'none';
    tile.interactive = false;
    tile.interactiveChildren = false;
    tile.cursor = 'default';
    return true;
  }

  owns(tile: any, token: number | null | undefined): boolean {
    return !!tile &&
      !tile.destroyed &&
      typeof token === 'number' &&
      tile[MERGE6_CLEANUP_TOKEN_KEY] === token;
  }

  hasClaim(tile: any): boolean {
    return !!tile &&
      !tile.destroyed &&
      typeof tile[MERGE6_CLEANUP_TOKEN_KEY] === 'number';
  }

  release(tile: any, token: number | null | undefined): boolean {
    if (!this.owns(tile, token)) return false;
    delete tile[MERGE6_CLEANUP_TOKEN_KEY];
    return true;
  }

  forget(tile: any): void {
    if (!tile) return;
    delete tile[MERGE6_CLEANUP_TOKEN_KEY];
  }
}
