import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const dragSource = fs.readFileSync(path.join(root, 'src/modules/drag-core.ts'), 'utf8');
const installSource = fs.readFileSync(path.join(root, 'src/modules/install-drag.ts'), 'utf8');

describe('gameplay drag overlay contract', () => {
  test('keeps the active tile above the Pixi HUD without raising its shared parent', () => {
    expect(installSource).toContain('dragLayer: board.parent || board');
    expect(dragSource).toContain('t.zIndex = DRAG_LAYER_Z_INDEX;');
    expect(dragSource).not.toContain('t.zIndex = 9999;');
    expect(dragSource).not.toContain('activeDragLayer.zIndex =');
  });

  test('preserves world transforms and converts board-space movement inside the overlay', () => {
    expect(dragSource).toContain("if (typeof layer.reparentChild === 'function')");
    expect(dragSource).toContain('originalParent.reparentChildAt(t, clampedIndex);');
    expect(dragSource).toContain('const globalPoint = board.toGlobal?.(boardPoint) ?? boardPoint;');
    expect(dragSource).toContain('const parentPoint = positionInParentFromGlobal(t.parent, globalPoint);');
    expect(dragSource).toContain('const tileBoardPosition = getTileBoardPosition(tile);');
    expect(dragSource).toContain('const magnetPosition = getTileBoardPosition(t);');
    expect(dragSource).toContain('const srcBoardPosition = getTileBoardPosition(src);');
    expect(dragSource).toContain('restoreZ(t);\n    clearHover({ immediateMagnet: true });\n    autoCenter(t, target);');
  });

  test('restores board ownership before a board-local snap-back tween', () => {
    const snapBack = dragSource.split('function snapBack(t, onSnapBackComplete) {')[1]
      ?.split('// 🔥 NOTE: Do not cleanup explosion state on snapBack')[0] ?? '';

    expect(snapBack).toContain('restoreGridCell(t);');
    expect(snapBack).toContain('restoreZ(t);');
  });
});
