import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

describe('Arcade terminal lifecycle regression contract', () => {
  test('fresh Round is saved before reveal and retried after the settled cube entrance', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core.ts'), 'utf8');
    const rebuild = source.slice(source.indexOf('function rebuildBoard(){'), source.indexOf('// Board exit animation', source.indexOf('function rebuildBoard(){')));
    const prepared = rebuild.indexOf('saveArcadeRoundAfterEntry({');
    const reveal = rebuild.indexOf('revealPreparedGameplaySurface();', prepared);
    const settled = rebuild.indexOf('sweetPopPromise.then(() => {');
    const hudFinal = rebuild.indexOf('handleSweetPopInComplete({', settled);
    const checkpoint = rebuild.indexOf('saveArcadeRoundAfterEntry({', settled);
    expect(settled).toBeGreaterThan(-1);
    expect(prepared).toBeGreaterThan(-1);
    expect(prepared).toBeLessThan(reveal);
    expect(reveal).toBeLessThan(settled);
    expect(rebuild.slice(prepared, reveal)).toContain('freshArcadeEntry: true');
    expect(checkpoint).toBeGreaterThan(hudFinal);
    expect(rebuild.slice(checkpoint)).toContain('readSavedRound: getArcadeSavedRound');
  });

  test('accepted Arcade Continue receipt is consulted before loading the old saved board', () => {
    const ui = fs.readFileSync(path.join(repoRoot, 'src/modules/ui-manager.ts'), 'utf8');
    const endgame = fs.readFileSync(path.join(repoRoot, 'src/modules/endgame-flow.ts'), 'utf8');
    const modal = fs.readFileSync(path.join(repoRoot, 'src/modules/arcade-stage-clear-modal.ts'), 'utf8');
    const receipt = ui.indexOf('const pendingRound = getPendingArcadeRound();');
    const oldLoad = ui.indexOf('const loadGameState = (window as any).loadGameState;', receipt);
    expect(endgame).toContain('setPendingArcadeRound(nextStage, currentScore, receiptOwnerId);');
    expect(endgame).toContain('showArcadeStageClearModal(clearedStage, nextStage, recordNextRound)');
    expect(endgame).toContain('if (nextRoundReceiptWritten) clearPendingArcadeRound(receiptOwnerId);');
    const receiptBeforeCard = modal.indexOf('onNextRoundPresented?.();');
    const cardEnter = modal.indexOf('await playRoundNumberPhase(parts, nextStage, isCurrent, fadeOutArcadeStageClearCelebrationSounds);', receiptBeforeCard);
    expect(receiptBeforeCard).toBeGreaterThan(-1);
    expect(cardEnter).toBeGreaterThan(receiptBeforeCard);
    expect(receipt).toBeGreaterThan(-1);
    expect(oldLoad).toBeGreaterThan(receipt);
    expect(ui.slice(receipt, oldLoad)).toContain('__ccStartAtLevel = pendingRound.round');
    expect(ui.slice(receipt, oldLoad)).toContain('await bootGame();');
  });

  test('cancel during the clear hold retires the cue before receipt or newer-modal cleanup', () => {
    const modal = fs.readFileSync(path.join(repoRoot, 'src/modules/arcade-stage-clear-modal.ts'), 'utf8');
    const clearPhase = modal.slice(modal.indexOf('async function playClearPhase('), modal.indexOf('function animateBottomHudStageIndicator('));
    const hold = clearPhase.indexOf('await wait(500);');
    const guard = clearPhase.indexOf('if (!isCurrent()) return;', hold);
    const exit = clearPhase.indexOf('const exitTimeline = gsap.timeline();', hold);
    expect(hold).toBeGreaterThan(-1);
    expect(guard).toBeGreaterThan(hold);
    expect(guard).toBeLessThan(exit);
    const show = modal.slice(modal.indexOf('export async function showArcadeStageClearModal('), modal.indexOf('export async function showArcadeContinuationRoundCue('));
    expect(show).toContain('ownerGeneration === stageClearOwnerGeneration');
    expect(show).toContain('if (!isCurrent()) return;\n        // The next-Round receipt');
    expect(show).toContain('if (isCurrent()) {\n          cleanupArcadeStageClearModal(false);');
    expect(modal).toContain('stageClearOwnerGeneration += 1;');
    const continuation = modal.slice(modal.indexOf('export async function showArcadeContinuationRoundCue('), modal.indexOf('export function cancelArcadeStageClearModal('));
    expect(continuation).toContain('await playRoundNumberPhase(parts, resumedStage, isCurrent);');
    expect(continuation).toContain('if (isCurrent()) {\n      emitNativeConsoleDiagnostic');
  });

  test('cleanup settles every killed Stage Clear animation wait', () => {
    const modal = fs.readFileSync(path.join(repoRoot, 'src/modules/arcade-stage-clear-modal.ts'), 'utf8');
    const helper = modal.slice(
      modal.indexOf('function waitForOwnedCompletion('),
      modal.indexOf('function wait(ms: number)'),
    );
    const cleanup = modal.slice(modal.indexOf('export function cleanupArcadeStageClearModal('));

    expect(helper).toContain('activeAsyncSettlers.add(settle);');
    expect(helper).toContain('activeAsyncSettlers.delete(settle);');
    expect(cleanup).toContain('const pendingAsyncSettlers = Array.from(activeAsyncSettlers);');
    expect(cleanup).toContain('activeAsyncSettlers.clear();');
    expect(cleanup).toContain('pendingAsyncSettlers.forEach((settle) =>');

    // The only raw Promises left are the shared owned-completion helper and
    // the public modal result. Animation/decode waits must use the helper so
    // killing GSAP work cannot strand their async continuations.
    expect(modal.match(/new Promise/g)).toHaveLength(2);
    expect(modal.match(/waitForOwnedCompletion\(/g)?.length).toBeGreaterThanOrEqual(8);
  });

  test('Magnet commit abort rolls back ownership and schedules the central endgame check', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core.ts'), 'utf8');
    expect(source).toContain('const magnetMergeCommitted = await handleWildMagnetMergedPulledTiles');
    expect(source).toContain('if (!magnetMergeCommitted)');
    expect(source).toContain("setWildMagnetPullInProgress(false, 'commit-validation-abort')");
    expect(source).toContain("scheduleCheckLevelEnd(0.18, 'wild-magnet-commit-validation-abort')");
    const commitCallback = source.indexOf('onMagnetPullCommitted: () =>');
    const committedProgress = source.indexOf('if (shouldAddWildProgress)', commitCallback);
    const mergeAwait = source.indexOf('const magnetMergeCommitted = await handleWildMagnetMergedPulledTiles', commitCallback);
    expect(commitCallback).toBeGreaterThan(-1);
    expect(committedProgress).toBeGreaterThan(commitCallback);
    expect(committedProgress).toBeLessThan(mergeAwait);
    expect(source.slice(mergeAwait, source.indexOf('return;', mergeAwait))).not.toContain('addWildProgress(');
  });

  test('Arcade startLevel cannot write into Journey progression', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core.ts'), 'utf8');
    const start = source.indexOf('function startLevel(');
    const end = source.indexOf('function rebuildBoard(', start);
    const startLevelSource = source.slice(start, end);
    expect(startLevelSource).toContain('if (isArcadeHomeRunMode())');
    expect(startLevelSource).toContain('updateJourneyRunState({ n, score, devLog, devWarn });');
    expect(startLevelSource).toContain('if (!isArcadeHomeRunMode()) {\n    syncJourneyBoards');
  });

  test('terminal handoff force-cleans protected stars and summary skips a completed board exit', () => {
    const handoff = fs.readFileSync(path.join(repoRoot, 'src/modules/game-over-animation-handoff.ts'), 'utf8');
    const modal = fs.readFileSync(path.join(repoRoot, 'src/modules/clean-board-modal.ts'), 'utf8');
    expect(handoff).toContain('fxModule.forceCleanupAllStarAnimations?.()');
    expect(modal).toContain("arcadeRunReached && (window as any).__ccGameOverBoardExitComplete === true");
  });

  test('Round 02+ summary keeps the overlay mounted through the complete modal exit', () => {
    const modal = fs.readFileSync(path.join(repoRoot, 'src/modules/clean-board-modal.ts'), 'utf8');
    const appCore = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core.ts'), 'utf8');
    const endgame = fs.readFileSync(path.join(repoRoot, 'src/modules/endgame-flow.ts'), 'utf8');
    const secondaryStart = modal.indexOf('addButtonPressHandling(secondaryBtn, async () =>');
    const secondaryEnd = modal.indexOf("}, 'secondary');", secondaryStart);
    const exitOwner = modal.slice(secondaryStart, secondaryEnd);

    expect(exitOwner).toContain('const ctaExitPromise = exitCtaPair(secondaryBtn, primaryBtn);');
    expect(exitOwner).toContain('const boardExitCompletePromise = boardExitPromise.catch');
    expect(exitOwner).toContain('const modalExitPromise = Promise.all([');
    expect(exitOwner).toContain('const starExitDuration = 500 + Math.max(0, numStars - 1) * 70;');
    expect(exitOwner).toContain('const cardExitDuration = starExitDuration + 650;');
    expect(exitOwner).toContain('const collapseDuration = Math.max(');
    expect(exitOwner.indexOf('const exitCompletion = await Promise.race(['))
      .toBeLessThan(exitOwner.indexOf('try { el.remove(); } catch {}'));
    expect(exitOwner).not.toContain('boardExitPromise.then(() => {\n          trackTimeout(() => {');
    expect(exitOwner).toContain('trackAnimationFrame(() => {');
    expect(exitOwner).toContain('trackTimeout(resolveModalExit, collapseDuration + 300);');
    expect(exitOwner).toContain('const exitCompletion = await Promise.race([');
    expect(exitOwner).toContain('navigationAbortPromise.then(() => ({');
    expect(exitOwner).toContain('if (!exitCompletion.completed) return;');
    expect(exitOwner).toContain('safeResolve(exitAction, {');
    expect(exitOwner).toContain('(window as any).__ccTerminalExitInProgress = true;');
    expect(modal).toContain('delete (window as any).__ccTerminalExitInProgress;');

    const visibilityStart = modal.indexOf("lifecycle.trackListener(document, 'visibilitychange'");
    const visibilityEnd = modal.indexOf("lifecycle.trackListener(window, 'beforeunload'", visibilityStart);
    const visibilityOwner = modal.slice(visibilityStart, visibilityEnd);
    expect(visibilityOwner).toContain("overlay?.getAttribute('data-clean-board-exiting') === 'true'");
    expect(visibilityOwner.indexOf("overlay?.getAttribute('data-clean-board-exiting') === 'true'"))
      .toBeLessThan(visibilityOwner.indexOf('clearAllModalTimeouts()'));

    // All modal completion branches must detach their per-session navigation
    // listener through safeResolve; the one raw resolve belongs to that helper.
    expect(modal.match(/resolve\(\{ action/g)).toHaveLength(1);

    const boardExitStart = appCore.indexOf('async function animateBoardExit()');
    const boardExitEnd = appCore.indexOf('// 🔥 v112: tintLocked', boardExitStart);
    expect(appCore.slice(boardExitStart, boardExitEnd)).not.toContain('animationManager.killAll()');

    const commonCleanupStart = appCore.indexOf('function killAllGsapTweensCommon');
    const commonCleanupEnd = appCore.indexOf('function logBoardExitStats', commonCleanupStart);
    const commonCleanup = appCore.slice(commonCleanupStart, commonCleanupEnd);
    expect(commonCleanup).not.toContain('animationManager.killAll()');
    expect(commonCleanup).not.toContain("gsap.killTweensOf('p')");
    expect(commonCleanup).not.toContain("gsap.killTweensOf('progress')");
    expect(commonCleanup).not.toContain("gsap.killTweensOf('ratio')");

    const preNextCleanupStart = endgame.indexOf('async function performPreNextBoardCleanup');
    const preNextCleanupEnd = endgame.indexOf('async function', preNextCleanupStart + 20);
    expect(endgame.slice(preNextCleanupStart, preNextCleanupEnd)).not.toContain('.killAll()');
  });

  test('Arcade Stage continuation has one awaited reset and layout owner', () => {
    const endgame = fs.readFileSync(path.join(repoRoot, 'src/modules/endgame-flow.ts'), 'utf8');
    const appCore = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core.ts'), 'utf8');
    const layoutHelper = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core-startlevel-layout.ts'), 'utf8');
    const stageModal = fs.readFileSync(path.join(repoRoot, 'src/modules/arcade-stage-clear-modal.ts'), 'utf8');
    const arcadeStart = endgame.indexOf('if (arcadeStageClearMode) {');
    const arcadeEnd = endgame.indexOf('runJourneyCompletionFlow', arcadeStart);
    const arcadeOwner = endgame.slice(arcadeStart, arcadeEnd);

    expect(arcadeOwner).toContain('await startLevel(nextStage);');
    expect(arcadeOwner).not.toContain("softResetBoardView?.('arcade-stage-clear')");
    expect(arcadeOwner).not.toContain("cleanupFxForBoardReset?.('arcade-stage-clear')");
    expect(arcadeOwner).not.toContain('layoutBoardFn');
    expect(arcadeOwner).not.toContain('ctx.updateHUD?.()');
    expect(arcadeOwner).toContain('delete (window as any).__ccArcadeContinuationCueRound;');

    const startLevelStart = appCore.indexOf('async function startLevel(n)');
    const startLevelEnd = appCore.indexOf('// --- local Wild skin fallback', startLevelStart);
    const startLevelOwner = appCore.slice(startLevelStart, startLevelEnd);
    expect(startLevelOwner).toContain('await ensureStartLevelLayout({');
    expect(startLevelOwner.indexOf('stage.visible = false'))
      .toBeLessThan(startLevelOwner.indexOf("await ensureCoreRenderTexturesGpuReady('startLevel')"));
    expect(layoutHelper).toContain('export async function ensureStartLevelLayout');
    expect(layoutHelper).toContain('await layoutBoard();');
    expect(stageModal).toContain('await wait(ROUND_SETTLED_HOLD_DURATION * 1000);');

    const bootStart = appCore.indexOf('export async function boot()');
    const bootEnd = appCore.indexOf('// -------------------- layout + HUD', bootStart);
    const bootOwner = appCore.slice(bootStart, bootEnd);
    expect(bootOwner).not.toContain('trackAppAnimationFrame(async () => {\n      await layoutBoard();');
  });
});
