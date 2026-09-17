import fs from 'node:fs';
import ts from 'typescript';

// Execute the production exit/cleanup bodies against DOM and fake animation
// scheduling. This specifically exercises a retired exit completing late.
function createHarness() {
  const file = ts.createSourceFile('overlay.ts', fs.readFileSync('src/modules/splash-text-overlay.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const functions = ['cleanupNoMovesOverlay', 'exitNoMovesText'];
  const statements = file.statements.filter((node) =>
    (ts.isFunctionDeclaration(node) && functions.includes(node.name?.text || '')) ||
    (ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) =>
      /^(noMoves|cancelNoMovesExit)/.test(declaration.name.getText(file)))),
  ).map((node) => node.getText(file).replace(/^export /, '')).join('\n');
  const calls: Array<{ callback: () => void; killed: boolean }> = [];
  const deps = {
    document, setTimeout, clearTimeout,
    gsap: { killTweensOf: jest.fn() },
    trackTimeline: () => ({ to: jest.fn() }),
    killTrackedTimeline: jest.fn(),
    trackDelayedCall: (_time: number, callback: () => void) => {
      const call = { callback, killed: false }; calls.push(call); return call;
    },
    killTrackedTween: (call: { killed: boolean }) => { call.killed = true; },
    BOOM_EXIT_STAGGER: 0.02, EXIT_BOUNCE_DURATION: 0.1, BOOM_EXIT_EXTRA: 0.1, EXIT_FADE_DURATION: 0.1,
  };
  const api = new Function(...Object.keys(deps), ts.transpileModule(statements + `
    return { exitNoMovesText, cleanupNoMovesOverlay,
      mount(overlay) { noMovesOverlay = overlay; },
      current() { return noMovesOverlay; }
    };`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(deps));
  function mount() {
    const overlay = document.createElement('div');
    overlay.className = 'cc-no-moves-overlay';
    const text = document.createElement('div');
    text.className = 'cc-no-moves-text';
    for (let i = 0; i < 8; i++) text.appendChild(document.createElement('span'));
    overlay.appendChild(text); document.body.appendChild(overlay); api.mount(overlay);
    return overlay;
  }
  return { ...api, mount, calls };
}

describe('NO MOVES exit lifecycle ownership', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { document.body.replaceChildren(); jest.useRealTimers(); });

  test('clearing an exit settles it and cannot remove the next overlay', async () => {
    const h = createHarness(); h.mount();
    const oldExit = h.exitNoMovesText();
    expect(h.exitNoMovesText()).toBe(oldExit);
    h.cleanupNoMovesOverlay();
    await oldExit;
    expect(jest.getTimerCount()).toBe(0);
    expect(h.calls[0].killed).toBe(true);
    const next = h.mount();
    h.calls[0].callback(); // Already-delivered GSAP callback may still arrive.
    jest.advanceTimersByTime(2000);
    expect(next.isConnected).toBe(true);
    expect(h.current()).toBe(next);
    h.cleanupNoMovesOverlay();
  });

  test.each(['animation', 'fallback'])('normal %s completion settles once and frees both clocks', async (clock) => {
    const h = createHarness(); const overlay = h.mount();
    const done = jest.fn(); const exit = h.exitNoMovesText().then(done);
    if (clock === 'animation') h.calls[0].callback();
    else jest.advanceTimersByTime(2000);
    await exit;
    h.calls[0].callback();
    expect(done).toHaveBeenCalledTimes(1);
    expect(overlay.isConnected).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    const next = h.mount();
    const nextExit = h.exitNoMovesText();
    expect(nextExit).toBeInstanceOf(Promise);
    h.cleanupNoMovesOverlay(); await nextExit;
    expect(next.isConnected).toBe(false);
  });

  test('empty exit returns a settled promise without retaining it for a later overlay', async () => {
    const h = createHarness();
    const empty = h.exitNoMovesText();
    expect(empty).toBeInstanceOf(Promise); await empty;
    h.mount(); const live = h.exitNoMovesText();
    expect(live).not.toBe(empty);
    expect(jest.getTimerCount()).toBe(1);
    h.cleanupNoMovesOverlay(); await live;
  });
});

test('the retired fail-flow timeout cannot clear a newer NO MOVES candidate', async () => {
  const source = fs.readFileSync('src/modules/app-core.ts', 'utf8');
  const start = source.indexOf('async function runNoMovesFailFlow(');
  const end = source.indexOf('\n\nfunction createEmptyGrid', start);
  let finishTimeout!: (result: string) => void;
  let waits = 0;
  const clearNoMovesText = jest.fn();
  const deps = {
    devLog() {}, devWarn() {}, buildNoMovesBoardSignature: () => 'stable',
    deferFailForWildContinuation: () => false, getNoMovesCommitBlockReason: () => null,
    deferNoMovesFailBeforeOwnership() {}, setNoMovesNavigationLocked() {},
    emitIOSSpecialTransactionTrace() {}, getNoMovesTraceState: () => ({}),
    TILE_IDLE_BOUNCE: { stop() {} }, cleanupFxContainersByTag() {}, saveGameState() {},
    resetEndgameHint() {}, showNoMovesText() {}, cancelNoMovesFailFlow() {},
    waitTrackedResult: () => ++waits === 1 ? Promise.resolve('elapsed') : new Promise<string>((resolve) => { finishTimeout = resolve; }),
    exitNoMovesText: () => Promise.resolve(), clearNoMovesText,
    setInputGateLock() {}, showFinalScreen() {}, window: {},
  };
  const api = new Function(...Object.keys(deps), ts.transpileModule(`
    let activeNoMovesFailFlowToken = null, busyEnding = false, noMovesFailFlowSequence = 0;
    let activeNoMovesInputLockToken = null, failScreenFlowInProgress = false;
    ${source.slice(start, end)}
    return {runNoMovesFailFlow, replace() { activeNoMovesFailFlowToken = 42; }};
  `, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(deps));
  await api.runNoMovesFailFlow({ reason: 'test', waitMs: 10, exitTimeoutMs: 700 });
  api.replace();
  finishTimeout('elapsed');
  await Promise.resolve(); await Promise.resolve();
  expect(clearNoMovesText).not.toHaveBeenCalled();
});
