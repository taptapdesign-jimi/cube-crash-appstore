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
  });
});
