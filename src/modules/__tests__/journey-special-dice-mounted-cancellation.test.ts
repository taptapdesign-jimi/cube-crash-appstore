export {};

const NativeImage = global.Image;

class EagerImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decode = async (): Promise<void> => {};

  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

describe('Journey Special Dice mounted cancellation', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.querySelector('#cc-journey-special-dice-style')?.remove();
    global.Image = EagerImage as unknown as typeof Image;
  });

  afterEach(async () => {
    const { cleanupJourneySpecialDiceScreen } = await import('../journey-special-dice-screen.js');
    cleanupJourneySpecialDiceScreen();
    global.Image = NativeImage;
  });

  test('external cleanup settles an already mounted presentation as cancelled', async () => {
    const {
      cleanupJourneySpecialDiceScreen,
      showJourneySpecialDiceScreen,
    } = await import('../journey-special-dice-screen.js');

    const presentation = showJourneySpecialDiceScreen({ diceType: 'flower' });
    // Backpack frames and final art share the global two-image decoder.
    for (let pass = 0; pass < 96; pass += 1) await Promise.resolve();

    expect(document.getElementById('cc-journey-special-dice-overlay')).not.toBeNull();
    cleanupJourneySpecialDiceScreen();

    await expect(presentation).resolves.toEqual({ action: 'cancelled' });
    expect(document.getElementById('cc-journey-special-dice-overlay')).toBeNull();
  });
});
