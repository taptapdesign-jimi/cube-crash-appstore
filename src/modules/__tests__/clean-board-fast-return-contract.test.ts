import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');
const read = (relativePath: string): string => fs.readFileSync(
  path.join(repoRoot, relativePath),
  'utf8',
);

describe('Clean Board fast Journey return contract', () => {
  test('mints completion proof only from the settled Clean Board visual owners', () => {
    const source = read('src/modules/clean-board-modal.ts');
    const start = source.indexOf('addButtonPressHandling(secondaryBtn, async () =>');
    const end = source.indexOf("}, 'secondary');", start);
    const exitOwner = source.slice(start, end);

    expect(exitOwner).toContain('let boardExitSucceeded = false;');
    expect(exitOwner).toContain('boardExitSucceeded = true;');
    expect(exitOwner).toContain('Promise.all([boardExitCompletePromise, modalExitPromise])');
    expect(exitOwner).toContain('visualExitAlreadyComplete: boardExitSucceeded');
    expect(exitOwner).toContain('navigationAbortPromise.then(() => ({');
    expect(exitOwner).toContain('visualExitAlreadyComplete: false');
    expect(exitOwner.indexOf('if (!exitCompletion.completed) return;'))
      .toBeLessThan(exitOwner.indexOf('safeResolve(exitAction, {'));
  });

  test('forwards the one-shot proof through Clean Board handlers without inferring it from skipBoardExit', () => {
    const source = read('src/modules/endgame-flow.ts');
    const backHandler = source.slice(
      source.indexOf('async function handleCleanBoardBackToJourney('),
      source.indexOf('async function handleArcadeCleanBoardExit'),
    );
    const journeyHandler = source.slice(
      source.indexOf('async function handleJourneyCleanBoardExit('),
      source.indexOf('async function animateBoardIndicatorExitSafe'),
    );
    const tutorialHandler = source.slice(
      source.indexOf('async function continueFirstPlayTutorialToJourneyHomepage'),
      source.indexOf('async function continueFirstPlayTutorialIntoArcade'),
    );

    expect(backHandler).toContain('visualExitAlreadyComplete: boolean');
    expect(backHandler).toContain('visualExitAlreadyComplete,');
    expect(journeyHandler).toContain('visualExitAlreadyComplete: boolean');
    expect(journeyHandler).toContain('visualExitAlreadyComplete,');
    expect(tutorialHandler).toContain('skipBoardExit: true');
    expect(tutorialHandler).not.toContain('visualExitAlreadyComplete');
  });

  test('accelerates only the proven terminal Journey enter while preserving standard timing', () => {
    const main = read('src/main.ts');
    const collectibles = read('src/collectibles-manager.ts');

    expect(main).toContain("journeyEnterTiming: visualExitAlreadyComplete ? 'post-terminal-exit' : 'standard'");
    expect(main).toContain('if (!isFastArcadeCleanExit && !expectedJourneyFamily)');
    expect(collectibles).toContain('const JOURNEY_ACTIVE_AREA_ENTER_OVERLAP_DELAY_MS = 260;');
    expect(collectibles).toContain('const JOURNEY_POST_TERMINAL_ACTIVE_AREA_ENTER_OVERLAP_DELAY_MS = 80;');
    expect(collectibles).toContain("options?.journeyEnterTiming === 'post-terminal-exit'");
    expect(collectibles).toContain("appZoneManager.isPresentationCurrent(journeyPresentationEpoch, 'journey')");
    expect(collectibles).toContain('!screen.isConnected');
    expect(collectibles).toContain('!journeyContainer.isConnected');
  });

  test('keeps tutorial on baseline and requires the game-over receipt for board-fail', () => {
    const endgame = read('src/modules/endgame-flow.ts');
    const boardFail = read('src/modules/board-fail-modal.ts');
    const tutorialStart = endgame.indexOf('async function continueFirstPlayTutorialToJourneyHomepage');
    const tutorialEnd = endgame.indexOf('async function continueFirstPlayTutorialIntoArcade', tutorialStart);
    const boardFailStart = boardFail.indexOf("reason: 'board-fail-modal-exit'");
    const boardFailEnd = boardFail.indexOf('});', boardFailStart);

    expect(endgame.slice(tutorialStart, tutorialEnd)).not.toContain('visualExitAlreadyComplete');
    expect(boardFail.slice(boardFailStart, boardFailEnd))
      .toContain('visualExitAlreadyComplete: (window as any).__ccGameOverBoardExitComplete === true');
  });
});
