export type SpatialMotionPermissionChoice = 'enabled' | 'dismissed' | 'cancelled';

const SPATIAL_MODAL_EXIT_DURATION_MS = 650;

const INTRO_DISMISSED_SESSION_KEY = 'cc_spatial_motion_intro_dismissed_session_v4';
const INTRO_DISMISSED_AT_KEY = 'cc_spatial_motion_intro_dismissed_at_v1';
const INTRO_FORCE_NEXT_LAUNCH_KEY = 'cc_spatial_motion_intro_force_next_launch_v1';
export const SPATIAL_MOTION_INTRO_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const SPATIAL_MOTION_ART_URLS = [
  './assets/tilt1.png',
  './assets/tilt1@2x.png',
  './assets/tilt2.png',
  './assets/tilt2@2x.png',
  './assets/wild.png',
  './assets/wild@2x.png',
  './assets/wild@3x.png',
] as const;

let activeOverlay: HTMLElement | null = null;
let activeResolve: ((choice: SpatialMotionPermissionChoice) => void) | null = null;
let activeExitTimeout: number | null = null;
let activeFinishNow: (() => void) | null = null;
let spatialMotionArtPreloadPromise: Promise<void> | null = null;

function emitSpatialIntroDiagnostic(event: string, detail: Record<string, unknown> = {}): void {
  try {
    const handler = (window as any).webkit?.messageHandlers?.consoleLog;
    if (!handler?.postMessage) return;
    handler.postMessage({
      level: 'info',
      message: `[CC_SPATIAL_INTRO] ${event} ${JSON.stringify({
        at: Math.round(performance.now()),
        ...detail,
      })}`,
    });
  } catch {}
}

function readSpatialIntroStorageState(): {
  forced: boolean;
  dismissedThisSession: boolean;
  dismissedAt: number;
  cooldownActive: boolean;
} {
  let forced = false;
  let dismissedThisSession = false;
  let dismissedAt = 0;
  try { forced = localStorage.getItem(INTRO_FORCE_NEXT_LAUNCH_KEY) === '1'; } catch {}
  try { dismissedThisSession = sessionStorage.getItem(INTRO_DISMISSED_SESSION_KEY) === '1'; } catch {}
  try {
    const stored = Number(localStorage.getItem(INTRO_DISMISSED_AT_KEY));
    if (Number.isFinite(stored) && stored > 0) dismissedAt = stored;
  } catch {}
  const elapsed = Date.now() - dismissedAt;
  const cooldownActive = dismissedAt > 0 && elapsed >= 0 && elapsed < SPATIAL_MOTION_INTRO_COOLDOWN_MS;
  return { forced, dismissedThisSession, dismissedAt, cooldownActive };
}

export function isSpatialMotionPermissionModalActive(): boolean {
  return activeOverlay !== null;
}

export function preloadSpatialMotionPermissionArt(): Promise<void> {
  if (spatialMotionArtPreloadPromise) return spatialMotionArtPreloadPromise;
  spatialMotionArtPreloadPromise = Promise.allSettled(SPATIAL_MOTION_ART_URLS.map((url) => (
    new Promise<void>((resolve) => {
      const image = new Image();
      const finish = () => resolve();
      image.onload = finish;
      image.onerror = finish;
      image.src = url;
      if (image.complete) finish();
    })
  ))).then(() => undefined);
  return spatialMotionArtPreloadPromise;
}

export function scheduleSpatialMotionPermissionIntroForNextLaunch(): boolean {
  try {
    localStorage.setItem(INTRO_FORCE_NEXT_LAUNCH_KEY, '1');
    sessionStorage.removeItem(INTRO_DISMISSED_SESSION_KEY);
    const storage = readSpatialIntroStorageState();
    emitSpatialIntroDiagnostic('scheduled', storage);
    return storage.forced;
  } catch {
    emitSpatialIntroDiagnostic('schedule-failed');
    return false;
  }
}

function consumeSpatialMotionPermissionIntroForce(): void {
  const before = readSpatialIntroStorageState();
  try { localStorage.removeItem(INTRO_FORCE_NEXT_LAUNCH_KEY); } catch {}
  emitSpatialIntroDiagnostic('consumed', {
    before,
    after: readSpatialIntroStorageState(),
  });
}

