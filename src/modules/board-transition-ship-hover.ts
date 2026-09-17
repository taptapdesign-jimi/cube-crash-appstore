/** Clean Board-style slow drift and buoyant hover, sampled by the existing scene clock. */
export function sampleBoardTransitionShipHover(elapsedSeconds: number, phase: number): {
  x: number;
  y: number;
  bank: number;
} {
  const t = Math.max(0, elapsedSeconds);
  const tau = Math.PI * 2;
  // Frequencies stay in real seconds: the short transition must not compress
  // Clean Board's gentle hover into a rapid vibration.
  return {
    x: Math.sin(t * tau * 0.09 + phase) * 0.65
      + Math.sin(t * tau * 0.38 + phase * 0.7) * 0.35,
    y: Math.sin(t * tau * 0.07 + phase * 0.8) * 0.55
      + Math.sin(t * tau * 0.47 + phase) * 0.45,
    bank: 3 * Math.sin(t * tau * 0.47 + phase),
  };
}
