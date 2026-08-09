import {
  cancelSpatialMotionPermissionModal,
  isSpatialMotionPermissionModalActive,
  scheduleSpatialMotionPermissionIntroForNextLaunch,
  shouldShowSpatialMotionPermissionModal,
  showSpatialMotionPermissionModal,
  SPATIAL_MOTION_MODAL_3D_FLIP_TEST_ENABLED,
  SPATIAL_MOTION_INTRO_COOLDOWN_MS,
} from '../spatial-motion-permission-modal.js';
import { gsap } from 'gsap';

async function finishActiveCtaMotion(): Promise<void> {
  // The suite intentionally caps requestAnimationFrame so GSAP cannot install
  // a recursive test-DOM ticker. Drive only the currently owned CTA tweens to
  // completion when a test needs to cross the CTA-before-modal handoff.
  await Promise.resolve();
  await Promise.resolve();
  gsap.globalTimeline.getChildren().forEach(animation => animation.progress(1));
  // Flush the controller exit, group Promise.all, and modal handoff layers so
  // fake-timer assertions begin after the 650ms surface timer is scheduled.
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('Spatial Motion permission modal', () => {
  beforeEach(() => {
    cancelSpatialMotionPermissionModal();
    localStorage.clear();
    sessionStorage.clear();
    document.body.innerHTML = '';
    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      value: { requestPermission: jest.fn().mockResolvedValue('granted') },
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockReturnValue({ matches: false }),
    });
    let synchronousFrameCount = 0;
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        synchronousFrameCount += 1;
        // Paint the modal's two-frame presentation deterministically without
        // recursively driving GSAP's self-scheduling ticker in the test DOM.
        if (synchronousFrameCount <= 2) callback(1000 + synchronousFrameCount * 16.67);
        return synchronousFrameCount;
      },
    });
  });

  afterEach(() => {
    cancelSpatialMotionPermissionModal();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('only offers the branded explainer when iOS motion permission is available', () => {
    expect(shouldShowSpatialMotionPermissionModal()).toBe(true);
    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      value: {},
    });
    expect(shouldShowSpatialMotionPermissionModal()).toBe(false);
  });

  it('allows a one-shot Developer preview on localhost without the iOS permission API', () => {
    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      value: {},
    });

    expect(shouldShowSpatialMotionPermissionModal()).toBe(false);
    expect(scheduleSpatialMotionPermissionIntroForNextLaunch()).toBe(true);
    expect(shouldShowSpatialMotionPermissionModal()).toBe(true);
  });

  it('requests permission directly from the launch CTA gesture', async () => {
    const requestPermission = jest.fn().mockResolvedValue(true);
    const result = showSpatialMotionPermissionModal(requestPermission);
    const enableButton = document.querySelector<HTMLButtonElement>('.journey-spatial-permission-enable');

    expect(isSpatialMotionPermissionModalActive()).toBe(true);
    expect(enableButton).not.toBeNull();
    expect(enableButton?.classList.contains('cc-cta')).toBe(true);
    expect(enableButton?.dataset.ctaVariant).toBe('primary');
    expect(enableButton?.textContent).toBe('Try It');
    expect(document.querySelector('.journey-spatial-permission-dismiss')?.textContent).toBe('Later');
    expect((document.querySelector('.journey-spatial-permission-dismiss') as HTMLElement | null)?.dataset.ctaVariant)
      .toBe('secondary');
    expect(document.querySelector('#spatial-motion-permission-title')?.textContent).toBe('Tilt Motion');
    expect(document.querySelector('#spatial-motion-permission-title span')?.textContent).toBe('Tilt');
    expect(document.querySelector('.journey-spatial-permission-copy')?.textContent)
      .toBe('Tilt your phone to add a little motion.');
    expect(document.querySelector('.journey-spatial-permission-divider')).toBeNull();
    expect(document.querySelector('.journey-spatial-permission-settings-copy')).toBeNull();
    expect(document.querySelector('.journey-spatial-permission-shell')).toBeNull();
    expect(document.querySelector('.journey-spatial-permission-handle')).toBeNull();
    expect(document.querySelector('.journey-spatial-permission-content')).toBeNull();
    expect(document.querySelector('.journey-spatial-permission-paper')?.children).toHaveLength(4);
    expect(document.querySelector('.journey-spatial-permission-card')?.classList.contains('bottom-sheet-paper-surface'))
      .toBe(false);
    expect(document.querySelector('.journey-spatial-permission-paper')?.classList.contains('bottom-sheet-paper-surface'))
      .toBe(true);
    expect(document.querySelector('.journey-spatial-permission-card')?.classList.contains('bottom-sheet-shadow-surface'))
      .toBe(false);
    expect(document.querySelector<HTMLElement>('.journey-spatial-permission-card')?.style.backgroundImage)
      .toBe('');
    const images = Array.from(document.querySelectorAll<HTMLImageElement>('.journey-spatial-permission-tilt'));
    expect(images.map((image) => image.src)).toEqual([
      expect.stringContaining('/tilt1.png'),
      expect.stringContaining('/tilt2.png'),
    ]);
    expect(document.querySelectorAll('.journey-spatial-permission-star')).toHaveLength(3);
    expect(document.activeElement).toBe(document.querySelector('.journey-spatial-permission-card'));
    enableButton?.click();
    expect(requestPermission).toHaveBeenCalledTimes(1);
    await finishActiveCtaMotion();
    await expect(result).resolves.toBe('enabled');
    expect(isSpatialMotionPermissionModalActive()).toBe(false);
    expect(localStorage.getItem('cc_journey_spatial_intro_seen_v3')).toBeNull();
    expect(shouldShowSpatialMotionPermissionModal()).toBe(true);
  });

  it('does not report Try It as enabled when permission fails', async () => {
    const requestPermission = jest.fn().mockResolvedValue(false);
    const result = showSpatialMotionPermissionModal(requestPermission);
    document.querySelector<HTMLButtonElement>('.journey-spatial-permission-enable')?.click();
    expect(requestPermission).toHaveBeenCalledTimes(1);
    await finishActiveCtaMotion();
    await expect(result).resolves.toBe('cancelled');
    expect(isSpatialMotionPermissionModalActive()).toBe(false);
  });

  it('paints the below-viewport start state before beginning the spring enter', async () => {
    const frameCallbacks: FrameRequestCallback[] = [];
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      },
    });

    const result = showSpatialMotionPermissionModal(jest.fn().mockResolvedValue(true));
    const overlay = document.querySelector('.journey-spatial-permission-overlay');
    expect(overlay?.classList.contains('is-visible')).toBe(false);
    expect(frameCallbacks).toHaveLength(1);

    frameCallbacks.shift()?.(0);
    expect(overlay?.classList.contains('is-visible')).toBe(false);
    expect(frameCallbacks).toHaveLength(1);

    frameCallbacks.shift()?.(16.67);
    expect(overlay?.classList.contains('is-visible')).toBe(true);

    cancelSpatialMotionPermissionModal();
    await expect(result).resolves.toBe('cancelled');
  });

  it('isolates the reversible 3D flip test from modal content and lifecycle ownership', async () => {
    const result = showSpatialMotionPermissionModal(jest.fn().mockResolvedValue(true));
    const overlay = document.querySelector('.journey-spatial-permission-overlay');
    const card = document.querySelector('.journey-spatial-permission-card');
    const flipShell = document.querySelector('.journey-spatial-permission-flip-shell');
    const paper = document.querySelector('.journey-spatial-permission-paper');

    expect(SPATIAL_MOTION_MODAL_3D_FLIP_TEST_ENABLED).toBe(true);
    expect(overlay?.classList.contains('is-3d-flip-test')).toBe(true);
    expect(flipShell?.parentElement).toBe(card);
    expect(paper?.parentElement).toBe(flipShell);
    expect(paper?.children).toHaveLength(4);

    cancelSpatialMotionPermissionModal();
    await expect(result).resolves.toBe('cancelled');
    expect(document.querySelector('.journey-spatial-permission-overlay')).toBeNull();
  });

  it('keeps Later dismissed across launches for seven days', async () => {
    const now = 2_000_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const result = showSpatialMotionPermissionModal(jest.fn().mockResolvedValue(true));
    document.querySelector<HTMLButtonElement>('.journey-spatial-permission-dismiss')?.click();

    await finishActiveCtaMotion();
    await expect(result).resolves.toBe('dismissed');
    expect(shouldShowSpatialMotionPermissionModal()).toBe(false);
    expect(localStorage.getItem('cc_spatial_motion_intro_dismissed_at_v1')).toBe(String(now));
    sessionStorage.clear();
    expect(shouldShowSpatialMotionPermissionModal()).toBe(false);
    jest.spyOn(Date, 'now').mockReturnValue(now + SPATIAL_MOTION_INTRO_COOLDOWN_MS);
    expect(shouldShowSpatialMotionPermissionModal()).toBe(true);
    expect(localStorage.getItem('cc_journey_spatial_intro_seen_v3')).toBeNull();
  });

  it('keeps launch ownership until the Later modal exit is actually complete', async () => {
    jest.useFakeTimers();
    const result = showSpatialMotionPermissionModal(jest.fn().mockResolvedValue(true));
    let settled = false;
    void result.then(() => { settled = true; });

    document.querySelector<HTMLButtonElement>('.journey-spatial-permission-dismiss')?.click();
    await finishActiveCtaMotion();

    expect(settled).toBe(false);
    expect(isSpatialMotionPermissionModalActive()).toBe(true);

    jest.advanceTimersByTime(649);
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(isSpatialMotionPermissionModalActive()).toBe(true);

    jest.advanceTimersByTime(1);
    await expect(result).resolves.toBe('dismissed');
    expect(isSpatialMotionPermissionModalActive()).toBe(false);
  });

  it('dismisses the centered modal from either vertical drag direction', async () => {
    const result = showSpatialMotionPermissionModal(jest.fn().mockResolvedValue(true));
    expect(document.querySelector('.journey-spatial-permission-handle')).toBeNull();
    const card = document.querySelector<HTMLElement>('.journey-spatial-permission-card')!;
    const pointerEvent = (type: string, clientY: number) => {
      const event = new Event(type, { bubbles: true }) as PointerEvent;
      Object.defineProperties(event, {
        pointerId: { value: 1 },
        button: { value: 0 },
        clientX: { value: 120 },
        clientY: { value: clientY },
      });
      return event;
    };
    card.dispatchEvent(pointerEvent('pointerdown', 300));
    card.dispatchEvent(pointerEvent('pointermove', 210));
    card.dispatchEvent(pointerEvent('pointerup', 210));
    await finishActiveCtaMotion();
    jest.advanceTimersByTime(650);
    await expect(result).resolves.toBe('dismissed');
  });

  it('lets Developer Settings force exactly the next launch intro', async () => {
    const dismissedAt = 2_100_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(dismissedAt);
    localStorage.setItem('cc_spatial_motion_intro_dismissed_at_v1', String(dismissedAt));
    const firstResult = showSpatialMotionPermissionModal(jest.fn().mockResolvedValue(true));
    document.querySelector<HTMLButtonElement>('.journey-spatial-permission-dismiss')?.click();
    await finishActiveCtaMotion();
    await firstResult;
    expect(shouldShowSpatialMotionPermissionModal()).toBe(false);

    expect(scheduleSpatialMotionPermissionIntroForNextLaunch()).toBe(true);
    expect(shouldShowSpatialMotionPermissionModal()).toBe(true);
    expect(shouldShowSpatialMotionPermissionModal(true, false)).toBe(true);
    expect(shouldShowSpatialMotionPermissionModal(false, false)).toBe(true);

    const forcedResult = showSpatialMotionPermissionModal(jest.fn().mockResolvedValue(true));
    const dismissButtons = document.querySelectorAll<HTMLButtonElement>('.journey-spatial-permission-dismiss');
    dismissButtons[dismissButtons.length - 1]?.click();
    await finishActiveCtaMotion();
    await forcedResult;
    expect(shouldShowSpatialMotionPermissionModal()).toBe(false);
    expect(localStorage.getItem('cc_spatial_motion_intro_dismissed_at_v1')).toBe(String(dismissedAt));
  });

  it('does not offer permission while 3D motion is disabled or no gesture is required', () => {
    expect(shouldShowSpatialMotionPermissionModal(false, true)).toBe(false);
    expect(shouldShowSpatialMotionPermissionModal(true, false)).toBe(false);
  });
});
