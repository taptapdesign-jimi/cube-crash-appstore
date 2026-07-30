import { applyAppPaperSurfaceToElement } from '../utils/app-paper-background.js';

export type JourneySpatialPermissionChoice = 'enabled' | 'dismissed' | 'cancelled';

const INTRO_DISMISSED_SESSION_KEY = 'cc_journey_spatial_intro_dismissed_session_v3';

let activeOverlay: HTMLElement | null = null;
let activeResolve: ((choice: JourneySpatialPermissionChoice) => void) | null = null;

export function shouldShowJourneySpatialPermissionModal(
  spatialMotionEnabled = true,
  permissionGestureRequired = true,
): boolean {
  if (activeOverlay) return false;
  if (!spatialMotionEnabled || !permissionGestureRequired) return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true) return false;
  const OrientationEvent = window.DeviceOrientationEvent as (typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  }) | undefined;
  if (typeof OrientationEvent?.requestPermission !== 'function') return false;
  try {
    return sessionStorage.getItem(INTRO_DISMISSED_SESSION_KEY) !== '1';
  } catch {
    return true;
  }
}

export function shouldShowJourneySpatialPermissionForVisibleHub(
  journeyScreen: HTMLElement | null,
  hubContainer: HTMLElement,
  spatialMotionEnabled = true,
  permissionGestureRequired = true,
): boolean {
  return !!journeyScreen &&
    !journeyScreen.hidden &&
    !journeyScreen.classList.contains('hidden') &&
    getComputedStyle(journeyScreen).display !== 'none' &&
    hubContainer.dataset.journeyV700View === 'hub' &&
    shouldShowJourneySpatialPermissionModal(spatialMotionEnabled, permissionGestureRequired);
}

export function cancelJourneySpatialPermissionModal(): void {
  finishActiveModal('cancelled');
}

export function showJourneySpatialPermissionModal(
  requestPermission: () => Promise<boolean>,
): Promise<JourneySpatialPermissionChoice> {
  if (activeOverlay) return Promise.resolve('cancelled');

  return new Promise((resolve) => {
    activeResolve = resolve;
    const overlay = document.createElement('div');
    overlay.className = 'journey-spatial-permission-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'journey-spatial-permission-title');

    const card = document.createElement('div');
    card.className = 'journey-spatial-permission-card';
    applyAppPaperSurfaceToElement(card);

    const handle = document.createElement('div');
    handle.className = 'journey-spatial-permission-handle modal-handle';
    handle.setAttribute('aria-hidden', 'true');

    const title = document.createElement('h2');
    title.id = 'journey-spatial-permission-title';
    title.append('Bring ');
    const titleAccent = document.createElement('span');
    titleAccent.textContent = 'Journey';
    title.append(titleAccent, ' to Life');

    const art = document.createElement('div');
    art.className = 'journey-spatial-permission-art';
    [
      {
        src: './assets/journey assets/robo/robo4.png',
        srcset: './assets/journey assets/robo/robo4@2x.png 2x',
      },
      {
        src: './assets/journey assets/robo/robo7.png',
        srcset: './assets/journey assets/robo/robo7@2x.png 2x',
      },
    ].forEach(({ src, srcset }, index) => {
      const image = document.createElement('img');
      image.src = src;
      image.srcset = srcset;
      image.alt = '';
      image.draggable = false;
      image.setAttribute('aria-hidden', 'true');
      image.className = `journey-spatial-permission-world journey-spatial-permission-world-${index + 1}`;
      art.appendChild(image);
    });

    const copy = document.createElement('p');
    copy.innerHTML = 'Move your iPhone<br>Watch each world come alive';

    const enableButton = document.createElement('button');
    enableButton.type = 'button';
    enableButton.className = 'journey-spatial-permission-enable restart-btn primary-button bottom-sheet-cta';
    enableButton.textContent = 'Turn on 3D';

    const dismissButton = document.createElement('button');
    dismissButton.type = 'button';
    dismissButton.className = 'journey-spatial-permission-dismiss exit-btn bottom-sheet-cta';
    dismissButton.textContent = 'Not now';

    const actions = document.createElement('div');
    actions.className = 'journey-spatial-permission-actions';
    actions.append(enableButton, dismissButton);
    card.append(handle, title, art, copy, actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    activeOverlay = overlay;

    const onEnable = () => {
      enableButton.disabled = true;
      dismissButton.disabled = true;
      // Keep this call synchronous inside the button gesture; WebKit requires it.
      void requestPermission().finally(() => finishActiveModal('enabled'));
    };
    const onDismiss = () => {
      try { sessionStorage.setItem(INTRO_DISMISSED_SESSION_KEY, '1'); } catch {}
      finishActiveModal('dismissed');
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };

    enableButton.addEventListener('click', onEnable, { once: true });
    dismissButton.addEventListener('click', onDismiss, { once: true });
    document.addEventListener('keydown', onKeyDown);
    (overlay as HTMLElement & { __journeySpatialCleanup?: () => void }).__journeySpatialCleanup = () => {
      enableButton.removeEventListener('click', onEnable);
      dismissButton.removeEventListener('click', onDismiss);
      document.removeEventListener('keydown', onKeyDown);
    };

    requestAnimationFrame(() => {
      if (!document.body.contains(overlay)) return;
      overlay.classList.add('is-visible');
      enableButton.focus({ preventScroll: true });
    });
  });
}

function finishActiveModal(choice: JourneySpatialPermissionChoice): void {
  const overlay = activeOverlay;
  const resolve = activeResolve;
  activeOverlay = null;
  activeResolve = null;
  if (!overlay) {
    resolve?.(choice);
    return;
  }

  (overlay as HTMLElement & { __journeySpatialCleanup?: () => void }).__journeySpatialCleanup?.();
  overlay.classList.remove('is-visible');
  overlay.classList.add('is-exiting');
  window.setTimeout(() => overlay.remove(), 260);
  resolve?.(choice);
}
