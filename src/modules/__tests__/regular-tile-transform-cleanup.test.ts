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

  test('idle squash always starts and exits at the canonical outer pose', () => {
    const owner = idleSource.split('function animateTile(tile: Tile): void {')[1]
      ?.split('function stopTileAnimation', 1)[0] ?? '';

    expect(owner).toContain('restoreCanonicalIdlePose(tile);');
    expect(owner).toContain('const baseTileScaleX = 1;');
    expect(owner).toContain('const baseTileScaleY = 1;');
    expect(owner).toContain('const originalRotation = 0;');
    expect(owner).toContain('const restoreIdlePose = () => {');
    expect(owner).toContain('if ((tile as any)._idleBounceTl !== tl) return;');
    expect(owner).toContain('onComplete: restoreIdlePose');
    expect(owner).toContain('onInterrupt: restoreIdlePose');
  });

  test('idle manager restart disposes previous timers and transform owners first', () => {
    const owner = idleSource.split('export function startTileIdleBounce(tiles: Tile[], board: any): void {')[1]
      ?.split('export function stopTileIdleBounce', 1)[0] ?? '';

    expect(owner).toContain('stopTileIdleBounce();');
    expect(owner.indexOf('stopTileIdleBounce();')).toBeLessThan(owner.indexOf('state.activeAnimations = new Set();'));
    expect(idleSource).toContain('stopForTile: stopTileIdleBounceForTile');
  });

  test('post-FX repair catches mild unowned outer squash without stealing live animation ownership', () => {
    const owner = appCoreSource.split("function repairBoardTileVisuals(reason = 'unknown'): void {")[1]
      ?.split('function collectBoardGameplayTiles', 1)[0] ?? '';

    expect(owner).toContain('Math.abs(sx - 1) > 0.005');
    expect(owner).toContain('Math.abs(sy - 1) > 0.005');
    expect(owner).toContain('t._idleBounceTl != null');
    expect(owner).toContain('t._mergeImpactTl != null');
    expect(owner).toContain('if (isRegularPlayableTile && !hasOuterTransformOwner && hasStaleOuterPose)');
    expect(owner).toContain('t._ccDragBaseScaleX = 1;');
    expect(owner).toContain('t._ccDragBaseScaleY = 1;');
  });
});
