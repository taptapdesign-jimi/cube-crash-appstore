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
    expect(dragSource).toContain('activeDragLayer.zIndex = DRAG_LAYER_Z_INDEX;');
    expect(dragSource).not.toContain('activeDragLayer.parent.zIndex =');
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

  test('repairs a restart-surviving overlay and avoids stale world-matrix movement for direct board children', () => {
    expect(dragSource).toContain('const expectedParent = board?.parent || app?.stage || null;');
    expect(dragSource).toContain('if (expectedParent && activeDragLayer.parent !== expectedParent)');
    expect(dragSource).toContain('activeDragLayer.visible = true;');
    expect(dragSource).toContain('activeDragLayer.renderable = true;');
    expect(dragSource).toContain('activeDragLayer.alpha = 1;');
    expect(dragSource).toContain('if ((t as any)._dragOriginalParent === board && t.parent === layer)');
    expect(dragSource).toContain('t.position.set(px, py);');
    expect(dragSource.indexOf('t.position.set(px, py);'))
      .toBeLessThan(dragSource.indexOf('const globalPoint = board.toGlobal?.(boardPoint) ?? boardPoint;', dragSource.indexOf('t.position.set(px, py);')));
  });

  test('bounds repeated pickup feedback to one immutable tile-local baseline', () => {
    expect(dragSource).toContain('const pickupBaseScale = resetTileToCanonicalDragScale(t);');
    expect(dragSource).toContain('const overlayScaleX = pickupBaseScale.x;');
    expect(dragSource).toContain('x: overlayScaleX * PICKUP_PEAK_SCALE_X,');
    expect(dragSource).toContain('x: overlayScaleX * PICKUP_HOLD_SCALE,');
    expect(dragSource).toContain('tile?._ccPickupScaleTimeline?.kill?.();');
    expect(dragSource).toContain('tile?._ccSnapBackTimeline?.kill?.();');
    expect(dragSource).toContain('animationManager.killExternalTimeline(tile?._mergeImpactTl);');
    expect(dragSource).toContain('animationManager.killExternalTimeline(tile?._idleBounceTl);');
    expect(dragSource).toContain('tile?.scale?.set?.(base.x, base.y);');
    expect(dragSource).toContain('Math.abs(liveX - liveY) <= 0.005');
    expect(dragSource).not.toContain('const overlayScaleX = Number(t.scale?.x) || 1;');
  });

  test('snap-back restores the same canonical scale and exposes one interruptible owner', () => {
    const snapBack = dragSource.split('function snapBack(t, onSnapBackComplete) {')[1]
      ?.split('\n  function onCancel', 1)[0] ?? '';

    expect(snapBack).toContain('const baseScale = resetTileToCanonicalDragScale(t);');
    expect(snapBack).toContain('t._ccSnapBackTimeline = tl;');
    expect(snapBack).toContain('t.scale.set(baseScale.x, baseScale.y);');
    expect(snapBack).toContain('x: baseScale.x * 1.035,');
    expect(snapBack).toContain('x: baseScale.x,');
    expect(snapBack).toContain('if (t?.scale) t.scale.set(baseScale.x, baseScale.y);');
    expect(snapBack).not.toContain('t.scale.set(1, 1);');
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

  test('attributes every physical drag to its archetype, frame budget and trail cost', () => {
    expect(dragSource).toContain('tileKind: getDragTileKind(tile)');
    expect(dragSource).toContain('estimatedFps: sample.tickerTotalMs > 0');
    expect(dragSource).toContain('tickerOver50Ms: sample.tickerOver50Ms');
    expect(dragSource).toContain('trailTotalMs: Number(sample.trailTotalMs.toFixed(2))');
    expect(dragSource).toContain('maxSpeedPxPerMs: Number(sample.maxSpeedPxPerMs.toFixed(3))');
  });

  test('samples visual ownership sparsely and emits the first disappearance reason once', () => {
    expect(dragSource).toContain('sample.tickerFrames % 6 === 0');
    expect(dragSource).toContain("? 'missing-parent'");
    expect(dragSource).toContain("? 'visible-false'");
    expect(dragSource).toContain("? 'alpha-zero'");
    expect(dragSource).toContain("? 'base-visible-false'");
    expect(dragSource).toContain("? 'rotG-visible-false'");
    expect(dragSource).toContain("? 'outside-renderer'");
    expect(dragSource).toContain("const message = `[CC_DRAG_VIS] ${JSON.stringify(payload)}`;");
  });
});
