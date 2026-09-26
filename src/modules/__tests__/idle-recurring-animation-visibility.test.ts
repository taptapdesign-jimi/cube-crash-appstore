import fs from 'node:fs';
import ts from 'typescript';
import { Container } from 'pixi.js';
import { gsap } from 'gsap';
import { STATE } from '../app-state';
import animationManager from '../animation-manager';
import { getSpecialDiceVariantForTile } from '../special-dice-registry';
import { createSpecialIdleAnimationVisibility, getSpecialDiceIdleVisibilityStats } from '../special-dice-idle-visibility';

const names = ['startWildIdle', 'stopWildIdle', 'startWildShimmer', 'stopWildShimmer', 'startTntIdleShake', 'stopTntIdleShake'];
const parsed = ts.createSourceFile('fx.ts', fs.readFileSync('src/modules/fx.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const source = parsed.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text || ''))
  .map(node => node.getText(parsed).replace(/^export /, '')).join('\n');

describe('recurring idle animation visibility and stale completion', () => {
  test.each([
    ['Wild shimmer', 'startWildShimmer', 'stopWildShimmer', 'wild', undefined],
    ['legacy idle', 'startWildIdle', 'stopWildIdle', 'wild-magnet', undefined],
    ['TNT sway', 'startTntIdleShake', 'stopTntIdleShake', 'wild-tnt', undefined],
    ['LaserGun twitch', 'startTntIdleShake', 'stopTntIdleShake', 'wild-tnt', 'laser-gun'],
  ])('%s retains delay phase while hidden and rejects retired callbacks after replacement', (_name, start, stop, special, variant) => {
    const ticks = new Set<() => void>(); const delayed: gsap.core.Tween[] = [];
    const animations: gsap.core.Animation[] = []; const calls = new Set();
    STATE.app = { ticker: { add: (fn: () => void) => ticks.add(fn), remove: (fn: () => void) => ticks.delete(fn) } } as any;
    const tile: any = new Container(); tile.rotG = tile.addChild(new Container());
    tile.special = special; tile._ccSpecialDiceVariant = variant;
    const dependencies = {
      gsap, animationManager, getSpecialDiceVariantForTile, createSpecialIdleAnimationVisibility,
      __globalDelayedCalls: calls, startWildStars() {}, stopWildStars() {}, destroyRuntimeTexture() {},
      trackTimeline(vars: any = {}) { const animation = animationManager.trackExternalTimeline(gsap.timeline(vars)); animations.push(animation); return animation; },
      trackDelayedCall(delay: number, callback: () => void) {
        const animation = animationManager.trackExternalTween(gsap.delayedCall(delay, callback));
        delayed.push(animation); animations.push(animation); return animation;
      },
      createWildShimmer(current: any) {
        current._wildShimmer = current.rotG.addChild(new Container());
        current._wildShimmerSprite = current._wildShimmer.addChild(new Container());
        return current._wildShimmer;
      },
    };
    const owners = new Function(...Object.keys(dependencies), ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
      + ';return {' + names.join(',') + '};')(...Object.values(dependencies));
    try {
      owners[start](tile);
      const firstDelay = delayed[0];
      const staleCompletion = firstDelay.eventCallback('onComplete');
      expect(firstDelay.paused()).toBe(false);
      tile.visible = false; [...ticks].forEach(tick => tick());
      expect(firstDelay.paused()).toBe(true);
      const playhead = firstDelay.totalTime();
      tile.visible = true; [...ticks].forEach(tick => tick());
      expect(firstDelay.paused()).toBe(false);
      expect(firstDelay.totalTime()).toBe(playhead);
      owners[stop](tile);
      expect(getSpecialDiceIdleVisibilityStats().owners).toBe(0);
      owners[start](tile);
      const liveCount = animations.length;
      staleCompletion.call(firstDelay);
      expect(animations).toHaveLength(liveCount);
      expect(getSpecialDiceIdleVisibilityStats().owners).toBe(1);
      owners[stop](tile);
      expect(ticks.size).toBe(0);
      expect(calls.size).toBe(0);
    } finally {
      owners[stop](tile); animations.forEach(animation => animation.kill());
      tile.destroy({ children: true }); STATE.app = null;
    }
  });
});
