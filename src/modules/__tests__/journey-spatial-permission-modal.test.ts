import {
  cancelSpatialMotionPermissionModal,
  isSpatialMotionPermissionModalActive,
  scheduleSpatialMotionPermissionIntroForNextLaunch,
  shouldShowSpatialMotionPermissionModal,
  showSpatialMotionPermissionModal,
} from '../spatial-motion-permission-modal.js';

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
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    });
  });

  afterEach(() => {
    cancelSpatialMotionPermissionModal();
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

  it('requests permission directly from the launch CTA gesture', async () => {
    const requestPermission = jest.fn().mockResolvedValue(true);
    const result = showSpatialMotionPermissionModal(requestPermission);
    const enableButton = document.querySelector<HTMLButtonElement>('.journey-spatial-permission-enable');

    expect(isSpatialMotionPermissionModalActive()).toBe(true);
    expect(enableButton).not.toBeNull();
    expect(enableButton?.classList.contains('primary-button')).toBe(true);
    expect(enableButton?.classList.contains('bottom-sheet-cta')).toBe(true);
    expect(enableButton?.textContent).toBe('Let’s Move');
    expect(document.querySelector('.journey-spatial-permission-dismiss')?.textContent).toBe('Later');
    expect(document.querySelector('#spatial-motion-permission-title')?.textContent).toBe('3D Motion');
    expect(document.querySelector('#spatial-motion-permission-title span')?.textContent).toBe('3D');
    expect(document.querySelector('.journey-spatial-permission-copy')?.textContent)
      .toBe('Tilt your phone and watch the game move with you.');
    expect(document.querySelector('.journey-spatial-permission-divider')).toBeNull();
    expect(document.querySelector('.journey-spatial-permission-settings-copy')).toBeNull();
    expect(document.querySelector('.journey-spatial-permission-shell')).toBeNull();
    expect(document.querySelector('.journey-spatial-permission-card')?.classList.contains('bottom-sheet-paper-surface'))
      .toBe(true);
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
    await expect(result).resolves.toBe('enabled');
    expect(isSpatialMotionPermissionModalActive()).toBe(false);
    expect(localStorage.getItem('cc_journey_spatial_intro_seen_v3')).toBeNull();
    expect(shouldShowSpatialMotionPermissionModal()).toBe(true);
  });

  it('treats Not now as a session-only dismissal', async () => {
    const result = showSpatialMotionPermissionModal(jest.fn().mockResolvedValue(true));
    document.querySelector<HTMLButtonElement>('.journey-spatial-permission-dismiss')?.click();

    await expect(result).resolves.toBe('dismissed');
    expect(shouldShowSpatialMotionPermissionModal()).toBe(false);
    expect(localStorage.getItem('cc_journey_spatial_intro_seen_v3')).toBeNull();
  });

  it('lets Developer Settings force exactly the next launch intro', async () => {
    const firstResult = showSpatialMotionPermissionModal(jest.fn().mockResolvedValue(true));
    document.querySelector<HTMLButtonElement>('.journey-spatial-permission-dismiss')?.click();
    await firstResult;
    expect(shouldShowSpatialMotionPermissionModal()).toBe(false);

    expect(scheduleSpatialMotionPermissionIntroForNextLaunch()).toBe(true);
    expect(shouldShowSpatialMotionPermissionModal()).toBe(true);
    expect(shouldShowSpatialMotionPermissionModal(true, false)).toBe(true);
    expect(shouldShowSpatialMotionPermissionModal(false, false)).toBe(true);

    const forcedResult = showSpatialMotionPermissionModal(jest.fn().mockResolvedValue(true));
    const dismissButtons = document.querySelectorAll<HTMLButtonElement>('.journey-spatial-permission-dismiss');
    dismissButtons[dismissButtons.length - 1]?.click();
    await forcedResult;
    expect(shouldShowSpatialMotionPermissionModal()).toBe(false);
  });

  it('does not offer permission while 3D motion is disabled or no gesture is required', () => {
    expect(shouldShowSpatialMotionPermissionModal(false, true)).toBe(false);
    expect(shouldShowSpatialMotionPermissionModal(true, false)).toBe(false);
  });
});
