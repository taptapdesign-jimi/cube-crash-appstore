import { DONE_KEY, FORCE_NEXT_KEY, isFirstPlayTutorialForced, setFirstPlayTutorialDevEnabled } from '../first-play-tutorial-request';

it.each([
  [null, null, true], [null, 'true', false], ['true', 'true', true],
  ['true', null, true], ['false', 'true', false], [null, 'false', true],
])('preserves launch policy for force=%s done=%s', (force, done, expected) => {
  localStorage.removeItem(FORCE_NEXT_KEY);
  localStorage.removeItem(DONE_KEY);
  if (force !== null) localStorage.setItem(FORCE_NEXT_KEY, force);
  if (done !== null) localStorage.setItem(DONE_KEY, done);
  expect(isFirstPlayTutorialForced()).toBe(expected);
});

it('developer arming/reset remain synchronous and preserve progression', () => {
  localStorage.setItem('cc_saved_game', 'stale');
  localStorage.setItem('cc_journey_boards_state_v2', 'progress');
  setFirstPlayTutorialDevEnabled(true);
  expect(localStorage.getItem('cc_saved_game')).toBeNull();
  expect(localStorage.getItem('cc_journey_boards_state_v2')).toBe('progress');
  expect(isFirstPlayTutorialForced()).toBe(true);
  expect((window as any).__ccFirstPlayTutorialArmed).toBe(true);
  setFirstPlayTutorialDevEnabled(false);
  expect(isFirstPlayTutorialForced()).toBe(false);
  expect((window as any).__ccFirstPlayTutorialArmed).toBeUndefined();
});
