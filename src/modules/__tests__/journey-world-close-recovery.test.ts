import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Execute the real manager method with boundary dependencies replaced. Avoid
// booting the app singleton; failures are injected at its actual async seams.
const source = fs.readFileSync(path.resolve(__dirname, '../journey-boards-manager.ts'), 'utf8');
const method = source.slice(source.indexOf('  private closeJourneyV700World(): void {'), source.indexOf('  private markJourneyDevBoardRefresh('));
const js = ts.transpileModule(`class CloseProbe { ${method} }`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText;
const noop = () => {};
const Probe = new Function(
  'stopJourneyForestAmbientSounds', 'getJourneyCardOverlayReturnBoardId',
  'cancelJourneyCardOverlayReturn', 'emitIOSNativeDiagnostic',
  'startIOSJourneyWorldEnterAudit', 'areContinuousRuntimeDiagnosticsEnabled',
  'markIOSJourneyTransitionAudit', 'markIOSJourneyRouteAudit', 'areDetailedRuntimeDiagnosticsEnabled',
  `${js}; return CloseProbe;`,
)(noop, () => null, noop, noop, () => noop, () => false, noop, noop, () => false);

function fixture(worldId: number) {
  document.body.innerHTML = '<div id="journey-boards-container"></div>';
  const container = document.getElementById('journey-boards-container') as HTMLElement & { __ccJourneyV700Closing?: boolean };
  const owner = new Probe();
  let complete: () => Promise<void> = async () => {};
  Object.assign(owner, {
    journeyV700View: 'world', journeyV700WorldId: worldId, journeyV700Phase: 'idle', renderDisposed: false,
    renderLifecycleGeneration: 0,
    logJourneyV700Flow: jest.fn(), journeyWorldAnimation: { stop: jest.fn() },
    prepareJourneyHubPrepaint: jest.fn(async () => true),
    playJourneyV700NavExit: jest.fn(async () => {}),
    playJourneyV700WorldExit: jest.fn((_container, callback) => { complete = callback; }),
    waitForTrackedFrames: jest.fn(async () => true),
    commitJourneyHubPrepaint: jest.fn(async () => false),
    cancelJourneyHubPrepaint: jest.fn(),
    setJourneyV700View: jest.fn((view) => { owner.journeyV700View = view; }),
    updateJourneyV700Nav: jest.fn(), renderBoards: jest.fn(), playJourneyV700NavEnter: jest.fn(),
    trackTimeout: jest.fn(),
  });
  return { owner, container, complete: () => complete() };
}

describe('World X failure ownership', () => {
  afterEach(() => { document.body.innerHTML = ''; });
  test.each([1, 2, 3])('World %i releases X and renders Hub on synchronous preparation failure', (world) => {
    const { owner, container } = fixture(world);
    owner.prepareJourneyHubPrepaint.mockImplementation(() => { throw new Error('prepare'); });
    expect(() => owner.closeJourneyV700World()).not.toThrow();
    expect(container.__ccJourneyV700Closing).toBe(false);
    expect(owner.journeyV700View).toBe('hub');
    expect(owner.renderBoards).toHaveBeenCalledTimes(1);
  });
  test.each(['prepareJourneyHubPrepaint', 'playJourneyV700NavExit', 'waitForTrackedFrames'])('handles rejected %s without leaving a closing lock', async (boundary) => {
    const { owner, container, complete } = fixture(1);
    owner[boundary].mockRejectedValue(new Error(boundary));
    owner.closeJourneyV700World();
    await complete();
    expect(container.__ccJourneyV700Closing).toBe(false);
    expect(owner.renderBoards).toHaveBeenCalledTimes(1);
    expect(owner.commitJourneyHubPrepaint).not.toHaveBeenCalled();
  });
  test('a retired World cannot commit over its replacement', async () => {
    const { owner, container, complete } = fixture(1);
    owner.closeJourneyV700World();
    owner.journeyV700WorldId = 2;
    await complete();
    expect(owner.commitJourneyHubPrepaint).not.toHaveBeenCalled();
    expect(owner.renderBoards).not.toHaveBeenCalled();
    expect(container.__ccJourneyV700Closing).toBe(false);
  });
  test('normal and duplicate completion produce one handoff', async () => {
    const { owner, container, complete } = fixture(1);
    owner.closeJourneyV700World();
    await complete();
    await complete();
    expect(owner.commitJourneyHubPrepaint).toHaveBeenCalledTimes(1);
    expect(owner.renderBoards).toHaveBeenCalledTimes(1);
    expect(container.__ccJourneyV700Closing).toBe(false);
  });
  test('a rerender of the same World invalidates its earlier close', async () => {
    const { owner, complete } = fixture(1);
    owner.closeJourneyV700World();
    owner.renderLifecycleGeneration++;
    await complete();
    expect(owner.renderBoards).not.toHaveBeenCalled();
    expect(owner.commitJourneyHubPrepaint).not.toHaveBeenCalled();
  });
  test('an old completion cannot release a newer close token', async () => {
    const { owner, container, complete } = fixture(1);
    owner.closeJourneyV700World();
    (container as any).__ccJourneyV700CloseToken = Symbol('new-close');
    await complete();
    expect(container.__ccJourneyV700Closing).toBe(true);
    expect(owner.renderBoards).not.toHaveBeenCalled();
  });
});
