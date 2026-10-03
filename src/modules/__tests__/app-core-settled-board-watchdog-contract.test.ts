import fs from 'node:fs';

const source = fs.readFileSync('src/modules/app-core.ts', 'utf8');

describe('app-core settled board reconciliation contract', () => {
  test('observes all live dice but keeps Special generation on its stricter existing gate', () => {
    const specialGate = source.indexOf('const specialRenderGate = guardSettledSpecialRenderHealth({');
    const parity = source.indexOf('function readSettledBoardWatchdogObservation(');
    const watchdog = source.indexOf('settledBoardWatchdog.observe(latestSettledBoardWatchdogObservation);');

    expect(specialGate).toBeGreaterThanOrEqual(0);
    expect(parity).toBeGreaterThanOrEqual(0);
    expect(watchdog).toBeGreaterThan(specialGate);
    const parityOwner = source.slice(parity, source.indexOf('async function refreshLiveCoreGameSpriteTextures', parity));
    expect(parityOwner).toContain('logicalDice: settledLogicalDice,');
    expect(parityOwner).toContain('rendererGeneration: 0,');
    expect(parityOwner).toContain("!issue.tile?.special");
    expect(parityOwner).toContain('SETTLED_INTERACTION_BLOCKING_PARITY_REASONS.has(issue.reason)');
    expect(source.slice(specialGate, watchdog)).toContain('readSettledBoardWatchdogObservation(');
  });

  test('never commits Fail or mutates gameplay from the watchdog callback', () => {
    const start = source.indexOf('const settledBoardWatchdog = new SettledBoardWatchdog({');
    const end = source.indexOf('let checkLevelEndRetryCount', start);
    const owner = source.slice(start, end);

    expect(owner).toContain("onNoMoves: () => scheduleCheckLevelEnd(0, 'settled-watchdog-no-moves')");
    expect(owner).toContain("recoverCoreRenderTextures('settled-board-watchdog', 'settled-board', true)");
    expect(owner).toContain('const freshObservation = readSettledBoardWatchdogObservation(');
    expect(owner).toContain("repairBoardTileVisuals('settled-board-watchdog-local-repair')");
    expect(owner).not.toContain('runNoMovesFailFlow(');
    expect(owner).not.toContain('triggerCleanBoardFlow(');
    expect(owner).not.toContain('openAtCell(');
  });

  test('cancels a pending deadline whenever a new board mutation or run reset begins', () => {
    expect(source).toContain('mergeBoardMutationStarted = true;\n  settledBoardWatchdog.noteActivity();');
    expect(source).toContain('settledSpecialRenderRecoveryOwner.reset();\n  settledBoardWatchdog.noteActivity();');
  });
});
