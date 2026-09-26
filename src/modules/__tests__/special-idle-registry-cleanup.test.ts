import { Assets, Container, Sprite, Texture } from 'pixi.js';
import { STATE } from '../app-state';
import { SPECIAL_DICE_VARIANTS, getCoreWildTypeForSpecialDiceVariant } from '../special-dice-registry';
import { startSpecialDiceIdleMotion, stopSpecialDiceIdleMotion } from '../special-dice-idle';
import { getSpecialDiceIdleVisibilityStats } from '../special-dice-idle-visibility';
import { getAnimatedSpecialArtworkLayerStats } from '../animated-special-artwork-layer';
import { getSharedPixiSheetCacheStats, resetSharedPixiSheetAnimationForTests } from '../shared-pixi-sheet-animation';
import animationManager from '../animation-manager';

describe('registry-wide special idle interruption and late readiness', () => {
  test.each(Object.values(SPECIAL_DICE_VARIANTS).map(variant => [variant.id, variant] as const))(
    '%s releases its real idle owner before a pending asset can complete', async (_id, variant) => {
      jest.useFakeTimers();
      const stage = new Container(); const callbacks = new Set<(ticker: any) => void>();
      const host = document.createElement('div'); const canvas = document.createElement('canvas');
      host.appendChild(canvas); document.body.appendChild(host);
      canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 844 } as DOMRect);
      STATE.app = { stage, canvas, renderer: { screen: { width: 390, height: 844 } },
        ticker: { add: (fn: any) => callbacks.add(fn), remove: (fn: any) => callbacks.delete(fn) } } as any;
      let finish!: (texture: Texture) => void;
      const pending = new Promise<Texture>(resolve => { finish = resolve; });
      jest.spyOn(Assets, 'load').mockReturnValue(pending as any);
      jest.spyOn(Assets, 'get').mockReturnValue(undefined as any);
      jest.spyOn(Assets, 'unload').mockResolvedValue(undefined);
      const tile: any = stage.addChild(new Container());
      tile.rotG = tile.addChild(new Container()); tile.base = tile.rotG.addChild(new Sprite(Texture.WHITE));
      tile._ccSpecialDiceVariant = variant.id; tile.special = getCoreWildTypeForSpecialDiceVariant(variant);
      const initialTimelines = animationManager.getStats().activeTimelines;
      try {
        startSpecialDiceIdleMotion(tile);
        tile.alpha = 0;
        [...callbacks].forEach(callback => callback({ elapsedMS: 100, deltaMS: 100 }));
        stopSpecialDiceIdleMotion(tile);
        stopSpecialDiceIdleMotion(tile);
        expect(getSpecialDiceIdleVisibilityStats().owners).toBe(0);
        expect(getAnimatedSpecialArtworkLayerStats().owners).toBe(0);
        expect(getSharedPixiSheetCacheStats().activeRefs).toBe(0);
        expect(animationManager.getStats().activeTimelines).toBe(initialTimelines);
        expect(callbacks.size).toBe(0);
        finish(Texture.WHITE);
        for (let turn = 0; turn < 12; turn++) await Promise.resolve();
        expect(getSpecialDiceIdleVisibilityStats().owners).toBe(0);
        expect(getAnimatedSpecialArtworkLayerStats().owners).toBe(0);
        expect(getSharedPixiSheetCacheStats().activeRefs).toBe(0);
        expect(callbacks.size).toBe(0);
      } finally {
        stopSpecialDiceIdleMotion(tile); resetSharedPixiSheetAnimationForTests();
        stage.destroy({ children: true }); host.remove(); STATE.app = null;
        jest.restoreAllMocks(); jest.useRealTimers();
      }
    },
  );
});
