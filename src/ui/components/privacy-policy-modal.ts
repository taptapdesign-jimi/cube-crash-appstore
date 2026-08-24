import { GAMEPLAY_MODAL_BENCHMARK } from '../../modules/gameplay-modal-benchmark.js';
import { mountGameplayModalSpatialMotion } from '../../modules/gameplay-modal-spatial-motion.js';
import { mountGameplaySheetClose, type GameplaySheetCloseController } from '../../modules/gameplay-sheet-close.js';
import { installGameplayOverlayModalDragMotion } from '../../modules/modal-vertical-drag-dismiss.js';

const PRIVACY_POLICY_MODAL_ID = 'settings-privacy-policy-modal';

type ActivePrivacyModalClose = (immediate: boolean) => void;

let activeClose: ActivePrivacyModalClose | null = null;

export function closePrivacyPolicyModal(options: { immediate?: boolean } = {}): void {
  activeClose?.(options.immediate ?? true);
}

export function showPrivacyPolicyModal(): void {
  closePrivacyPolicyModal({ immediate: true });

  const previouslyFocused = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  const backdrop = document.createElement('div');
  backdrop.className = 'score-bottom-sheet-backdrop settings-privacy-policy-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');

  const stage = document.createElement('div');
  stage.id = PRIVACY_POLICY_MODAL_ID;
  stage.className = 'simple-bottom-sheet cc-gameplay-modal-stage settings-privacy-policy-modal';
  stage.setAttribute('role', 'dialog');
  stage.setAttribute('aria-modal', 'true');
  stage.setAttribute('aria-labelledby', 'settings-privacy-policy-title');
  stage.innerHTML = `
    <div class="cc-gameplay-modal-bounce-shell">
      <div class="cc-gameplay-modal-flip-shell">
        <div class="cc-gameplay-modal-idle-shell">
          <div class="cc-gameplay-modal-touch-tilt-shell">
            <div class="cc-gameplay-modal-gyro-shell">
              <div class="cc-gameplay-modal-paper-shell settings-privacy-policy-paper">
                <div class="simple-content">
                  <div class="simple-header">
                    <div class="simple-title-section settings-privacy-policy-copy">
                      <h2 id="settings-privacy-policy-title" class="cc-gameplay-modal-title settings-privacy-policy-title"><span class="settings-privacy-policy-title-accent">Privacy</span> Policy</h2>
                      <p>Stack to Six does not collect, transmit, sell, or share personal data.</p>
                      <p>Game progress and settings are stored only on your device.</p>
                      <p>Optional device motion is used only for visual effects and is not recorded or transmitted.</p>
                      <p>The game does not use accounts, advertising, analytics, or in-app purchases.</p>
                      <p>Deleting the app removes its locally stored data.</p>
                      <p>Privacy questions can be directed to Tap Tap Design through the App Store support page.</p>
                      <p class="settings-privacy-policy-updated">Last updated: August 23, 2026</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const bounceShell = stage.querySelector<HTMLElement>('.cc-gameplay-modal-bounce-shell');
  const gyroShell = stage.querySelector<HTMLElement>('.cc-gameplay-modal-gyro-shell');
  let closeController: GameplaySheetCloseController | null = null;
  let disposeDragMotion: (() => void) | null = null;
  let disposeSpatialMotion: (() => void) | null = null;
  let enterFrame = 0;
  let enterTimer = 0;
  let exitTimer = 0;
  let closing = false;
  let cleaned = false;

  const removeInputListeners = () => {
    backdrop.removeEventListener('click', onBackdropClick);
    document.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('cc-navigation', onNavigation);
  };

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    removeInputListeners();
    window.cancelAnimationFrame(enterFrame);
    window.clearTimeout(enterTimer);
    window.clearTimeout(exitTimer);
    disposeSpatialMotion?.();
    disposeSpatialMotion = null;
    disposeDragMotion?.();
    disposeDragMotion = null;
    closeController?.dispose();
    closeController = null;
    stage.remove();
    backdrop.remove();
    if (activeClose === requestClose) activeClose = null;
    if (previouslyFocused?.isConnected) previouslyFocused.focus();
  };

  const requestClose = (immediate: boolean) => {
    if (cleaned) return;
    if (immediate) {
      cleanup();
      return;
    }
    if (closing) return;
    closing = true;
    removeInputListeners();
    window.cancelAnimationFrame(enterFrame);
    window.clearTimeout(enterTimer);
    disposeSpatialMotion?.();
    disposeSpatialMotion = null;
    backdrop.style.pointerEvents = 'none';
    backdrop.classList.remove('cc-gameplay-modal-backdrop-visible');
    stage.classList.remove('cc-gameplay-modal-entering', 'cc-gameplay-modal-idle');
    stage.classList.add('cc-gameplay-modal-exiting');
    exitTimer = window.setTimeout(cleanup, GAMEPLAY_MODAL_BENCHMARK.exitDurationMs);
  };

  const onBackdropClick = (event: Event) => {
    event.preventDefault();
    requestClose(false);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') requestClose(false);
  };
  const onNavigation = () => requestClose(true);

  activeClose = requestClose;
  closeController = mountGameplaySheetClose(
    gyroShell ?? stage,
    () => requestClose(false),
    'Close Privacy Policy',
  );
  disposeDragMotion = bounceShell
    ? installGameplayOverlayModalDragMotion(stage, {
        onDismiss: () => requestClose(false),
        motionElement: bounceShell,
        maxDragTiltDeg: 1.15,
        maxTouchTiltDeg: 3.64,
      })
    : null;
  disposeSpatialMotion = mountGameplayModalSpatialMotion(stage, gyroShell, 'reduced-exit-score');

  backdrop.addEventListener('click', onBackdropClick);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('cc-navigation', onNavigation);
  document.body.appendChild(backdrop);
  document.body.appendChild(stage);

  enterFrame = window.requestAnimationFrame(() => {
    if (cleaned || closing) return;
    stage.classList.add('visible', 'cc-gameplay-modal-entering');
    backdrop.classList.add('cc-gameplay-modal-backdrop-visible');
    closeController?.element.focus();
    enterTimer = window.setTimeout(() => {
      if (cleaned || closing) return;
      stage.classList.remove('cc-gameplay-modal-entering');
      stage.classList.add('cc-gameplay-modal-idle');
    }, GAMEPLAY_MODAL_BENCHMARK.enterDurationMs + GAMEPLAY_MODAL_BENCHMARK.enterCleanupBufferMs);
  });
}
