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
    expect(appCoreSource).toContain('createSpecialMergeTransactionReceipt({');
    expect(appCoreSource).toContain('specialDiceTransactionOwner.attachMergeReceipt(');
  });

  test('never exposes a Special merge-6 carrier as an unowned playable six', () => {
    const finality = appCoreSource.indexOf('const isFinalMergeByResolver =');
    const universalClaim = appCoreSource.indexOf(
      'if (wildActive || !isFinalMergeByResolver) {',
      finality,
    );
    const setValue = appCoreSource.indexOf('makeBoard.setValue(dst, 6, 0)', universalClaim);
    const hideCarrier = appCoreSource.indexOf(
      "hideSpecialMerge6DestinationVisual(dst, 'special-merge6-transaction-carrier')",
      setValue,
    );

    expect(universalClaim).toBeGreaterThan(finality);
    expect(appCoreSource.slice(universalClaim, setValue)).toContain(
      'regularMerge6CleanupToken = merge6DestinationCleanupOwner.claim(dst)',
    );
    expect(hideCarrier).toBeGreaterThan(setValue);
    expect(appCoreSource).toContain('specialDiceTransactionOwner.reservePrimarySpawn(');
    expect(appCoreSource).toContain('specialDiceTransactionOwner.commitPrimarySpawn(specialPermit)');
    expect(appCoreSource).toContain('specialDiceTransactionOwner.cancelPrimarySpawn(specialPermit)');
    expect(appCoreSource).toContain('if (specialMergeTransactionReceipt?.finalMerge === true) return null;');
    expect(appCoreSource).toContain('if (specialMergeTransactionReceipt?.finalMerge === true) return false;');
    expect(appCoreSource).toContain('return openPrimarySpecialMergeCell(spawnC, spawnR, {');
    expect(appCoreSource).toContain('const ok = await openPrimarySpecialMergeCell(gx, gy, {');
    expect(appCoreSource).toContain("releaseSpecialDiceTransaction(specialTransactionToken, 'stale-special-merge6-absorb', { mode: 'abort-recovery' })");
    expect(appCoreSource).toContain("settleSpecialMergeTransaction('post-spawn-destination-cleanup')");
    expect(appCoreSource).toContain("settleSpecialMergeTransaction('primary-spawn-committed')");
    expect(appCoreSource).toContain("settleSpecialMergeTransaction('hard-fallback-primary-spawn-committed')");
    expect(appCoreSource).toContain("options: { mode?: 'settled' | 'abort-recovery' } = {}")
    expect(appCoreSource).toContain("const isAbortRecovery = options.mode === 'abort-recovery'")
    expect(appCoreSource).toContain("return releaseSpecialDiceTransaction(specialTransactionToken, reason, { mode: 'settled' })")
    expect(appCoreSource).toContain('if (specialMergeReceiptRecoveryPending) {');
    expect(appCoreSource).toContain('specialReleaseAccepted = releaseSpecialDiceTransaction(');
    expect(appCoreSource).toContain('return specialReleaseAccepted;');
    expect(appCoreSource).toContain('if (specialTransactionToken !== null && !releasedSpecialOwner)');
  });

  test('serializes external drops while preserving Magnet-owned internal merges', () => {
    expect(appCoreSource).toContain('specialDiceTransactionOwner.isActive()');
    expect(appCoreSource).toContain('!isInternalPulledTilesMerge');
    expect(appCoreSource).toContain('specialTransactionKind && !isInternalPulledTilesMerge');
    const boardCommitIndex = appMergeSource.indexOf('helpers?.onMagnetBoardCommit?.()');
    const settleWaitIndex = appMergeSource.indexOf('await waitForMagnet(1200)');
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

  test('allows every stable ordinary merge through six after Special board commit', () => {
    expect(appCoreSource).toContain('markSpecialDiceTransactionBoardCommitted(');
    expect(appCoreSource).toContain("'magnet-board-commit'");
    expect(appCoreSource).toContain("setInputGateLock('special-transaction', true, { ttlMs: 15000, scope: 'wild-only' })");
    expect(appCoreSource).toContain('canOrdinaryMergeDuringSpecialVisualTail(s, d)');
    expect(appCoreSource).toContain('canOrdinaryMergeDuringSpecialVisualTail(src, dst)');
    expect(appCoreSource).toContain('canRunOrdinaryMergeDuringVisualTail(specialDiceTransactionOwner');
    expect(appCoreSource).toContain("if (specialDiceTransactionOwner.isActive()) return 'special-transaction'");
    expect(appCoreSource).toContain('queueWildSpawnAfterGuardRelease(`special-transaction:${reason}`)');
  });

  test('abandons stale Magnet post-commit work when an ordinary merge changes the board revision', () => {
    const revisionCommitIndex = appCoreSource.indexOf(
      'gameplayBoardMutationRevision = mergeBoardMutationEpoch.boardRevision;',
    );
    const firstGridMutationIndex = appCoreSource.indexOf('grid[src.gridY][src.gridX] = null', revisionCommitIndex);
    const commitCaptureIndex = appMergeSource.indexOf('postCommitBoardRevision.capture()');
    const settleWaitIndex = appMergeSource.indexOf('await waitForMagnet(1200)', commitCaptureIndex);
    const staleCheckIndex = appMergeSource.indexOf("abortSupersededPostCommitTail('after-initial-settle')", settleWaitIndex);
    const fallbackIndex = appMergeSource.indexOf('await openMagnetCell(target.c, target.r', staleCheckIndex);
    const fallbackGuardIndex = appMergeSource.indexOf("abortSupersededPostCommitTail('before-fallback-spawn')", staleCheckIndex);
    const resolutionIndex = appMergeSource.indexOf('resolvePostMagnetEndgameAction({', staleCheckIndex);
    const resolutionGuardIndex = appMergeSource.indexOf("abortSupersededPostCommitTail('before-post-magnet-resolution')", staleCheckIndex);

    expect(revisionCommitIndex).toBeGreaterThan(0);
    expect(firstGridMutationIndex).toBeGreaterThan(revisionCommitIndex);
    expect(appCoreSource).toContain('getBoardMutationRevision: () => gameplayBoardMutationRevision');
    expect(commitCaptureIndex).toBeGreaterThan(0);
    expect(staleCheckIndex).toBeGreaterThan(settleWaitIndex);
    expect(fallbackGuardIndex).toBeGreaterThan(staleCheckIndex);
    expect(fallbackGuardIndex).toBeLessThan(fallbackIndex);
    expect(resolutionGuardIndex).toBeGreaterThan(staleCheckIndex);
    expect(resolutionGuardIndex).toBeLessThan(resolutionIndex);
    expect(appMergeSource).toContain('pendingPostGuardEndgameCheckSource = null');
    expect(appMergeSource).toContain('magnetLifecycleCancelled = true');
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
    expect(appCoreSource).not.toContain("resetMerge6SpawnState('timeout'");
    expect(appCoreSource).toContain('retaining immutable owner until settlement');
    expect(appCoreSource).toContain("releaseSpecialTransaction: specialTransactionKind !== 'tnt'");
    expect(appCoreSource).toContain('releaseSpecialDiceTransaction(specialTransactionToken, `tnt-gameplay-settled:${reason}`)');
    expect(appCoreSource).toContain('specialDiceTransactionOwner.reset();');
  });

  test('awards exactly five percent for each TNT and Beach Ball bonus impact', () => {
    expect(appCoreSource).toContain('const bonusProgressPerImpact = 0.05;');
    expect(appCoreSource).toContain('addWildProgress(bonusProgressPerImpact);');
    const bonusOwner = appCoreSource.split('function runTntBoomBonusBreak2Tiles(')[1]
      ?.split('\nfunction ', 1)[0] ?? '';
    expect(bonusOwner).not.toContain('addWildProgress(WILD_INC_BIG);');
  });

  test('TNT releases ordinary merges after reserving exact bonus tiles, before its visual tail ends', () => {
    const tntStart = appCoreSource.indexOf('let tntBonusGameplayComplete = false;');
    const sprite6Trigger = appCoreSource.indexOf("triggerTntBonusBreak('sprite-6-enter-complete')", tntStart);
    const reserveTiles = appCoreSource.indexOf('claimTntBonusTiles(toBreak)', tntStart);
    const boardCommit = appCoreSource.indexOf("commitTntBoardForOrdinaryStacks('bonus-targets-reserved')", tntStart);
    const visualComplete = appCoreSource.indexOf('tntVisibleSequenceComplete = true', tntStart);

    expect(sprite6Trigger).toBeGreaterThan(tntStart);
    expect(reserveTiles).toBeGreaterThan(tntStart);
    expect(boardCommit).toBeGreaterThan(tntStart);
    expect(boardCommit).toBeLessThan(visualComplete);
    expect(appCoreSource).toContain('releaseTntGameplayInputGate();');
    expect(appCoreSource).toContain('markSpecialDiceTransactionBoardCommitted(specialTransactionToken');
    expect(appCoreSource).toContain('!isTntBonusTileOwned(tile)');
  });

  test('blocks endgame residue recovery during the special absorb handoff', () => {
    const checkStart = appCoreSource.indexOf('function checkLevelEnd()');
    const checkOwner = appCoreSource.slice(checkStart, checkStart + 5200);
    const transactionGuard = checkOwner.indexOf('getSpecialDiceEndgameBlock(specialDiceTransactionOwner)');
    const residueSweep = checkOwner.indexOf("forceRemoveMagnetMergeResidues('checkLevelEnd')");

    expect(transactionGuard).toBeGreaterThan(-1);
    expect(residueSweep).toBeGreaterThan(transactionGuard);
    expect(checkOwner).toContain('scheduleCheckLevelEnd(0.2, `special-transaction:${specialTransactionBlock.kind}`)');
  });

  test('final special merge releases its exact token before clean-board modal ownership', () => {
    const finalBranch = appCoreSource.indexOf('if (isLastMergeFlagSet && !willPulledTilesMerge)');
    const finalRelease = appCoreSource.indexOf('`final-merge-clean-handoff:${finalMergeFx || \'regular\'}`', finalBranch);
    const cleanFlow = appCoreSource.indexOf(
      'await triggerCleanBoardFlow(finalCleanReason, {',
      finalBranch,
    );

    expect(finalBranch).toBeGreaterThan(0);
    expect(finalRelease).toBeGreaterThan(finalBranch);
    expect(cleanFlow).toBeGreaterThan(finalRelease);
  });
});
