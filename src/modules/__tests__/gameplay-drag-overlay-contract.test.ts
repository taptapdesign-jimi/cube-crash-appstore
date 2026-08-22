import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const dragSource = fs.readFileSync(path.join(root, 'src/modules/drag-core.ts'), 'utf8');
const installSource = fs.readFileSync(path.join(root, 'src/modules/install-drag.ts'), 'utf8');

describe('gameplay drag overlay contract', () => {
  test('keeps the active tile above the Pixi HUD without raising its shared parent', () => {
    expect(installSource).toContain("dragLayer.label = 'GAMEPLAY_DRAG_OVERLAY';");
    expect(installSource).toContain('dragLayer.zIndex = 12_000;');
    expect(installSource).toContain('dragLayerParent.addChild(dragLayer);');
    expect(dragSource).toContain('t.zIndex = DRAG_LAYER_Z_INDEX;');
    expect(dragSource).not.toContain('t.zIndex = 9999;');
    expect(dragSource).not.toContain('activeDragLayer.zIndex =');
  });

  test('mirrors the board transform so every existing scale-to-one owner stays safe', () => {
    expect(installSource).toContain('dragLayer.position.copyFrom(board.position);');
    expect(installSource).toContain('dragLayer.scale.copyFrom(board.scale);');
    expect(installSource).toContain('dragLayer.pivot.copyFrom(board.pivot);');
    expect(installSource).toContain('dragLayer.skew.copyFrom(board.skew);');
    expect(installSource).toContain('dragLayer.rotation = board.rotation;');
    expect(installSource).toContain('syncDragLayer: syncDragLayerTransform,');
    expect(dragSource).toContain('try { syncDragLayer?.(); } catch {}');
  });

  test('the retained drag cleanup also retires the overlay and resize listener', () => {
    expect(installSource).toContain("window.removeEventListener('resize', setHitArea);");
    expect(installSource).toContain('dragLayer.removeFromParent();');
    expect(installSource).toContain('dragLayer.destroy({ children: false });');
    expect(installSource).toContain('drag.cleanup = cleanup;');
  });

  test('preserves board-local transforms without a stale first-frame world-matrix conversion', () => {
    expect(dragSource).toContain('if (originalParent === board && layer !== board)');
    expect(dragSource).toContain('originalParent.removeChild?.(t);');
    expect(dragSource).toContain('layer.addChild?.(t);');
    expect(dragSource).toContain('if (originalParent === board && t.parent === activeDragLayer)');
    expect(dragSource.indexOf('if (originalParent === board && layer !== board)'))
      .toBeLessThan(dragSource.indexOf("else if (typeof layer.reparentChild === 'function')"));
  });

  test('keeps fallback world transforms and converts board-space movement inside the overlay', () => {
    expect(dragSource).toContain("else if (typeof layer.reparentChild === 'function')");
    expect(dragSource).toContain('originalParent.reparentChildAt(t, clampedIndex);');
    expect(dragSource).toContain('const globalPoint = board.toGlobal?.(boardPoint) ?? boardPoint;');
    expect(dragSource).toContain('const parentPoint = positionInParentFromGlobal(t.parent, globalPoint);');
    expect(dragSource).toContain('const tileBoardPosition = getTileBoardPosition(tile);');
    expect(dragSource).toContain('const magnetPosition = getTileBoardPosition(t);');
    expect(dragSource).toContain('const srcBoardPosition = getTileBoardPosition(src);');
    expect(dragSource).toContain('restoreZ(t);\n    clearHover({ immediateMagnet: true });\n    autoCenter(t, target);');
  });

  test('keeps pickup scale relative to the world transform preserved by the overlay', () => {
    expect(dragSource).toContain('const overlayScaleX = Number(t.scale?.x) || 1;');
    expect(dragSource).toContain('x: overlayScaleX * 1.13,');
    expect(dragSource).toContain('x: overlayScaleX * 1.105,');
    expect(dragSource).not.toContain('x: 1.13,');
    expect(dragSource).not.toContain('x: 1.105,');
  });

  test('measures overlay and board tiles in the same board coordinate space', () => {
    expect(dragSource).toContain('const bounds = d.getBounds?.();');
    expect(dragSource).toContain('const a = board.toLocal({ x: bounds.x, y: bounds.y });');
    expect(dragSource).toContain('const b = board.toLocal({ x: bounds.x + bounds.width, y: bounds.y + bounds.height });');
  });

  test('restores board ownership before a board-local snap-back tween', () => {
    const snapBack = dragSource.split('function snapBack(t, onSnapBackComplete) {')[1]
      ?.split('// 🔥 NOTE: Do not cleanup explosion state on snapBack')[0] ?? '';

    expect(snapBack).toContain('restoreGridCell(t);');
    expect(snapBack).toContain('restoreZ(t);');
  });
});
