import { STATE } from '../app-state';
import { startFishSwimArtwork, destroyFishSwimArtworkRuntime, setFishSwimArtworkDragging } from '../fish-swim-artwork';
import { getAnimatedSpecialArtworkLayerStats } from '../animated-special-artwork-layer';
jest.mock('../mobile-runtime-profile', () => ({ MOBILE_RUNTIME_PROFILE: { platform: 'ios', isMobileDevice: true } }));
jest.mock('../special-dice-registry', () => ({ getSpecialDiceVariantForTile: () => ({ id: 'fish' }) }));
jest.mock('../animated-special-artwork-mode', () => ({ releaseAnimatedSpecialArtworkFamily: jest.fn() }));

describe('Fish media and shared overlay visibility ownership', () => {
  let tick: () => void;
  let canvas: HTMLCanvasElement;
  let play: jest.SpyInstance;
  let pause: jest.SpyInstance;
  const originalHidden = Object.getOwnPropertyDescriptor(document, 'hidden');
  const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
  beforeEach(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    const host = document.createElement('div');
    canvas = document.createElement('canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 844 } as DOMRect);
    host.appendChild(canvas);
    document.body.appendChild(host);
    STATE.app = {
      canvas, renderer: { screen: { width: 390, height: 844 } },
      ticker: { add: jest.fn((callback) => { tick = callback; }), remove: jest.fn() },
    } as any;
    jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    pause = jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });
  afterEach(() => {
    destroyFishSwimArtworkRuntime();
    STATE.app = null;
    document.body.replaceChildren();
    jest.restoreAllMocks();
    if (originalHidden) Object.defineProperty(document, 'hidden', originalHidden);
    else delete (document as any).hidden;
  });
  function makeTile() {
    return {
      base: { scale: { x: 1 }, getGlobalPosition: () => ({ x: 50 }) },
      visible: true, worldTransform: { a: 1, b: 0, c: 0, d: 1, tx: 50, ty: 50 },
      _wildJuiceBubbleSystem: {
        container: { renderable: true },
        bubbles: [{ x: 0, y: 0, alpha: 1, scale: { x: 1, y: 1 }, _ccIdleBubblePaint: { radius: 2, color: 0xffffff } }],
      },
    };
  }
  it('does not rewrite settled Fish styles and still publishes pose changes', async () => {
    const tile = makeTile();
    const controller = startFishSwimArtwork(tile)!;
    controller.video!.dispatchEvent(new Event('loadeddata'));
    await flush();
    tick();
    const observer = new MutationObserver(() => {});
    observer.observe(controller.wrapper, { attributes: true, subtree: true, attributeFilter: ['style'] });
    try {
      for (let i = 0; i < 10; i++) tick();
      expect(observer.takeRecords()).toHaveLength(0);
      const beforeX = Number(controller.wrapper.style.transform.slice(7, -1).split(',')[4]);
      tile.worldTransform.tx += 10;
      tick();
      expect(observer.takeRecords().length).toBeGreaterThan(0);
      const afterX = Number(controller.wrapper.style.transform.slice(7, -1).split(',')[4]);
      expect(afterX - beforeX).toBeCloseTo(10);
    } finally { observer.disconnect(); }
  });

  it('pauses hidden media and suppresses visible bubble descendants, retaining playhead on every resume', async () => {
    const tile = makeTile();
    const controller = startFishSwimArtwork(tile)!;
    const video = controller.video!;
    video.dispatchEvent(new Event('loadeddata'));
    await flush();
    expect(play).toHaveBeenCalledTimes(1);
    expect(controller.ready).toBe(true);
    expect(controller.bubbleLayer.style.visibility).toBe('visible');
    video.currentTime = 0.42;
    tile.visible = false;
    tick();
    expect(pause).toHaveBeenCalledTimes(1);
    expect(controller.wrapper.style.display).toBe('none');
    tile.visible = true;
    tick();
    await flush();
    expect(play).toHaveBeenCalledTimes(2);
    expect(controller.video).toBe(video);
    expect(video.currentTime).toBe(0.42);

    canvas.style.display = 'none';
    tick();
    expect(controller.wrapper.parentElement!.style.display).toBe('none');
    expect(pause).toHaveBeenCalledTimes(2);
    canvas.style.display = '';
    tick();
    await flush();
    expect(play).toHaveBeenCalledTimes(3);

    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(pause).toHaveBeenCalledTimes(3); // No Pixi tick is needed while backgrounded.
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(play).toHaveBeenCalledTimes(4);
    setFishSwimArtworkDragging(tile, true);
    expect(pause).toHaveBeenCalledTimes(4);
    setFishSwimArtworkDragging(tile, false);
    await flush();
    expect(play).toHaveBeenCalledTimes(5);
    expect(video.currentTime).toBe(0.42);
    destroyFishSwimArtworkRuntime();
    expect(getAnimatedSpecialArtworkLayerStats().owners).toBe(0);
  });

  it('ignores obsolete HEVC play completion after SVG fallback takes ownership', async () => {
    let finishPlay!: () => void;
    play.mockImplementationOnce(() => new Promise<void>((resolve) => { finishPlay = resolve; }));
    const controller = startFishSwimArtwork(makeTile())!;
    const oldVideo = controller.video!;
    oldVideo.dispatchEvent(new Event('loadeddata'));
    oldVideo.dispatchEvent(new Event('error'));
    expect(controller.video).toBeNull();
    expect(controller.image).not.toBeNull();
    expect(controller.ready).toBe(false);
    expect(controller.wrapper.style.display).toBe('none');
    expect(controller.base.renderable).toBe(true);
    finishPlay();
    await flush();
    expect(controller.ready).toBe(false);
    controller.image!.dispatchEvent(new Event('load'));
    expect(controller.ready).toBe(true);
    controller.image!.dispatchEvent(new Event('error'));
    expect(controller.wrapper.style.display).toBe('none');
    expect(controller.base.renderable).toBe(true);
  });
});
