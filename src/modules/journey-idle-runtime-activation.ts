export interface JourneyIdleRuntimeTargetState {
  target: HTMLElement;
  initialX: number;
  initialY: number;
}

export interface JourneyIdleRuntimeActivationEntry {
  runtimeActive: boolean;
  startTime: number;
  suspendedRebasePending: boolean;
  targetStates: JourneyIdleRuntimeTargetState[];
}

export type JourneyIdleTransformReader = (
  target: HTMLElement,
  axis: 'x' | 'y',
) => number;

export interface JourneyUnitIdlePaintSnapshot {
  paintSuspended: boolean;
  ambientScrollBoosted: boolean;
}

/** Keep the bounded transform-only Unit idle alive during native scrolling and
 * its settle tail. Heavy World/ambient owners retain the scheduler's ordinary
 * suspension policy; only the two-nearest-Unit idle has no stop/resume seam. */
export function shouldSuspendJourneyUnitIdlePaint(
  snapshot: JourneyUnitIdlePaintSnapshot,
): boolean {
  return snapshot.paintSuspended && !snapshot.ambientScrollBoosted;
}

/** Freeze the exact last painted pose before scroll/modal ownership suspends
 * idle paint. Resuming from the mathematical phase can otherwise reveal the
 * unpainted fraction of the previous 30fps idle tick as a one-pixel jump. */
export function captureJourneyIdleRuntimeSuspension(
  entry: JourneyIdleRuntimeActivationEntry,
  readTransform: JourneyIdleTransformReader,
): boolean {
  if (!entry.runtimeActive || entry.suspendedRebasePending) return false;
  entry.suspendedRebasePending = true;
  entry.targetStates.forEach((state) => {
    const currentX = readTransform(state.target, 'x');
    const currentY = readTransform(state.target, 'y');
    if (Number.isFinite(currentX)) state.initialX = currentX;
    if (Number.isFinite(currentY)) state.initialY = currentY;
  });
  return true;
}

/** Rebase a newly reactivated Unit from its last rendered pose so the existing
 * idle ramp resumes without catching up to an advanced sine phase in one frame. */
export function updateJourneyIdleRuntimeActivation(
  entry: JourneyIdleRuntimeActivationEntry,
  nextRuntimeActive: boolean,
  now: number,
  paintSuspended: boolean,
  readTransform: JourneyIdleTransformReader,
): boolean {
  const becameActive = !entry.runtimeActive && nextRuntimeActive;
  entry.runtimeActive = nextRuntimeActive;
  if (!becameActive) return false;

  entry.startTime = now;
  entry.suspendedRebasePending = paintSuspended;
  entry.targetStates.forEach((state) => {
    const currentX = readTransform(state.target, 'x');
    const currentY = readTransform(state.target, 'y');
    if (Number.isFinite(currentX)) state.initialX = currentX;
    if (Number.isFinite(currentY)) state.initialY = currentY;
  });
  return true;
}
