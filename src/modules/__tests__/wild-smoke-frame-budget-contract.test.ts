import fs from 'fs';
import path from 'path';

describe('wild smoke frame budget', () => {
  const core = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
  const fx = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/fx.ts'), 'utf8');

  test('both high-strength wild paths cap synchronous Graphics/timeline creation', () => {
    expect(core).toContain('maxParticles: 72');
    expect(core).toContain('wild-smoke-alt-created');
    expect(core).toContain('wild-smoke-main-created');
    expect(fx).toContain('const COUNT     = Math.min(requestedCount, maxParticles)');
    expect(core.match(/deferFutureBursts: true/g)).toHaveLength(2);
    expect(core.match(/groupedOwner: true/g)?.length).toBeGreaterThanOrEqual(2);
    expect(fx).toContain('trackDelayedCall(burstIndex * BURST_GAP, () => buildBurst(burstIndex))');
    expect(fx).toContain('buildBurst(0)');
  });

  test('warms pooled Graphics in tracked post-enter batches instead of a merge frame', () => {
    const pool = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/object-pool.ts'), 'utf8');
    expect(pool).toContain('prewarmToSize(targetSize: number)');
    expect(core).toContain('prewarmWildSmokeGraphicsPool(Math.min(76, warmupBatch * 8))');
    expect(core).toContain('260 + (warmupBatch * 70)');
  });
});
