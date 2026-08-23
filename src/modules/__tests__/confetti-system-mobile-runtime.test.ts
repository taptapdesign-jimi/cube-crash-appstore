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
});
