const BUBBLE_OPACITY_MIN = 0.2;
const BUBBLE_OPACITY_MAX = 0.7;

export function getBottleBubbleAssetSource(assetIndex: number): string {
  const safeIndex = ((Math.trunc(assetIndex) % 6) + 6) % 6;
  const use2x = typeof navigator !== 'undefined'
    && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  return `./assets/shop/bottle/bottle animation pack/bubble${safeIndex + 1}${use2x ? '@2x' : ''}.png`;
}

export function createMixedBottleBubbleOpacities(
  count: number,
  random: () => number = Math.random,
): number[] {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount === 0) return [];
  const opacityRange = BUBBLE_OPACITY_MAX - BUBBLE_OPACITY_MIN;
  const values = Array.from({ length: safeCount }, (_, index) => {
    const normalized = (index + Math.min(1, Math.max(0, random()))) / safeCount;
    return BUBBLE_OPACITY_MIN + normalized * opacityRange;
  });
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.min(
      index,
      Math.floor(Math.min(1, Math.max(0, random())) * (index + 1)),
    );
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}
