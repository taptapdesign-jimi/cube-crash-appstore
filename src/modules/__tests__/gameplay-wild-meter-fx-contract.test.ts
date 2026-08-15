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

  it('emits smoke from the live moved fill rather than the static track origin', () => {
    expect(hudSource).toContain('const fillPoint = container._fill.toGlobal({');
    expect(hudSource).toContain("typeof hudStage.toLocal === 'function' ? hudStage.toLocal(fillPoint) : fillPoint");
  });
});
