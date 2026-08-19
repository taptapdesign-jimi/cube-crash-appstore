import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

describe('Arcade terminal lifecycle regression contract', () => {
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
    expect(exitOwner.indexOf('const exitsCompleted = await Promise.race(['))
      .toBeLessThan(exitOwner.indexOf('try { el.remove(); } catch {}'));
    expect(exitOwner).not.toContain('boardExitPromise.then(() => {\n          trackTimeout(() => {');
    expect(exitOwner).toContain('trackAnimationFrame(() => {');
    expect(exitOwner).toContain('trackTimeout(resolveModalExit, collapseDuration + 300);');
    expect(exitOwner).toContain('const exitsCompleted = await Promise.race([');
    expect(exitOwner).toContain('navigationAbortPromise.then(() => false)');
    expect(exitOwner).toContain('if (!exitsCompleted) return;');
    expect(exitOwner).toContain('safeResolve(exitAction);');

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
      .toBeLessThan(startLevelOwner.indexOf("await ensureCoreGameTexturesLoaded('startLevel')"));
    expect(layoutHelper).toContain('export async function ensureStartLevelLayout');
    expect(layoutHelper).toContain('await layoutBoard();');
    expect(stageModal).toContain('await wait(300);');

    const bootStart = appCore.indexOf('export async function boot()');
    const bootEnd = appCore.indexOf('// -------------------- layout + HUD', bootStart);
    const bootOwner = appCore.slice(bootStart, bootEnd);
    expect(bootOwner).not.toContain('trackAppAnimationFrame(async () => {\n      await layoutBoard();');
  });
});
