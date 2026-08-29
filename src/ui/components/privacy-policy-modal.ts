import { GAMEPLAY_MODAL_BENCHMARK } from '../../modules/gameplay-modal-benchmark.js';
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
            <div class="cc-gameplay-modal-pose-shell">
              <div class="cc-gameplay-modal-paper-shell settings-privacy-policy-paper">
                <div class="simple-content">
                  <div class="simple-header">
                    <div class="simple-title-section settings-privacy-policy-copy">
                      <h2 id="settings-privacy-policy-title" class="cc-gameplay-modal-title settings-privacy-policy-title"><span class="settings-privacy-policy-title-accent">Privacy</span> Policy</h2>
                      <div class="settings-privacy-policy-scroll-shell">
                        <div
                          class="settings-privacy-policy-scroll"
                          role="region"
                          aria-label="Privacy Policy details"
                          tabindex="0"
                          data-modal-drag-ignore
                        >
                          <p>Stack to Six does not collect, transmit, sell, or share personal data.</p>
                          <p>Game progress and settings are stored only on your device.</p>
                          <p>The game does not use accounts, advertising, analytics, or in-app purchases.</p>
                          <p>Deleting the app removes its locally stored data.</p>
                          <p>Privacy questions can be directed to Tap Tap Design through the App Store support page.</p>
                          <p><a class="settings-privacy-policy-online-link" href="https://taptapdesign.com/stacktosix-privacy-policy/" target="_blank" rel="noopener noreferrer">Read Privacy Policy</a></p>
                          <p class="settings-privacy-policy-updated">Last updated: August 27, 2026</p>
                        </div>
                        <div class="settings-privacy-policy-scroll-track" aria-hidden="true">
                          <div class="settings-privacy-policy-scroll-thumb"></div>
                        </div>
                      </div>
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
  const poseShell = stage.querySelector<HTMLElement>('.cc-gameplay-modal-pose-shell');
  const privacyScroll = stage.querySelector<HTMLElement>('.settings-privacy-policy-scroll');
  const privacyScrollTrack = stage.querySelector<HTMLElement>('.settings-privacy-policy-scroll-track');
  const privacyScrollThumb = stage.querySelector<HTMLElement>('.settings-privacy-policy-scroll-thumb');
  let closeController: GameplaySheetCloseController | null = null;
  let disposeDragMotion: (() => void) | null = null;
  let enterFrame = 0;
  let enterTimer = 0;
  let exitTimer = 0;
  let closing = false;
  let cleaned = false;
  let scrollResizeObserver: ResizeObserver | null = null;

  const syncScrollThumb = () => {
    if (!privacyScroll || !privacyScrollTrack || !privacyScrollThumb) return;
    const viewportHeight = privacyScroll.clientHeight;
    const trackHeight = privacyScrollTrack.clientHeight;
    const scrollRange = Math.max(0, privacyScroll.scrollHeight - viewportHeight);
    const thumbHeight = scrollRange > 0
      ? Math.max(14, trackHeight * viewportHeight / privacyScroll.scrollHeight)
      : trackHeight;
    const thumbRange = Math.max(0, trackHeight - thumbHeight);
    const progress = scrollRange > 0 ? privacyScroll.scrollTop / scrollRange : 0;
    privacyScrollThumb.style.height = `${thumbHeight}px`;
    privacyScrollThumb.style.transform = `translate3d(0, ${thumbRange * progress}px, 0)`;
  };

  const removeInputListeners = () => {
    backdrop.removeEventListener('click', onBackdropClick);
    document.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('cc-navigation', onNavigation);
  };

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    removeInputListeners();
    privacyScroll?.removeEventListener('scroll', syncScrollThumb);
    window.removeEventListener('resize', syncScrollThumb);
    scrollResizeObserver?.disconnect();
    scrollResizeObserver = null;
    window.cancelAnimationFrame(enterFrame);
    window.clearTimeout(enterTimer);
    window.clearTimeout(exitTimer);
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
    poseShell ?? stage,
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
  backdrop.addEventListener('click', onBackdropClick);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('cc-navigation', onNavigation);
  document.body.appendChild(backdrop);
  document.body.appendChild(stage);

  privacyScroll?.addEventListener('scroll', syncScrollThumb, { passive: true });
  window.addEventListener('resize', syncScrollThumb);
  if (typeof ResizeObserver !== 'undefined' && privacyScroll) {
    scrollResizeObserver = new ResizeObserver(syncScrollThumb);
    scrollResizeObserver.observe(privacyScroll);
    if (privacyScroll.firstElementChild instanceof HTMLElement) {
      scrollResizeObserver.observe(privacyScroll.firstElementChild);
    }
  }

  enterFrame = window.requestAnimationFrame(() => {
    if (cleaned || closing) return;
    syncScrollThumb();
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
