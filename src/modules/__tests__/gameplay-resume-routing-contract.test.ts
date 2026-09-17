import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const mainSource = fs.readFileSync(path.join(root, 'src/main.ts'), 'utf8');
const animationsSource = fs.readFileSync(path.join(root, 'src/utils/animations.ts'), 'utf8');

const resumeSource = mainSource.split(
  '(window as any).continueGameWithSavedState = async () => {',
)[1]?.split('// 🔥 JOURNEY PROGRESSION: Export startNewRun function globally')[0] ?? '';

const journeyResume = resumeSource.split(
  'if (cameFromJourney) {',
)[1]?.split('} else {\n        // Resume only after the shared Homepage exit owner has completed.')[0] ?? '';

const homepageResume = resumeSource.split(
  '// Resume only after the shared Homepage exit owner has completed.',
)[1]?.split('return; // Exit early')[0] ?? '';

describe('saved-game resume routing contract', () => {
  test('Journey resume keeps its immediate HUD-drop and load-before-layout ownership', () => {
    expect(journeyResume).toContain('(window as any).__ccTriggerHudDrop = true');
    expect(journeyResume).toContain('await bootGame();');
    expect(journeyResume).toContain('requestAnimationFrame(() => requestAnimationFrame(resolve))');
    expect(journeyResume).toContain('let layoutHandledByLoadState = false');

    const loadIndex = journeyResume.indexOf('const loaded = await loadGameState(savedBoardNumber)');
    const layoutIndex = journeyResume.indexOf('await layoutGame()');
    expect(loadIndex).toBeGreaterThan(-1);
    expect(layoutIndex).toBeGreaterThan(loadIndex);

    expect(journeyResume).toContain('if (!layoutHandledByLoadState)');
    expect(journeyResume).toContain('delete (window as any).__ccSkipRebuildBoard');
    expect(journeyResume).toContain('assertJourneyGameSurfaceVisible');
  });

  test('Homepage resume waits for the shared exit and releases restore flags after its owned commit', () => {
    expect(homepageResume).toContain('void (homepageExitPromise ?? Promise.resolve()).then(async () =>');
    expect(homepageResume).toContain('finalizeJourneySliderExit()');
    expect(homepageResume).toContain('await bootGame();');

    const loadIndex = homepageResume.indexOf('const loaded = await loadGameState(savedBoardNumber)');
    const layoutIndex = homepageResume.indexOf('await layoutGame()');
    expect(loadIndex).toBeGreaterThan(-1);
    expect(layoutIndex).toBeGreaterThan(loadIndex);

    const commitIndex = homepageResume.indexOf('await commitPreparedGameplayEntry()');
    const ownershipIndex = homepageResume.indexOf('if (!savedLoadCallerIsCurrent()) return;', commitIndex);
    const releaseIndex = homepageResume.lastIndexOf('delete (window as any).__ccSkipRebuildBoard');
    expect(commitIndex).toBeGreaterThan(layoutIndex);
    expect(ownershipIndex).toBeGreaterThan(commitIndex);
    expect(releaseIndex).toBeGreaterThan(ownershipIndex);
    expect(homepageResume).toContain('delete (window as any).__ccStartAtLevel');
  });

  test('repeated Homepage exit requests share one completion promise before resume continues', () => {
    const exitOwner = animationsSource.split(
      'export const animateJourneySliderExit = (): Promise<void> => {',
    )[1]?.split('/** Call only after Homepage is hidden')[0] ?? '';

    expect(exitOwner).toContain('if (journeySliderExitPromise) return journeySliderExitPromise');
    expect(exitOwner).toContain('const exitPromise = new Promise<void>');
    expect(exitOwner).toContain('journeySliderExitPromise = exitPromise;');
    expect(exitOwner).toContain('return exitPromise;');
    expect(exitOwner).toContain('return journeySliderExitPromise');
  });
});
