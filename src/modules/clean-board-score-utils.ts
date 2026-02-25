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
 * Compute efficiency bonus based on moves efficiency + stack depth.
 * - movesEfficiency: movesRemaining / maxMoves
 * - stackEfficiency: (maxStackDepth - 1) / 3  (depth 1..4 => 0..1)
 * - efficiencyScore: 60% moves + 40% stack
 * - final bonus: 30%..100% of base bonus
 */
export function computeEfficiencyBonus(input: EfficiencyInput): number {
  const bonus = Math.max(0, input.bonus | 0);
  const maxMoves = Math.max(1, (input.maxMoves ?? 50) | 0);
  const movesRemaining = Math.max(0, (input.movesRemaining ?? 0) | 0);
  const maxStackDepth = Math.max(1, (input.maxStackDepth ?? 1) | 0);

  const movesEfficiency = clamp01(movesRemaining / maxMoves);
  const stackEfficiency = clamp01((maxStackDepth - 1) / 3); // depth 1..4
  const efficiencyScore = (movesEfficiency * 0.6) + (stackEfficiency * 0.4);

  const efficiencyFactor = 0.30 + 0.70 * clamp01(efficiencyScore); // 30%..100%
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
