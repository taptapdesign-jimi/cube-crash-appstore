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
    expect(mergeSource.slice(finalityCapture, sourceDetach)).toContain('grid,');
  });

  test('invalid authoritative ownership exits before mutation epochs or source detachment', () => {
    const mergeStart = appCoreSource.indexOf('function merge(src: Tile, dst: Tile');
    const mergeSource = appCoreSource.slice(mergeStart);
    const invalidGuard = mergeSource.indexOf("lastMergeResult.authoritativeGridStatus === 'invalid'");
    const mutationEpoch = mergeSource.indexOf('let committedMergeTransaction: CommittedGameplayTransaction');
    const sourceDetach = mergeSource.indexOf('grid[src.gridY][src.gridX] = null;');
    const guardSource = mergeSource.slice(invalidGuard, mutationEpoch);

    expect(invalidGuard).toBeGreaterThanOrEqual(0);
    expect(invalidGuard).toBeLessThan(mutationEpoch);
    expect(invalidGuard).toBeLessThan(sourceDetach);
    expect(guardSource).toContain("releaseSpecialDiceTransaction(specialTransactionToken, 'invalid-authoritative-grid-snapshot')");
    expect(guardSource).toContain('helpers.snapBack?.(src);');
    expect(guardSource).toContain('scheduleOwnedMergeRecoveryCheck');
    expect(guardSource).toContain('return;');
  });

  test('publishes one immutable snapshot consumed by delayed merge-6 resolution', () => {
    const mergeStart = appCoreSource.indexOf('function merge(src: Tile, dst: Tile');
    const mergeSource = appCoreSource.slice(mergeStart);
    const snapshotWrite = mergeSource.indexOf('(dst as any)._ccFinalMergeSnapshotAtMergeEntry = {');
    const merge6Read = mergeSource.indexOf('const capturedFinalMergeSnapshot = (dst as any)?._ccFinalMergeSnapshotAtMergeEntry;');

    expect(snapshotWrite).toBeGreaterThanOrEqual(0);
    expect(merge6Read).toBeGreaterThan(snapshotWrite);
  });

  test('commits final merge from one immutable transaction before mutating the live board', () => {
    const mergeStart = appCoreSource.indexOf('function merge(src: Tile, dst: Tile');
    const mergeSource = appCoreSource.slice(mergeStart);
    const prepare = mergeSource.indexOf('mergeGameplayTransactionOwner.prepare({');
    const commit = mergeSource.indexOf('mergeGameplayTransactionOwner.commit(prepared.transaction)');
    const revisionCommit = mergeSource.indexOf('gameplayBoardMutationRevision = mergeBoardMutationEpoch.boardRevision;');
    const sourceDetach = mergeSource.indexOf('grid[src.gridY][src.gridX] = null;');

    expect(prepare).toBeGreaterThanOrEqual(0);
    expect(commit).toBeGreaterThan(prepare);
    expect(revisionCommit).toBeGreaterThan(commit);
    expect(sourceDetach).toBeGreaterThan(revisionCommit);
    expect(mergeSource).toContain('decision: mergeEntryDecision,');
    expect(mergeSource).toContain('spawns: [],');
    expect(mergeSource).toContain('committedMergeTransaction.capabilities.presentation');
  });

  test('seals terminal completion before its visual await and gates every delayed spawn family', () => {
    const mergeStart = appCoreSource.indexOf('function merge(src: Tile, dst: Tile');
    const mergeEnd = appCoreSource.indexOf('async function checkMovesDepleted()', mergeStart);
    const mergeSource = appCoreSource.slice(mergeStart, mergeEnd);
    const finalBranch = mergeSource.indexOf('if (isLastMergeFlagSet && !willPulledTilesMerge) {');
    const terminalSeal = mergeSource.indexOf("sealMergeBoardComplete('final-merge-source-of-truth')", finalBranch);
    const visualAwait = mergeSource.indexOf('await prepareArcadeStageClearFinalMergeHandoff(', finalBranch);
    const presentationChecks = mergeSource.slice(finalBranch).match(/isMergePresentationCapabilityCurrent\(\)/g);

    expect(terminalSeal).toBeGreaterThan(finalBranch);
    expect(visualAwait).toBeGreaterThan(terminalSeal);
    expect(presentationChecks).toHaveLength(2);
    expect(mergeSource).not.toContain('await FLOW.openLockedBounceParallel({');
    expect(mergeSource).not.toMatch(/await openAtCell\(/);
    expect(mergeSource).toContain('openLockedBounceForMerge({');
    expect(mergeSource).toContain('openAtCellForMerge(');
    expect(mergeSource).toContain('hardFallbackSpawnAtCellForMerge(');
    expect(mergeSource).toContain('spawnLockedTilesWithPopForMerge(');
    expect(mergeSource).toContain('if (!commitMergeSpawnAtBoundary()) return opened;');
    expect(mergeSource).toContain('if (!commitMergeSpawnAtBoundary()) return openedForced;');
  });

  test('blocks the delayed TNT gameplay bonus when entry snapshot is final', () => {
    expect(appCoreSource).toContain('const finalMergeOwnsTntResolution =');
    expect(appCoreSource).toContain('capturedWasFinalMerge ||');
    expect(appCoreSource).toContain("commitTntBoardForOrdinaryStacks('final-merge-no-bonus');");
    expect(appCoreSource).toContain("releaseTntTransactionWhenSettled('final-merge-no-bonus');");

    const guard = appCoreSource.indexOf('if (finalMergeOwnsTntResolution) {');
    const bonus = appCoreSource.indexOf('runTntBoomBonusBreak2Tiles({', guard);
    const bonusCallEnd = appCoreSource.indexOf('});', bonus);
    const bonusCall = appCoreSource.slice(bonus, bonusCallEnd);
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(bonus).toBeGreaterThan(guard);
    expect(bonusCall).toContain('openAtCell: openAtCellForMerge,');
    expect(bonusCall).toContain('isBoardMutationCurrent: () => {');
    expect(bonusCall).toContain('commitBoardMutation: commitMergeSpawnAtBoundary,');
  });

  test('gates the delayed same-tile Laser mutation with the merge epoch', () => {
    const impact = appCoreSource.indexOf('return commitLaserGunTileImpact({');
    const impactEnd = appCoreSource.indexOf('});', impact);
    const impactCall = appCoreSource.slice(impact, impactEnd);

    expect(impact).toBeGreaterThanOrEqual(0);
    expect(impactCall).toContain('isCurrent: () => laserGunRunGeneration === gameplayRunGeneration');
    expect(impactCall).toContain('commitMutation: commitBoardMutation');
  });

  test('rejects a stale TNT replacement before removing its reserved tile', () => {
    const helperStart = appCoreSource.indexOf('function runTntBoomBonusBreak2Tiles(');
    const replaceStart = appCoreSource.indexOf('const replaceTile = () => {', helperStart);
    const remove = appCoreSource.indexOf('removeTile(tile);', replaceStart);
    const currentGuard = appCoreSource.indexOf('if (!isBoardMutationCurrent()) {', replaceStart);
    const guardedOpen = appCoreSource.indexOf('openAtCell(c, r, { value: val, skipBind: false })', replaceStart);

    expect(helperStart).toBeGreaterThanOrEqual(0);
    expect(currentGuard).toBeGreaterThan(replaceStart);
    expect(currentGuard).toBeLessThan(remove);
    expect(guardedOpen).toBeGreaterThan(remove);
  });

  test('routes final LaserGun through the presentation-only no-target owner', () => {
    const guard = appCoreSource.indexOf('if (finalMergeOwnsTntResolution) {');
    const guardEnd = appCoreSource.indexOf('runTntBoomBonusBreak2Tiles({', guard);
    const finalGuardSource = appCoreSource.slice(guard, guardEnd);
    const fakeOut = finalGuardSource.indexOf('playActiveLaserGunNoTarget(');
    const boardCommit = finalGuardSource.indexOf("commitTntBoardForOrdinaryStacks('final-merge-no-bonus')");

    expect(finalGuardSource).toContain("tntVariantForMerge?.id === 'laser-gun'");
    expect(finalGuardSource).toContain('getTntTileDomScreenPos(board, dst)');
    expect(finalGuardSource).toContain('if (!fakeOutStarted) completeActiveLaserGunFinaleImpacts();');
    expect(finalGuardSource).not.toContain('planLaserGunCrossfireTargets(');
    expect(finalGuardSource).not.toContain('setActiveLaserGunFinaleTargets(');
    expect(fakeOut).toBeGreaterThanOrEqual(0);
    expect(boardCommit).toBeGreaterThan(fakeOut);
  });

  test('uses ZAPED OUT for final LaserGun or any LaserGun with zero eligible regular targets', () => {
    const targetDecisionStart = appCoreSource.indexOf('const laserGunTargetsAtMergeEntry =');
    const optionsStart = appCoreSource.indexOf('const tntAnimationOptionsForMerge = {');
    const optionsEnd = appCoreSource.indexOf('const tntFramesReadyForMerge =', optionsStart);
    const targetDecisionSource = appCoreSource.slice(targetDecisionStart, optionsStart);
    const animationOptionsSource = appCoreSource.slice(optionsStart, optionsEnd);

    expect(targetDecisionSource).toContain('getEligibleTntBonusTargets(');
    expect(targetDecisionSource).toContain('[src, dst]');
    expect(targetDecisionSource).toContain('shouldUseLaserGunNoTargetPresentation({');
    expect(targetDecisionSource).toContain('isFinalMerge: isFinalMergeByResolver');
    expect(targetDecisionSource).toContain('eligibleTargetCount: laserGunTargetsAtMergeEntry.length');
    expect(animationOptionsSource).toContain('usesLaserGunNoTargetPresentation');
    expect(animationOptionsSource).toContain('text: LASERGUN_NO_TARGET_TEXT');
    expect(animationOptionsSource).toContain('laserGunNoTarget: true');
  });

  test('routes a non-final zero-target LaserGun merge through the same fake-out owner', () => {
    const handoffStart = appCoreSource.indexOf("onTargetsSelected: tntVariantForMerge?.id === 'laser-gun'");
    const handoffEnd = appCoreSource.indexOf('onBoardCommitted:', handoffStart);
    const handoffSource = appCoreSource.slice(handoffStart, handoffEnd);

    expect(handoffSource).toContain('targets.length === 0 && usesLaserGunNoTargetPresentation');
    expect(handoffSource).toContain('playActiveLaserGunNoTarget(');
    expect(handoffSource).toContain("return fakeOutStarted ? 'painted' : 'cancelled';");
    expect(handoffSource).toContain('return setActiveLaserGunFinaleTargets(targets);');
  });

  test('fallback final guard releases merge and special owners before clean-board handoff', () => {
    const helperStart = appCoreSource.indexOf('const triggerFinalMergeCleanBoardFromMergeGuard = async');
    const helperEnd = appCoreSource.indexOf('const maybeForceCleanBoardFromSingleMerge6', helperStart);
    const helperSource = appCoreSource.slice(helperStart, helperEnd);
    const cleanupRelease = helperSource.indexOf('merge6DestinationCleanupOwner.release(dst, regularMerge6CleanupToken)');
    const spawnReset = helperSource.indexOf('resetMerge6SpawnState(`final-merge-guard:${guardReason}`');
    const specialRelease = helperSource.indexOf('releaseSpecialDiceTransaction(');
    const visualHandoff = helperSource.indexOf('prepareFinalMergeVisualHandoff(');
    const cleanBoard = helperSource.indexOf('triggerCleanBoardFlow(finalReason, {');

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
    expect(helperSource).toContain('boardMutationEpoch: mergeBoardMutationEpoch,');
  });
});
