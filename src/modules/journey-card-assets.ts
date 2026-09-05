import { getJourneyEarnedStars } from './journey-stage-balance.js';

export type JourneyCardRarity = 'common' | 'legendary';

export interface JourneyCardAsset {
  boardId: number;
  stageInWorld: number;
  rarity: JourneyCardRarity;
  path1x: string;
  path2x?: string;
}

const FOREST_FIRST_BOARD = 1;
const FOREST_LAST_BOARD = 10;
const AREA55_FIRST_BOARD = 21;
const AREA55_LAST_BOARD = 30;
const FOREST_CARD_ROOT = './assets/colelctibles/Forest';
const AREA55_CARD_ROOT = './assets/colelctibles/Area55';
const REDUNDANT_CARD_ROOT = './assets/redundant assets/collectible cards old';
// Keep authored filenames immutable while progression reorders their Stages:
// Weee-Beee uses authored 03, Shroomy uses authored 06 and Flying Tent uses authored 02.
const FOREST_CARD_ART_STAGE_BY_STAGE = Object.freeze([1, 3, 9, 4, 5, 6, 7, 8, 2, 10] as const);

export function isForestJourneyBoard(boardId: number): boolean {
  const safeBoardId = Math.trunc(boardId);
  return safeBoardId >= FOREST_FIRST_BOARD && safeBoardId <= FOREST_LAST_BOARD;
}

export function isArea55JourneyCardBoard(boardId: number): boolean {
  const safeBoardId = Math.trunc(boardId);
  return safeBoardId >= AREA55_FIRST_BOARD && safeBoardId <= AREA55_LAST_BOARD;
}

/**
 * Card rarity is derived from the canonical saved score. It is never persisted
 * separately, so a better replay upgrades the artwork and a reset can safely
 * return it to common without stale state.
 */
export function resolveJourneyCardAsset(
  boardId: number,
  highScore: number,
): JourneyCardAsset {
  const safeBoardId = Math.max(1, Math.min(30, Math.trunc(boardId) || 1));
  const stageInWorld = ((safeBoardId - 1) % 10) + 1;

  const isForest = isForestJourneyBoard(safeBoardId);
  const isArea55 = isArea55JourneyCardBoard(safeBoardId);
  if (isForest || isArea55) {
    const artStage = isForest
      ? FOREST_CARD_ART_STAGE_BY_STAGE[stageInWorld - 1] || stageInWorld
      : stageInWorld;
    const paddedStage = String(artStage).padStart(2, '0');
    const rarity: JourneyCardRarity = getJourneyEarnedStars(highScore, safeBoardId) === 3
      ? 'legendary'
      : 'common';
    const filename = rarity === 'legendary' ? `${paddedStage}-gold` : paddedStage;
    const root = isForest ? FOREST_CARD_ROOT : AREA55_CARD_ROOT;
    const base = `${root}/${rarity}/${filename}`;
    return {
      boardId: safeBoardId,
      stageInWorld,
      rarity,
      path1x: `${base}.png`,
      path2x: `${base}@2x.png`,
    };
  }

  // Beach retains its existing authored placeholders until it receives a
  // dedicated common/legendary card pack.
  return {
    boardId: safeBoardId,
    stageInWorld,
    rarity: 'common',
    path1x: `${REDUNDANT_CARD_ROOT}/${String(safeBoardId).padStart(2, '0')}.png`,
  };
}
