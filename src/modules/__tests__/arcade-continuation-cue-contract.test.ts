import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

describe('Arcade continuation Round cue contract', () => {
  test('reuses only the pure Round-number phase without resolving gameplay progression', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/modules/arcade-stage-clear-modal.ts'), 'utf8');
    const cue = source.slice(
      source.indexOf('export async function showArcadeContinuationRoundCue'),
      source.indexOf('export function cleanupArcadeStageClearModal'),
    );

    expect(cue).toContain('await playRoundNumberPhase(parts, resumedStage)');
    expect(cue).toContain('onPresented?.();');
    expect(cue).toContain('cancelArcadeStageClearModal();');
    expect(cue).not.toContain('gsap.timeline(');
    expect(cue).not.toContain("action: 'continue'");
    expect(cue).not.toContain('startLevel(');
  });

  test('an abandoned stage-clear resolves as cancel and endgame never advances it', () => {
    const modalSource = fs.readFileSync(path.join(repoRoot, 'src/modules/arcade-stage-clear-modal.ts'), 'utf8');
    const endgameSource = fs.readFileSync(path.join(repoRoot, 'src/modules/endgame-flow.ts'), 'utf8');
    const zoneSource = fs.readFileSync(path.join(repoRoot, 'src/modules/app-zone-manager.ts'), 'utf8');

    expect(modalSource).toContain("cancel?.({ action: 'cancel' });");
    expect(endgameSource).toContain("if (stageClearResult.action !== 'continue')");
    expect(zoneSource).toContain('cancelArcadeStageClearModal?.();');
    expect(zoneSource).not.toContain('cleanupArcadeStageClearModal?.(false)');
  });

  test('Homepage Arcade resume shows the current-Round cue for every valid saved Round including 01', () => {
    const uiSource = fs.readFileSync(path.join(repoRoot, 'src/modules/ui-manager.ts'), 'utf8');
    const coreSource = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core.ts'), 'utf8');

    expect(uiSource).toContain('const continuationRound = getArcadeSavedRound();');
    expect(uiSource).toContain('continuationRound !== null && continuationRound > 0');
    expect(uiSource).toContain('__ccArcadeContinuationCueRound = continuationRound');
    expect(coreSource).toContain('beforePopIn: arcadeContinuationCueRound > 0');
    expect(coreSource).toContain('await consumeArcadeEntryCue(arcadeContinuationCueRound)');
  });

  test('fresh Arcade shows Round 01 before its first non-tutorial board entrance', () => {
    const uiSource = fs.readFileSync(path.join(repoRoot, 'src/modules/ui-manager.ts'), 'utf8');
    const coreSource = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core.ts'), 'utf8');
    const modalSource = fs.readFileSync(path.join(repoRoot, 'src/modules/arcade-stage-clear-modal.ts'), 'utf8');

    const freshStart = uiSource.slice(
      uiSource.indexOf('async startNewGame(): Promise<void>'),
      uiSource.indexOf('// Start new game with saved state'),
    );
    expect(freshStart).toContain('if (shouldStartFirstPlayTutorial)');
    expect(freshStart).toContain('delete (window as any).__ccArcadeContinuationCueRound;');
    expect(freshStart).toContain('(window as any).__ccArcadeContinuationCueRound = 1;');
    expect(freshStart.indexOf('delete (window as any).__ccArcadeContinuationCueRound;'))
      .toBeLessThan(freshStart.indexOf('(window as any).__ccArcadeContinuationCueRound = 1;'));
    expect(freshStart).not.toContain('void beginArcadeEntryCue(1)');
    expect(coreSource).toContain('beforePopIn: arcadeEntryCueRound > 0');
    expect(coreSource).toContain('tiles.forEach((tile: any) => { if (tile) tile.visible = false; });');
    const rebuild = coreSource.slice(
      coreSource.indexOf('function rebuildBoard()'),
      coreSource.indexOf('// Board exit animation', coreSource.indexOf('function rebuildBoard()')),
    );
    const cueOwner = rebuild.slice(
      rebuild.indexOf('beforePopIn: arcadeEntryCueRound > 0'),
      rebuild.indexOf(': undefined,', rebuild.indexOf('beforePopIn: arcadeEntryCueRound > 0')),
    );
    expect(cueOwner).toContain('await consumeArcadeEntryCue(arcadeEntryCueRound);');
    expect(cueOwner).toContain('scheduleBoardPopInSafetyNet();');
    expect(cueOwner).toContain('activateGameplaySpatialMotionForCurrentBoard();');
    expect(rebuild).toContain('if (arcadeEntryCueRound <= 0) scheduleBoardPopInSafetyNet();');
    expect(rebuild).toContain('prepareGameplayEntryCommit(');
    expect(rebuild).toContain('revealPreparedGameplaySurface();');
    expect(rebuild.indexOf('scheduleBoardPopInSafetyNet();'))
      .toBeGreaterThan(rebuild.indexOf('await consumeArcadeEntryCue(arcadeEntryCueRound);'));
    const layout = coreSource.slice(
      coreSource.indexOf('export async function layoutBoard()'),
      coreSource.indexOf('// 🔥 v112: Utility functions', coreSource.indexOf('export async function layoutBoard()')),
    );
    expect(layout).toContain('if (!isArcadeEntryCuePending()) {');
    expect(layout).toContain('Round cue retains spatial surface ownership until tile pop-in starts');
    expect(modalSource).toContain('const resumedStage = Math.max(1, stageNumber | 0);');
  });

  test('boot starts the saved Round cue after destructive cleanup and before cold renderer warmup', () => {
    const uiSource = fs.readFileSync(path.join(repoRoot, 'src/modules/ui-manager.ts'), 'utf8');
    const coreSource = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core.ts'), 'utf8');
    const boot = coreSource.slice(
      coreSource.indexOf('export async function boot()'),
      coreSource.indexOf('export async function layoutBoard'),
    );
    const cueStart = boot.indexOf('void beginArcadeEntryCue(pendingArcadeEntryRound)');
    expect(cueStart).toBeGreaterThan(boot.indexOf("gsap.globalTimeline.clear()"));
    expect(cueStart).toBeLessThan(boot.indexOf('await app.init(initOptions)'));
    expect(boot).toContain('shouldOverlapArcadeEntryCueWithColdBoot()');
    expect(uiSource).toContain('!shouldOverlapArcadeEntryCueWithColdBoot()');
    expect(uiSource).toContain('void beginArcadeEntryCue(continuationRound)');
    expect(coreSource).toContain('await consumeArcadeEntryCue(arcadeContinuationCueRound)');
  });

  test('post-load recovery cannot inspect the board while continuation tiles are hidden', () => {
    const coreSource = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core.ts'), 'utf8');
    const popInCall = coreSource.slice(
      coreSource.indexOf('playLoadPopInAnimation({'),
      coreSource.indexOf('return true;', coreSource.indexOf('playLoadPopInAnimation({')),
    );
    const completionOwner = popInCall.slice(popInCall.indexOf('onComplete: () => {'));

    expect(completionOwner).toContain('schedulePostLoadRecoveryCheck({');
    expect(popInCall.match(/schedulePostLoadRecoveryCheck\(\{/g)).toHaveLength(1);
  });
});
