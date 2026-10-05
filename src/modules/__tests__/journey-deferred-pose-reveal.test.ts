import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const source = fs.readFileSync(path.resolve(__dirname, '../../collectibles-manager.ts'), 'utf8');
const handoff = source.split('    // A paintable parked World keeps its settled backing through preparation.')[1]
  .split('    // Opacity and visibility are already set to 0/hidden above')[0];
const compiled = ts.transpileModule(`${handoff}\nreturn { continued: true, ready: worldEnterPoseReady };`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

function fixture(overrides: Record<string, unknown> = {}) {
  const manager = {
    commitPreparedJourneyWorldEnterPose: jest.fn(() => false),
    recoverPreparedJourneyWorldEnterPose: jest.fn(() => false),
    promotePreparedJourneyV700WorldBehindTerminalCover: jest.fn(() => true),
  };
  const dependencies = {
    isVisibleEnterOwnerCurrent: () => true,
    isJourneyRevealCurrent: () => true,
    shouldUseV700WorldReturnEnter: true,
    terminalReturnToken: 7,
    getJourneyReturnTransitionToken: () => 7,
    visibleEnterLease: { settle: jest.fn() },
    journeyBoardsManagerPreparedForEnter: manager,
    emitIOSNativeDiagnostic: jest.fn(),
    logger: { warn: jest.fn() },
    hasTransferredTerminalCover: true,
    screen: document.createElement('section'),
    releaseJourneyViewportParking: jest.fn(),
    commitPreparedJourneyViewportBehindTerminalCover: jest.fn(() => true),
    markJourneyReturnDestinationVisibleReady: jest.fn(),
    ...overrides,
  };
  return { manager, dependencies, run: () => new Function(...Object.keys(dependencies), compiled)(...Object.values(dependencies)) };
}

describe('covered deferred World pose reveal recovery', () => {
  it.each(['visible', 'reveal', 'token'])('retires only a genuinely stale %s owner without touching successor state', stale => {
    const f = fixture(stale === 'visible' ? { isVisibleEnterOwnerCurrent: () => false }
      : stale === 'reveal' ? { isJourneyRevealCurrent: () => false }
        : { getJourneyReturnTransitionToken: () => 8 });
    expect(f.run()).toBeUndefined();
    expect(f.dependencies.visibleEnterLease.settle).toHaveBeenCalledTimes(1);
    expect(f.manager.commitPreparedJourneyWorldEnterPose).not.toHaveBeenCalled();
    expect(f.manager.recoverPreparedJourneyWorldEnterPose).not.toHaveBeenCalled();
    expect(f.dependencies.releaseJourneyViewportParking).not.toHaveBeenCalled();
  });

  it('keeps reveal/watchdog ownership after a current failed recovery without reporting readiness', () => {
    const f = fixture();
    expect(f.run()).toEqual({ continued: true, ready: false });
    expect(f.manager.recoverPreparedJourneyWorldEnterPose).toHaveBeenCalledWith(7);
    expect(f.dependencies.visibleEnterLease.settle).not.toHaveBeenCalled();
    expect(f.dependencies.releaseJourneyViewportParking).not.toHaveBeenCalled();
    expect(f.dependencies.markJourneyReturnDestinationVisibleReady).not.toHaveBeenCalled();
  });

  it('reports readiness only after recovery, plan validation and a real viewport commit', () => {
    const f = fixture();
    f.manager.recoverPreparedJourneyWorldEnterPose.mockReturnValue(true);
    expect(f.run()).toEqual({ continued: true, ready: true });
    expect(f.dependencies.releaseJourneyViewportParking).toHaveBeenCalledTimes(1);
    expect(f.dependencies.commitPreparedJourneyViewportBehindTerminalCover).toHaveBeenCalledTimes(1);
    expect(f.dependencies.markJourneyReturnDestinationVisibleReady).toHaveBeenCalledWith(7);
  });

  it('rejects a recovered plan which fails terminal promotion validation', () => {
    const f = fixture();
    f.manager.recoverPreparedJourneyWorldEnterPose.mockReturnValue(true);
    f.manager.promotePreparedJourneyV700WorldBehindTerminalCover.mockReturnValue(false);
    expect(f.run()).toEqual({ continued: true, ready: false });
    expect(f.dependencies.releaseJourneyViewportParking).not.toHaveBeenCalled();
    expect(f.dependencies.markJourneyReturnDestinationVisibleReady).not.toHaveBeenCalled();
  });

  it('keeps the fallback alive if both pose writes and synchronous recovery throw', () => {
    const f = fixture();
    f.manager.commitPreparedJourneyWorldEnterPose.mockImplementation(() => { throw new Error('write'); });
    f.manager.recoverPreparedJourneyWorldEnterPose.mockImplementation(() => { throw new Error('recover'); });
    expect(f.run()).toEqual({ continued: true, ready: false });
    expect(f.dependencies.visibleEnterLease.settle).not.toHaveBeenCalled();
    expect(f.dependencies.markJourneyReturnDestinationVisibleReady).not.toHaveBeenCalled();
  });

  it('does not confuse a paintable covered root with a successful visible watchdog commit', () => {
    const watchdog = source.split('const recoverVisibleCommit = (reason: string): void => {')[1]
      .split('const revealFallbackTimer')[0];
    expect(watchdog).toContain('&& !isJourneyViewportParked(screen as HTMLElement)');
    expect(watchdog).toContain('&& !isJourneyReturnStaticCoverActive(terminalReturnToken)');
    expect(watchdog).toContain('if (!worldEnterPoseReady) worldEnterPoseReady = recoverWorldEnterPose();');
    expect(source).toContain('if (!hasTransferredTerminalCover || !worldEnterPoseReady)');
  });
});
