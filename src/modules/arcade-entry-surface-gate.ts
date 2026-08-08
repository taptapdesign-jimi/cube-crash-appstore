type PixiLikeApp = {
  canvas?: HTMLCanvasElement | null;
  renderer?: { render?: (stage: any) => void } | null;
};

let active = false;
let generation = 0;

function hideCanvas(canvas?: HTMLCanvasElement | null): void {
  if (!canvas) return;
  canvas.style.display = 'block';
  canvas.style.visibility = 'hidden';
  canvas.style.opacity = '0';
  canvas.style.pointerEvents = 'none';
}

export function engageArcadeEntrySurfaceGate(canvas?: HTMLCanvasElement | null): void {
  active = true;
  generation += 1;
  hideCanvas(canvas);
}

export function isArcadeEntrySurfaceGateActive(): boolean {
  return active;
}

/** Returns true when the caller must not reveal the canvas. */
export function enforceArcadeEntrySurfaceGate(canvas?: HTMLCanvasElement | null): boolean {
  if (!active) return false;
  hideCanvas(canvas);
  return true;
}

/**
 * sweetPopIn prepares every tile synchronously before returning its Promise.
 * Keep the canvas compositor-hidden for one more paint, render that safe pose,
 * and only then reveal it. This prevents WKWebView from presenting the retained
 * IOSurface from the previous Arcade board during Homepage -> Play.
 */
export function releaseArcadeEntrySurfaceGateAfterPreparedFrame(
  app: PixiLikeApp | null | undefined,
  stage: any,
): void {
  if (!active) return;
  const owner = generation;
  const canvas = app?.canvas;
  hideCanvas(canvas);
  try { app?.renderer?.render?.(stage); } catch {}

  window.requestAnimationFrame(() => {
    if (!active || owner !== generation) return;
    try { app?.renderer?.render?.(stage); } catch {}
    active = false;
    if (!canvas) return;
    canvas.style.display = 'block';
    canvas.style.visibility = 'visible';
    canvas.style.opacity = '1';
    canvas.style.pointerEvents = 'auto';
  });
}

export function cancelArcadeEntrySurfaceGate(): void {
  active = false;
  generation += 1;
}
