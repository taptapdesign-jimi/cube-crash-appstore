const NativeImage = global.Image;

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
    global.Image = NativeImage;
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
    for (let pass = 0; pass < 8; pass += 1) await Promise.resolve();

    expect(document.getElementById('cc-journey-new-card-overlay')).not.toBeNull();
    cleanupJourneyNewCardScreen();

    await expect(presentation).resolves.toEqual({ action: 'cancelled' });
    expect(document.getElementById('cc-journey-new-card-overlay')).toBeNull();
  });
});
