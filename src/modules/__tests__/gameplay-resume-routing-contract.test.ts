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

  test('Homepage resume waits for the shared exit and preserves startLevel flag ownership', () => {
    expect(homepageResume).toContain('void (homepageExitPromise ?? Promise.resolve()).then(async () =>');
    expect(homepageResume).toContain('finalizeJourneySliderExit()');
    expect(homepageResume).toContain('await bootGame();');

    const loadIndex = homepageResume.indexOf('const loaded = await loadGameState(savedBoardNumber)');
    const layoutIndex = homepageResume.indexOf('await layoutGame()');
    expect(loadIndex).toBeGreaterThan(-1);
    expect(layoutIndex).toBeGreaterThan(loadIndex);

    expect(homepageResume).toContain("Don't delete __ccSkipRebuildBoard here - let startLevel() handle it");
    expect(homepageResume).toContain('delete (window as any).__ccStartAtLevel');
  });

  test('repeated Homepage exit requests share one completion promise before resume continues', () => {
    const exitOwner = animationsSource.split(
      'export const animateJourneySliderExit = (): Promise<void> => {',
    )[1]?.split('/** Call only after Homepage is hidden')[0] ?? '';

    expect(exitOwner).toContain('if (journeySliderExitPromise) return journeySliderExitPromise');
    expect(exitOwner).toContain('journeySliderExitPromise = new Promise<void>');
    expect(exitOwner).toContain('return journeySliderExitPromise');
  });
});
