/** Match the board renderer density policy at every preload boundary. */
export function getGhostTextureAsset(pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1): string {
  const dpr = Math.max(1, Math.round(Number(pixelRatio) || 1));
  if (dpr >= 3) return './assets/ghost-placeholder@3x.png';
  if (dpr >= 2) return './assets/ghost-placeholder@2x.png';
  return './assets/ghost-placeholder.png';
}
