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

  it('reuses one masked burn and contains no idle shimmer owner', () => {
    expect(hudSource).toContain("fillFxLayer.label = 'wildMeterFillFxLayer'");
    expect(hudSource).toContain('fillFxLayer.mask = fillFxMask');
    expect(hudSource).toContain('fillFxLayer.addChild(fillFxMask, fillBurn)');
    expect(hudSource).toContain('const playFillBurn = (targetWidth: number) =>');
    expect(hudSource).toContain('if (!keepsSameFillBurn) playFillBurn(width)');
    expect(hudSource).not.toContain('fillShimmer');
    expect(hudSource).not.toContain('FillIdleShimmer');
    expect(hudSource).not.toContain('_fillIdleShimmerTimeline');
    expect(hudSource).not.toContain('BlurFilter');
  });

  it('owns and clears the reusable burn timeline on reset, HUD replacement, and restart', () => {
    expect(hudSource).toContain('container._fillBurnTimeline.kill()');
    expect(hudSource).toContain('container._stopFillBurn = stopFillBurn');
    expect(hudSource).not.toContain('_stopFillFx');
    expect(hudSource).toContain('wild?.view?._stopFillBurn?.()');
    expect(appSource).toContain('wild?.view?._stopFillBurn?.()');
  });

  it('combines constant masked boiling with two restrained moving-tip puffs', () => {
    expect(hudSource).toContain("bubble.label = 'wild-meter-boil-bubble';");
    expect(hudSource).toContain('fillFxLayer.addChild(bubble);');
    expect(hudSource).toContain('fillFxLayer.mask = fillFxMask;');
    expect(hudSource).toContain('activeWildMeterBoilBubbles.size >= 3');
    expect(hudSource).toContain('const radius = 1.8 + Math.random() * 1.2;');
    expect(hudSource).toContain('.fill({ color: 0xFFA866, alpha: 0.78 })');
    expect(hudSource).toContain('.fill({ color: 0xFFE7B5, alpha: 0.9 });');
    expect(hudSource).toContain('syncWildMeterBoil(clampedWidth);');
    expect(hudSource).toContain('}, 180);');
    expect(hudSource).toContain('container._stopWildMeterBoil = stopWildMeterBoil;');
    expect(hudSource).toContain('container._syncWildMeterBoil = () => syncWildMeterBoil(container._liveFillWidth || 0);');
    expect(hudSource).toContain("puff.label = 'wild-meter-tip-puff';");
    expect(hudSource).toContain('const tipPoint = fill.toGlobal({ x: liveLeft + liveWidth, y: Math.random() * 2 });');
    expect(hudSource).toContain('for (let puffIndex = 0; puffIndex < 2; puffIndex += 1)');
    expect(hudSource).toContain('y: startY - 3 - Math.random() * 2,');
    expect(hudSource).toContain(".fill({ color: 0xFFD69A, alpha: 0.62 });");
    expect(hudSource).toContain('const activeWildMeterTipPuffs = new Set<any>();');
    expect(hudSource).toContain('if (isGrowing) startWildMeterTipPuffs();');
    expect(hudSource).toContain('}, 140);');
    expect(hudSource).toContain('container._stopWildMeterTipPuffs = stopWildMeterTipPuffs;');
    expect(appSource).toContain('wild?.view?._stopWildMeterTipPuffs?.();');
    expect(appSource).toContain('wild?.view?._stopWildMeterBoil?.();');
    expect(hudSource).not.toContain('BlurFilter');
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
