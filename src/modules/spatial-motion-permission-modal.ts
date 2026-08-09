import { registerCta, type CtaController } from './cta-system.js';
import { runGameplayModalParallelExit } from './gameplay-modal-benchmark.js';
import { mountGameplaySheetClose } from './gameplay-sheet-close.js';
import { installGameplayOverlayModalDragMotion } from './modal-vertical-drag-dismiss.js';

export type SpatialMotionPermissionChoice = 'enabled' | 'dismissed' | 'cancelled';

const SPATIAL_MODAL_EXIT_DURATION_MS = 650;

// Reversible visual experiment. This flag owns only the nested 3D presentation
// layer; setting it to false restores the accepted modal DOM/CSS behavior
// without touching permission, CTA, cooldown, focus, or launch ownership.
export const SPATIAL_MOTION_MODAL_3D_FLIP_TEST_ENABLED = true;

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
let activeCtaControllers: CtaController[] = [];
let spatialMotionArtPreloadPromise: Promise<void> | null = null;

function emitSpatialIntroDiagnostic(event: string, detail: Record<string, unknown> = {}): void {
  try {
    const handler = (window as any).webkit?.messageHandlers?.consoleLog;
    if (!handler?.postMessage) return;
    handler.postMessage({
      level: 'info',
      message: `[CC_SPATIAL_INTRO] ${event} ${JSON.stringify({
        at: Math.round(window.performance.now()),
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
    if (SPATIAL_MOTION_MODAL_3D_FLIP_TEST_ENABLED) {
      overlay.classList.add('is-3d-flip-test');
    }
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'spatial-motion-permission-title');
    overlay.setAttribute('aria-describedby', 'spatial-motion-permission-copy');

    const card = document.createElement('div');
    card.className = 'journey-spatial-permission-card';
    card.tabIndex = -1;

    const paperSurface = document.createElement('div');
    paperSurface.className = 'journey-spatial-permission-paper bottom-sheet-paper-surface';

    const flipShell = document.createElement('div');
    flipShell.className = 'journey-spatial-permission-flip-shell';

    const dragShell = document.createElement('div');
    dragShell.className = 'journey-spatial-permission-drag-shell';

    const title = document.createElement('h2');
    title.id = 'spatial-motion-permission-title';
    title.className = 'cc-gameplay-modal-title';
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
    enableButton.className = 'journey-spatial-permission-enable';
    enableButton.textContent = 'Try It';

    const actions = document.createElement('div');
    actions.className = 'journey-spatial-permission-actions';
    actions.append(enableButton);
    paperSurface.append(title, art, copy, actions);
    flipShell.appendChild(paperSurface);
    dragShell.appendChild(flipShell);
    card.appendChild(dragShell);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    activeOverlay = overlay;

    let choiceExitInProgress = false;
    let closeButton: HTMLButtonElement | null = null;
    const beginChoiceExit = async (choice: SpatialMotionPermissionChoice): Promise<void> => {
      if (choiceExitInProgress) return;
      choiceExitInProgress = true;
      enableButton.disabled = true;
      if (closeButton) closeButton.disabled = true;
      await runGameplayModalParallelExit(
        () => activeCtaControllers[0]?.exit() ?? Promise.resolve(),
        () => {
          if (activeOverlay === overlay) finishActiveModal(choice);
        },
      );
    };
    const onEnable = () => {
      // Keep this call synchronous inside the button gesture; WebKit requires it.
      return requestPermission()
        .then((granted) => beginChoiceExit(granted ? 'enabled' : 'cancelled'))
        .catch(() => finishActiveModal('cancelled'));
    };
    const onDismiss = () => {
      if (!forcedDeveloperPreview) {
        try { sessionStorage.setItem(INTRO_DISMISSED_SESSION_KEY, '1'); } catch {}
        try { localStorage.setItem(INTRO_DISMISSED_AT_KEY, String(Date.now())); } catch {}
      }
      void beginChoiceExit('dismissed');
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };

    activeCtaControllers = [
      registerCta(enableButton, {
        variant: 'primary',
        initialState: 'hidden',
        activationTiming: 'immediate',
        onActivate: onEnable,
      }),
    ];
    const closeController = mountGameplaySheetClose(dragShell, onDismiss);
    closeButton = closeController.element;
    document.addEventListener('keydown', onKeyDown);
    const randomDirection = Math.random() < 0.5 ? -1 : 1;
    const restTiltDeg = Number((randomDirection * (2 + Math.random() * 1.25)).toFixed(2));
    const cardHeight = card.getBoundingClientRect().height;
    const dragCommitDistance = Math.min(140, Math.max(88, Math.max(1, cardHeight) * 0.22));
    const disposeDragDismiss = installGameplayOverlayModalDragMotion(card, {
      onDismiss,
      motionElement: dragShell,
      restTiltDeg,
      thresholdPx: dragCommitDistance,
    });
    const overlayLifecycle = overlay as HTMLElement & {
      __spatialMotionCleanup?: () => void;
      __spatialMotionFinalCleanup?: () => void;
    };
    overlayLifecycle.__spatialMotionCleanup = () => {
      document.removeEventListener('keydown', onKeyDown);
    };
    overlayLifecycle.__spatialMotionFinalCleanup = () => {
      disposeDragDismiss();
      closeController.dispose();
    };

    // Two distinct frames guarantee that the off-screen start state is painted
    // before is-visible starts the spring transition. A single RAF can be
    // coalesced with DOM insertion on Chrome/WebKit and look instantaneous.
    requestAnimationFrame(() => {
      if (!document.body.contains(overlay)) return;
      requestAnimationFrame(() => {
        if (!document.body.contains(overlay)) return;
        overlay.classList.add('is-visible');
        requestAnimationFrame(() => {
          if (!document.body.contains(overlay) || overlay.classList.contains('is-exiting')) return;
          overlay.classList.add('is-backdrop-visible');
        });
        void activeCtaControllers[0]?.enter();
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

  const overlayLifecycle = overlay as HTMLElement & {
    __spatialMotionCleanup?: () => void;
    __spatialMotionFinalCleanup?: () => void;
  };
  overlayLifecycle.__spatialMotionCleanup?.();
  const card = overlay.querySelector('.journey-spatial-permission-card') as (HTMLElement & { _closing?: boolean }) | null;
  if (card) {
    card._closing = true;
    card.style.removeProperty('transition');
  }
  overlay.classList.remove('is-backdrop-visible');
  overlay.classList.remove('is-visible');
  overlay.classList.add('is-exiting');
  const complete = () => {
    if (activeExitTimeout !== null) {
      window.clearTimeout(activeExitTimeout);
      activeExitTimeout = null;
    }
    overlayLifecycle.__spatialMotionFinalCleanup?.();
    overlay.remove();
    activeCtaControllers.splice(0).forEach(controller => controller.dispose());
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
