import fs from 'node:fs';
import path from 'node:path';

describe('gameplay wild meter fill FX contract', () => {
  const repoRoot = path.resolve(__dirname, '../../..');
  const hudSource = fs.readFileSync(path.join(repoRoot, 'src/modules/hud-helpers.ts'), 'utf8');
  const appSource = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core.ts'), 'utf8');

  it('isolates the orange fill from its track and exposes only that layer to gyro', () => {
    expect(hudSource).toContain("fillSpatialLayer.label = 'wildMeterFillSpatialLayer'");
    expect(hudSource).toContain("fillBounceLayer.label = 'wildMeterFillBounceLayer'");
    expect(hudSource).toContain('container._fillSpatialWrapper = fillSpatialLayer');
    expect(hudSource).toContain('wildMeterSpatialWrapper = wild.view._fillSpatialWrapper ?? null');
    expect(hudSource).toContain('HUD_ROOT.addChild(wild.view)');
  });

  it('removes the masked burn and every persistent idle particle owner', () => {
    expect(hudSource).toContain('fillBounceLayer.addChild(fill);');
    expect(hudSource).toContain('container.addChild(bg, fillSpatialLayer, dashLine);');
    expect(hudSource).not.toContain('wildMeterFillFxLayer');
    expect(hudSource).not.toContain('fillFxMask');
    expect(hudSource).not.toContain('fillBurn');
    expect(hudSource).not.toContain('wild-meter-boil-bubble');
    expect(hudSource).not.toContain('wild-meter-honey-tip-bubble');
    expect(hudSource).not.toContain('_boilInterval');
    expect(hudSource).not.toContain('fillShimmer');
    expect(hudSource).not.toContain('FillIdleShimmer');
    expect(hudSource).not.toContain('_fillIdleShimmerTimeline');
    expect(hudSource).not.toContain('BlurFilter');
  });

  it('restores the lightweight v915 smoke only while fill or refill is moving', () => {
    expect(hudSource).toContain('const emitV915WildMeterSmoke = () =>');
    expect(hudSource).toContain("smokeBubble.label = 'wild-meter-smoke';");
    expect(hudSource).toContain('const radius = 2.5 + Math.pow(Math.random(), 1.7) * 3;');
    expect(hudSource).toContain("smokeBubble.circle(0, 0, radius).fill({ color: 0xF86B3C, alpha: 0.5 });");
    expect(hudSource).toContain('duration: 1.0 + Math.random() * 0.3,');
    expect(hudSource).toContain("ease: 'power1.out'");
    expect(hudSource).toContain('}, 100);');
    expect(hudSource).toContain('if (isGrowing) startV915WildMeterSmoke();');
    expect(hudSource).toContain('if (latestRatio > 0) startV915WildMeterSmoke();');
    expect(hudSource).toContain('stopWildMeterSmokeEmission();');
    expect(hudSource).toContain('container._stopWildMeterSmoke = stopWildMeterSmoke;');
    expect(hudSource).toContain('activeWildMeterSmoke.clear();');
    expect(appSource).toContain('wild?.view?._stopWildMeterSmoke?.();');
  });

  it('uses one dedicated full-charge drain and overflow-refill owner', () => {
    expect(hudSource).toContain('container.consumeProgress = runChargeConsumption');
    expect(hudSource).toContain('getWildMeterDrainGeometry(maxWidth, drain.progress)');
    expect(hudSource).toContain('container._pendingProgressRatio = progress');
    expect(hudSource).toContain('container._consumeQueue.push(progress)');
    expect(hudSource).toContain('duration: 0.34,');
    expect(hudSource).not.toContain('duration: progress > 0 ? 0.34 : 0.01');
    expect(hudSource).toContain('if (latestRatio > 0) playFillVerticalBounce(fillBounceLayer);');
    expect(hudSource).toContain("window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true");
    expect(appSource).toContain('animateWildMeterChargeConsumption: HUD.animateWildMeterChargeConsumption');
    expect(appSource).not.toContain('wild.setProgress(displayRatio, true);');
    const addProgressSource = appSource.split('function addWildProgress(')[1]
      ?.split('\nfunction resetWildProgress', 1)[0] ?? '';
    expect(addProgressSource).not.toContain('gsap.killTweensOf(wild?.view?._fill)');
    expect(addProgressSource).not.toContain('wild.view._currentAnimation.kill()');
  });

  it('pulses only after a newly full charge has visibly settled at 100 percent', () => {
    expect(hudSource).toContain('if (reachedFull) playFillVerticalBounce(fillBounceLayer);');
    expect(hudSource).toContain('if (!reachedFull) playFillVerticalBounce(fillBounceLayer);');
  });

  it('cancels charge-cycle state during a hard HUD meter reset', () => {
    expect(hudSource).toContain('wild.view._consumeGeneration = (wild.view._consumeGeneration || 0) + 1');
    expect(hudSource).toContain('wild.view._consumeActive = false');
    expect(hudSource).toContain('wild.view._consumeQueue.length = 0');
    expect(hudSource).toContain('wild.view._pendingProgressRatio = null');
  });
});
