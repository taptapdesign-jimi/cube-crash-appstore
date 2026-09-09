import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

describe('gameplay HUD exit ownership contract', () => {
  it('keeps the Arcade Round indicator four pixels lower than its former 24px inset', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/modules/hud-helpers.ts'), 'utf8');

    expect(source).toContain('const BOARD_INDICATOR_BOTTOM = 20;');
    expect(source).toContain('bottom: ${BOARD_INDICATOR_BOTTOM}px;');
  });

  it('hands ownership to exit before the rise tween and cannot be restored by layout', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/modules/hud-helpers.ts'), 'utf8');
    const riseStart = source.indexOf('export function playHudRise');
    const riseEnd = source.indexOf('export function updateHUD', riseStart);
    const riseOwner = source.slice(riseStart, riseEnd);

    expect(riseOwner.indexOf('HUD_ROOT._dropped = false;'))
      .toBeLessThan(riseOwner.indexOf('trackTween(HUD_ROOT'));
    expect(riseOwner.indexOf('HUD_ROOT._exitInProgress = true;'))
      .toBeLessThan(riseOwner.indexOf('trackTween(HUD_ROOT'));
    expect(riseOwner).toContain('HUD_ROOT.visible = false;');
    expect(source).toContain(
      "HUD_ROOT._dropped && HUD_ROOT._exitInProgress !== true && isGameplayHudRevealAllowed()",
    );
  });

  it('blocks every HUD close path from the NO MOVES candidate through Fail ownership', () => {
    const hud = fs.readFileSync(path.join(repoRoot, 'src/modules/hud-helpers.ts'), 'utf8');
    const appCore = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core.ts'), 'utf8');
    const endRun = fs.readFileSync(path.join(repoRoot, 'src/modules/end-run-modal.ts'), 'utf8');
    const exitHandoff = fs.readFileSync(path.join(repoRoot, 'src/modules/menu-exit-handoff.ts'), 'utf8');
    const main = fs.readFileSync(path.join(repoRoot, 'src/main.ts'), 'utf8');
    const failModal = fs.readFileSync(path.join(repoRoot, 'src/modules/board-fail-modal.ts'), 'utf8');

    expect(appCore).toContain('activeNoMovesFailFlowToken !== null');
    expect(appCore).toContain('setNoMovesNavigationLocked(true)');
    expect(appCore).toContain('setNoMovesNavigationLocked(false)');
    expect(hud).toContain("shouldBlockHudCloseForTerminalResolution('dom-close')");
    expect(hud).toContain("shouldBlockHudCloseForTerminalResolution('circle-close')");
    expect(hud).toContain("shouldBlockHudCloseForTerminalResolution('x-hit-area')");
    expect(hud).toContain("shouldBlockHudCloseForTerminalResolution('x-delayed-open')");
    expect(endRun).toContain("shouldBlockEndRunActionForNoMoves('restart')");
    expect(endRun).toContain("shouldBlockEndRunActionForNoMoves('restart-handoff')");
    expect(endRun).toContain("shouldBlockEndRunActionForNoMoves('exit')");
    expect(endRun).toContain("shouldBlockEndRunActionForNoMoves('exit-handoff')");
    expect(exitHandoff).toContain(
      'if (!options.allowTerminalNoMovesExit && isNoMovesNavigationLocked())',
    );
    expect(main).toContain(
      'if (!options.allowTerminalNoMovesExit && isNoMovesNavigationLocked())',
    );
    expect(failModal).toContain('allowTerminalNoMovesExit: true');
  });

  it.each([
    'app-core-hud-drop.ts',
    'app-core-popin-final.ts',
    'app-core-load-animation.ts',
    'app-core-startlevel-hudroot.ts',
    'app-core-startlevel-huddrop.ts',
  ])('guards delayed reveal callbacks in %s', (fileName) => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/modules', fileName), 'utf8');
    expect(source).toContain('isGameplayHudRevealAllowed()');
  });
});
