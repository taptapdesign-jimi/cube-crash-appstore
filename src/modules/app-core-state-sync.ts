import type { Tile, Board, Grid, HUD as HUDType, Stage as StageType } from '../types/game-types.js';

type SyncDeps = {
  STATE: any;
  app: any;
  stage: StageType | null;
  board: Board | null;
  boardBG: any;
  hud: HUDType | null;
  grid: Grid;
  tiles: Tile[];
  score: number;
  level: number;
  moves: number;
  boardNumber: number;
};

export function syncSharedState(deps: SyncDeps) {
  deps.STATE.app = deps.app;
  deps.STATE.stage = deps.stage;
  deps.STATE.board = deps.board;
  deps.STATE.boardBG = deps.boardBG;

  // 🔥 EXPOSE STATE to window for magnet idle particles access
  (window as any).STATE = deps.STATE;
  deps.STATE.hud = deps.hud;
  deps.STATE.grid = deps.grid;
  deps.STATE.tiles = deps.tiles;
  deps.STATE.score = deps.score;
  deps.STATE.level = deps.level;
  deps.STATE.moves = deps.moves;
  deps.STATE.boardNumber = deps.boardNumber;
}
