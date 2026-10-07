import { STATE } from '../app-state';
import { startSpecialDiceIdleMotion, stopSpecialDiceIdleMotion, acquireSpecialDiceIdleSuspension, resetSpecialDiceIdleRegistryForTests } from '../special-dice-idle';
import * as fish from '../fish-swim-artwork';

jest.mock('../mobile-runtime-profile', () => ({ MOBILE_RUNTIME_PROFILE: { platform: 'ios', isMobileDevice: true } }));

test('dragging a sibling retains the Fish animated skin and facing; real Fish pickup still uses its drag owner', async () => {
  const originalHidden = Object.getOwnPropertyDescriptor(document, 'hidden');
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 844 } as DOMRect);
  const callbacks = new Set<(frame: any) => void>();
  STATE.app = { canvas, renderer: { screen: { width: 390, height: 844 } },
    ticker: { add: (fn: any) => callbacks.add(fn), remove: (fn: any) => callbacks.delete(fn) } } as any;
  jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const tile: any = { special: 'wild-juice', _ccSpecialDiceVariant: 'fish', visible: true,
    base: { renderable: true, scale: { x: 1 }, getGlobalPosition: () => ({ x: 370 }) },
    worldTransform: { a: 1, b: 0, c: 0, d: 1, tx: 370, ty: 50 } };
  const tick = () => [...callbacks].forEach(fn => fn({ elapsedMS: 16, deltaMS: 16 }));
  let release: (() => void) | undefined;
  try {
    startSpecialDiceIdleMotion(tile);
    const controller = tile._ccFishSwimArtwork;
    expect(controller).toBeDefined();
    controller.video.dispatchEvent(new Event('loadeddata'));
    for (let i = 0; i < 8; i++) await Promise.resolve();
    tick();
    const transform = controller.wrapper.style.transform;
    expect(tile.base.renderable).toBe(false);
    release = acquireSpecialDiceIdleSuspension('drag');
    tick();
    expect(controller.dragging).toBe(false);
    expect(controller.wrapper.style.visibility).toBe('visible');
    expect(controller.wrapper.style.transform).toBe(transform);
    expect(tile.base.renderable).toBe(false);
    expect(tile.base.scale.x).toBe(1);
    release();
    tick();
    expect(fish.setFishSwimArtworkDragging(tile, true)).toBe(true);
    expect(controller.dragging).toBe(true);
    expect(tile.base.renderable).toBe(true);
  } finally {
    release?.(); stopSpecialDiceIdleMotion(tile); resetSpecialDiceIdleRegistryForTests();
    fish.destroyFishSwimArtworkRuntime(); STATE.app = null; canvas.remove(); jest.restoreAllMocks();
    if (originalHidden) Object.defineProperty(document, 'hidden', originalHidden);
  }
});
