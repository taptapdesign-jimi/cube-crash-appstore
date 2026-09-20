// @ts-nocheck
import { boardSpecificRules } from './board-specific-rules.ts';

type EfficiencyInput = {
  bonus: number;
  boardNumber: number;
  movesRemaining?: number;
  maxMoves?: number;
  maxStackDepth?: number;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Reward a completed board independently of how many scoring merges it took.
 * Keep the existing completion/stack reward and add up to 4x the board bonus
 * for unused moves. The quadratic curve rewards short clears most strongly,
 * including Wild clears without a deep stack or a long combo. No clock or
 * accumulated score is used, so waiting cannot farm this reward.
 */
export function computeEfficiencyBonus(input: EfficiencyInput): number {
  const bonus = Math.max(0, input.bonus | 0);
  const maxMoves = Math.max(1, (input.maxMoves ?? 50) | 0);
  const movesRemaining = Math.max(0, (input.movesRemaining ?? 0) | 0);
  const maxStackDepth = Math.max(1, (input.maxStackDepth ?? 1) | 0);

  const movesEfficiency = clamp01(movesRemaining / maxMoves);
  const stackEfficiency = clamp01((maxStackDepth - 1) / 3); // depth 1..4
  const efficiencyScore = (movesEfficiency * 0.6) + (stackEfficiency * 0.4);

  const efficiencyFactor = 0.30 + 0.70 * clamp01(efficiencyScore)
    + 4 * movesEfficiency ** 2; // 30%..500%; never reduces the previous reward
  return Math.round(bonus * efficiencyFactor);
}

/**
 * Compute efficiency bonus from global STATE + board rules.
 */
export function computeEfficiencyBonusFromState({
  bonus,
  boardNumber,
}: { bonus: number; boardNumber: number }): number {
  const st = (window as any).STATE || {};
  const rule = boardSpecificRules?.getRule?.(boardNumber);
  const maxMoves = Number.isFinite(rule?.maxMoves) ? rule.maxMoves : 50;
  const movesRemaining = Number.isFinite(st.moves) ? st.moves : 0;
  const maxStackDepth = Number.isFinite(st.maxStackDepth) ? st.maxStackDepth : 1;

  return computeEfficiencyBonus({
    bonus,
    boardNumber,
    movesRemaining,
    maxMoves,
    maxStackDepth,
  });
}

export function computeCleanBoardFinalScore({
  currentScore,
  comboBonus,
  efficiencyBonus,
  scoreCap = 999999,
}: {
  currentScore: number;
  comboBonus: number;
  efficiencyBonus: number;
  scoreCap?: number;
}): number {
  const safeCap = Math.max(0, Number.isFinite(scoreCap) ? Math.trunc(scoreCap) : 999999);
  const safeScore = Math.max(0, Number.isFinite(currentScore) ? Math.trunc(currentScore) : 0);
  const safeComboBonus = Math.max(0, Number.isFinite(comboBonus) ? Math.trunc(comboBonus) : 0);
  const safeEfficiencyBonus = Math.max(
    0,
    Number.isFinite(efficiencyBonus) ? Math.trunc(efficiencyBonus) : 0,
  );
  return Math.min(safeCap, safeScore + safeComboBonus + safeEfficiencyBonus);
}
