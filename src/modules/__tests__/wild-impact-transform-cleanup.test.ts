import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const fxSource = fs.readFileSync(path.join(root, 'src/modules/fx.ts'), 'utf8');
const appCoreSource = fs.readFileSync(path.join(root, 'src/modules/app-core.ts'), 'utf8');

describe('wild impact transform cleanup', () => {
  test('one timeline owns squash and restores the complete inner transform on every exit', () => {
    const impactOwner = fxSource.split('export function wildImpactEffect(tile, opts = {})')[1]
      ?.split('export function startWildIdle')[0] ?? '';

    expect(impactOwner).toContain('g._ccWildImpactTl = tl;');
    expect(impactOwner).toContain('onComplete: restoreImpactTransform');
    expect(impactOwner).toContain('onInterrupt: restoreImpactTransform');
    expect(impactOwner).toContain('g.scale?.set?.(sx, sy)');
    expect(impactOwner).toContain('g.rotation = 0');
    expect(impactOwner).not.toContain('trackTween(g.scale');
    expect(impactOwner).not.toContain('trackFromTo(g.scale');
  });

  test('late board repair checks rotG rather than only the outer tile scale', () => {
    const repairOwner = appCoreSource.split("function repairBoardTileVisuals(reason = 'unknown')")[1]
      ?.split('function collectBoardGameplayTiles')[0] ?? '';

    expect(repairOwner).toContain('const hasStaleInnerSquash =');
    expect(repairOwner).toContain('Math.abs(rotScaleX - rotScaleY) > 0.08');
    expect(repairOwner).toContain('t.rotG.scale?.set?.(1, 1)');
    expect(repairOwner).toContain('t.rotG.rotation = 0');
    expect(repairOwner).toContain('t !== drag?.t');
    expect(repairOwner).toContain('!(t.rotG as any)._ccWildImpactTl');
  });
});
