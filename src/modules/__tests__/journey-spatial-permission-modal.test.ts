import {
  cancelJourneySpatialPermissionModal,
  shouldShowJourneySpatialPermissionForVisibleHub,
  shouldShowJourneySpatialPermissionModal,
  showJourneySpatialPermissionModal,
} from '../journey-spatial-permission-modal.js';

describe('Journey spatial permission modal', () => {
  beforeEach(() => {
    cancelJourneySpatialPermissionModal();
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
    cancelJourneySpatialPermissionModal();
    jest.restoreAllMocks();
  });

  it('only offers the branded explainer when iOS motion permission is available', () => {
    expect(shouldShowJourneySpatialPermissionModal()).toBe(true);
    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      value: {},
    });
    expect(shouldShowJourneySpatialPermissionModal()).toBe(false);
  });

  it('allows automatic presentation only after the Journey Worlds hub is visible', () => {
    const journeyScreen = document.createElement('section');
    journeyScreen.id = 'journey-screen';
    const hubContainer = document.createElement('div');
    hubContainer.dataset.journeyV700View = 'hub';
    document.body.append(journeyScreen, hubContainer);

    expect(shouldShowJourneySpatialPermissionForVisibleHub(journeyScreen, hubContainer)).toBe(true);
    journeyScreen.hidden = true;
    expect(shouldShowJourneySpatialPermissionForVisibleHub(journeyScreen, hubContainer)).toBe(false);
    journeyScreen.hidden = false;
    hubContainer.dataset.journeyV700View = 'world';
    expect(shouldShowJourneySpatialPermissionForVisibleHub(journeyScreen, hubContainer)).toBe(false);
  });

  it('requests permission directly from the Enable 3D button gesture', async () => {
    const requestPermission = jest.fn().mockResolvedValue(true);
    const result = showJourneySpatialPermissionModal(requestPermission);
    const enableButton = document.querySelector<HTMLButtonElement>('.journey-spatial-permission-enable');

    expect(enableButton).not.toBeNull();
    expect(enableButton?.classList.contains('primary-button')).toBe(true);
    expect(enableButton?.classList.contains('bottom-sheet-cta')).toBe(true);
    expect(document.querySelector('.journey-spatial-permission-shell')).toBeNull();
    const images = Array.from(document.querySelectorAll<HTMLImageElement>('.journey-spatial-permission-world'));
    expect(images.map((image) => image.src)).toEqual([
      expect.stringContaining('/robo4.png'),
      expect.stringContaining('/robo7.png'),
    ]);
    enableButton?.click();
    expect(requestPermission).toHaveBeenCalledTimes(1);
    await expect(result).resolves.toBe('enabled');
    expect(localStorage.getItem('cc_journey_spatial_intro_seen_v3')).toBeNull();
    expect(shouldShowJourneySpatialPermissionModal()).toBe(true);
  });

  it('treats Not now as a session-only dismissal', async () => {
    const result = showJourneySpatialPermissionModal(jest.fn().mockResolvedValue(true));
    document.querySelector<HTMLButtonElement>('.journey-spatial-permission-dismiss')?.click();

    await expect(result).resolves.toBe('dismissed');
    expect(shouldShowJourneySpatialPermissionModal()).toBe(false);
    expect(localStorage.getItem('cc_journey_spatial_intro_seen_v3')).toBeNull();
  });

  it('does not offer permission while 3D motion is disabled or no gesture is required', () => {
    expect(shouldShowJourneySpatialPermissionModal(false, true)).toBe(false);
    expect(shouldShowJourneySpatialPermissionModal(true, false)).toBe(false);
  });
});
