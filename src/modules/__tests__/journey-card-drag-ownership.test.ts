import fs from 'node:fs';
import ts from 'typescript';
import { getJourneyCardDragPresentationAngle, resolveJourneyCardDragAxis, shouldCommitJourneyCardReleasedDrag } from '../journey-card-overlay-modal';

// Execute the production input closures, retaining their real shared state.
// Only DOM/animation sinks are replaced; movement and release decisions are real.
const source = ts.createSourceFile('modal.ts', fs.readFileSync('src/modules/journey-card-overlay-modal.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const closures: string[] = [];
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && ['handlePointerMove', 'finishPointer'].includes(node.name?.text ?? '')) closures.push(node.getText(source));
  ts.forEachChild(node, visit);
}
visit(source);
const code = ts.transpileModule(closures.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture(face = 'front', angle = face === 'front' ? 0 : -180) {
  const scope: any = {
    activePointerId: 1, pointerTraceMoveCount: 0, dragStartX: 0, dragStartY: 0,
    dragLatestX: 0, dragLatestY: 0, dragStartAngle: angle, currentAngle: angle,
    stableFace: face, dragMoved: false, dragAxis: null, dragViewportWidth: 390,
    dragViewportHeight: 844, dragCardHeight: 400, dragCardRect: null,
    dragImpactStartTranslateX: 0, dragImpactStartTranslateY: 0, dragImpactStartScale: 1,
    dragHorizontalMinX: -4, dragHorizontalMaxX: 4, dragPresentationTranslateX: 0,
    dismissDragReleaseY: 0, dismissDragReleaseScale: 1,
    flipping: false, prefersReducedMotion: false, impactAnimation: null,
    dragPreviewSettleAnimation: null, JOURNEY_CARD_FLIP_TAP_SLOP_PX: 7,
    impactShell: { style: {} }, rotor: { releasePointerCapture: jest.fn(), hasPointerCapture: () => true },
    stage: { classList: { remove: jest.fn(), add: jest.fn() } },
    getJourneyCardDragPresentationAngle, resolveJourneyCardDragAxis, shouldCommitJourneyCardReleasedDrag,
    clamp01: (n: number) => Math.min(1, Math.max(0, n)),
    getJourneyCardDismissDragDistance: () => 88,
    isJourneyCardVerticalDismissGesture: (x: number, y: number) => Math.abs(y) > Math.abs(x),
    stableRotorAngle: () => face === 'front' ? 0 : -180,
    animateInteractiveFlip: jest.fn(), beginClose: jest.fn(),
    setRotorAngle: (n: number) => { scope.currentAngle = n; },
  };
  const proxy = new Proxy(scope, { has: () => true, get: (obj, key) => {
    if (key === Symbol.unscopables) return undefined;
    if (key in obj) return obj[key];
    if (key in globalThis) return (globalThis as any)[key];
    return obj[key] = jest.fn();
  } });
  const handlers = new Function('scope', `with(scope){${code}; return {handlePointerMove, finishPointer};}`)(proxy);
  const event = (x: number, y = 0, id = 1) => ({ pointerId: id, clientX: x, clientY: y, preventDefault: jest.fn(), stopPropagation: jest.fn(), composedPath: () => [] });
  return { scope, move: (x: number, y = 0, id = 1) => handlers.handlePointerMove(event(x, y, id)),
    up: (x: number, y = 0, id = 1, commit = true) => handlers.finishPointer(event(x, y, id), commit, commit ? 'rotor-up' : 'rotor-cancel') };
}

test('physical long swipe retains its origin through the next move and commits once on release', () => {
  const h = fixture();
  h.move(177.67); const first = h.scope.currentAngle;
  h.move(190); h.move(204.33);
  expect(h.scope.currentAngle).toBeGreaterThan(first);
  expect(h.scope.dragStartX).toBe(0);
  expect(h.scope.animateInteractiveFlip).not.toHaveBeenCalled();
  h.up(204.33);
  expect(h.scope.animateInteractiveFlip).toHaveBeenCalledTimes(1);
  expect(h.scope.animateInteractiveFlip).toHaveBeenCalledWith('back', undefined, h.scope.currentAngle);
  h.up(204.33); expect(h.scope.animateInteractiveFlip).toHaveBeenCalledTimes(1);
});

test('held reversal follows the original baseline; a deliberate backtrack settles without a flip', () => {
  const h = fixture(); h.move(180); h.move(90);
  expect(h.scope.currentAngle).toBeCloseTo(90 / 390 * 180);
  h.move(10); h.up(10);
  expect(h.scope.animateInteractiveFlip).not.toHaveBeenCalled();
  expect(h.scope.currentAngle).toBe(0);
});

test('back face and reverse-direction swipes complete their intended face', () => {
  const h = fixture('back'); h.move(-190); h.move(-210); h.up(-210);
  expect(h.scope.animateInteractiveFlip).toHaveBeenCalledWith('front', undefined, h.scope.currentAngle);
  const reversed = fixture(); reversed.move(190); reversed.move(-90); reversed.up(-90);
  expect(reversed.scope.currentAngle).toBeLessThan(0);
  expect(reversed.scope.animateInteractiveFlip).toHaveBeenCalledWith('back', undefined, reversed.scope.currentAngle);
});

test('a newer pointerup sample paints and resolves release intent', () => {
  const h = fixture(); h.move(20); h.up(100);
  expect(h.scope.currentAngle).toBeCloseTo(100 / 390 * 180);
  expect(h.scope.animateInteractiveFlip).toHaveBeenCalledTimes(1);
  const backtracked = fixture(); backtracked.move(190); backtracked.up(5);
  expect(backtracked.scope.animateInteractiveFlip).not.toHaveBeenCalled();
  expect(backtracked.scope.currentAngle).toBe(0);
});

test('foreign pointers cannot move or finish the contact; cancel never commits', () => {
  const h = fixture(); h.move(180, 0, 2); h.up(180, 0, 2);
  expect(h.scope.currentAngle).toBe(0); expect(h.scope.activePointerId).toBe(1);
  h.move(180); h.up(250, 0, 1, false);
  expect(h.scope.animateInteractiveFlip).not.toHaveBeenCalled();
  expect(h.scope.currentAngle).toBe(0);
});

test('tap and vertical artwork dismiss keep their dedicated paths', () => {
  const tap = fixture(); tap.up(2);
  expect(tap.scope.animateInteractiveFlip).toHaveBeenCalledWith('back', 1, 0);
  const dismiss = fixture(); dismiss.move(2, 100); dismiss.up(2, 100);
  expect(dismiss.scope.beginClose).toHaveBeenCalledWith('dismiss', true);
  expect(dismiss.scope.animateInteractiveFlip).not.toHaveBeenCalled();
});


test.each([-1, 1])('vertical artwork dismiss uses the same unflipped return in direction %i', (direction) => {
  const h = fixture();
  h.move(45, 140 * direction);
  expect(h.scope.currentAngle).toBe(0);
  expect(Math.sign(h.scope.dismissDragReleaseY)).toBe(direction);
  h.up(45, 140 * direction);
  h.up(45, 140 * direction);
  expect(h.scope.beginClose).toHaveBeenCalledTimes(1);
  expect(h.scope.beginClose).toHaveBeenCalledWith('dismiss', true);
  expect(h.scope.animateInteractiveFlip).not.toHaveBeenCalled();
});

test.each([-1, 1])('vertical stats dismiss retains its return flip in direction %i', (direction) => {
  const h = fixture('back');
  h.move(20, 140 * direction); h.up(20, 140 * direction);
  expect(h.scope.beginClose).toHaveBeenCalledWith('dismiss');
});

test.each([-1, 1])('short or cancelled vertical artwork drags do not dismiss in direction %i', (direction) => {
  const short = fixture(); short.move(2, 40 * direction); short.up(2, 40 * direction);
  expect(short.scope.beginClose).not.toHaveBeenCalled();
  expect(short.scope.currentAngle).toBe(0);
  const cancelled = fixture(); cancelled.move(2, 140 * direction); cancelled.up(2, 140 * direction, 1, false);
  expect(cancelled.scope.beginClose).not.toHaveBeenCalled();
  expect(cancelled.scope.currentAngle).toBe(0);
});
