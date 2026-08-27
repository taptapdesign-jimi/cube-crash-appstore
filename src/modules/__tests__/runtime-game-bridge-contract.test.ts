import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const read = (relativePath: string): string => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('typed runtime game bridge contract', () => {
  const appCore = read('src/modules/app-core.ts');
  const bridgeType = read('src/types/runtime-game-bridge.ts');
  const windowTypes = read('src/types/window.d.ts');

  test('publishes one compile-checked window.CC adapter without a cast escape hatch', () => {
    const bridgeInstall = appCore.split('const runtimeGameBridge = {')[1]
      ?.split('// Expose for continueGameWithSavedState fallback')[0] ?? '';

    expect(bridgeInstall).toContain('satisfies RuntimeGameBridge');
    expect(bridgeInstall).toContain('window.CC = runtimeGameBridge');
    expect(bridgeInstall).not.toContain('as any');
    expect(windowTypes).toContain("import type { RuntimeGameBridge } from './runtime-game-bridge.ts'");
    expect(windowTypes).toContain('CC?: RuntimeGameBridge');
  });

  test('keeps decision, recovery and diagnostics capabilities on the typed adapter', () => {
    [
      'triggerCleanBoardFlow',
      'checkLevelEnd',
      'beginEndgameGuard',
      'getEndgameGuardState',
      'cleanupFxForBoardReset',
      'resetTransientRunGuards',
      'destroyOldBoardForTransition',
      'snapshotState',
      'replayStatus',
    ].forEach((capability) => {
      expect(bridgeType).toContain(`${capability}:`);
      expect(appCore).toContain(`${capability}:`);
    });
  });

  test('types named save/load recovery hooks and publishes them without window casts', () => {
    expect(windowTypes).toContain('loadGameState?: (boardNumber?: number) => Promise<boolean>');
    expect(windowTypes).toContain('startLevel?: (boardNumber: number) => Promise<void>');
    expect(windowTypes).toContain('stopPixiTicker?: () => boolean');
    expect(windowTypes).toContain('killAllDelayedCalls?: () => void');

    expect(appCore).toContain('window.rebuildBoard = rebuildBoard');
    expect(appCore).toContain('window.startLevel = startLevel');
    expect(appCore).toContain('window.stopPixiTicker = stopPixiTicker');
    expect(appCore).toContain('window.killAllDelayedCalls = killAllDelayedCalls');
  });
});
