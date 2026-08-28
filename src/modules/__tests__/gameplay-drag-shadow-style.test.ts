import fs from 'node:fs';
import path from 'node:path';
import { ASSET_DRAG_SHADOW } from '../constants.js';
import {
  resolveDragShadowAppearance,
  resolveDragShadowPose,
  resolveDragShadowRevealDistance,
  resolveTiltedTileVisualCenter,
} from '../drag-shadow-pose.js';

const root = path.resolve(__dirname, '../../..');
const boardSource = fs.readFileSync(path.join(root, 'src/modules/board.ts'), 'utf8');
const dragSource = fs.readFileSync(path.join(root, 'src/modules/drag-core.ts'), 'utf8');

describe('gameplay drag shadow style', () => {
  test('uses the supplied image-backed shadow instead of rebuilding layered Graphics', () => {
    expect(ASSET_DRAG_SHADOW).toBe('./assets/shadow.png');
    const shadowPath = path.join(root, ASSET_DRAG_SHADOW.replace(/^\.\//, ''));
    const png = fs.readFileSync(shadowPath);
    expect(png.readUInt32BE(16)).toBe(520);
    expect(png.readUInt32BE(20)).toBe(520);
    expect(boardSource).toContain('const shadowVisual = new Sprite(getBoardTexture(ASSET_DRAG_SHADOW));');
    expect(boardSource).not.toContain('sh.clear()');
    expect(boardSource).not.toContain('for (let i = 9; i >= 0; i--)');
  });

  test('keeps pickup animation and directional deformation on separate transform owners', () => {
    const shadowCreation = boardSource.split('const sh = new Container();')[1]
      ?.split('// board center in board-local space')[0] ?? '';

    expect(shadowCreation).toContain('sh.addChild(shadowVisual);');
    expect(shadowCreation).toContain('sh.alpha = 0;');
    expect(shadowCreation.indexOf('sh.alpha = 0;'))
      .toBeLessThan(shadowCreation.indexOf('t._ccSpatialG.addChild(sh);'));
    expect(boardSource).toContain('shadowVisual.position.set(');
    expect(boardSource).toContain('shadowVisual.rotation = 0');
    expect(boardSource).toContain('shadowBaseScaleX * appearance.scale');
  });

  test('restores the original filtered-velocity owner with a local fallback light', () => {
    expect(boardSource).toContain('resolveDragShadowRevealDistance(dx, dy, TILE)');
    expect(boardSource).toContain('shadowVisual.position.set(visualCenter.x + pose.x, visualCenter.y + pose.y)');
    expect(boardSource).not.toContain('t.x - boardCenterX');
    expect(boardSource).not.toContain('t.y - boardCenterY');
    expect(boardSource).not.toContain('ny * shift + 4 + biasY');
    expect(dragSource).toContain('const shadowVelocity = Math.hypot(drag.vx, drag.vy);');
    expect(dragSource).toContain('t._shadowDirX = -drag.vx;');
    expect(dragSource).toContain('t._shadowDirY = -drag.vy;');
    expect(dragSource).toContain('tile._shadowDirY = 1;');
    expect(dragSource).not.toContain('resolveDragShadowMotionStep');
    expect(dragSource).not.toContain('_shadowTravelPx');
    expect(dragSource).not.toContain('const shadowDragX = nx - drag.startX;');
  });

  test('keeps equal visible geometry and resolves all four drag directions behaviorally', () => {
    expect(boardSource).toContain('const shadowVisualScale = 1.42 * 0.7 * 1.1;');
    expect(boardSource).toContain('shadowVisual.width = TILE * shadowVisualScale;');
    expect(boardSource).toContain('shadowVisual.height = TILE * shadowVisualScale;');
    expect(dragSource).toContain('x: 1.03,');
    expect(dragSource).toContain('y: 1.03,');

    expect(resolveDragShadowPose(0, -20, 4)).toEqual({ x: 0, y: -4 });
    expect(resolveDragShadowPose(0, 20, 4)).toEqual({ x: 0, y: 4 });
    expect(resolveDragShadowPose(-20, 0, 4)).toEqual({ x: -4, y: 0 });
    expect(resolveDragShadowPose(20, 0, 4)).toEqual({ x: 4, y: 0 });

    expect(resolveDragShadowRevealDistance(0, 0, 128)).toBe(0);
    expect(resolveDragShadowRevealDistance(1, 0, 128)).toBeCloseTo(128 * 0.10);
    expect(resolveDragShadowRevealDistance(0.01, 0, 128)).toBeCloseTo(128 * 0.10);
    expect(resolveDragShadowRevealDistance(0, 1, 128)).toBeCloseTo(128 * 0.10);
    expect(resolveDragShadowRevealDistance(0, -1, 128)).toBeCloseTo(128 * 0.10);

    const staticAppearance = resolveDragShadowAppearance(0, 0, 0);
    expect(staticAppearance).toEqual({ alpha: 0.18, scale: 1, strength: 0 });
    const movingAppearance = resolveDragShadowAppearance(1, 0, 0);
    expect(movingAppearance).toEqual(staticAppearance);
    const tiltedAppearance = resolveDragShadowAppearance(0, 0, 0.08);
    expect(tiltedAppearance).toEqual({ alpha: 0.18, scale: 1.04, strength: 0.5 });
    const fullAppearance = resolveDragShadowAppearance(1, 0, 0);
    expect(fullAppearance).toEqual({ alpha: 0.18, scale: 1, strength: 0 });

    expect(dragSource).not.toContain('startDragShadowMotion');
    expect(dragSource).not.toContain('_shadowMotionRaf');

    const tilt = 0.16;
    const center = resolveTiltedTileVisualCenter(tilt, 128);
    expect(center.x).toBeCloseTo(-Math.sin(tilt) * 64);
    expect(center.y).toBeCloseTo(-64 + (Math.cos(tilt) * 64));
    expect(boardSource).toContain("t._ccSpatialG.addChild(sh);");
    expect(boardSource).toContain('visualCenter.x + pose.x, visualCenter.y + pose.y');
  });
});
