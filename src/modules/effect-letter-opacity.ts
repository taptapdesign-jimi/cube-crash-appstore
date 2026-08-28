export const EFFECT_LETTER_OPACITY_RANGE = [0.8, 1] as const;

export function resolveEffectLetterOpacity(
  range: unknown = EFFECT_LETTER_OPACITY_RANGE,
  randomValue = Math.random(),
): number {
  const resolvedRange = Array.isArray(range) && range.length >= 2
    ? range
    : EFFECT_LETTER_OPACITY_RANGE;
  const low = Number(resolvedRange[0]);
  const high = Number(resolvedRange[1]);
  const safeLow = Number.isFinite(low) ? low : EFFECT_LETTER_OPACITY_RANGE[0];
  const safeHigh = Number.isFinite(high) ? high : EFFECT_LETTER_OPACITY_RANGE[1];
  const min = Math.max(0, Math.min(1, Math.min(safeLow, safeHigh)));
  const max = Math.max(min, Math.min(1, Math.max(safeLow, safeHigh)));
  const progress = Math.max(0, Math.min(1, Number.isFinite(randomValue) ? randomValue : 0.5));
  return min + ((max - min) * progress);
}

export function applyEffectLetterOpacity(color: string, alpha: number): string {
  const normalized = String(color || '').trim();
  const match = normalized.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return normalized;
  const r = parseInt(match[1], 16);
  const g = parseInt(match[2], 16);
  const b = parseInt(match[3], 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha)).toFixed(2)})`;
}
