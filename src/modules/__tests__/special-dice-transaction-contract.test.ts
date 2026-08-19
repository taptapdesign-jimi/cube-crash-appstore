import fs from 'node:fs';
import path from 'node:path';

const appCoreSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/modules/app-core.ts'),
  'utf8',
);
const appMergeSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/modules/app-merge.ts'),
  'utf8',
);

describe('shared special-dice transaction contract', () => {
  test('claims immutable ownership before the first grid mutation', () => {
    const claimIndex = appCoreSource.indexOf('specialTransactionToken = beginSpecialDiceTransaction');
    const firstGridMutationIndex = appCoreSource.indexOf('grid[src.gridY][src.gridX] = null', claimIndex);

    expect(claimIndex).toBeGreaterThan(0);
    expect(firstGridMutationIndex).toBeGreaterThan(claimIndex);
    expect(appCoreSource).toContain('if (active.token !== token)');
    expect(appCoreSource).not.toContain('releaseActiveSpecialDiceTransaction');
  });

  test('serializes external drops while preserving Magnet-owned internal merges', () => {
    expect(appCoreSource).toContain('specialDiceTransactionOwner.isActive() && !isInternalPulledTilesMerge');
    expect(appCoreSource).toContain('specialTransactionKind && !isInternalPulledTilesMerge');
    const boardCommitIndex = appMergeSource.indexOf('helpers?.onMagnetBoardCommit?.()');
    const settleWaitIndex = appMergeSource.indexOf('await new Promise(resolve => trackAppTimeout(resolve, 1200))');
    const handlerAwaitIndex = appCoreSource.indexOf('await handleWildMagnetMergedPulledTiles(mergeLocation, validTiles, helpersWithMerge)');
    const finalReleaseIndex = appCoreSource.indexOf("releaseSpecialDiceTransaction(specialTransactionToken, 'wild-magnet-handler-complete-fallback')");
    const boardCommitCallbackStart = appCoreSource.indexOf('onMagnetBoardCommit: () =>');
    const boardCommitCallbackEnd = appCoreSource.indexOf('};', boardCommitCallbackStart);
    const boardCommitCallback = appCoreSource.slice(boardCommitCallbackStart, boardCommitCallbackEnd);
    expect(boardCommitIndex).toBeGreaterThan(0);
    expect(settleWaitIndex).toBeGreaterThan(boardCommitIndex);
    expect(handlerAwaitIndex).toBeGreaterThan(0);
    expect(finalReleaseIndex).toBeGreaterThan(handlerAwaitIndex);
    expect(boardCommitCallback).not.toContain('releaseSpecialDiceTransaction');
    expect(appMergeSource).not.toContain('usedSpawnLockedTilesWithPop');
  });

  test('starts Magnet meter progress at validated pull commit, before its visual tail', () => {
    const validationIndex = appMergeSource.indexOf('if (!dst || dst.destroyed)');
    const progressCommitIndex = appMergeSource.indexOf('helpers?.onMagnetPullCommitted?.({ pulledTileCount })');
    const pulledTileRemovalIndex = appMergeSource.indexOf('validTiles.forEach((tile: any, index: number) =>');
    expect(progressCommitIndex).toBeGreaterThan(validationIndex);
    expect(pulledTileRemovalIndex).toBeGreaterThan(progressCommitIndex);
    expect(appCoreSource).toContain('onMagnetPullCommitted: () =>');
    expect(appCoreSource).toContain('if (magnetPullProgressCommitted) return;');
    expect(appCoreSource).toContain('addWildProgress(WILD_INC_BIG, { confirmedNonFinal: true });');
  });

  test('releases Magnet/Honey ownership after every rollback and abort path', () => {
    expect(appCoreSource).toContain("'wild-magnet-commit-validation-abort'");
    expect(appCoreSource).toContain("'wild-magnet-not-enough-valid-tiles'");
    expect(appCoreSource).toContain("'wild-magnet-merge-error-rollback'");
    expect(appCoreSource).toContain("'wild-magnet-multiplier-callback-error-rollback'");
    expect(appCoreSource).toContain("'wild-magnet-timeout-fallback-rollback'");
    expect(appCoreSource).toContain("emitIOSSpecialTransactionTrace('magnet-merge-error'");
  });

  test('releases from board completion, never the short legacy timeout or Flower visual tail', () => {
    expect(appCoreSource).toContain("resetMerge6SpawnState('timeout', { releaseSpecialTransaction: false })");
    expect(appCoreSource).toContain("releaseSpecialTransaction: specialTransactionKind !== 'tnt'");
    expect(appCoreSource).toContain('releaseSpecialDiceTransaction(specialTransactionToken, `tnt-gameplay-settled:${reason}`)');
    expect(appCoreSource).toContain('specialDiceTransactionOwner.reset();');
  });
});