export function shouldShowSpatialMotionPermissionModal(
  spatialMotionEnabled = true,
  permissionGestureRequired = true,
): boolean {
  const storage = readSpatialIntroStorageState();
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const OrientationEvent = window.DeviceOrientationEvent as (typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  }) | undefined;
  const requestPermissionAvailable = typeof OrientationEvent?.requestPermission === 'function';
  let reason = 'session-available';
  let shouldShow = true;

  if (activeOverlay) {
    reason = 'already-active';
    shouldShow = false;
  } else if (reducedMotion) {
    reason = 'reduced-motion';
    shouldShow = false;
  } else if (storage.forced) {
    // Developer preview must also work on localhost/desktop, where Apple's
    // requestPermission API does not exist. Normal launches remain iOS-only.
    reason = requestPermissionAvailable
      ? 'developer-forced'
      : 'developer-forced-web-preview';
  } else if (!requestPermissionAvailable) {
    reason = 'native-permission-unavailable';
    shouldShow = false;
  } else if (!spatialMotionEnabled) {
    reason = 'spatial-motion-disabled';
    shouldShow = false;
  } else if (!permissionGestureRequired) {
    reason = 'permission-gesture-not-required';
    shouldShow = false;
  } else if (storage.cooldownActive || storage.dismissedThisSession) {
    reason = storage.cooldownActive ? 'dismissed-seven-day-cooldown' : 'dismissed-this-session';
    shouldShow = false;
  }

  emitSpatialIntroDiagnostic('decision', {
    shouldShow,
    reason,
    spatialMotionEnabled,
    permissionGestureRequired,
    reducedMotion,
    requestPermissionAvailable,
    ...storage,
  });
  return shouldShow;
}

export function cancelSpatialMotionPermissionModal(): void {
  finishActiveModal('cancelled');
}

