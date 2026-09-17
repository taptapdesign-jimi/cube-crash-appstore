import { captureGameplayEntryValidity } from './gameplay-entry-coordinator';
import { getRunMode } from './run-mode';

export type SavedBoardLoadResult = boolean | 'superseded';

export function captureSavedBoardLoadCaller(): () => boolean {
  const entryIsCurrent = captureGameplayEntryValidity();
  const mode = getRunMode();
  return () => entryIsCurrent() && mode === getRunMode();
}

export function isSavedBoardLoadSuperseded(result: SavedBoardLoadResult, isCurrent: () => boolean): boolean {
  return result === 'superseded' || !isCurrent();
}
