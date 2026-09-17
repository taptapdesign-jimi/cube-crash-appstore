import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the real closure handlers, including movement threshold and queued
// frame processing. Rendering/merge sinks are isolated from Pixi's WebGL setup.
const source = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/drag-core.ts'), 'utf8');
const ast = ts.createSourceFile('drag-core.ts', source, ts.ScriptTarget.Latest, true);
const names = new Set(['eventPointerId', 'isActivePointerEvent', 'processMove', 'processQueuedMove', 'onMove', 'onUp', 'onCancel']);
const handlers: string[] = [];
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name && names.has(node.name.text)) handlers.push(node.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
const compiled = ts.transpileModule(
  handlers.join('\n').replace(/import\.meta\.env\.DEV/g, 'false') + '\nexports.handlers = { onMove, onUp, onCancel };',
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText;

function fixture() {
  const board = { toLocal: (point: any) => ({ x: (point.x - 20) / 2, y: point.y / 2 }) };
  const tile: any = { value: 2, x: 0, y: 0, _dragOriginalParent: board };
  tile.parent = board;
  tile.position = { set: (x: number, y: number) => { tile.x = x; tile.y = y; } };
  const target = { value: 3, x: 100, y: 0 };
  const drag: any = {
    t: tile, pointerId: 7, pointerType: 'touch', moved: false, startX: 0, startY: 0, offX: 0, offY: 0,
    _lastGlobal: { x: 20, y: 0 }, _pendingMoveEvent: null, _moveRaf: null,
    vx: 0, vy: 0, lagX: 0, lagY: 0, lastTime: 0,
  };
  const rafs = new Map<number, () => void>();
  let nextRaf = 0;
  const snapBack = jest.fn();
  const onMerge = jest.fn();
  const movePaint = jest.fn();
  const scope: any = {
    exports: {}, drag, board, app: {}, window: {}, console, performance: { now: () => 16 }, helpers: {},
    VEL_SMOOTH: 0.1, TOUCH_TILT_MAX_RAD: 0.16, TILT_MAX_RAD: 0.22, TILT_SCALE: 18,
    requestAnimationFrame: (fn: () => void) => { rafs.set(++nextRaf, fn); return nextRaf; },
    cancelAnimationFrame: (id: number) => rafs.delete(id),
    restartDragWatchdog: jest.fn(), shouldUseTouchDragPerformanceMode: () => true,
    getDragLayer: () => board, updateSpecialDiceIdleDragMotion() {}, refreshSpecialDiceIdleDragFacing() {},
    refreshGameplayDragForeground: movePaint, emitRegularDragTrail() {}, isAnyWildTile: () => false,
    stabilizeHoverTarget: () => null, showHover() {}, releaseMagnet() {}, clearHover() {},
    pickDropTarget: (src: any) => Math.abs(src.x - target.x) < 10 ? target : null,
    setActiveDragArtworkDragging() {}, emitFastStackTrace() {}, finishDragPerfSample() {},
    TILE_IDLE_BOUNCE: { notifyInteraction() {} },
    clearDragRuntime: () => {
      if (drag._moveRaf !== null) rafs.delete(drag._moveRaf);
      drag._moveRaf = null; drag._pendingMoveEvent = null; drag.pointerId = null;
    },
    isGameplayTileCandidate: () => true, getTiles: () => [tile, target], canDrop: () => true,
    restoreZ() {}, autoCenter() {}, getTileSpecial: () => null, getSpecialDiceVariantForTile: () => null,
    beginMergePerformanceTrace() {}, schedulePostFailedDropEndgameCheck() {}, snapBack, onMerge,
  };
  vm.runInNewContext(compiled, scope);
  return { ...scope.exports.handlers, drag, tile, target, rafs, snapBack, onMerge, movePaint };
}
const event = (x: number, pointerId = 7) => ({ pointerId, pointerType: 'touch', global: { x, y: 0 } });

describe('final pointer release coordinates', () => {
  test('accepts a real final drop without a delivered move, through board-local conversion', () => {
    const f = fixture();
    f.onUp(event(220));
    expect(f.tile.x).toBe(100);
    expect(f.movePaint).toHaveBeenCalledTimes(1);
    expect(f.onMerge).toHaveBeenCalledWith(f.tile, f.target, expect.anything());
    expect(f.snapBack).not.toHaveBeenCalled();
  });
  test('replaces an older queued move with the final point and processes one frame', () => {
    const f = fixture();
    f.onMove(event(100));
    expect(f.rafs.size).toBe(1);
    f.onUp(event(220));
    expect(f.movePaint).toHaveBeenCalledTimes(1);
    expect(f.rafs.size).toBe(0);
    expect(f.onMerge).toHaveBeenCalledTimes(1);
  });
  test('small release jitter keeps the established four-pixel local tap threshold', () => {
    const f = fixture();
    f.onUp(event(26));
    expect(f.drag.moved).toBe(false);
    expect(f.snapBack).toHaveBeenCalledTimes(1);
    expect(f.onMerge).not.toHaveBeenCalled();
  });
  test('foreign pointer release neither consumes the queued move nor ends ownership', () => {
    const f = fixture();
    f.onMove(event(100));
    f.onUp(event(220, 8));
    expect(f.drag.t).toBe(f.tile);
    expect(f.rafs.size).toBe(1);
    expect(f.movePaint).not.toHaveBeenCalled();
  });
  test('cancel discards pending movement and snaps back without committing its final point', () => {
    const f = fixture();
    f.onMove(event(100));
    f.onCancel(event(220));
    expect(f.tile.x).toBe(0);
    expect(f.rafs.size).toBe(0);
    expect(f.snapBack).toHaveBeenCalledTimes(1);
    expect(f.onMerge).not.toHaveBeenCalled();
  });
  test('an already processed final point does not run another movement frame or merge twice', () => {
    const f = fixture();
    f.onMove(event(220));
    const pending = Array.from(f.rafs.values())[0] as () => void;
    f.rafs.clear();
    pending();
    f.onUp(event(220));
    f.onUp(event(220));
    expect(f.movePaint).toHaveBeenCalledTimes(1);
    expect(f.onMerge).toHaveBeenCalledTimes(1);
  });
  test('release at origin supersedes an unpainted excursion instead of dropping at its stale point', () => {
    const f = fixture();
    f.onMove(event(220));
    f.onUp(event(20));
    expect(f.tile.x).toBe(0);
    expect(f.onMerge).not.toHaveBeenCalled();
    expect(f.snapBack).toHaveBeenCalledTimes(1);
  });
  test('missing release coordinates preserve a valid queued move', () => {
    const f = fixture();
    f.onMove(event(220));
    f.onUp({ pointerId: 7 });
    expect(f.onMerge).toHaveBeenCalledTimes(1);
  });
});
