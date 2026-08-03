export const JOURNEY_STAGES_PER_WORLD = 10;

export type JourneyStageDifficulty = 'very-easy' | 'medium' | 'normal';

export interface JourneyStageBalance {
  boardNumber: number;
  stageInWorld: number;
  difficulty: JourneyStageDifficulty;
  smallValueBias: number;
  twoStarScore: number;
  threeStarScore: number;
}

/**
 * Each Journey world teaches the same ten-stage arc:
 * 1-3 are welcoming, 4-6 introduce more 4/5 tiles, and 7-10 use the
 * unassisted regular distribution. Global boards 1, 11 and 21 therefore
 * share the same opening difficulty instead of getting harder forever.
 */
export function getJourneyStageBalance(boardNumber: number): JourneyStageBalance {
  const safeBoardNumber = Math.max(1, Number.isFinite(boardNumber) ? Math.trunc(boardNumber) : 1);
  const stageInWorld = ((safeBoardNumber - 1) % JOURNEY_STAGES_PER_WORLD) + 1;

  if (stageInWorld <= 3) {
    return {
      boardNumber: safeBoardNumber,
      stageInWorld,
      difficulty: 'very-easy',
      smallValueBias: 0.75,
      twoStarScore: 2500,
      threeStarScore: 6500,
    };
  }

  if (stageInWorld <= 6) {
    return {
      boardNumber: safeBoardNumber,
      stageInWorld,
      difficulty: 'medium',
      smallValueBias: 0.4,
      twoStarScore: 3000,
      threeStarScore: 8000,
    };
  }

  return {
    boardNumber: safeBoardNumber,
    stageInWorld,
    difficulty: 'normal',
    smallValueBias: 0,
    twoStarScore: 3500,
    threeStarScore: 9500,
  };
}

export function getJourneySmallValueBias(boardNumber: number): number {
  return getJourneyStageBalance(boardNumber).smallValueBias;
}

export function getJourneyEarnedStars(score: number, boardNumber: number): number {
  const safeScore = Number.isFinite(score) ? Math.max(0, score) : 0;
  if (safeScore <= 0) return 0;

  const balance = getJourneyStageBalance(boardNumber);
  if (safeScore < balance.twoStarScore) return 1;
  if (safeScore < balance.threeStarScore) return 2;
  return 3;
}
