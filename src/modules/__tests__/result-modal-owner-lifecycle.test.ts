/** Exercise current modal code and the real CTA/GSAP owners without booting Pixi/audio. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { gsap } from 'gsap';
import { createResultModalLifetime } from '../result-modal-lifetime';
import * as terminalMotion from '../journey-terminal-return-policy';

function fixture(arcade = false) {
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  const add = window.addEventListener.bind(window);
  const remove = window.removeEventListener.bind(window);
  jest.spyOn(window, 'addEventListener').mockImplementation((name, callback, options) => {
    const entries = listeners.get(name) ?? new Set();
    entries.add(callback); listeners.set(name, entries);
    if (typeof options === 'object') options.signal?.addEventListener('abort', () => entries.delete(callback), { once: true });
    add(name, callback, options);
  });
  jest.spyOn(window, 'removeEventListener').mockImplementation((name, callback, options) => {
    listeners.get(name)?.delete(callback); remove(name, callback, options);
  });
  const quiet = { log: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const failStop = jest.fn(); const cleanStop = jest.fn();
  const progression = { setLastOpenedBoardId: jest.fn(), getCurrentRunState: () => null, setCurrentRunState: jest.fn() };
  const manager = { getBoardById: () => null };
  const stats = { updateHighScore: jest.fn(), updateBoardHighScore: jest.fn(), flushStatsNow: jest.fn(), getStats: () => ({ highScore: 0 }), wasHighScoreJustUpdated: () => false, getBoardStats: () => ({ highScore: 0 }) };
  const animationManager = { trackExternalTween: tween => tween, trackExternalTimeline: timeline => timeline, killExternalTimeline: timeline => timeline.kill() };
  const mocks = {
    './cta-system.ts': {} as typeof import('../cta-system'),
    gsap: { gsap },
    './result-modal-lifetime.js': { createResultModalLifetime },
    './animation-manager.js': { __esModule: true, default: animationManager },
    './cta-activation-sound.ts': { playCtaActivationSounds: jest.fn(), preloadCtaActivationSounds: jest.fn() },
    '../core/logger.js': { logger: quiet },
    './clean-board-utils.js': { pickRandom: arr => arr[0] },
    '../utils/board-save-utils.js': { getBoardSaveKey: n => `board_${n}`, clearArcadeSaveState: jest.fn(), clearBoardSaveState: jest.fn(), hasSavedStateForBoard: () => false },
    './run-mode.js': { isArcadeHomeRunMode: () => arcade, getRunMode: () => arcade ? 'arcade_home' : 'journey', RUN_MODE_JOURNEY: 'journey' },
    './menu-exit-handoff.ts': { requestExitToMenu: jest.fn(() => Promise.resolve()) },
    './journey-origin-state.js': { clearJourneyDetailReturn: jest.fn(), prepareJourneyFailReturnTarget: jest.fn(), isJourneyInterimOriginActive: () => false, markJourneyGameOrigin: jest.fn() },
    '../utils/app-paper-background.js': { applyAppPaperSurfaceToElement: jest.fn() },
    './gameplay-terminology.ts': { formatGameplayResultProgressLabel: () => 'Beach 1' },
    './fail-screen-sound.ts': { playFailScreenCtaBounceSound: jest.fn(), playFailScreenSaxophoneSound: jest.fn(), preloadFailScreenSounds: jest.fn(), stopFailScreenSounds: failStop },
    './soundtrack-manager.ts': {
      acquireGameplaySoundtrackAfterPlayAgain: jest.fn(),
      fadeSoundtrackForResultHook: () => jest.fn(),
      setSoundtrackResultMix: jest.fn(),
    },
    './journey-terminal-return-policy.ts': terminalMotion,
    './journey-return-transition-trace.ts': { beginJourneyReturnTransition: () => 1, markJourneyReturnResultExitComplete: jest.fn(), cancelJourneyReturnTransition: jest.fn(), prepareJourneyReturnBehindTerminalOverlay: jest.fn(), markJourneyReturnTransition: jest.fn(), measureJourneyReturnPreparationPhase: <T>(_id: number, _name: string, work: () => T) => work(), finishJourneyReturnCtaSetup: jest.fn() },
    './journey-progression-state.js': { journeyProgressionState: progression },
    './journey-boards-manager.js': { journeyBoardsManager: manager },
    './confetti-system.js': { allowConfettiSpawns: jest.fn(), cleanupConfetti: jest.fn(), createConfettiExplosion: jest.fn() },
    './clean-board-area55-ship-flybys.js': { stopCleanBoardArea55ShipFlybys: jest.fn(), startCleanBoardArea55ShipFlybys: () => ({ dispose: jest.fn() }) },
    '../services/stats-service.js': { statsService: stats },
    '../services/board-stats-service.js': { boardStatsService: stats },
    '../services/arcade-stats-service.js': { arcadeStatsService: stats },
    './hud-utils.js': { formatScoreSimple: n => String(n) },
    './board-recovery.js': { clearPendingCleanBoard: jest.fn() },
    './drag-core.js': { getOriginalGsapTo: () => gsap.to, getOriginalGsapTimeline: () => gsap.timeline },
    './journey-stage-balance.ts': { getJourneyEarnedStars: () => 1 },
    '../utils/ios-native-diagnostic.ts': { emitNativeConsoleDiagnostic: jest.fn() },
    './clean-board-win-messages.ts': { ADDITIONAL_CLEAN_BOARD_WIN_MESSAGES: [] },
    './run-combo-bonus.ts': { getRunComboBonus: () => 0 },
    './clean-board-score-utils.ts': { computeCleanBoardFinalScore: ({currentScore,comboBonus,efficiencyBonus}) => currentScore + comboBonus + efficiencyBonus },
    './clean-board-celebration-theme.ts': { resolveCleanBoardCelebrationTheme: () => 'beach', shouldShowArea55CleanBoardShips: () => false },
    './clean-board-sound.ts': { createCleanBoardStarHarpOrder: () => [0,1,2], playCleanBoardBonusCountSound: jest.fn(), playCleanBoardApplauseSound: jest.fn(), playCleanBoardCtaBounceSound: jest.fn(), playCleanBoardEarnedStarSound: jest.fn(), playCleanBoardMoneyCountSound: jest.fn(), playCleanBoardSaxophoneHappySound: jest.fn(), preloadCleanBoardSounds: jest.fn(), stopCleanBoardSounds: cleanStop },
    './clean-board-star-transform.ts': { freezeCleanBoardStarRenderedScale: jest.fn() },
    '../utils/haptic-runtime-governor.ts': { triggerCleanBoardCounterHaptic: jest.fn(() => true) },
    './app-state.js': { STATE: {} },
  };
  function load<T>(name: string): T {
    const filename = path.resolve(process.cwd(), 'src/modules', name);
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    vm.runInNewContext(code, {
      module, exports: module.exports, require: name => { if (!(name in mocks)) throw new Error(`Missing fixture dependency ${name}`); return mocks[name]; },
      window, document, localStorage, HTMLElement, HTMLButtonElement, HTMLImageElement, HTMLCanvasElement, AbortController,
      requestAnimationFrame: window.requestAnimationFrame.bind(window), cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
      setTimeout, clearTimeout, performance, console: quiet,
    }, { filename });
    return module.exports as T;
  }
  mocks['./cta-system.ts'] = load<typeof import('../cta-system')>('cta-system.ts');
  return { fail: load<typeof import('../board-fail-modal')>('board-fail-modal.ts'), clean: load<typeof import('../clean-board-modal')>('clean-board-modal.ts'), tutorial: load<typeof import('../tutorial-complete-modal')>('tutorial-complete-modal.ts'), failStop, cleanStop, mocks, quiet, progression,
    count: name => listeners.get(name)?.size ?? 0,
    pointerCount: () => (listeners.get('pointerup')?.size ?? 0) + (listeners.get('pointercancel')?.size ?? 0),
  };
}

/** Execute the current endgame Tutorial branch with its real modal owner. */
function tutorialEndgameFixture(tutorial: typeof import('../tutorial-complete-modal'), source: 'arcade' | 'journey') {
  const filename = path.resolve(process.cwd(), 'src/modules/endgame-flow.ts');
  const parsed = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
  let branch: ts.IfStatement | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isIfStatement(node) && node.expression.getText(parsed) === 'firstPlayTutorialCompletion') branch = node;
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  if (!branch) throw new Error('Missing endgame Tutorial branch');
  type Outcome = { arcade: boolean; journey: boolean; cleanup: (() => void) | null };
  let outcome: Outcome | null = null;
  const markDone = jest.fn();
  const module = { exports: {} as { run: () => Promise<void> } };
  const code = ts.transpileModule(`async function run() {
    let cleanupTutorialCompleteCover = null;
    let continueTutorialIntoArcade = false;
    let continueTutorialIntoJourney = false;
    try { ${branch.thenStatement.getText(parsed)} } finally {
      onComplete({ arcade: continueTutorialIntoArcade, journey: continueTutorialIntoJourney, cleanup: cleanupTutorialCompleteCover });
    }
  }
  exports.run = run;`, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: (name: string) => {
      if (name === './tutorial-complete-modal.js') return tutorial;
      if (name === './first-play-tutorial.js') return { markFirstPlayTutorialDone: markDone };
      throw new Error(`Unexpected Tutorial branch dependency: ${name}`);
    },
    animateBoardIndicatorExitSafe: jest.fn(() => Promise.resolve()),
    shouldAbortEndgameFlow: () => false,
    firstPlayTutorialSource: source,
    onComplete: (result: Outcome) => { outcome = result; },
    console: { warn: jest.fn() },
  }, { filename });
  return { run: module.exports.run, markDone, getOutcome: () => outcome };
}

