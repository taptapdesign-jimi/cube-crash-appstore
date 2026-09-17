import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const root = process.cwd();
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('production terminal and Magnet async ownership', () => {
  test('an aborted Clean Board completion cannot clear a newer flow owner', async () => {
    const source = fs.readFileSync(
      path.join(root, 'src/modules/app-core.ts'),
      'utf8',
    );
    const a = source.indexOf('async function triggerCleanBoardFlow('),
      b = source.indexOf('\n}\n', a) + 2;
    const code = source.slice(a, b);
    const waits: Array<{ resolve: () => void; abortToken: number }> = [],
      events: unknown[] = [];
    const noop = () => {};
    const ctx: any = {
      console,
      window: { __ccEndgameFlowAbortToken: 0 },
      busyEnding: false,
      failScreenFlowInProgress: false,
      gameplayRunGeneration: 1,
      activeGameplayEntryGeneration: 1,
      firstWildSpawned: true,
      wildSpawnCount: 4,
      lastWildDropType: 'star',
      wildDropTypeStreak: 2,
      app: {},
      stage: {},
      board: {},
      boardBG: {},
      level: 1,
      score: 0,
      boardNumber: 1,
      hud: {},
      markPixiMobileActivity: noop,
      logger: { info: noop, debug: noop, warn: noop },
      getScreenVisibility: () => ({
        appVisible: true,
        homeVisible: false,
        journeyVisible: false,
      }),
      setFinalMergeVisualSuppression: (v) => events.push(['suppression', v]),
      cancelPendingWildContinuation: noop,
      shouldRunCleanBoardVisualHandoff: () => false,
      isArcadeHomeRunMode: () => false,
      hideTerminalLockedArtifacts: noop,
      waitForFinalMergeHandoff: async () => {},
      waitTracked: noop,
      isTntAnimationActive: noop,
      onTntBoomExitComplete: noop,
      onTntAnimationComplete: noop,
      isWildJuiceFinaleAnimationActive: noop,
      isWildJuiceBubblesExplosionRecentlyStarted: noop,
      waitForBubblesExplosionToComplete: noop,
      isMagneticTextActive: noop,
      showMagneticText: noop,
      waitForMagneticTextComplete: noop,
      isSparkleTextActive: noop,
      waitForSparkleTextComplete: noop,
      resetEndgameHint: noop,
      TILE_IDLE_BOUNCE: { stop: noop },
      cleanupFxContainersByTag: noop,
      logRuntimeStats: noop,
      resetWildMeterState: noop,
      FINAL_MERGE_REASONS: {},
      runEndgameFlow: (opts) =>
        new Promise<void>((resolve) =>
          waits.push({ resolve, abortToken: opts.abortToken }),
        ),
      startLevel: noop,
      updateHUD: noop,
      animateScore: noop,
      memoryManager: { performCleanup: noop },
      cleanupTexturesForBoardTransition: noop,
      clearPendingCleanBoard: () => events.push(['clearPendingCleanBoard']),
      setJourneyGameBottomDecorVisible: noop,
      drawBoardBG: noop,
    };
    vm.createContext(ctx);
    vm.runInContext(
      ts.transpileModule(code, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
      ctx,
    );

    const old = ctx.triggerCleanBoardFlow('old');
    await flush();
    ctx.window.__ccEndgameFlowAbortToken = 1;
    ctx.gameplayRunGeneration = 2;
    ctx.busyEnding = false;
    const newer = ctx.triggerCleanBoardFlow('new');
    await flush();
    expect(waits.map((wait) => wait.abortToken)).toEqual([0, 1]);
    waits[0].resolve();
    await old;
    expect(ctx.busyEnding).toBe(true);
    expect(events).toEqual([]);
    waits[1].resolve();
    await newer;
    expect(ctx.busyEnding).toBe(false);
    expect(events).toEqual([
      ['clearPendingCleanBoard'],
      ['suppression', false],
    ]);
  });

  function magnetHarness() {
    let id = 0;
    const timers = new Map<number, () => void>();
    const calls: Array<{ board: string; c: number; r: number; value: number }> =
      [];
    const noop = () => {};
    const transpile = (source) =>
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText;
    const utils: any = {
      exports: {},
      require: (name) =>
        name.includes('logger') ? { logger: { debug: noop, error: noop } } : {},
      setTimeout: (callback) => {
        timers.set(++id, callback);
        return id;
      },
      clearTimeout: (key) => timers.delete(key),
      console,
    };
    vm.createContext(utils);
    vm.runInContext(
      transpile(
        fs.readFileSync(
          path.join(root, 'src/modules/app-core-utils.ts'),
          'utf8',
        ),
      ),
      utils,
    );
    const source = fs.readFileSync(
      path.join(root, 'src/modules/app-merge.ts'),
      'utf8',
    );
    const helperStart = source.indexOf(
      '  let magnetLifecycleCancelled = false;',
    );
    const helperEnd = source.indexOf(
      '  let pendingPostGuardEndgameCheckSource:',
      helperStart,
    );
    const fanoutStart = source.indexOf(
      '  // 🔥 CRITICAL FIX: Track successful spawns',
    );
    const fanoutEnd = source.indexOf(
      '    // Keep the six reserved placeholder cells synchronized',
      fanoutStart,
    );
    const code =
      'async function runFanout(){' +
      source.slice(helperStart, helperEnd) +
      source.slice(fanoutStart, fanoutEnd) +
      '}}';
    class Cancelled extends Error {}
    const state = { grid: [[]], board: { id: 'old' }, drag: null };
    const context: any = {
      window: { __ccEndgameFlowAbortToken: 0 },
      helpers: {},
      console: { log: noop, warn: noop, error: noop },
      Math,
      Map,
      Set,
      Promise,
      STATE: state,
      waitTrackedResult: utils.exports.waitTrackedResult,
      trackAppTimeout: utils.exports.trackAppTimeout,
      trackAppAnimationFrame: noop,
      spawnTargets: [
        { c: 0, r: 0 },
        { c: 1, r: 0 },
      ],
      spawnCount: 2,
      obligatoryCell: null,
      obligatorySpawnCount: 0,
      replacementSpawnCount: 2,
      forcedSpawnValues: new Map(),
      createMagnetRespawnDelays: () => [0, 150],
      dst: { destroyed: true },
      COLS: 7,
      ROWS: 9,
      tileIsWild: () => false,
      AppSpawnCancelledError: Cancelled,
      openAtCell: jest.fn(async (c, r, options) => {
        calls.push({ board: state.board.id, c, r, value: options.value });
      }),
      LOCKED_RESERVE_COUNT: 6,
      findRandomEmptyCells: () => [
        { c: 2, r: 0 },
        { c: 3, r: 0 },
      ],
      isAllowedReplacementCell: () => true,
      reservedSet: new Set(),
    };
    vm.createContext(context);
    vm.runInContext(transpile(code), context);
    const fireTimers = () => {
      const pending = Array.from(timers.values());
      timers.clear();
      pending.forEach((callback) => callback());
    };
    return { context, state, timers, calls, fireTimers, utils, Cancelled };
  }

  test('cancelled Magnet fanout never retries spawns against a replacement board', async () => {
    const h = magnetHarness();
    const result = h.context.runFanout();
    const rejected = expect(result).rejects.toBeInstanceOf(h.Cancelled);
    h.fireTimers();
    await flush();
    expect(h.timers.size).toBe(2);
    h.state.board = { id: 'replacement' };
    h.state.grid = [[]];
    h.utils.exports.clearAllAppTimeouts();
    await rejected;
    expect(h.calls).toEqual([]);
  });

  test('genuine failed spawns on the same board retain the recovery fallback', async () => {
    const h = magnetHarness();
    h.context.openAtCell
      .mockRejectedValueOnce(new Error('spawn failure'))
      .mockRejectedValueOnce(new Error('spawn failure'));
    const result = h.context.runFanout();
    h.fireTimers();
    await flush();
    h.fireTimers();
    await result;
    expect(h.calls).toHaveLength(2);
    expect(h.calls.map((call) => [call.board, call.c])).toEqual([
      ['old', 2],
      ['old', 3],
    ]);
  });

  test('a board replacement during a successful awaited spawn aborts verification and all fallback work', async () => {
    const h = magnetHarness();
    h.context.openAtCell.mockImplementationOnce(async () => {
      h.state.board = { id: 'replacement' };
      h.state.grid = [[]];
    });
    const result = h.context.runFanout();
    const rejected = expect(result).rejects.toBeInstanceOf(h.Cancelled);
    h.fireTimers();
    await flush();
    h.fireTimers();
    await rejected;
    expect(h.calls).toEqual([]);
    expect(h.context.openAtCell).toHaveBeenCalledTimes(1);
  });
  test('cancelled current Magnet releases its guard, but a retired flow cannot release the replacement guard', async () => {
    const source = fs.readFileSync(
      path.join(root, 'src/modules/app-merge.ts'),
      'utf8',
    );
    const helperStart = source.indexOf(
      '  let magnetLifecycleCancelled = false;',
    );
    const helperEnd = source.indexOf(
      '  let pendingPostGuardEndgameCheckSource:',
      helperStart,
    );
    const finalizerStart = source.indexOf('  } finally {', helperEnd);
    const finalizerEnd = source.indexOf(
      '\n}\n\nexport async function handleWild',
      finalizerStart,
    );
    const finalizer = source.slice(
      finalizerStart + '  } finally {'.length,
      finalizerEnd - 1,
    );
    const context: any = {
      STATE: { board: {}, grid: [] },
      window: { __ccEndgameFlowAbortToken: 0 },
      helpers: {},
      endEndgameGuard: jest.fn(),
      triggerCentralEndgameCheck: jest.fn(),
      console,
    };
    vm.createContext(context);
    vm.runInContext(
      ts.transpileModule(
        `async function settle(replace) {
      ${source.slice(helperStart, helperEnd)}
      let endgameGuardActive = true;
      const endgameGuardSource = 'mergePulledTilesIntoMerge6';
      const pendingPostGuardEndgameCheckSource = 'obsolete';
      const shouldRunPostMagnetEndgameCheck = true;
      magnetLifecycleCancelled = true;
      if (replace) STATE.board = {};
      ${finalizer}
    }`,
        {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.CommonJS,
          },
        },
      ).outputText,
      context,
    );
    await context.settle(false);
    expect(context.endEndgameGuard).toHaveBeenCalledTimes(1);
    await context.settle(true);
    expect(context.endEndgameGuard).toHaveBeenCalledTimes(1);
    expect(context.triggerCentralEndgameCheck).not.toHaveBeenCalled();
  });
  test('the owned next-level child may retry, but cannot adopt an unrelated entry', async () => {
    const source = fs.readFileSync(
      path.join(root, 'src/modules/app-core.ts'),
      'utf8',
    );
    const from = source.indexOf(
      '  let nextBoardEntry:',
      source.indexOf('async function triggerCleanBoardFlow('),
    );
    const to = source.indexOf('\n  };', from) + '\n  };'.length;
    const context: any = {
      activeGameplayEntryGeneration: 1,
      gameplayRunGeneration: 1,
      cleanBoardRunAbortToken: 0,
      window: { __ccEndgameFlowAbortToken: 0 },
    };
    context.ownsCleanBoardRun = () => context.gameplayRunGeneration === 1;
    context.startLevel = jest.fn(async () => {
      context.activeGameplayEntryGeneration++;
      context.gameplayRunGeneration++;
      if (context.gameplayRunGeneration === 2)
        throw new Error('first attempt failed');
    });
    vm.createContext(context);
    vm.runInContext(
      ts.transpileModule(
        source.slice(from, to) + '\nglobalThis.start = startOwnedNextLevel;',
        {
          compilerOptions: { target: ts.ScriptTarget.ES2022 },
        },
      ).outputText,
      context,
    );
    await expect(context.start(2)).rejects.toThrow('first attempt failed');
    await context.start(2);
    expect(context.startLevel).toHaveBeenCalledTimes(2);
    context.activeGameplayEntryGeneration++;
    context.gameplayRunGeneration++;
    await context.start(2);
    expect(context.startLevel).toHaveBeenCalledTimes(2);
  });

  test.each([false, true])(
    'terminal finalizer preserves replacement board and clears only its own global flag (new terminal: %s)',
    async (newTerminal) => {
      const source = fs.readFileSync(
        path.join(root, 'src/modules/endgame-flow.ts'),
        'utf8',
      );
      const from = source.lastIndexOf('  } finally {');
      const body = source.slice(
        from + '  } finally {'.length,
        source.lastIndexOf('\n}') - 3,
      );
      const oldOwner = Symbol('old');
      let finish!: () => void;
      const wait = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const context: any = {
        flowOwner: oldOwner,
        activeEndgameFlowOwner: oldOwner,
        shouldAbortEndgameFlow: () => false,
        ctx: { isRunCurrent: () => false },
        cleanupNewCardHandoffCover: null,
        cleanupTutorialCompleteCover: null,
        continueTutorialIntoArcade: false,
        continueTutorialIntoJourney: false,
        stage: { eventMode: 'none' },
        boardBG: { visible: false },
        prevBG: true,
        prevMode: 'static',
        showGrid: jest.fn(),
        window: { CC: { _endgameFlowRunning: true } },
        wait,
      };
      vm.createContext(context);
      vm.runInContext(
        ts.transpileModule(
          'async function finishOld(){await wait;' + body + '\n}',
          {
            compilerOptions: { target: ts.ScriptTarget.ES2022 },
          },
        ).outputText,
        context,
      );
      const old = context.finishOld();
      if (newTerminal) context.activeEndgameFlowOwner = Symbol('new');
      finish();
      await old;
      expect(context.stage.eventMode).toBe('none');
      expect(context.boardBG.visible).toBe(false);
      expect(context.showGrid).not.toHaveBeenCalled();
      expect(context.window.CC._endgameFlowRunning).toBe(newTerminal);
    },
  );
});
