/** Clean Board reward for this attempt; historical records never enter this owner. */
const BONUS_CAP = 999999;
const COMBO_CAP = 99;
let ownerBoard = 0;
let activeCombo = 0;
let earnedBonus = 0;

function safeInteger(value: unknown, cap: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(cap, Math.max(0, Math.trunc(value))) : 0;
}

function streakBonus(length: number): number {
  if (length < 3) return 0;
  return 50 * length + 25 * (length - 3) * (length - 2) / 2;
}

export function resetRunComboBonus(boardNumber: number): void {
  ownerBoard = boardNumber;
  activeCombo = 0;
  earnedBonus = 0;
}

/** Called by the shared combo setter, including Magnet's multi-step increase.
 * Credit only the difference, so repeated setters and result reads cannot pay twice.
 */
export function recordRunCombo(boardNumber: number, combo: number): void {
  if (boardNumber !== ownerBoard) return;
  const next = safeInteger(combo, COMBO_CAP);
  if (next > activeCombo) {
    earnedBonus = Math.min(BONUS_CAP, earnedBonus + streakBonus(next) - streakBonus(activeCombo));
  }
  activeCombo = next;
}

export function getRunComboBonus(boardNumber: number): number {
  return boardNumber === ownerBoard ? earnedBonus : 0;
}

export function snapshotRunComboBonus(boardNumber: number) {
  return { version: 1, earnedBonus: getRunComboBonus(boardNumber) };
}

/** Resume keeps earned points, while the live streak restarts with the existing HUD.
 * Legacy saves have no attempt reward; never infer it from a historical record.
 */
export function restoreRunComboBonus(boardNumber: number, snapshot: unknown): void {
  resetRunComboBonus(boardNumber);
  if (!snapshot || typeof snapshot !== 'object') return;
  const saved = snapshot as { version?: unknown; earnedBonus?: unknown };
  if (saved.version === 1) earnedBonus = safeInteger(saved.earnedBonus, BONUS_CAP);
}
