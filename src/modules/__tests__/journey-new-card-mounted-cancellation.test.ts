const NativeImage = global.Image;

class BlockingImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decode = async (): Promise<void> => {};

  set src(_value: string) {}
}

jest.mock('../journey-card-idle-bounce.js', () => ({
  cleanupJourneySmokeEffects: jest.fn(),
  smokeBubblesAtCard: jest.fn(),
}));

class EagerImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decode = async (): Promise<void> => {};

  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

describe('Journey New Reward mounted cancellation', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.querySelector('#cc-journey-new-card-style')?.remove();
    global.Image = EagerImage as unknown as typeof Image;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn(() => ({ matches: true })),
    });
  });

  afterEach(async () => {
    const { cleanupJourneyNewCardScreen } = await import('../journey-new-card-screen.js');
    cleanupJourneyNewCardScreen();
    const { resetBoundedImagePreloaderForTests } = await import('../../utils/bounded-image-preloader.js');
    resetBoundedImagePreloaderForTests();
    global.Image = NativeImage;
  });

  test('mounts the opaque New Reward surface without waiting for the bounded image package', async () => {
    global.Image = BlockingImage as unknown as typeof Image;
    const {
      cleanupJourneyNewCardScreen,
      showJourneyNewCardScreen,
    } = await import('../journey-new-card-screen.js');

    const presentation = showJourneyNewCardScreen({
      boardNumber: 11,
      cardImagePath: './assets/colelctibles/beach/common/01@2x.png',
      cardMaskImagePath: './assets/colelctibles/beach/common/01.png',
      cardName: 'Fishy',
      cardRarity: 'common',
    });

    expect(document.getElementById('cc-journey-new-card-overlay')).not.toBeNull();
    cleanupJourneyNewCardScreen();
    await expect(presentation).resolves.toEqual({ action: 'cancelled' });
  });

  test('external cleanup settles an already mounted presentation as cancelled', async () => {
    const {
      cleanupJourneyNewCardScreen,
      showJourneyNewCardScreen,
    } = await import('../journey-new-card-screen.js');

    const presentation = showJourneyNewCardScreen({
      boardNumber: 11,
      cardImagePath: './assets/colelctibles/beach/common/01@2x.png',
      cardMaskImagePath: './assets/colelctibles/beach/common/01.png',
      cardName: 'Fishy',
      cardRarity: 'common',
    });
    // The reward owner intentionally decodes at most two images at a time.
    for (let pass = 0; pass < 64; pass += 1) await Promise.resolve();

    expect(document.getElementById('cc-journey-new-card-overlay')).not.toBeNull();
    cleanupJourneyNewCardScreen();

    await expect(presentation).resolves.toEqual({ action: 'cancelled' });
    expect(document.getElementById('cc-journey-new-card-overlay')).toBeNull();
  });
});
