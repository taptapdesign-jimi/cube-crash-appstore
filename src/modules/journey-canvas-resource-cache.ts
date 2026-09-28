export type JourneyCanvasReleaseSummary = {
  releasedCount: number;
  estimatedBytes: number;
};

/**
 * A detached canvas may retain its complete backing store until a later GC.
 * Clear dimensions explicitly at the lifecycle boundary so WebKit can release
 * CPU/GPU pixels immediately.
 */
export function releaseJourneyCanvasBackingStore(canvas: HTMLCanvasElement): number {
  const estimatedBytes = Math.max(0, canvas.width) * Math.max(0, canvas.height) * 4;
  try { canvas.remove(); } catch {}
  canvas.width = 1;
  canvas.height = 1;
  return estimatedBytes;
}

export function releaseJourneyCanvasCacheExcept(
  cache: Map<number, HTMLCanvasElement>,
  protectedWorldIds: ReadonlySet<number> = new Set<number>(),
): JourneyCanvasReleaseSummary {
  let releasedCount = 0;
  let estimatedBytes = 0;
  Array.from(cache.entries()).forEach(([worldId, canvas]) => {
    if (protectedWorldIds.has(worldId)) return;
    cache.delete(worldId);
    estimatedBytes += releaseJourneyCanvasBackingStore(canvas);
    releasedCount += 1;
  });
  return { releasedCount, estimatedBytes };
}
