import fs from 'node:fs';
import path from 'node:path';

const appCoreSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/modules/app-core.ts'),
  'utf8',
);

describe('merge-entry finality snapshot contract', () => {
  test('captures finality before source detachment and before the stack-only branch', () => {
    const mergeStart = appCoreSource.indexOf('function merge(src: Tile, dst: Tile');
    const mergeSource = appCoreSource.slice(mergeStart);
    const finalityCapture = mergeSource.indexOf('const lastMergeResult = handleLastMergeEarly({');
    const sourceDetach = mergeSource.indexOf('grid[src.gridY][src.gridX] = null;');
    const stackOnlyBranch = mergeSource.indexOf('if (effSum < 6){');

    expect(mergeStart).toBeGreaterThanOrEqual(0);
    expect(finalityCapture).toBeGreaterThanOrEqual(0);
    expect(finalityCapture).toBeLessThan(sourceDetach);
    expect(finalityCapture).toBeLessThan(stackOnlyBranch);
    expect(mergeSource.match(/const lastMergeResult = handleLastMergeEarly\(\{/g)).toHaveLength(1);
  });

  test('publishes one immutable snapshot consumed by delayed merge-6 resolution', () => {
    const mergeStart = appCoreSource.indexOf('function merge(src: Tile, dst: Tile');
    const mergeSource = appCoreSource.slice(mergeStart);
    const snapshotWrite = mergeSource.indexOf('(dst as any)._ccFinalMergeSnapshotAtMergeEntry = {');
    const merge6Read = mergeSource.indexOf('const capturedFinalMergeSnapshot = (dst as any)?._ccFinalMergeSnapshotAtMergeEntry;');

    expect(snapshotWrite).toBeGreaterThanOrEqual(0);
    expect(merge6Read).toBeGreaterThan(snapshotWrite);
  });

  test('blocks the delayed TNT gameplay bonus when entry snapshot is final', () => {
    expect(appCoreSource).toContain('const finalMergeOwnsTntResolution =');
    expect(appCoreSource).toContain('capturedWasFinalMerge ||');
    expect(appCoreSource).toContain("commitTntBoardForOrdinaryStacks('final-merge-no-bonus');");
    expect(appCoreSource).toContain("releaseTntTransactionWhenSettled('final-merge-no-bonus');");

    const guard = appCoreSource.indexOf('if (finalMergeOwnsTntResolution) {');
    const bonus = appCoreSource.indexOf('runTntBoomBonusBreak2Tiles({', guard);
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(bonus).toBeGreaterThan(guard);
  });

  test('fallback final guard releases merge and special owners before clean-board handoff', () => {
    const helperStart = appCoreSource.indexOf('const triggerFinalMergeCleanBoardFromMergeGuard = async');
    const helperEnd = appCoreSource.indexOf('const maybeForceCleanBoardFromSingleMerge6', helperStart);
    const helperSource = appCoreSource.slice(helperStart, helperEnd);
    const cleanupRelease = helperSource.indexOf('merge6DestinationCleanupOwner.release(dst, regularMerge6CleanupToken)');
    const spawnReset = helperSource.indexOf('resetMerge6SpawnState(`final-merge-guard:${guardReason}`');
    const specialRelease = helperSource.indexOf('releaseSpecialDiceTransaction(');
    const visualHandoff = helperSource.indexOf('prepareFinalMergeVisualHandoff(');
    const cleanBoard = helperSource.indexOf('triggerCleanBoardFlow(finalReason, { finalMergeSnapshot })');

    expect(helperStart).toBeGreaterThanOrEqual(0);
    expect(cleanupRelease).toBeGreaterThanOrEqual(0);
    expect(spawnReset).toBeGreaterThan(cleanupRelease);
    expect(specialRelease).toBeGreaterThan(spawnReset);
    expect(visualHandoff).toBeGreaterThan(specialRelease);
    expect(cleanBoard).toBeGreaterThan(visualHandoff);
    expect(helperSource).toContain('merge6SpawnOwnerToken = null');
    expect(helperSource).toContain('releaseSpecialDiceResolution(src)');
    expect(helperSource).toContain('releaseSpecialDiceResolution(dst)');
    expect(helperSource).toContain('finalMergeSnapshot,');
  });
});
