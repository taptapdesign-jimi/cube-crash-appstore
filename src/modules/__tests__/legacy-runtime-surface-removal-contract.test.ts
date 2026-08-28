import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const read = (relativePath: string): string => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('post-KING legacy runtime surface removal', () => {
  test('removes only the proven empty clean-board debug hooks and declarations', () => {
    const appCore = read('src/modules/app-core.ts');
    const windowTypes = read('src/types/window.d.ts');
    const globalTypes = read('src/types/global.d.ts');

    expect(appCore).not.toContain('testCleanBoard');
    expect(appCore).not.toContain('testCleanAndPrize');
    expect(windowTypes).not.toContain('testCleanBoard');
    expect(windowTypes).not.toContain('testCleanAndPrize');
    expect(globalTypes).not.toContain('testCleanAndPrize');

    expect(appCore).toContain('showCleanBoardOverlay: () => showCleanBoardOverlay()');
    expect(appCore).toContain('window.rebuildBoard = rebuildBoard');
    expect(appCore).toContain('window.startLevel = startLevel');
  });

  test('removes misleading app-state snapshots while preserving STATE and constants', () => {
    const appState = read('src/modules/app-state.ts');

    expect(appState).not.toContain('export const app = STATE.app');
    expect(appState).not.toContain('export const stage = STATE.stage');
    expect(appState).not.toContain('export const board = STATE.board');
    expect(appState).not.toContain('export const divider = STATE.divider');
    expect(appState).not.toContain('export const hud = STATE.hud');
    expect(appState).toContain('export const STATE: GameState');
    expect(appState).toContain('COLS, ROWS, TILE, GAP');
  });

  test('keeps one canonical Window declaration surface instead of the legacy parallel module', () => {
    const legacyTypeSurface = path.join(root, 'src/types/main.ts');
    const windowTypes = read('src/types/window.d.ts');

    expect(fs.existsSync(legacyTypeSurface)).toBe(false);
    expect(windowTypes).toContain('CC?: RuntimeGameBridge');
    expect(windowTypes).toContain('STATE?: any');
    expect(windowTypes).toContain('updateGhostVisibility?: () => void');
    expect(windowTypes).toContain('showEndRunModalFromGame?: () => void');
    expect(windowTypes).toContain('trackCubesCracked?: (count?: number) => void | Promise<void>');
  });

  test('removes the proven empty boot idle-check shim', () => {
    const appCore = read('src/modules/app-core.ts');

    expect(appCore).not.toContain('scheduleIdleCheck');
    expect(appCore).toContain("trackAppListener(window, 'resize', layoutBoard)");
    expect(appCore).toContain('export function pauseGame()');
    expect(appCore).toContain('export function resumeGame()');
  });

  test('removes unreachable local animation and Figma conversion implementations', () => {
    const appMerge = read('src/modules/app-merge.ts');
    const mergeUtils = read('src/modules/merge-utils.ts');
    const journeyBoards = read('src/modules/journey-boards-manager.ts');

    expect(appMerge).not.toContain('function pulseBoardZoom');
    expect(appMerge).not.toContain('function landPreBounce');
    expect(mergeUtils).toContain('export function pulseBoardZoom');
    expect(mergeUtils).toContain('export function landPreBounce');
    expect(journeyBoards).not.toContain('function figmaToPercent');
    expect(journeyBoards).not.toContain('const FRAME_WIDTH = 361.51');
    expect(journeyBoards).toContain('const FRAME_HEIGHT = 770.32');
    expect(journeyBoards).toContain('function pxToPercentTop');
  });

  test('removes the unreachable pre-V700 Journey scene-enter scheduler only', () => {
    const journeyBoards = read('src/modules/journey-boards-manager.ts');
    const collectibles = read('src/collectibles-manager.ts');
    const returnPolicy = read('src/modules/journey-return-entry-policy.ts');

    expect(journeyBoards).not.toContain('playJourneyForestSceneEnterAnimation');
    expect(journeyBoards).not.toContain('scheduleJourneyAreaIdleAnimations');
    expect(journeyBoards).not.toContain('journeyAreaIdleStartTimeout');
    expect(journeyBoards).not.toContain('journeyScrollSettledTimeout');
    expect(collectibles).not.toContain('playJourneyForestSceneEnterAnimation');

    expect(journeyBoards).toContain('playActiveJourneyBoardAreaEnterAnimation');
    expect(journeyBoards).toContain('startJourneyAreaIdleAnimations');
    expect(journeyBoards).toContain('this.journeyWorldAnimation.enter(');
    expect(journeyBoards).toContain('this.journeyWorldAnimation.exit(');
    expect(returnPolicy).toContain('useWorldReturnEnter: hasAcceptedReturn && input.isWorldView');
    expect(returnPolicy).toContain('playActiveBoardAreaEnter: hasAcceptedReturn && !input.isWorldView');
  });
});
