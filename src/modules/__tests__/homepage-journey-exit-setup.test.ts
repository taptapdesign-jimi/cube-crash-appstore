/** @jest-environment jsdom */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const source = ts.createSourceFile('ui.ts', fs.readFileSync(path.join(__dirname, '../ui-manager.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
let method = '';
const visit = (node: ts.Node) => {
  if (ts.isMethodDeclaration(node) && node.name.getText(source) === 'showCollectiblesScreenWithAnimation') method = node.body!.getText(source);
  ts.forEachChild(node, visit);
}; visit(source);
const body = ts.transpileModule(`function run(launchFirstPlayTutorial = false) ${method}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture(waapi = true) {
  document.body.innerHTML = '<div id="home"><div id="slider-container"><div id="slider-wrapper"><div class="slider-slide active" data-slide="0"></div></div></div></div><div id="app"></div>';
  if (waapi) Element.prototype.animate = jest.fn(); else delete (Element.prototype as any).animate;
  const slide = document.querySelector('.slider-slide')!;
  const readHeight = jest.fn(() => 844); Object.defineProperty(slide, 'offsetHeight', { get: readHeight });
  const cleanupFx = jest.fn(); const softReset = jest.fn();
  (window as any).CC = { cleanupFxForBoardReset: cleanupFx, softResetBoardView: softReset };
  (window as any).collectiblesManager = { prepareJourneyScreen: () => new Promise(() => {}) };
  const setupPerformance = {
    phase: jest.fn((_name: string, work: () => unknown) => work()),
    finish: jest.fn(),
  };
  const scope = {
    beginTransitionPerformance: jest.fn(() => setupPerformance),
    homepageEnterTransitionOwner: { isActive: () => false, cancel: jest.fn() },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }, emitIOSNativeDiagnostic: jest.fn(),
    applyPaperBackground: jest.fn(), clearSliderBackgrounds: jest.fn(), gameState: { set: jest.fn() },
    beginIOSJourneyRouteAudit: jest.fn(), markIOSJourneyRouteAudit: jest.fn(), cancelSliderEnterAnimation: jest.fn(),
    JOURNEY_SLIDE_INDEX: 0, sliderManager: { freezeHomepageHeroBounceForExit: jest.fn() },
    isHomepageExitCancelled: jest.fn(() => false),
    animateJourneySliderExit: jest.fn(() => new Promise(() => {})), finalizeJourneySliderExit: jest.fn(),
  };
  const owner = { queueJourneyOpenAfterHomepageEnter: jest.fn() };
  const run = new Function('scope', `with(scope){ ${body}; return run; }`)(scope).bind(owner) as (tutorial?: boolean) => void;
  return { run, scope, cleanupFx, softReset, readHeight, setupPerformance };
}
afterEach(() => {
  delete (window as any).__ccUiJourneyTransitioning; delete (window as any).__ccIsAnimatingSliderExit;
  delete (window as any).CC; delete (window as any).collectiblesManager;
  delete (Element.prototype as any).animate; document.body.innerHTML = '';
});

test('duplicate Journey requests do not repeat navigation or board teardown', () => {
  const f = fixture(); const navigation = jest.fn(); window.addEventListener('cc-navigation', navigation);
  f.run(); f.run();
  expect(navigation).toHaveBeenCalledTimes(1); expect(f.cleanupFx).toHaveBeenCalledTimes(1);
  expect(f.softReset).toHaveBeenCalledTimes(1); expect(f.scope.applyPaperBackground).toHaveBeenCalledTimes(1);
  expect(f.scope.animateJourneySliderExit).toHaveBeenCalledTimes(1);
  window.removeEventListener('cc-navigation', navigation);
});

test('navigation-event reentry sees an already claimed Journey exit owner', () => {
  const f = fixture(); let calls = 0;
  const navigation = () => { if (++calls === 1) f.run(); };
  window.addEventListener('cc-navigation', navigation); f.run();
  expect(calls).toBe(1); expect(f.cleanupFx).toHaveBeenCalledTimes(1);
  expect(f.scope.animateJourneySliderExit).toHaveBeenCalledTimes(1);
  window.removeEventListener('cc-navigation', navigation);
});

test.each([false, true])('WAAPI avoids redundant explicit layout flush for tutorial=%s', (tutorial) => {
  const f = fixture(); f.run(tutorial);
  expect(f.readHeight).not.toHaveBeenCalled(); expect(f.scope.animateJourneySliderExit).toHaveBeenCalledTimes(1);
  expect(f.cleanupFx).toHaveBeenCalledTimes(1); expect(f.softReset).toHaveBeenCalledTimes(1);
});

test('legacy animation setup retains its explicit layout boundary', () => {
  const f = fixture(false); f.run(); expect(f.readHeight).toHaveBeenCalledTimes(1);
});

test('synchronous setup failure releases the early owner so the next request can retry', () => {
  const f = fixture(); f.scope.applyPaperBackground.mockImplementationOnce(() => { throw new Error('setup'); });
  expect(() => f.run()).not.toThrow();
  expect((window as any).__ccUiJourneyTransitioning).toBe(false);
  f.run(); expect(f.scope.animateJourneySliderExit).toHaveBeenCalledTimes(1);
});


test('rejected exit releases both published transition locks', async () => {
  const f = fixture();
  f.scope.animateJourneySliderExit.mockImplementationOnce(() => Promise.reject(new Error('exit')));
  f.run(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect((window as any).__ccUiJourneyTransitioning).toBe(false);
  expect((window as any).__ccIsAnimatingSliderExit()).toBe(false);
  expect(f.scope.gameState.set).toHaveBeenLastCalledWith('sliderLocked', false);
});


test.each(['throw', 'reject'])('exit %s after pointer disable restores the exact input style', async (failure) => {
  const f = fixture();
  const slider = document.getElementById('slider-container')!;
  slider.style.setProperty('pointer-events', 'auto', 'important');
  f.scope.animateJourneySliderExit.mockImplementationOnce(() => {
    expect(slider.style.pointerEvents).toBe('none');
    if (failure === 'throw') throw new Error('exit setup');
    return Promise.reject(new Error('exit async'));
  });
  f.run(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(slider.style.pointerEvents).toBe('auto');
  expect(slider.style.getPropertyPriority('pointer-events')).toBe('important');
  f.run();
  expect(f.scope.animateJourneySliderExit).toHaveBeenCalledTimes(2);
  expect(slider.style.pointerEvents).toBe('none');
});

test('late rejected exit cannot restore input owned by a replacement transition', async () => {
  const f = fixture();
  let rejectExit!: (reason: Error) => void;
  f.scope.animateJourneySliderExit.mockImplementationOnce(() => new Promise((_, reject) => { rejectExit = reject; }));
  f.run();
  (window as any).__ccUiJourneyTransitioning = false;
  f.run();
  rejectExit(new Error('old exit'));
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(document.getElementById('slider-container')!.style.pointerEvents).toBe('none');
  expect((window as any).__ccUiJourneyTransitioning).toBe(true);
  expect((window as any).__ccIsAnimatingSliderExit()).toBe(true);
});

test('failed exit does not restore pointer styles on a replacement slider DOM', async () => {
  const f = fixture();
  let rejectExit!: (reason: Error) => void;
  f.scope.animateJourneySliderExit.mockImplementationOnce(() => new Promise((_, reject) => { rejectExit = reject; }));
  f.run();
  document.getElementById('slider-container')!.outerHTML = '<div id="slider-container" style="pointer-events:none"></div>';
  rejectExit(new Error('retired exit'));
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(document.getElementById('slider-container')!.style.pointerEvents).toBe('none');
});


test('input setup measures synchronous owners and closes before asynchronous preparation', () => {
  const f = fixture(); f.run();
  expect(f.scope.beginTransitionPerformance).toHaveBeenCalledWith('homepage-journey-input-setup');
  expect(f.setupPerformance.phase.mock.calls.map(([name]) => name)).toEqual([
    'lock-slider', 'navigation-listeners', 'cleanup-board-fx', 'reset-board-view',
    'paper-background', 'slider-backgrounds', 'cancel-homepage-enter', 'freeze-hero', 'schedule-exit',
  ]);
  expect(f.setupPerformance.finish).toHaveBeenCalledTimes(1);
  expect(f.setupPerformance.finish).toHaveBeenCalledWith('exit-scheduled');
});

test('input setup diagnostic closes on synchronous failure and does not capture duplicate requests', () => {
  const f = fixture();
  f.scope.applyPaperBackground.mockImplementationOnce(() => { throw new Error('setup'); });
  f.run();
  expect(f.setupPerformance.finish).toHaveBeenCalledWith('setup-failed');
  f.run(); f.run();
  expect(f.scope.beginTransitionPerformance).toHaveBeenCalledTimes(2);
});


test('cancelled exit never reveals Journey after delayed preparation resolves', async () => {
  const f = fixture();
  let prepare!: () => void;
  const showCollectibles = jest.fn();
  (window as any).collectiblesManager = {
    prepareJourneyScreen: () => new Promise<void>((resolve) => { prepare = resolve; }),
    showCollectibles,
  };
  f.scope.animateJourneySliderExit.mockImplementationOnce(() => Promise.resolve());
  f.scope.isHomepageExitCancelled.mockReturnValue(true);
  f.run();
  await Promise.resolve();
  expect((window as any).__ccUiJourneyTransitioning).toBe(false);
  expect(document.getElementById('slider-container')!.style.pointerEvents).toBe('');
  prepare();
  for (let i = 0; i < 8; i++) await Promise.resolve();
  expect(showCollectibles).not.toHaveBeenCalled();
  expect((window as any).__ccUiJourneyTransitioning).toBe(false);
  expect(document.getElementById('slider-container')!.style.pointerEvents).toBe('');
});
