import { JOURNEY_LAYOUT_STATE_VERSION, JOURNEY_MAX_BOARDS } from './journey-world-definitions.js';
import { reconcileJourneyWorldInterims } from './journey-world-stage.js';

const JOURNEY_CODE_PREPARATION_TIMEOUT_MS = 1500;
let prepared = false;
let pending: Promise<boolean> | null = null;

function hasStableJourneyLaunchState(): boolean {
  try {
    if (localStorage.getItem('cc_first_play_tutorial_done') !== 'true' ||
        localStorage.getItem('cc_first_play_tutorial_force_next') === 'true' ||
        localStorage.getItem('journey_forest_layout_state_version') !== JOURNEY_LAYOUT_STATE_VERSION) return false;
    const serialized = localStorage.getItem('journey_boards_state');
    const saved: unknown = JSON.parse(serialized || 'null');
    if (!Array.isArray(saved) || saved.length !== JOURNEY_MAX_BOARDS) return false;
    if (!saved.every((board, index) => board && board.id === index + 1 &&
      typeof board.unlocked === 'boolean' && typeof board.interim === 'boolean')) return false;
    const boards = saved.map(({ id, unlocked, interim }) => ({ id, unlocked, interim }));
    const before = JSON.stringify(boards);
    reconcileJourneyWorldInterims(boards);
    return serialized === before && JSON.stringify(boards) === before;
  } catch {
    return false;
  }
}

/** Evaluate navigation code under the launch screen; never render hidden Journey DOM. */
export function prepareJourneyNavigationCode(): Promise<boolean> {
  if (prepared) return Promise.resolve(true);
  if (pending) return pending;
  // The imported Journey singleton normalizes persisted state. Only move that
  // evaluation earlier when normalization is a no-op; first play/migrations
  // remain owned by the original on-demand route.
  if (!hasStableJourneyLaunchState()) return Promise.resolve(false);

  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), JOURNEY_CODE_PREPARATION_TIMEOUT_MS);
  });
  const modules = Promise.all([
    import('../collectibles-manager.js'),
    import('./journey-boards-manager.js'),
  ]).then(() => true, () => false);
  const attempt = Promise.race([modules, deadline]).then((ready) => {
    if (pending === attempt && ready) prepared = true;
    return ready;
  }).finally(() => {
    clearTimeout(timer);
    if (pending === attempt) pending = null;
  });
  pending = attempt;
  return attempt;
}
