import { Assets, Container, Sprite, Texture } from 'pixi.js';
import { STATE } from '../app-state';
import { startKantaDiceIdle, type KantaDiceIdleController } from '../kanta-dice-idle';
import { getSpecialDiceIdleVisibilityStats } from '../special-dice-idle-visibility';

test('a broken Kanta bubble retires its local ticker and leaves the next Kanta animating', () => {
  const callbacks = new Set<(ticker: any) => void>();
  const load = jest.spyOn(Assets, 'load').mockImplementation(() => new Promise(() => {}) as any);
  const board = new Container();
  const controllers: KantaDiceIdleController[] = [];
  STATE.app = { ticker: {
    add: (callback: (ticker: any) => void) => callbacks.add(callback),
    remove: (callback: (ticker: any) => void) => callbacks.delete(callback),
  } } as any;
  const create = () => {
    const rotG = board.addChild(new Container());
    const base = rotG.addChild(new Sprite(Texture.WHITE));
    base.width = 128; base.height = 171;
    const tile = { base, rotG };
    const controller = startKantaDiceIdle(tile, [])!;
    controllers.push(controller);
    const bubbles = rotG.getChildByLabel('kanta-idle-top-bubbles') as Container;
    return { base, controller, bubbles, bubble: bubbles.children[0] };
  };
  try {
    const failed = create(); const healthy = create();
    const priorY = healthy.bubble.y;
    const scale = jest.spyOn(failed.bubble.scale, 'set').mockImplementationOnce(() => { throw new Error('stale Kanta bubble'); });
    expect(() => [...callbacks].forEach(callback => callback({ deltaMS: 40 }))).not.toThrow();
    scale.mockRestore();
    expect(failed.controller.ownsBase(failed.base)).toBe(false);
    expect(failed.bubbles.destroyed).toBe(true);
    expect(healthy.controller.ownsBase(healthy.base)).toBe(true);
    expect(healthy.bubble.y).not.toBe(priorY);
    expect(callbacks.size).toBe(2); // Shared visibility plus only the healthy bubble ticker.
    healthy.controller.dispose();
    expect(callbacks.size).toBe(0);
    expect(getSpecialDiceIdleVisibilityStats().owners).toBe(0);
  } finally {
    controllers.forEach(controller => controller.dispose());
    board.destroy({ children: true }); STATE.app = null; load.mockRestore();
  }
});