async function flush() { for (let n = 0; n < 12; n++) await Promise.resolve(); }
async function finishMotion() {
  for (let n = 0; n < 10; n++) {
    gsap.globalTimeline.getChildren(true, true, true).forEach(tween => { if (tween.repeat() !== -1) tween.totalProgress(1); });
    jest.advanceTimersByTime(1000);
    await flush();
  }
}
function click(label: string) {
  const button = [...document.querySelectorAll('button')].find(button => button.textContent === label);
  expect(button).toBeDefined();
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
}
function abort() { window.dispatchEvent(new Event('cc-navigation')); }

beforeEach(() => {
  jest.useFakeTimers();
  // jsdom exposes authored transform lists; GSAP expects a browser matrix.
  // Geometry is outside this ownership test, so provide an identity matrix.
  const getStyle = window.getComputedStyle.bind(window);
  jest.spyOn(window, 'getComputedStyle').mockImplementation(element => {
    const style = getStyle(element);
    return new Proxy(style, { get(target, key) {
      if (key === 'transform') return 'matrix(1, 0, 0, 1, 0, 0)';
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
  });
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  document.body.innerHTML = ''; localStorage.clear();
  Object.defineProperty(window, 'CC', { configurable: true, writable: true, value: { restart: jest.fn(() => Promise.resolve()), cleanupFxForBoardReset: jest.fn() } });
});
afterEach(() => { abort(); gsap.globalTimeline.clear(); gsap.ticker.sleep(); jest.clearAllTimers(); jest.useRealTimers(); document.body.innerHTML = ''; document.head.querySelector('#clean-board-star-animations')?.remove(); });

test.each([false, true])('Fail abort/reopen retires actual CTA and key listeners (Arcade=%s)', async arcade => {
  const f = fixture(arcade);
  for (let n = 0; n < 3; n++) {
    const result = f.fail.showBoardFailModal({ boardNumber: 11, score: 10 }); await flush();
    expect(document.getElementById('cc-board-fail-overlay')).not.toBeNull();
    expect(f.pointerCount()).toBe(4);
    abort();
    await expect(result).resolves.toEqual({ action: '__navigation-abort__' });
    expect(f.pointerCount()).toBe(0); expect(f.count('keydown')).toBe(0);
    expect(document.getElementById('cc-board-fail-overlay')).toBeNull();
    await finishMotion();
    expect(f.pointerCount()).toBe(0);
  }
  expect(f.failStop).toHaveBeenCalledTimes(3);
});

test.each([false, true])('normal Fail Play Again preserves restart and retires listeners (Arcade=%s)', async arcade => {
  const f = fixture(arcade);
  const result = f.fail.showBoardFailModal({ boardNumber: 11, score: 10 }); await flush(); await finishMotion();
  click('Play Again'); await finishMotion();
  await expect(result).resolves.toEqual({ action: 'retry' });
  expect(window.CC.restart).toHaveBeenCalledTimes(1);
  expect(f.mocks['./soundtrack-manager.ts'].acquireGameplaySoundtrackAfterPlayAgain)
    .toHaveBeenCalledTimes(1);
  expect(f.pointerCount()).toBe(0); expect(f.count('keydown')).toBe(0);
});

test('Fail aborted before progression import cannot write board state or mount later', async () => {
  const f = fixture();
  const result = f.fail.showBoardFailModal({ boardNumber: 11 });
  abort(); await flush();
  await expect(result).resolves.toEqual({ action: '__navigation-abort__' });
  expect(f.progression.setLastOpenedBoardId).not.toHaveBeenCalled();
  expect(document.getElementById('cc-board-fail-overlay')).toBeNull();
  expect(f.pointerCount()).toBe(0);
});

test.each([false, true])('Clean Board replacement and abort retire mounted CTAs (Arcade=%s)', async arcade => {
  const f = fixture(arcade);
  const first = f.clean.showCleanBoardModal({ boardNumber: 11, getScore: () => 10, forcedStars: 1 });
  expect(document.getElementById('cc-clean-board-overlay')).not.toBeNull();
  expect(f.pointerCount()).toBe(4);
  const second = f.clean.showCleanBoardModal({ boardNumber: 12, getScore: () => 20, forcedStars: 1 });
  await expect(first).resolves.toEqual({ action: '__navigation-abort__' });
  expect(f.pointerCount()).toBe(4);
  abort(); await expect(second).resolves.toEqual({ action: '__navigation-abort__' });
  await finishMotion();
  expect(f.pointerCount()).toBe(0);
  expect(document.getElementById('cc-clean-board-overlay')).toBeNull();
  expect(document.getElementById('clean-board-star-animations')).toBeNull();
});

test.each([false, true])('Clean Board normal Play Again retires CTA listeners (Arcade=%s)', async arcade => {
  const f = fixture(arcade);
  const result = f.clean.showCleanBoardModal({ boardNumber: 11, getScore: () => 10, forcedStars: 1 });
  await finishMotion(); click('Play Again'); await finishMotion();
  await expect(result).resolves.toEqual({ action: 'play-again' });
  expect(f.mocks['./soundtrack-manager.ts'].acquireGameplaySoundtrackAfterPlayAgain)
    .toHaveBeenCalledTimes(1);
  expect(f.pointerCount()).toBe(0);
});

test('late old board-exit completion cannot hide a replacement gameplay surface', async () => {
  const f = fixture();
  let completeBoardExit;
  window.animateBoardExit = jest.fn(() => new Promise(resolve => { completeBoardExit = resolve; }));
  const canvas = document.createElement('canvas'); document.body.append(canvas);
  const stage = { visible: true, alpha: 1 };
  const result = f.clean.showCleanBoardModal({ boardNumber: 11, getScore: () => 10, forcedStars: 1, app: { canvas }, stage });
  await finishMotion(); click('Exit'); await flush();
  expect(window.animateBoardExit).toHaveBeenCalledTimes(1);
  abort(); await expect(result).resolves.toEqual({ action: '__navigation-abort__' });
  const next = f.clean.showCleanBoardModal({ boardNumber: 12, getScore: () => 20, forcedStars: 1 });
  const replacement = document.getElementById('cc-clean-board-overlay');
  completeBoardExit(); await finishMotion();
  expect(canvas.style.display).not.toBe('none'); expect(stage.visible).toBe(true);
  expect(document.getElementById('cc-clean-board-overlay')).toBe(replacement);
  expect(f.pointerCount()).toBe(4);
  abort(); await next;
});

test('a partially mounted Clean Board error removes its owned DOM and can reopen', async () => {
  const f = fixture();
  f.mocks['./soundtrack-manager.ts'].setSoundtrackResultMix.mockImplementationOnce(() => { throw new Error('test setup failure'); });
  await expect(f.clean.showCleanBoardModal({ boardNumber: 11, forcedStars: 1 })).resolves.toEqual({ action: 'continue' });
  expect(document.getElementById('cc-clean-board-overlay')).toBeNull(); expect(f.pointerCount()).toBe(0);
  const next = f.clean.showCleanBoardModal({ boardNumber: 12, forcedStars: 1 });
  expect(f.pointerCount()).toBe(4); abort(); await next;
});


test('Fail error while registering the second CTA retires the first controller', async () => {
  const f = fixture();
  const register = f.mocks['./cta-system.ts'].registerCta;
  let registrations = 0;
  f.mocks['./cta-system.ts'].registerCta = (...args) => {
    if (++registrations === 2) throw new Error('test second CTA setup failure');
    return register(...args);
  };
  await expect(f.fail.showBoardFailModal({ boardNumber: 11 })).resolves.toEqual({ action: 'menu' });
  expect(f.pointerCount()).toBe(0); expect(f.count('keydown')).toBe(0);
  expect(document.getElementById('cc-board-fail-overlay')).toBeNull();
});

test('Fail restart resolving after abort cannot remove a replacement modal', async () => {
  const f = fixture();
  let finishRestart;
  window.CC.restart = jest.fn(() => new Promise(resolve => { finishRestart = resolve; }));
  const old = f.fail.showBoardFailModal({ boardNumber: 11 }); await flush(); await finishMotion();
  click('Play Again'); await finishMotion(); expect(window.CC.restart).toHaveBeenCalledTimes(1);
  abort(); await old;
  const next = f.fail.showBoardFailModal({ boardNumber: 12 }); await flush();
  const replacement = document.getElementById('cc-board-fail-overlay');
  finishRestart(); await finishMotion();
  expect(document.getElementById('cc-board-fail-overlay')).toBe(replacement);
  expect(f.pointerCount()).toBe(4);
  abort(); await next;
});

test('hidden Clean Board resumes its pending entrance and CTA exactly once', async () => {
  const f = fixture();
  const result = f.clean.showCleanBoardModal({ boardNumber: 11, forcedStars: 1 });
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  document.dispatchEvent(new Event('visibilitychange'));
  await finishMotion();
  expect(f.mocks['./clean-board-sound.ts'].playCleanBoardCtaBounceSound).not.toHaveBeenCalled();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  document.dispatchEvent(new Event('visibilitychange'));
  await finishMotion();
  expect(f.mocks['./clean-board-sound.ts'].playCleanBoardCtaBounceSound).toHaveBeenCalledTimes(2);
  abort(); await result;
});

test('Tutorial cancellation settles and retires CTA/decode/entrance ownership', async () => {
  const f = fixture();
  const old = f.tutorial.showTutorialCompleteModal();
  expect(f.pointerCount()).toBe(2);
  f.tutorial.cleanupTutorialCompleteModal();
  await expect(old).resolves.toEqual({ action: 'cancel' });
  expect(f.pointerCount()).toBe(0);
  const next = f.tutorial.showTutorialCompleteModal();
  const replacement = document.getElementById('cc-tutorial-complete-overlay');
  await finishMotion();
  expect(document.getElementById('cc-tutorial-complete-overlay')).toBe(replacement);
  expect(f.pointerCount()).toBe(2);
  abort(); await expect(next).resolves.toEqual({ action: 'cancel' });
  expect(f.pointerCount()).toBe(0);
});

test('Tutorial Continue retires its CTA while retaining the accepted opaque cover', async () => {
  const f = fixture();
  const result = f.tutorial.showTutorialCompleteModal();
  const cleanupCover = f.tutorial.captureTutorialCompleteModalCleanup();
  await finishMotion();
  click('Continue'); await finishMotion();
  await expect(result).resolves.toEqual({ action: 'continue' });
  expect(f.pointerCount()).toBe(0);
  expect(document.getElementById('cc-tutorial-complete-overlay')).not.toBeNull();
  cleanupCover();
  expect(document.getElementById('cc-tutorial-complete-overlay')).toBeNull();
});

test('old Tutorial caller cleanup cannot retire a replacement presentation', async () => {
  const f = fixture();
  const old = f.tutorial.showTutorialCompleteModal();
  const cleanupOld = f.tutorial.captureTutorialCompleteModalCleanup();
  const next = f.tutorial.showTutorialCompleteModal();
  const cleanupNext = f.tutorial.captureTutorialCompleteModalCleanup();
  const replacement = document.getElementById('cc-tutorial-complete-overlay');
  await expect(old).resolves.toEqual({ action: 'cancel' });
  cleanupOld(); cleanupOld();
  expect(document.getElementById('cc-tutorial-complete-overlay')).toBe(replacement);
  expect(f.pointerCount()).toBe(2);
  cleanupNext();
  await expect(next).resolves.toEqual({ action: 'cancel' });
  expect(document.getElementById('cc-tutorial-complete-overlay')).toBeNull();
  expect(f.pointerCount()).toBe(0);
});

test('Tutorial cleanup during CTA exit prevents stale visual continuation', async () => {
  const f = fixture();
  const old = f.tutorial.showTutorialCompleteModal(); await finishMotion();
  const button = document.querySelector('.cc-tutorial-complete-cta');
  const controller = f.mocks['./cta-system.ts'].getRegisteredCta(button as HTMLButtonElement);
  let finishCtaExit;
  jest.spyOn(controller, 'exit').mockImplementation(() => new Promise(resolve => { finishCtaExit = resolve; }));
  click('Continue');
  // Finish press/release so the CTA dispatches its actual activation.
  for (let i = 0; i < 4; i++) { gsap.globalTimeline.getChildren(true,true,true).forEach(t => { if (t.repeat() !== -1) t.totalProgress(1); }); await flush(); }
  expect(finishCtaExit).toBeDefined();
  f.tutorial.cleanupTutorialCompleteModal();
  finishCtaExit();
  const next = f.tutorial.showTutorialCompleteModal();
  const replacement = document.getElementById('cc-tutorial-complete-overlay');
  await finishMotion();
  await expect(old).resolves.toEqual({ action: 'cancel' });
  expect(document.getElementById('cc-tutorial-complete-overlay')).toBe(replacement);
  expect(f.pointerCount()).toBe(2);
  abort(); await next;
});


test('Tutorial setup failure rejects for caller recovery and removes the partially mounted cover', async () => {
  const f = fixture();
  f.mocks['./cta-system.ts'].registerCta = () => { throw new Error('test CTA setup failure'); };
  await expect(f.tutorial.showTutorialCompleteModal()).rejects.toThrow('test CTA setup failure');
  expect(f.pointerCount()).toBe(0);
  expect(f.count('cc-navigation')).toBe(0);
  expect(document.getElementById('cc-tutorial-complete-overlay')).toBeNull();
  expect(document.getElementById('cc-tutorial-complete-style')).toBeNull();
});

test('Tutorial CTA exit rejection retires its owner and reaches caller recovery', async () => {
  const f = fixture();
  const result = f.tutorial.showTutorialCompleteModal();
  const rejected = expect(result).rejects.toThrow('test CTA exit failure');
  await finishMotion();
  const button = document.querySelector('.cc-tutorial-complete-cta') as HTMLButtonElement;
  const controller = f.mocks['./cta-system.ts'].getRegisteredCta(button);
  jest.spyOn(controller, 'exit').mockRejectedValue(new Error('test CTA exit failure'));
  click('Continue'); await finishMotion();
  await rejected;
  expect(f.pointerCount()).toBe(0);
  expect(f.count('cc-navigation')).toBe(0);
  expect(document.getElementById('cc-tutorial-complete-overlay')).toBeNull();
});

test('late Tutorial CTA exit rejection cannot remove its replacement', async () => {
  const f = fixture();
  const old = f.tutorial.showTutorialCompleteModal(); await finishMotion();
  const button = document.querySelector('.cc-tutorial-complete-cta') as HTMLButtonElement;
  const controller = f.mocks['./cta-system.ts'].getRegisteredCta(button);
  let rejectExit!: (reason: unknown) => void;
  jest.spyOn(controller, 'exit').mockImplementation(() => new Promise<void>((_resolve, reject) => { rejectExit = reject; }));
  click('Continue'); await finishMotion();
  const next = f.tutorial.showTutorialCompleteModal();
  const replacement = document.getElementById('cc-tutorial-complete-overlay');
  await expect(old).resolves.toEqual({ action: 'cancel' });
  rejectExit(new Error('late old CTA failure')); await finishMotion();
  expect(document.getElementById('cc-tutorial-complete-overlay')).toBe(replacement);
  expect(f.pointerCount()).toBe(2);
  expect(f.count('cc-navigation')).toBe(1);
  abort(); await expect(next).resolves.toEqual({ action: 'cancel' });
});

test.each(['arcade', 'journey'] as const)('endgame Tutorial Continue commits and selects the %s destination', async source => {
  const f = fixture();
  const endgame = tutorialEndgameFixture(f.tutorial, source);
  const run = endgame.run(); await flush(); await finishMotion();
  click('Continue'); await finishMotion(); await run;
  expect(endgame.markDone).toHaveBeenCalledTimes(1);
  expect(endgame.getOutcome()).toMatchObject({ arcade: source === 'arcade', journey: source === 'journey' });
  expect(f.pointerCount()).toBe(0);
  expect(document.getElementById('cc-tutorial-complete-overlay')).not.toBeNull();
  endgame.getOutcome()?.cleanup?.();
});

test.each(['arcade', 'journey'] as const)('endgame Tutorial navigation cancellation does not commit or continue (%s)', async source => {
  const f = fixture();
  const endgame = tutorialEndgameFixture(f.tutorial, source);
  const run = endgame.run(); await flush();
  abort(); await run;
  expect(endgame.markDone).not.toHaveBeenCalled();
  expect(endgame.getOutcome()).toMatchObject({ arcade: false, journey: false });
  expect(f.pointerCount()).toBe(0);
  expect(document.getElementById('cc-tutorial-complete-overlay')).toBeNull();
});

test.each(['arcade', 'journey'] as const)('endgame Tutorial setup rejection preserves its existing %s recovery', async source => {
  const f = fixture();
  f.mocks['./cta-system.ts'].registerCta = () => { throw new Error('test setup failure'); };
  const endgame = tutorialEndgameFixture(f.tutorial, source);
  await endgame.run();
  expect(endgame.markDone).toHaveBeenCalledTimes(1);
  expect(endgame.getOutcome()).toMatchObject({ arcade: source === 'arcade', journey: source === 'journey' });
  expect(f.pointerCount()).toBe(0);
  expect(f.count('cc-navigation')).toBe(0);
  expect(document.getElementById('cc-tutorial-complete-overlay')).toBeNull();
});

test('late Tutorial image decode cannot schedule work against the next presentation', async () => {
  let completeDecode;
  const original = HTMLImageElement.prototype.decode;
  HTMLImageElement.prototype.decode = () => new Promise(resolve => { completeDecode = resolve; });
  try {
    const f = fixture();
    const old = f.tutorial.showTutorialCompleteModal();
    f.tutorial.cleanupTutorialCompleteModal();
    await expect(old).resolves.toEqual({ action: 'cancel' });
    HTMLImageElement.prototype.decode = () => Promise.resolve();
    const next = f.tutorial.showTutorialCompleteModal();
    const replacement = document.getElementById('cc-tutorial-complete-overlay');
    completeDecode(); await finishMotion();
    expect(document.getElementById('cc-tutorial-complete-overlay')).toBe(replacement);
    expect(f.pointerCount()).toBe(2);
    abort(); await next;
  } finally { HTMLImageElement.prototype.decode = original; }
});
