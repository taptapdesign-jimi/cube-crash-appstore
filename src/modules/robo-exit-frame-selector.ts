export function selectRoboExitFrameIndex(
  frameCount: number,
  currentFrameIndex: number,
  previousExitFrameIndex: number | null,
  randomValue: number = Math.random(),
): number | null {
  const normalizedFrameCount = Math.max(0, Math.floor(frameCount));
  if (normalizedFrameCount === 0) return null;

  const allIndices = Array.from({ length: normalizedFrameCount }, (_, index) => index);
  const nonRepeatingCandidates = allIndices.filter(
    (index) => index !== currentFrameIndex && index !== previousExitFrameIndex,
  );
  const visiblyDifferentCandidates = allIndices.filter((index) => index !== currentFrameIndex);
  const candidates = nonRepeatingCandidates.length > 0
    ? nonRepeatingCandidates
    : visiblyDifferentCandidates.length > 0
      ? visiblyDifferentCandidates
      : allIndices;
  const safeRandomValue = Number.isFinite(randomValue)
    ? Math.min(0.999999999999, Math.max(0, randomValue))
    : 0;

  return candidates[Math.floor(safeRandomValue * candidates.length)] ?? candidates[0] ?? null;
}
