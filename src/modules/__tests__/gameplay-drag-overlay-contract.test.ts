import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const dragSource = fs.readFileSync(path.join(root, 'src/modules/drag-core.ts'), 'utf8');
const installSource = fs.readFileSync(path.join(root, 'src/modules/install-drag.ts'), 'utf8');
const hudSource = fs.readFileSync(path.join(root, 'src/modules/hud-helpers.ts'), 'utf8');
const styleSource = fs.readFileSync(path.join(root, 'src/style.css'), 'utf8');
const foregroundOwnerSource = fs.readFileSync(
  path.join(root, 'src/modules/gameplay-drag-foreground-owner.ts'),
  'utf8',
);
const artworkLayerSource = fs.readFileSync(
  path.join(root, 'src/modules/animated-special-artwork-layer.ts'),
  'utf8',
);
const appCoreSource = fs.readFileSync(path.join(root, 'src/modules/app-core.ts'), 'utf8');

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

  test('lifts every dragged die above the DOM top HUD only for the owned drag lifecycle', () => {
    const domHudZ = Number(hudSource.match(/height: 140px;\s*z-index: (\d+);/)?.[1]);
    const dragCanvasZ = Number(styleSource.match(
      /body\.gameplay-drag-active #app canvas \{\s*z-index: (\d+) !important;/,
    )?.[1]);
    const clearRuntime = dragSource.split('function clearDragRuntime() {')[1]
      ?.split('\n  function resetTileDragShadowPose', 1)[0] ?? '';

    expect(domHudZ).toBe(2000);
    expect(dragCanvasZ).toBeGreaterThan(domHudZ);
    expect(dragSource).toContain('releaseGameplayDragForeground = acquireGameplayDragForeground();');
    expect(clearRuntime).toContain('releaseGameplayDragForeground?.();');
    expect(clearRuntime).toContain('setActiveDragArtworkDragging(activeDragTile, false);');
    expect(foregroundOwnerSource).toContain("document.body?.classList.toggle('gameplay-drag-active', active);");
    expect(foregroundOwnerSource).toContain('activeOwners += 1;');
    expect(foregroundOwnerSource).toContain('activeOwners = Math.max(0, activeOwners - 1);');
    expect(styleSource).not.toContain('body.gameplay-drag-active #app {');
    expect(foregroundOwnerSource).toContain('refreshAnimatedSpecialArtworkDepth();');
    expect(artworkLayerSource).toContain('finaleDepthOwners > 0 && !gameplayDragActive');
    expect(artworkLayerSource).toContain("dragOverlayRoot.className = 'animated-special-artwork-drag-layer';");
    expect(artworkLayerSource).toContain("console.info('[CC_DRAG_DEPTH]', payload);");
  });

  test('portals every direct SVG wrapper through the same drag foreground owner', () => {
    const artworkFiles = [
      'juice-bounce-artwork.ts',
      'ball-bouncy-artwork.ts',
      'wild-star-bouncy-artwork.ts',
      'robo-bouncy-artwork.ts',
      'mushroom-bouncy-artwork.ts',
      'flower-bouncy-artwork.ts',
    ];
    for (const filename of artworkFiles) {
      const source = fs.readFileSync(path.join(root, 'src/modules', filename), 'utf8');
      expect(source).toContain('setAnimatedSpecialArtworkDragging(controller.wrapper, dragging);');
      expect(source).toContain('gameplayDragActive');
      expect(source).toContain('doesAnimatedSpecialArtworkOverlapGameplayDrag');
    }
    expect(artworkLayerSource).toContain('gameplayDragActive: isGameplayDragActive()');
    expect(artworkLayerSource).toContain('if (frameOwners.size > 0) updateAnimatedSpecialArtworkLayer();');
  });

  test('never pauses unrelated dice animations and publishes only overlap geometry', () => {
    expect(dragSource).not.toContain('pauseSpecialDiceIdleForDrag');
    expect(dragSource).not.toContain('_pausedSpecialIdleTiles');
    expect(dragSource).toContain('publishActiveDragBounds(t);');
    expect(dragSource).toContain('setGameplayDragBounds(null);');
    expect(foregroundOwnerSource).toContain('__ccGameplayDragBounds = bounds');
    expect(artworkLayerSource).toContain('doesAnimatedSpecialArtworkOverlapGameplayDrag');
  });

  test('captures artwork ownership independently of mutable drag.t for cleanup retry', () => {
    expect(dragSource).toContain('let activeDragArtworkTile: any = null;');
    expect(dragSource).toContain('const ownedTile = dragging ? tile : (activeDragArtworkTile || tile);');
    expect(dragSource).toContain('if (dragging) activeDragArtworkTile = ownedTile;');
    expect(dragSource).toContain('if (!dragging) activeDragArtworkTile = null;');
    expect(dragSource).toContain('setActiveDragArtworkDragging(activeDragTile, false);');
  });

  test('retires active drag and every direct-SVG owner before restart or hard cleanup detaches the board', () => {
    expect(dragSource).toContain('cancelActive: cancelActiveDrag');
    expect(appCoreSource).toContain("(drag as any)?.cancelActive?.({ resumeIdle: false });");
    const restart = appCoreSource.split('async function performRestartGame(): Promise<void> {')[1]
      ?.split('\nasync function', 1)[0] ?? '';
    expect(restart.indexOf('cancelActive?.({ resumeIdle: false })'))
      .toBeLessThan(restart.indexOf("softResetBoardView('restartGame-immediate-clear')"));
    expect(restart.indexOf('stopSpecialDiceIdleMotion(tile)'))
      .toBeLessThan(restart.indexOf("softResetBoardView('restartGame-immediate-clear')"));
    const cleanup = appCoreSource.split('export function cleanupGame(')[1] ?? '';
    expect(cleanup.indexOf('cancelActive?.({ resumeIdle: false })'))
      .toBeLessThan(cleanup.indexOf('app.ticker.stop()'));
    expect(cleanup).toContain('stopSpecialDiceIdleMotion(t);');
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
    expect(dragSource).toContain('if (t.parent === readyDragLayer)');
    expect(dragSource).toContain('delete (t as any)._dragOriginalParent;');
    expect(dragSource).toContain('layer.parent?.sortChildren?.();');
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
