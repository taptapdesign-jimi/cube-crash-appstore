type HapticImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' | string;

type HapticRuntimeWindow = Window & {
  triggerHapticImpact?: (style?: string) => void;
  triggerHapticSelection?: () => void;
  triggerHapticNotification?: (type?: string) => void;
  __ccHapticRuntimeGovernor?: HapticRuntimeGovernorSnapshot;
};

export const HAPTIC_RUNTIME_POLICY = Object.freeze({
  burstWindowMs: 2_000,
  maxImpactsPerBurst: 5,
  sustainedWindowMs: 10_000,
  maxImpactsPerSustainedWindow: 10,
  maxLightImpactsPerSustainedWindow: 6,
  sameStyleGapByStyleMs: Object.freeze({
    light: 220,
    medium: 180,
    heavy: 140,
    rigid: 180,
    soft: 220,
  }),
  minGapByStyleMs: Object.freeze({
    light: 180,
    medium: 140,
    heavy: 110,
    rigid: 140,
    soft: 180,
  }),
  selectionGapMs: 180,
  notificationGapMs: 260,
});

export type HapticRuntimeGovernorSnapshot = {
  installed: boolean;
  acceptedImpacts: number;
  suppressedImpacts: number;
  acceptedSelections: number;
  suppressedSelections: number;
  acceptedNotifications: number;
  suppressedNotifications: number;
  recentImpactCount: number;
  recentLightImpactCount: number;
  reset: () => void;
};

let installed = false;
let impactTimes: number[] = [];
let lightImpactTimes: number[] = [];
let lastImpactAt = Number.NEGATIVE_INFINITY;
let lastSelectionAt = Number.NEGATIVE_INFINITY;
let lastNotificationAt = Number.NEGATIVE_INFINITY;
const lastImpactByStyle = new Map<string, number>();

let acceptedImpacts = 0;
let suppressedImpacts = 0;
let acceptedSelections = 0;
let suppressedSelections = 0;
let acceptedNotifications = 0;
let suppressedNotifications = 0;

function resetRuntimeState(): void {
  impactTimes = [];
  lightImpactTimes = [];
  lastImpactAt = Number.NEGATIVE_INFINITY;
  lastSelectionAt = Number.NEGATIVE_INFINITY;
  lastNotificationAt = Number.NEGATIVE_INFINITY;
  lastImpactByStyle.clear();
}

function prune(now: number): void {
  const sustainedCutoff = now - HAPTIC_RUNTIME_POLICY.sustainedWindowMs;
  impactTimes = impactTimes.filter((timestamp) => timestamp > sustainedCutoff);
  lightImpactTimes = lightImpactTimes.filter((timestamp) => timestamp > sustainedCutoff);
}

function isPageVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

function normalizeImpactStyle(style: string | undefined): HapticImpactStyle {
  const normalized = String(style || 'medium').toLowerCase();
  return normalized || 'medium';
}

function minimumGapForStyle(style: HapticImpactStyle): number {
  return HAPTIC_RUNTIME_POLICY.minGapByStyleMs[
    style as keyof typeof HAPTIC_RUNTIME_POLICY.minGapByStyleMs
  ] ?? HAPTIC_RUNTIME_POLICY.minGapByStyleMs.medium;
}

function sameStyleGapForStyle(style: HapticImpactStyle): number {
  return HAPTIC_RUNTIME_POLICY.sameStyleGapByStyleMs[
    style as keyof typeof HAPTIC_RUNTIME_POLICY.sameStyleGapByStyleMs
  ] ?? HAPTIC_RUNTIME_POLICY.sameStyleGapByStyleMs.medium;
}

function shouldAcceptImpact(style: HapticImpactStyle, now: number): boolean {
  if (!isPageVisible()) return false;
  prune(now);

  if (now - lastImpactAt < minimumGapForStyle(style)) return false;
  if (now - (lastImpactByStyle.get(style) ?? Number.NEGATIVE_INFINITY) < sameStyleGapForStyle(style)) {
    return false;
  }

  const burstCutoff = now - HAPTIC_RUNTIME_POLICY.burstWindowMs;
  const burstCount = impactTimes.reduce(
    (count, timestamp) => count + (timestamp > burstCutoff ? 1 : 0),
    0,
  );
  if (burstCount >= HAPTIC_RUNTIME_POLICY.maxImpactsPerBurst) return false;
  if (impactTimes.length >= HAPTIC_RUNTIME_POLICY.maxImpactsPerSustainedWindow) return false;
  if (style === 'light' && lightImpactTimes.length >= HAPTIC_RUNTIME_POLICY.maxLightImpactsPerSustainedWindow) {
    return false;
  }

  impactTimes.push(now);
  if (style === 'light') lightImpactTimes.push(now);
  lastImpactAt = now;
  lastImpactByStyle.set(style, now);
  return true;
}

function updatePublicSnapshot(target: HapticRuntimeWindow): void {
  target.__ccHapticRuntimeGovernor = {
    installed,
    acceptedImpacts,
    suppressedImpacts,
    acceptedSelections,
    suppressedSelections,
    acceptedNotifications,
    suppressedNotifications,
    recentImpactCount: impactTimes.length,
    recentLightImpactCount: lightImpactTimes.length,
    reset: resetRuntimeState,
  };
}

export function installHapticRuntimeGovernor(target: HapticRuntimeWindow = window): void {
  if (installed || typeof target.triggerHapticImpact !== 'function') {
    updatePublicSnapshot(target);
    return;
  }

  const rawImpact = target.triggerHapticImpact.bind(target);
  const rawSelection = target.triggerHapticSelection?.bind(target);
  const rawNotification = target.triggerHapticNotification?.bind(target);

  target.triggerHapticImpact = (requestedStyle = 'medium') => {
    const style = normalizeImpactStyle(requestedStyle);
    const now = Date.now();
    if (!shouldAcceptImpact(style, now)) {
      suppressedImpacts += 1;
      updatePublicSnapshot(target);
      return;
    }
    acceptedImpacts += 1;
    rawImpact(style);
    updatePublicSnapshot(target);
  };

  if (rawSelection) {
    target.triggerHapticSelection = () => {
      const now = Date.now();
      if (!isPageVisible() || now - lastSelectionAt < HAPTIC_RUNTIME_POLICY.selectionGapMs) {
        suppressedSelections += 1;
        updatePublicSnapshot(target);
        return;
      }
      lastSelectionAt = now;
      acceptedSelections += 1;
      rawSelection();
      updatePublicSnapshot(target);
    };
  }

  if (rawNotification) {
    target.triggerHapticNotification = (type = 'success') => {
      const now = Date.now();
      if (!isPageVisible() || now - lastNotificationAt < HAPTIC_RUNTIME_POLICY.notificationGapMs) {
        suppressedNotifications += 1;
        updatePublicSnapshot(target);
        return;
      }
      lastNotificationAt = now;
      acceptedNotifications += 1;
      rawNotification(type);
      updatePublicSnapshot(target);
    };
  }

  const reset = () => resetRuntimeState();
  window.addEventListener('pagehide', reset);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') resetRuntimeState();
  });

  installed = true;
  updatePublicSnapshot(target);
}

export function resetHapticRuntimeGovernorForTests(): void {
  installed = false;
  resetRuntimeState();
  acceptedImpacts = 0;
  suppressedImpacts = 0;
  acceptedSelections = 0;
  suppressedSelections = 0;
  acceptedNotifications = 0;
  suppressedNotifications = 0;
}

if (typeof window !== 'undefined') {
  installHapticRuntimeGovernor(window);
}
