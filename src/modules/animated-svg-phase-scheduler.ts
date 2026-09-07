export type AnimatedSvgPhaseSource = {
  image: HTMLImageElement;
  url: string;
};

export type AnimatedSvgPhaseLease = {
  delayMs: number;
  phaseSlot: number;
  plannedStartAtMs: number;
  release: () => void;
};

type PhaseEntry = {
  plannedStartAtMs: number;
  phaseSlot: number;
  started: boolean;
};

type PhaseGroup = {
  cycleMs: number;
  entries: Set<PhaseEntry>;
};

const TARGET_PHASE_DIVISOR = 12;
const MIN_PHASE_SEPARATION_MS = 100;
const SEARCH_STEP_MS = 5;
const MAX_PHASE_START_DELAY_MS = 1000;
const LATE_TIMER_REPLAN_THRESHOLD_MS = 50;

const phaseGroups = new Map<string, PhaseGroup>();

function withPhaseSlot(url: string, phaseSlot: number): string {
  if (phaseSlot === 0) return url;
  const hashIndex = url.indexOf('#');
  const resourceUrl = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
  const separator = resourceUrl.includes('?') ? '&' : '?';
  return `${resourceUrl}${separator}cc-svg-phase=${phaseSlot}${hash}`;
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function circularDistanceMs(first: number, second: number, cycleMs: number): number {
  const direct = Math.abs(positiveModulo(first - second, cycleMs));
  return Math.min(direct, cycleMs - direct);
}

function choosePhaseStartDelayMs(
  entries: Iterable<PhaseEntry>,
  nowMs: number,
  cycleMs: number,
): number {
  const occupiedStarts = Array.from(entries, (entry) => entry.plannedStartAtMs);
  if (occupiedStarts.length === 0) return 0;

  const targetSeparationMs = Math.max(MIN_PHASE_SEPARATION_MS, cycleMs / TARGET_PHASE_DIVISOR);
  const maxDelayMs = Math.min(MAX_PHASE_START_DELAY_MS, cycleMs / 2);
  let bestDelayMs = 0;
  let bestDistanceMs = -1;

  for (let delayMs = 0; delayMs <= maxDelayMs; delayMs += SEARCH_STEP_MS) {
    const candidateStartMs = nowMs + delayMs;
    const nearestDistanceMs = occupiedStarts.reduce(
      (nearest, occupiedStartMs) => Math.min(
        nearest,
        circularDistanceMs(candidateStartMs, occupiedStartMs, cycleMs),
      ),
      Number.POSITIVE_INFINITY,
    );
    if (nearestDistanceMs > bestDistanceMs) {
      bestDistanceMs = nearestDistanceMs;
      bestDelayMs = delayMs;
    }
    if (nearestDistanceMs + 0.001 >= targetSeparationMs) return delayMs;
  }

  // A very crowded board may not expose the preferred gap inside the bounded
  // wait. Use the most separated candidate rather than delaying a fallback for
  // a complete loop or allowing another exactly synchronized start.
  return bestDelayMs;
}

/**
 * Starts external self-animating SVG images on distinct clocks while keeping
 * the existing PNG fallback visible during the short stagger. This is needed
 * because CSS animation-delay cannot address SMIL inside a replaced <img>.
 */
export function acquireAnimatedSvgPhase(
  groupKey: string,
  cycleMs: number,
  sources: AnimatedSvgPhaseSource[],
): AnimatedSvgPhaseLease {
  if (!groupKey || !Number.isFinite(cycleMs) || cycleMs <= 0 || sources.length === 0) {
    throw new Error('Animated SVG phase scheduling requires a key, positive cycle, and source.');
  }

  let group = phaseGroups.get(groupKey);
  if (!group) {
    group = { cycleMs, entries: new Set() };
    phaseGroups.set(groupKey, group);
  } else if (Math.abs(group.cycleMs - cycleMs) > 0.001) {
    throw new Error(`Animated SVG phase group ${groupKey} cannot mix cycle durations.`);
  }

  const nowMs = Date.now();
  const delayMs = choosePhaseStartDelayMs(group.entries, nowMs, cycleMs);
  const occupiedSlots = new Set(Array.from(group.entries, (entry) => entry.phaseSlot));
  let phaseSlot = 0;
  while (occupiedSlots.has(phaseSlot)) phaseSlot += 1;
  const entry: PhaseEntry = {
    plannedStartAtMs: nowMs + delayMs,
    phaseSlot,
    started: false,
  };
  group.entries.add(entry);

  let released = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const startOrReplan = () => {
    timer = null;
    if (released) return;
    const actualNowMs = Date.now();
    if (actualNowMs - entry.plannedStartAtMs > LATE_TIMER_REPLAN_THRESHOLD_MS) {
      // Backgrounding and a blocked main thread can coalesce several delayed
      // callbacks onto one frame. Re-plan overdue entries against live and
      // still-future peers so resume cannot synchronize every pending SVG.
      const relevantPeers = Array.from(group?.entries ?? []).filter(
        (peer) => peer !== entry && (peer.started || peer.plannedStartAtMs > actualNowMs),
      );
      const replannedDelayMs = choosePhaseStartDelayMs(relevantPeers, actualNowMs, cycleMs);
      if (replannedDelayMs > 0) {
        entry.plannedStartAtMs = actualNowMs + replannedDelayMs;
        timer = setTimeout(startOrReplan, replannedDelayMs);
        return;
      }
    }
    entry.started = true;
    entry.plannedStartAtMs = actualNowMs;
    sources.forEach(({ image, url }) => {
      // A distinct resource identity is intentional. WebKit may share the
      // animation clock of identical cached image URLs, which would undo the
      // stagger even when src assignment happens later.
      image.src = withPhaseSlot(url, phaseSlot);
    });
  };

  sources.forEach(({ image }) => {
    image.dataset.ccSvgPhaseGroup = groupKey;
    image.dataset.ccSvgPhaseDelayMs = String(delayMs);
    image.dataset.ccSvgPhaseSlot = String(phaseSlot);
  });
  if (delayMs === 0) startOrReplan();
  else timer = setTimeout(startOrReplan, delayMs);

  return {
    delayMs,
    phaseSlot,
    get plannedStartAtMs() {
      return entry.plannedStartAtMs;
    },
    release: () => {
      if (released) return;
      released = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      group?.entries.delete(entry);
      if (group?.entries.size === 0) phaseGroups.delete(groupKey);
    },
  };
}

export function getAnimatedSvgPhaseSchedulerStats() {
  let leases = 0;
  let pending = 0;
  phaseGroups.forEach((group) => {
    leases += group.entries.size;
    group.entries.forEach((entry) => {
      if (!entry.started) pending += 1;
    });
  });
  return {
    groups: phaseGroups.size,
    leases,
    pending,
  };
}
