import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const read = (relativePath: string): string => fs.readFileSync(path.join(root, relativePath), 'utf8');

const protectedCallerFiles = [
  'src/main.ts',
  'src/modules/app-merge.ts',
  'src/modules/board-fail-modal.ts',
  'src/modules/clean-board-modal.ts',
  'src/modules/drag-core.ts',
  'src/modules/endgame-checker.ts',
  'src/modules/endgame-flow.ts',
  'src/modules/journey-boards-manager.ts',
  'src/modules/ui-manager.ts',
];

const protectedCapabilities = [
  'checkLevelEnd',
  'triggerCleanBoardFlow',
  'getEndgameGuardState',
  'cleanupFxForBoardReset',
  'resetTransientRunGuards',
  'softResetBoardView',
  'destroyOldBoardForTransition',
  'cleanupTexturesForBoardTransition',
];

const stateCallerFiles = [
  'src/main.ts',
  'src/ui/components/settings-screen.ts',
  'src/modules/app-core.ts',
  'src/modules/app-core-helpers.ts',
  'src/modules/app-merge.ts',
  'src/modules/end-run-modal.ts',
  'src/modules/endgame-flow.ts',
  'src/modules/first-play-tutorial.ts',
  'src/modules/journey-boards-manager.ts',
  'src/modules/ui-manager.ts',
];

const stateCapabilities = [
  'beginEndgameGuard',
  'endEndgameGuard',
  'getScore',
  'setScore',
  'getCombo',
  'setCombo',
  'killComboTimer',
  'scheduleComboDecay',
  'setStarsCount',
  'restart',
  'layoutBoard',
  'app',
  'stage',
];

describe('typed runtime bridge protected callers', () => {
  test('uses the typed window.CC boundary for migrated decision and cleanup capabilities', () => {
    const combinedSource = protectedCallerFiles.map(read).join('\n');

    protectedCapabilities.forEach((capability) => {
      expect(combinedSource).not.toContain(`(window as any).CC?.${capability}`);
      expect(combinedSource).not.toContain(`(window as any)?.CC?.${capability}`);
    });

    expect(read('src/modules/app-merge.ts')).toContain('window.CC?.triggerCleanBoardFlow');
    expect(read('src/modules/drag-core.ts')).toContain('window.CC?.checkLevelEnd');
    expect(read('src/modules/endgame-checker.ts')).toContain('window.CC?.getEndgameGuardState');
  });

  test('preserves optional method dispatch for pre-boot and partial compatibility states', () => {
    const endgameFlow = read('src/modules/endgame-flow.ts');

    expect(endgameFlow).toContain("window.CC?.cleanupFxForBoardReset?.('endgame-flow')");
    expect(endgameFlow).toContain("window.CC?.softResetBoardView?.('endgame-flow')");
    expect(endgameFlow).toContain("window.CC?.destroyOldBoardForTransition?.('endgame-flow')");
    expect(endgameFlow).toContain(
      "window.CC?.cleanupTexturesForBoardTransition?.('endgame-flow', false, true)",
    );
  });

  test('uses the typed bridge for migrated state, HUD, guard and navigation adapters', () => {
    const combinedSource = stateCallerFiles.map(read).join('\n');

    stateCapabilities.forEach((capability) => {
      expect(combinedSource).not.toContain(`(window as any).CC?.${capability}`);
      expect(combinedSource).not.toContain(`(window as any)?.CC?.${capability}`);
      expect(combinedSource).not.toContain(`(window as any).CC.${capability}`);
    });

    expect(read('src/modules/app-core-helpers.ts')).toContain('window.CC?.getCombo');
    expect(read('src/modules/end-run-modal.ts')).toContain('window.CC?.restart');
    expect(read('src/modules/endgame-flow.ts')).toContain('window.CC?.layoutBoard');
    expect(read('src/ui/components/settings-screen.ts')).toContain('let cc = window.CC');
  });

  test('removes bridge fallbacks that have no published runtime owner', () => {
    const removedFallbackCallers = [
      'src/main.ts',
      'src/modules/ui-manager.ts',
      'src/utils/journey-play-again-incident-ring.ts',
      'src/modules/app-merge.ts',
      'src/modules/first-play-tutorial.ts',
    ].map(read).join('\n');

    expect(removedFallbackCallers).not.toContain('CC?.STATE');
    expect(removedFallbackCallers).not.toContain('CC?.combo');
    expect(removedFallbackCallers).not.toContain('CC.combo');
    expect(removedFallbackCallers).not.toContain('CC?.makeBoard');
    expect(removedFallbackCallers).not.toContain('CC.makeBoard');
    expect(read('src/modules/app-merge.ts')).toContain('? window.CC.getCombo()\n    : 0;');
    expect(read('src/modules/first-play-tutorial.ts')).toContain('tile.value = value;');
  });

  test('keeps the active terminal presentation marker protected', () => {
    expect(read('src/modules/endgame-flow.ts')).toContain('(window as any).CC?._endgameFlowRunning');
    expect(read('src/modules/endgame-flow.ts')).toContain('(window as any).CC._endgameFlowRunning = true');
    expect(read('src/modules/endgame-flow.ts')).toContain('(window as any).CC._endgameFlowRunning = false');
  });
});
