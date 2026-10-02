import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const source = fs.readFileSync(path.resolve(__dirname, '../journey-boards-manager.ts'), 'utf8');
const method = source.slice(
  source.indexOf('  private playJourneyV700WorldExit('),
  source.indexOf('  private applyJourneyV700WorldHeights('),
);
const js = ts.transpileModule(`class WorldExitProbe { ${method} }`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText;

const finishAudit = jest.fn();
const gsap = {
  killTweensOf: jest.fn(),
  set: jest.fn((targets: HTMLElement[], properties: Record<string, unknown>) => {
    targets.forEach((target) => {
      target.style.opacity = String(properties.opacity);
      target.style.visibility = String(properties.visibility);
      target.style.pointerEvents = String(properties.pointerEvents);
    });
  }),
};
const Probe = new Function(
  'markIOSJourneyRouteAudit', 'startIOSJourneyWorldEnterAudit',
  'markIOSJourneyTransitionAudit', 'setJourneyAlienBeamIdleReady', 'gsap',
  `${js}; return WorldExitProbe;`,
)(jest.fn(), () => finishAudit, jest.fn(), jest.fn(), gsap);

describe('Journey World exit watchdog', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (window as any).matchMedia = jest.fn(() => ({ matches: false }));
  });

  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
    delete (window as any).matchMedia;
  });

  test('forces the owned outgoing pixels closed and completes after a stalled coordinator', async () => {
    const container = document.createElement('div');
    const target = document.createElement('div');
    container.append(target);
    document.body.append(container);
    const never = new Promise<void>(() => {});
    const complete = jest.fn();
    const owner = new Probe();
    Object.assign(owner, {
      journeyV700WorldId: 1,
      journeyV700PreparedWorldEnter: null,
      journeyV700WorldMotionEpoch: 0,
      journeyV700Phase: 'idle',
      journeyWorldRuntime: { beginTransition: jest.fn() },
      journeyWorldAnimation: { exit: jest.fn(() => never), stop: jest.fn() },
      stopForestBeeOrbits: jest.fn(),
      stopBeachBubbleDrift: jest.fn(),
      stopArea55ShipFlybys: jest.fn(),
      getJourneyV700AnimationUnits: jest.fn(() => [{ id: 'forest-main', targets: [target], clouds: [] }]),
      cleanupJourneyAreaIdleAnimations: jest.fn(),
      logJourneyV700Flow: jest.fn(),
      trackTimeout: jest.fn((callback: () => void, delayMs: number) => window.setTimeout(callback, delayMs)),
      clearTrackedTimeout: jest.fn((timer: number) => window.clearTimeout(timer)),
    });

    owner.playJourneyV700WorldExit(container, complete);
    jest.advanceTimersByTime(2199);
    expect(complete).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await Promise.resolve();

    expect(owner.journeyWorldAnimation.stop).toHaveBeenCalledWith(true);
    expect(gsap.set).toHaveBeenCalledWith([target], expect.objectContaining({
      opacity: 0,
      visibility: 'hidden',
      pointerEvents: 'none',
      overwrite: true,
    }));
    expect(finishAudit).toHaveBeenCalledWith('watchdog');
    expect(complete).toHaveBeenCalledTimes(1);
  });
});
