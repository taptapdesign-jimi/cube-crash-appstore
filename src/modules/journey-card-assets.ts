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
const FOREST_CARD_ROOT = './assets/colelctibles/Forest';

export function isForestJourneyBoard(boardId: number): boolean {
  const safeBoardId = Math.trunc(boardId);
  return safeBoardId >= FOREST_FIRST_BOARD && safeBoardId <= FOREST_LAST_BOARD;
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
  const paddedStage = String(stageInWorld).padStart(2, '0');

  if (isForestJourneyBoard(safeBoardId)) {
    const rarity: JourneyCardRarity = getJourneyEarnedStars(highScore, safeBoardId) === 3
      ? 'legendary'
      : 'common';
    const filename = rarity === 'legendary' ? `${paddedStage}-gold` : paddedStage;
    const base = `${FOREST_CARD_ROOT}/${rarity}/${filename}`;
    return {
      boardId: safeBoardId,
      stageInWorld,
      rarity,
      path1x: `${base}.png`,
      path2x: `${base}@2x.png`,
    };
  }

  // Beach and Area 55 keep their established artwork until their own two-tier
  // asset packs exist. Do not infer Forest rarity or filenames for those worlds.
  const legacyId = safeBoardId >= 21 ? stageInWorld : safeBoardId;
  return {
    boardId: safeBoardId,
    stageInWorld,
    rarity: 'common',
    path1x: `./assets/colelctibles/common/${String(legacyId).padStart(2, '0')}.png`,
  };
}
