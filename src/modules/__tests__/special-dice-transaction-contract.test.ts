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
    expect(appCoreSource).toContain("releaseSpecialDiceTransaction(specialTransactionToken, 'wild-magnet-board-commit')");
    const boardCommitIndex = appMergeSource.indexOf('helpers?.onMagnetBoardCommit?.()');
    const settleWaitIndex = appMergeSource.indexOf('await new Promise(resolve => trackAppTimeout(resolve, 1200))');
    expect(boardCommitIndex).toBeGreaterThan(0);
    expect(settleWaitIndex).toBeGreaterThan(boardCommitIndex);
    expect(appMergeSource).not.toContain('usedSpawnLockedTilesWithPop');
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
