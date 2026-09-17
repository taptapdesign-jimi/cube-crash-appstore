/** @jest-environment jsdom */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { saveAfterBoardStart } from '../app-core-startlevel-save';
import { canSaveGameState } from '../app-core-save-guards';
import { buildGridSnapshot } from '../app-core-save-tiles';
import { buildSaveState, createGameSaveWriter } from '../app-core-save-state';
import { stampCurrentGameSaveSchema } from '../app-core-save-schema';
import { getBoardSaveKey, hasResumableSavedStateForBoard, protectCompletedJourneyBoardSave } from '../../utils/board-save-utils';

function actualSave() {
  const file = ts.createSourceFile('app-core.ts', fs.readFileSync(path.join(__dirname, '../app-core.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
  const fn = file.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'saveGameState')!;
  const scope: Record<string, any> = {
    syncSharedState: jest.fn(), isArcadeHomeRunMode: () => false, protectCompletedJourneyBoardSave,
    boardNumber: 8, level: 8, score: 0, moves: 20, wildMeter: 0, wildSpawnCount: 0,
    tiles: [], grid: [[null, null], [null, null]], ROWS: 2, COLS: 2, MOVES_MAX: 20,
    STATE: { bestScore: 0 }, StarsCollector: {}, gameSaveWriter: createGameSaveWriter(),
    hasUnsavableTransientGameplayState: () => false, canSaveGameState, buildGridSnapshot, buildSaveState,
    stampCurrentGameSaveSchema, getStarsCountForSave: () => 0, getBoardSaveKey,
    devLog: jest.fn(), devWarn: jest.fn(), devError: jest.fn(), logger: { error: jest.fn() },
  };
  const body = ts.transpileModule(fn.getText(file), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const save = new Function('scope', `with(scope) { ${body}; return saveGameState; }`)(scope) as () => void;
  return { save, scope };
}

beforeEach(() => {
  localStorage.clear(); jest.useFakeTimers();
  (window as any).__ccSkipRebuildBoard = true;
  (window as any)._gameHasEnded = false;
});
afterEach(() => { jest.useRealTimers(); delete (window as any).__ccSkipRebuildBoard; });

test('actual boot save cannot overwrite a valid Journey snapshot while restore owns the empty runtime board', () => {
  const key = getBoardSaveKey(8);
  const original = JSON.stringify({ boardNumber: 8, grid: [[{ value: 2 }, { value: 3 }], [null, null]] });
  localStorage.setItem(key, original);
  const { save } = actualSave();
  saveAfterBoardStart({ boardNumber: 8, isCurrentEntry: () => true, trackAppTimeout: (fn, ms) => setTimeout(fn, ms), saveGameState: save, devLog: jest.fn() });
  jest.advanceTimersByTime(100);
  // Journey refreshes Continue eligibility using this destructive invalid-save
  // cleanup. A boot placeholder must never become its input snapshot.
  expect(hasResumableSavedStateForBoard(8, { clearInvalid: true })).toBe(true);
  expect(localStorage.getItem(key)).toBe(original);
});


test('ordinary current board entry still saves; retired entry cannot save a replacement run', () => {
  delete (window as any).__ccSkipRebuildBoard;
  const { save, scope } = actualSave();
  scope.tiles = [2, 3].map((value, gridX) => ({ value, gridX, gridY: 0, visible: true, alpha: 1, locked: false }));
  scope.grid[0] = scope.tiles;
  let current = true;
  const schedule = () => saveAfterBoardStart({ boardNumber: 8, isCurrentEntry: () => current,
    trackAppTimeout: (fn, ms) => setTimeout(fn, ms), saveGameState: save, devLog: jest.fn() });
  schedule(); current = false; jest.advanceTimersByTime(100);
  expect(localStorage.getItem(getBoardSaveKey(8))).toBeNull();
  current = true; schedule(); jest.advanceTimersByTime(100);
  expect(hasResumableSavedStateForBoard(8, { clearInvalid: true })).toBe(true);
});

test('actual direct lifecycle save preserves the resume snapshot before restoration commits', () => {
  const original = JSON.stringify({ boardNumber: 8, grid: [[{ value: 2 }, { value: 3 }]] });
  localStorage.setItem(getBoardSaveKey(8), original);
  const { save, scope } = actualSave();
  save();
  expect(localStorage.getItem(getBoardSaveKey(8))).toBe(original);
  expect(scope.syncSharedState).not.toHaveBeenCalled();
});
