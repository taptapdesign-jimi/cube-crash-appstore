import {
  clearFirstPlayTutorialResumeBlockers,
  FIRST_PLAY_TUTORIAL_TRANSIENT_SAVE_KEYS,
} from '../first-play-tutorial-dev-reset.js';
import fs from 'node:fs';
import path from 'node:path';

describe('First Time Run developer reset', () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as any).__ccBoardJustCompleted;
    delete (window as any).__ccCleanBoardInProgress;
  });

  test('removes every resume blocker while preserving player progression', () => {
    FIRST_PLAY_TUTORIAL_TRANSIENT_SAVE_KEYS.forEach(key => localStorage.setItem(key, 'stale'));
    localStorage.setItem('cc_journey_boards_state_v2', 'journey-progress');
    localStorage.setItem('cc_board_high_scores_v1', 'high-scores');
    localStorage.setItem('cc_collectibles_v1', 'collection');
    (window as any).__ccBoardJustCompleted = true;
    (window as any).__ccCleanBoardInProgress = true;

    clearFirstPlayTutorialResumeBlockers();

    FIRST_PLAY_TUTORIAL_TRANSIENT_SAVE_KEYS.forEach(key => expect(localStorage.getItem(key)).toBeNull());
    expect(localStorage.getItem('cc_journey_boards_state_v2')).toBe('journey-progress');
    expect(localStorage.getItem('cc_board_high_scores_v1')).toBe('high-scores');
    expect(localStorage.getItem('cc_collectibles_v1')).toBe('collection');
    expect((window as any).__ccBoardJustCompleted).toBeUndefined();
    expect((window as any).__ccCleanBoardInProgress).toBeUndefined();
  });

  test('runs the reset before arming the developer tutorial request', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/first-play-tutorial.ts'),
      'utf8',
    );
    const setter = source.slice(
      source.indexOf('export function setFirstPlayTutorialDevEnabled'),
      source.indexOf('export function beginFirstPlayTutorialRun'),
    );
    expect(setter.indexOf('clearFirstPlayTutorialResumeBlockers()')).toBeGreaterThanOrEqual(0);
    expect(setter.indexOf('clearFirstPlayTutorialResumeBlockers()')).toBeLessThan(setter.indexOf('armFirstPlayTutorial()'));
  });
});
