// merge-core.ts
// Compatibility layer that re-exports the modern merge logic from app-merge.ts
// This keeps older entry points (e.g., legacy builds) working while the
// real implementation lives exclusively in app-merge.ts / app-core.ts.
console.warn('⚠️ merge-core.ts is deprecated – import from app-merge.ts instead.');

import * as makeBoard from './board.js';

export { merge, clearWildState, checkGameOver } from './app-merge.ts';

export function anyMergePossibleOnBoard(tiles: any[]): boolean {
  return makeBoard.anyMergePossible(tiles);
}
