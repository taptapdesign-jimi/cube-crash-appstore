import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

describe('first-play tutorial completion Arcade continuation', () => {
  test('hands Tutorial Complete directly to the canonical Round 01 board entrance', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/modules/endgame-flow.ts'), 'utf8');
    const tutorialBranch = source.slice(
      source.indexOf('if (firstPlayTutorialCompletion)'),
      source.indexOf('if (arcadeStageClearMode)', source.indexOf('if (firstPlayTutorialCompletion)')),
    );
    const continuation = source.slice(
      source.indexOf('async function continueFirstPlayTutorialIntoArcade'),
      source.indexOf('async function initTransitionMemoryTracking'),
    );

    expect(tutorialBranch).toContain('await showTutorialCompleteModal()');
    expect(tutorialBranch).toContain('continueTutorialIntoArcade = true');
    expect(tutorialBranch).not.toContain('requestExitToMenu');
    expect(continuation).toContain('(window as any).__ccArcadeContinuationCueRound = 1;');
    expect(continuation).toContain('(window as any).__ccTriggerHudDrop = true;');
    expect(continuation).toContain('const startPromise = startLevel(1);');
    expect(continuation).toContain('await Promise.race([cuePresented, startPromise]);');
    expect(continuation.indexOf('await Promise.race([cuePresented, startPromise]);'))
      .toBeLessThan(continuation.lastIndexOf('releaseCover();'));
    expect(continuation).toContain('if (coverReleased) return;');
  });

  test('old endgame ownership is released before the fresh board rebuild starts', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/modules/endgame-flow.ts'), 'utf8');
    const unlock = source.indexOf('(window as any).CC._endgameFlowRunning = false;');
    const finalizer = source.slice(source.lastIndexOf('} finally {', unlock));

    expect(finalizer.indexOf('(window as any).CC._endgameFlowRunning = false;'))
      .toBeLessThan(finalizer.indexOf('await continueFirstPlayTutorialIntoArcade(startLevel, cleanupCover);'));
    expect(finalizer.indexOf('stage.eventMode = prevMode;'))
      .toBeLessThan(finalizer.indexOf('await continueFirstPlayTutorialIntoArcade(startLevel, cleanupCover);'));
  });

  test('clears tutorial saves and stats before either selected destination', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/modules/endgame-flow.ts'), 'utf8');
    const cleanup = source.slice(
      source.indexOf('async function clearFirstPlayTutorialRunState'),
      source.indexOf('async function prepareFirstPlayTutorialArcadeRestart'),
    );

    expect(cleanup).toContain('clearFirstPlayTutorialResumeBlockers()');
    expect(cleanup).toContain('clearArcadeSaveState()');
    expect(cleanup).toContain('clearBoardSaveState(tutorialBoardNumber)');
    expect(cleanup).toContain('journeyProgressionState.clearCurrentRunState()');
    expect(cleanup).toContain('boardStatsService.resetBoardStats(tutorialBoardNumber)');
    expect(cleanup).toContain('arcadeStatsService.resetStats()');
    expect(cleanup).not.toContain('requestExitToMenu');
  });

  test('Journey-owned tutorial returns to Journey Worlds instead of starting Arcade Round 01', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/modules/endgame-flow.ts'), 'utf8');
    const journeyContinuation = source.slice(
      source.indexOf('async function continueFirstPlayTutorialIntoJourney'),
      source.indexOf('async function continueFirstPlayTutorialIntoArcade'),
    );

    expect(source).toContain("(window as any).__ccFirstPlayTutorialRunSource === 'journey'");
    expect(source).toContain("if (firstPlayTutorialSource === 'journey')");
    expect(source).toContain('continueTutorialIntoJourney = true;');
    expect(journeyContinuation).toContain('markJourneyGameOrigin({ fromInterim: false });');
    expect(journeyContinuation).toContain("reason: 'first-play-tutorial-complete-journey-worlds'");
    expect(journeyContinuation).toContain("target: 'auto'");
    expect(journeyContinuation).toContain('if (coverReleased) return;');
    expect(journeyContinuation).toContain('if (presented) releaseCover();');
    expect(journeyContinuation.indexOf('if (presented) releaseCover();'))
      .toBeLessThan(journeyContinuation.indexOf('await requestExitToMenu({'));
    expect(journeyContinuation).not.toContain('__ccArcadeContinuationCueRound');
    expect(journeyContinuation).not.toContain('startLevel(1)');
  });
});
