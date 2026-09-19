import fs from 'node:fs';

describe('Clean Board confetti mobile runtime', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalRequestAnimationFrame = global.requestAnimationFrame;
  const originalCancelAnimationFrame = global.cancelAnimationFrame;

  afterEach(async () => {
    const module = await import('../confetti-system');
    module.cleanupConfetti();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    global.requestAnimationFrame = originalRequestAnimationFrame;
    global.cancelAnimationFrame = originalCancelAnimationFrame;
    jest.restoreAllMocks();
  });

  test('uses one canvas and one frame owner instead of per-piece DOM animations and timers', async () => {
    const context = {
      setTransform: jest.fn(),
      clearRect: jest.fn(),
      save: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      restore: jest.fn(),
      beginPath: jest.fn(),
      roundRect: jest.fn(),
      fill: jest.fn(),
      globalAlpha: 1,
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D;
    HTMLCanvasElement.prototype.getContext = jest.fn(() => context) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    let frameCallback: FrameRequestCallback | null = null;
    global.requestAnimationFrame = jest.fn((callback: FrameRequestCallback) => {
      frameCallback = callback;
      return 17;
    });
    global.cancelAnimationFrame = jest.fn();
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const module = await import('../confetti-system');
    module.allowConfettiSpawns();
    module.createConfettiExplosion(document.createElement('div'));

    expect(document.querySelectorAll('.cc-confetti-canvas')).toHaveLength(1);
    expect(document.querySelectorAll('.cc-confetti-piece')).toHaveLength(0);
    expect(module.getConfettiRuntimeSnapshot()).toMatchObject({
      canvasCount: 1,
      particleCount: 60,
      animationFrameCount: 1,
      burstCount: 1,
      pixelRatio: 1,
    });
    expect(global.requestAnimationFrame).toHaveBeenCalledTimes(1);

    (frameCallback as unknown as FrameRequestCallback)(performance.now() + 16);
    expect(context.clearRect).toHaveBeenCalledTimes(1);
    expect(global.requestAnimationFrame).toHaveBeenCalledTimes(2);

    module.cleanupConfetti();
    expect(document.querySelectorAll('.cc-confetti-canvas')).toHaveLength(0);
    expect(module.getConfettiRuntimeSnapshot()).toMatchObject({
      canvasCount: 0,
      particleCount: 0,
      animationFrameCount: 0,
      burstCount: 0,
      spawnBlocked: true,
    });
  });

  test('matches the accepted DOM ease-out fall without added sinusoidal cycles', async () => {
    const context = {
      setTransform: jest.fn(),
      clearRect: jest.fn(),
      save: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      restore: jest.fn(),
      beginPath: jest.fn(),
      roundRect: jest.fn(),
      fill: jest.fn(),
      globalAlpha: 1,
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D;
    HTMLCanvasElement.prototype.getContext = jest.fn(() => context) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    let frameCallback: FrameRequestCallback | null = null;
    global.requestAnimationFrame = jest.fn((callback: FrameRequestCallback) => {
      frameCallback = callback;
      return 23;
    });
    global.cancelAnimationFrame = jest.fn();
    jest.spyOn(performance, 'now').mockReturnValue(1000);
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const module = await import('../confetti-system');
    module.allowConfettiSpawns();
    module.createConfettiExplosion(document.createElement('div'));
    (frameCallback as unknown as FrameRequestCallback)(2500);

    const acceptedCssEaseOutAtHalf = 0.684643;
    const startX = -(window.innerWidth * 0.3);
    const startY = -(window.innerHeight * 0.3);
    const angle = (Math.PI / 4) - 0.125;
    const endTranslationX = (Math.cos(angle) * 120 * 2) + (Math.sin(1) * 80);
    const [actualX, actualY] = (context.translate as jest.Mock).mock.calls[0];

    expect(actualX).toBeCloseTo(startX + (endTranslationX * acceptedCssEaseOutAtHalf), 1);
    expect(actualY).toBeCloseTo(
      startY + ((window.innerHeight * 1.3) * acceptedCssEaseOutAtHalf),
      1,
    );
    expect(context.roundRect).toHaveBeenCalled();
  });

  test('keeps Beach bubbles rising continuously with a slower bounded side weave', async () => {
    const module = await import('../confetti-system');
    const motion = {
      startX: 180,
      startY: 900,
      rise: 1000,
      weaveDirection: 1 as const,
      weaveDistance: 42,
      weaveCycles: 1.5,
    };
    const samples = [0, 0.2, 0.4, 0.6, 0.8, 1]
      .map((progress) => module.sampleCleanBoardBeachBubblePoint(motion, progress));

    samples.slice(1).forEach((sample, index) => {
      expect(sample.y).toBeLessThan(samples[index].y);
      expect(sample.y - samples[index].y).toBeCloseTo(-200, 10);
    });
    samples.forEach((sample) => {
      expect(Math.abs(sample.x - motion.startX)).toBeLessThanOrEqual(motion.weaveDistance);
    });
    expect(module.BEACH_CLEAN_BOARD_MIN_BUBBLE_TRAVEL_MS).toBe(1650);
    expect(module.BEACH_CLEAN_BOARD_MAX_BUBBLE_TRAVEL_MS).toBe(2150);
  });

  test.each([
    ['forest', 42, 0],
    ['beach', 0, 40],
  ] as const)('keeps the %s World field on the same canvas and RAF owner', async (
    theme,
    forestLeafCount,
    beachBubbleCount,
  ) => {
    const context = {
      setTransform: jest.fn(),
      clearRect: jest.fn(),
    } as unknown as CanvasRenderingContext2D;
    HTMLCanvasElement.prototype.getContext = jest.fn(() => context) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    global.requestAnimationFrame = jest.fn(() => 31);
    global.cancelAnimationFrame = jest.fn();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    const module = await import('../confetti-system');
    module.allowConfettiSpawns();
    module.createConfettiExplosion(document.createElement('div'), theme);

    const snapshot = module.getConfettiRuntimeSnapshot();
    expect(document.querySelectorAll('.cc-confetti-canvas')).toHaveLength(1);
    expect(document.querySelector('.cc-confetti-canvas')).toHaveAttribute(
      'data-celebration-theme',
      theme,
    );
    expect(snapshot).toMatchObject({
      theme,
      particleCount: forestLeafCount + beachBubbleCount,
      forestLeafCount,
      beachBubbleCount,
      animationFrameCount: 1,
      burstCount: 5,
    });
    if (theme === 'forest') {
      expect(snapshot.forestHighestBirthY).toBeLessThan(0);
    } else {
      expect(snapshot.beachLowestBirthY).toBeGreaterThan(window.innerHeight);
      expect(snapshot.beachOpacityRange?.[0]).toBeGreaterThanOrEqual(0.16);
      expect(snapshot.beachOpacityRange?.[1]).toBeLessThanOrEqual(0.56);
      const { createMixedBottleBubbleOpacities } = await import('../bottle-bubble-presentation');
      const expectedOpacities = createMixedBottleBubbleOpacities(40, () => 0.5)
        .map((opacity) => opacity * module.BEACH_CLEAN_BOARD_OPACITY_SCALE);
      expect(snapshot.beachOpacityRange?.[0]).toBeCloseTo(Math.min(...expectedOpacities), 10);
      expect(snapshot.beachOpacityRange?.[1]).toBeCloseTo(Math.max(...expectedOpacities), 10);
    }

    const scheduledRuntimeMs = theme === 'forest'
      ? snapshot.forestScheduledRuntimeMs
      : snapshot.beachScheduledRuntimeMs;
    expect(scheduledRuntimeMs).toBeCloseTo(module.CLEAN_BOARD_CONFETTI_MAX_RUNTIME_MS, 6);
    // The normal Clean Board sequence starts its last CTA at 6620ms, staggers
    // the second by 350ms, then completes the authored 340ms CTA enter.
    expect(scheduledRuntimeMs).toBeGreaterThan(6620 + 350 + 340);
  });

  test.each(['forest', 'beach'] as const)(
    'stops unborn %s waves and retires the shared RAF after the live particle finishes',
    async (theme) => {
      const context = {
        setTransform: jest.fn(),
        clearRect: jest.fn(),
      } as unknown as CanvasRenderingContext2D;
      HTMLCanvasElement.prototype.getContext = jest.fn(() => context) as unknown as typeof HTMLCanvasElement.prototype.getContext;
      let frameCallback: FrameRequestCallback | null = null;
      global.requestAnimationFrame = jest.fn((callback: FrameRequestCallback) => {
        frameCallback = callback;
        return 47;
      });
      global.cancelAnimationFrame = jest.fn();
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const module = await import('../confetti-system');
      module.allowConfettiSpawns();
      module.createConfettiExplosion(document.createElement('div'), theme);
      module.stopConfettiSpawns();

      expect(module.getConfettiRuntimeSnapshot().particleCount).toBeLessThan(
        theme === 'forest' ? 42 : 40,
      );
      (frameCallback as unknown as FrameRequestCallback)(performance.now() + 10_000);
      expect(module.getConfettiRuntimeSnapshot()).toMatchObject({
        canvasCount: 0,
        particleCount: 0,
        animationFrameCount: 0,
        spawnBlocked: true,
      });
    },
  );

  test.each(['area55', 'forest', 'beach'] as const)(
    'the actual %s Clean Board CTA hook synchronously removes the complete celebration before another frame',
    async (theme) => {
      HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
        setTransform: jest.fn(), clearRect: jest.fn(),
      })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
      let pendingFrame!: FrameRequestCallback;
      global.requestAnimationFrame = jest.fn((callback: FrameRequestCallback) => {
        pendingFrame = callback;
        return 47;
      });
      global.cancelAnimationFrame = jest.fn();
      const module = await import('../confetti-system');
      module.allowConfettiSpawns();
      module.createConfettiExplosion(document.createElement('div'), theme);
      expect(module.getConfettiRuntimeSnapshot().particleCount).toBeGreaterThan(0);
      const source = fs.readFileSync('src/modules/clean-board-modal.ts', 'utf8');
      const body = source.match(/const cleanupCelebrationParticlesImmediately = \(\) => \{([\s\S]*?)\n {4}\};/)![1];
      const exit = new Function('cleanupConfetti', body);
      exit(module.cleanupConfetti);
      expect(global.cancelAnimationFrame).toHaveBeenCalledWith(47);
      expect(module.getConfettiRuntimeSnapshot()).toMatchObject({
        canvasCount: 0, particleCount: 0, animationFrameCount: 0, spawnBlocked: true,
      });
      pendingFrame(performance.now() + 16);
      module.createConfettiExplosion(document.createElement('div'), theme);
      expect(module.getConfettiRuntimeSnapshot().canvasCount).toBe(0);
      expect(global.requestAnimationFrame).toHaveBeenCalledTimes(1);
      module.allowConfettiSpawns();
      module.createConfettiExplosion(document.createElement('div'), theme);
      expect(module.getConfettiRuntimeSnapshot().particleCount).toBeGreaterThan(0);
    },
  );

  test('runs celebration cleanup first in Exit and Continue or Play Again CTA handlers', () => {
    const source = fs.readFileSync('src/modules/clean-board-modal.ts', 'utf8');
    const primaryStart = source.indexOf('addButtonPressHandling(primaryBtn, async () => {');
    const primaryEnd = source.indexOf("}, 'primary');", primaryStart);
    const secondaryStart = source.indexOf('addButtonPressHandling(secondaryBtn, async () => {');
    const secondaryEnd = source.indexOf("}, 'secondary');", secondaryStart);
    const primaryHandler = source.slice(primaryStart, primaryEnd);
    const secondaryHandler = source.slice(secondaryStart, secondaryEnd);

    expect(primaryHandler.indexOf('cleanupCelebrationParticlesImmediately();')).toBeGreaterThan(-1);
    expect(primaryHandler.indexOf('cleanupCelebrationParticlesImmediately();')).toBeLessThan(primaryHandler.indexOf('await '));
    expect(secondaryHandler.indexOf('cleanupCelebrationParticlesImmediately();')).toBeGreaterThan(-1);
    expect(secondaryHandler.indexOf('cleanupCelebrationParticlesImmediately();')).toBeLessThan(secondaryHandler.indexOf('await '));
  });
});
