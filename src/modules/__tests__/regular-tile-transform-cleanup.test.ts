import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const appCoreSource = fs.readFileSync(path.join(root, 'src/modules/app-core.ts'), 'utf8');
const idleSource = fs.readFileSync(path.join(root, 'src/modules/tile-idle-bounce.ts'), 'utf8');

describe('regular tile transform cleanup', () => {
  test('stack contact restores neutral scale on completion and interruption', () => {
    const owner = appCoreSource.split('function playMergeImpactAndAbsorbAnimation(targetTile: any): void {')[1]
      ?.split('function playRegularMergeContactPresentation', 1)[0] ?? '';

    expect(owner).toContain('const restoreNeutralPose = () => {');
    expect(owner).toContain('if ((targetTile as any)._mergeImpactTl !== tl) return;');
    expect(owner).toContain('targetTile.scale.set(1, 1);');
    expect(owner).toContain('(targetTile as any)._ccDragBaseScaleX = 1;');
    expect(owner).toContain('(targetTile as any)._ccDragBaseScaleY = 1;');
    expect(owner).toContain('onComplete: restoreNeutralPose');
    expect(owner).toContain('onInterrupt: restoreNeutralPose');
  });

  test('idle squash restores its captured neutral pose on every exit', () => {
    const owner = idleSource.split('function animateTile(tile: Tile): void {')[1]
      ?.split('function stopTileAnimation', 1)[0] ?? '';

    expect(owner).toContain('const restoreIdlePose = () => {');
    expect(owner).toContain('if ((tile as any)._idleBounceTl !== tl) return;');
    expect(owner).toContain('tile.scale.x = baseTileScaleX;');
    expect(owner).toContain('tile.scale.y = baseTileScaleY;');
    expect(owner).toContain('onComplete: restoreIdlePose');
    expect(owner).toContain('onInterrupt: restoreIdlePose');
  });
});