export function showSpatialMotionPermissionModal(
  requestPermission: () => Promise<boolean>,
): Promise<SpatialMotionPermissionChoice> {
  if (activeOverlay) return Promise.resolve('cancelled');
  const forcedDeveloperPreview = readSpatialIntroStorageState().forced;
  consumeSpatialMotionPermissionIntroForce();

  return new Promise((resolve) => {
    activeResolve = resolve;
    const overlay = document.createElement('div');
    overlay.className = 'journey-spatial-permission-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'spatial-motion-permission-title');
    overlay.setAttribute('aria-describedby', 'spatial-motion-permission-copy');

    const card = document.createElement('div');
    card.className = 'journey-spatial-permission-card';
    card.tabIndex = -1;

    const paperSurface = document.createElement('div');
    paperSurface.className = 'journey-spatial-permission-paper bottom-sheet-paper-surface';

    const title = document.createElement('h2');
    title.id = 'spatial-motion-permission-title';
    const titleAccent = document.createElement('span');
    titleAccent.textContent = 'Tilt';
    title.append(titleAccent, ' Motion');

    const art = document.createElement('div');
    art.className = 'journey-spatial-permission-art';
    const tiltFrames = document.createElement('div');
    tiltFrames.className = 'journey-spatial-permission-tilt-frames';
    [1, 2].forEach((frame) => {
      const image = document.createElement('img');
      image.src = `./assets/tilt${frame}.png`;
      image.srcset = `./assets/tilt${frame}@2x.png 2x`;
      image.alt = '';
      image.draggable = false;
      image.setAttribute('aria-hidden', 'true');
      image.className = `journey-spatial-permission-tilt journey-spatial-permission-tilt-${frame}`;
      tiltFrames.appendChild(image);
    });
    art.appendChild(tiltFrames);

    [1, 2, 3].forEach((starIndex) => {
      const star = document.createElement('img');
      star.src = './assets/wild.png';
      star.srcset = './assets/wild@2x.png 2x, ./assets/wild@3x.png 3x';
      star.alt = '';
      star.draggable = false;
      star.setAttribute('aria-hidden', 'true');
      star.className = `journey-spatial-permission-star journey-spatial-permission-star-${starIndex}`;
      art.appendChild(star);
    });

    const copy = document.createElement('p');
    copy.id = 'spatial-motion-permission-copy';
    copy.className = 'journey-spatial-permission-copy';
    copy.textContent = 'Tilt your phone to add a little motion.';

    const enableButton = document.createElement('button');
    enableButton.type = 'button';
    enableButton.className = 'journey-spatial-permission-enable restart-btn primary-button bottom-sheet-cta';
    enableButton.textContent = 'Try It';

    const dismissButton = document.createElement('button');
    dismissButton.type = 'button';
    dismissButton.className = 'journey-spatial-permission-dismiss exit-btn bottom-sheet-cta';
    dismissButton.textContent = 'Later';

    const actions = document.createElement('div');
    actions.className = 'journey-spatial-permission-actions';
    actions.append(enableButton, dismissButton);
    paperSurface.append(title, art, copy, actions);
    card.appendChild(paperSurface);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    activeOverlay = overlay;

    const onEnable = () => {
      enableButton.disabled = true;
      dismissButton.disabled = true;
      // Keep this call synchronous inside the button gesture; WebKit requires it.
      void requestPermission()
        .then((granted) => finishActiveModal(granted ? 'enabled' : 'cancelled'))
        .catch(() => finishActiveModal('cancelled'));
    };
    const onDismiss = () => {
      if (!forcedDeveloperPreview) {
        try { sessionStorage.setItem(INTRO_DISMISSED_SESSION_KEY, '1'); } catch {}
        try { localStorage.setItem(INTRO_DISMISSED_AT_KEY, String(Date.now())); } catch {}
      }
      finishActiveModal('dismissed');
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };

    enableButton.addEventListener('click', onEnable, { once: true });
    dismissButton.addEventListener('click', onDismiss, { once: true });
    document.addEventListener('keydown', onKeyDown);
    (overlay as HTMLElement & { __spatialMotionCleanup?: () => void }).__spatialMotionCleanup = () => {
      enableButton.removeEventListener('click', onEnable);
      dismissButton.removeEventListener('click', onDismiss);
      document.removeEventListener('keydown', onKeyDown);
    };

    // Two distinct frames guarantee that the off-screen start state is painted
    // before is-visible starts the spring transition. A single RAF can be
    // coalesced with DOM insertion on Chrome/WebKit and look instantaneous.
    requestAnimationFrame(() => {
      if (!document.body.contains(overlay)) return;
      requestAnimationFrame(() => {
        if (!document.body.contains(overlay)) return;
        overlay.classList.add('is-visible');
        card.focus({ preventScroll: true });
        const cardStyle = getComputedStyle(card);
        emitSpatialIntroDiagnostic('presented', {
          activeElementIsCard: document.activeElement === card,
          outlineStyle: cardStyle.outlineStyle,
          outlineWidth: cardStyle.outlineWidth,
          outlineColor: cardStyle.outlineColor,
          overlayOpacity: getComputedStyle(overlay).opacity,
        });
      });
    });
  });
}

function finishActiveModal(choice: SpatialMotionPermissionChoice): void {
  const overlay = activeOverlay;
  const resolve = activeResolve;
  if (!overlay) {
    resolve?.(choice);
    return;
  }

  // A launch abort must be able to finish an already-closing modal at once.
  // Normal user choices retain one owner until the visual exit is complete so
  // launch cannot start its own exit/Homepage handoff underneath this overlay.
  if (activeFinishNow) {
    if (choice === 'cancelled') activeFinishNow();
    return;
  }

  (overlay as HTMLElement & { __spatialMotionCleanup?: () => void }).__spatialMotionCleanup?.();
  const card = overlay.querySelector('.journey-spatial-permission-card') as (HTMLElement & { _closing?: boolean }) | null;
  if (card) {
    card._closing = true;
    card.style.removeProperty('transition');
  }
  overlay.classList.remove('is-visible');
  overlay.classList.add('is-exiting');
  const complete = () => {
    if (activeExitTimeout !== null) {
      window.clearTimeout(activeExitTimeout);
      activeExitTimeout = null;
    }
    overlay.remove();
    if (activeOverlay === overlay) activeOverlay = null;
    if (activeResolve === resolve) activeResolve = null;
    activeFinishNow = null;
    resolve?.(choice);
  };
  activeFinishNow = complete;

  if (choice === 'cancelled') {
    complete();
    return;
  }
  activeExitTimeout = window.setTimeout(complete, SPATIAL_MODAL_EXIT_DURATION_MS);
}
