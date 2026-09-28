import fs from 'node:fs';
import path from 'node:path';
import {
  isJourneyWorldUnitNearViewport,
  shouldRenderJourneySettledIdleFrame,
} from '../journey-world-animation-coordinator.js';

const root = path.resolve(__dirname, '../../..');

describe('Journey mobile idle runtime', () => {
  it('allows the first settled paint and then caps mobile idle near 30fps', () => {
    expect(shouldRenderJourneySettledIdleFrame(10, null, 30)).toBe(true);
    expect(shouldRenderJourneySettledIdleFrame(10.016, 10, 30)).toBe(false);
    expect(shouldRenderJourneySettledIdleFrame(10.034, 10, 30)).toBe(true);
  });

  it('leaves desktop settled idle cadence unrestricted', () => {
    expect(shouldRenderJourneySettledIdleFrame(10.001, 10, 0)).toBe(true);
  });

  it('starts settled idle after enter and culls resolved offscreen Units', () => {
    const source = fs.readFileSync(
      path.join(root, 'src/modules/journey-world-animation-coordinator.ts'),
      'utf8',
    );
    expect(source).toContain("this.phase === 'idle'");
    expect(source).toContain('this.startIdle(liveUnits, reducedMotion, 0, enteringUnitSet)');
    expect(source).not.toContain('this.startIdle([unit], reducedMotion, index)');
    expect(source).toContain('this.runtimeProfile.settledIdleMaxFramesPerSecond');
    expect(source).toContain('entry.visibilityResolved && entry.visibleTargets.size === 0');
    expect(source).toContain("rootMargin: '160px 0px'");
    expect(source).toContain('this.idleVisibilityObserver?.disconnect()');
    expect(source).toContain("x: gsap.quickSetter(cloud, 'x', 'px')");
    expect(source).not.toContain("y: gsap.quickSetter(cloud, 'y', 'px')");
    expect(source).not.toContain('setters.y(');
  });

  it('admits only measurable Units near the initial viewport and fails open without geometry', () => {
    const scrollRoot = document.createElement('div');
    const near = document.createElement('div');
    const far = document.createElement('div');
    const unmeasured = document.createElement('div');
    scrollRoot.getBoundingClientRect = () => ({
      top: 0,
      bottom: 800,
      left: 0,
      right: 390,
      width: 390,
      height: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    near.getBoundingClientRect = () => ({
      top: 760,
      bottom: 900,
      left: 0,
      right: 200,
      width: 200,
      height: 140,
      x: 0,
      y: 760,
      toJSON: () => ({}),
    });
    far.getBoundingClientRect = () => ({
      top: 1800,
      bottom: 1940,
      left: 0,
      right: 200,
      width: 200,
      height: 140,
      x: 0,
      y: 1800,
      toJSON: () => ({}),
    });

    expect(isJourneyWorldUnitNearViewport({ id: 'near', targets: [near], clouds: [] }, scrollRoot)).toBe(true);
    expect(isJourneyWorldUnitNearViewport({ id: 'far', targets: [far], clouds: [] }, scrollRoot)).toBe(false);
    expect(isJourneyWorldUnitNearViewport({ id: 'unknown', targets: [unmeasured], clouds: [] }, scrollRoot)).toBe(true);
  });

  it('keeps the legacy active-Unit resume path inside the same mobile budget', () => {
    const source = fs.readFileSync(
      path.join(root, 'src/modules/journey-boards-manager.ts'),
      'utf8',
    );
    expect(source).toContain('MOBILE_RUNTIME_PROFILE.settledIdleMaxFramesPerSecond');
    expect(source).toContain('this.lastJourneyAreaIdlePaintAt = now');
    expect(source).toContain('!MOBILE_RUNTIME_PROFILE.isMobileDevice');
    expect(source).toContain('MOBILE_RUNTIME_PROFILE.isMobileDevice\n        || this.journeyWorldRuntime');
  });

  it('bounds settled Hub CSS animation to Worlds near the scroll viewport', () => {
    const schedulerSource = fs.readFileSync(
      path.join(root, 'src/modules/journey-hub-runtime-scheduler.ts'),
      'utf8',
    );
    const cssSource = fs.readFileSync(
      path.join(root, 'src/collectibles-screen.css'),
      'utf8',
    );
    expect(schedulerSource).toContain("rootMargin: '160px 0px'");
    expect(schedulerSource).toContain(".journey-v700-world-cloud[data-world-id=\"${worldId}\"]");
    expect(schedulerSource).toContain("card.classList.toggle(ACTIVE_CLASS, active)");
    expect(cssSource).toContain(
      '.journey-v700-world-card.journey-v700-runtime-active .journey-v700-world-visual',
    );
    expect(cssSource).toContain(
      '.journey-v700-world-cloud.journey-v700-runtime-active',
    );
  });

  it('pauses World-local interim and ribbon work outside the runtime viewport', () => {
    const managerSource = fs.readFileSync(
      path.join(root, 'src/modules/journey-boards-manager.ts'),
      'utf8',
    );
    const coordinatorSource = fs.readFileSync(
      path.join(root, 'src/modules/journey-world-animation-coordinator.ts'),
      'utf8',
    );
    const cssSource = fs.readFileSync(
      path.join(root, 'src/collectibles-screen.css'),
      'utf8',
    );

    expect(managerSource).toContain('this.isJourneyElementInRuntimeViewport(cardWrapper)');
    expect(managerSource).toContain('target.getBoundingClientRect(), viewportRect, 0');
    expect(managerSource).toContain('this.interimShineController?.pause()');
    expect(coordinatorSource).toContain('JOURNEY_WORLD_IDLE_ACTIVE_CLASS');
    expect(coordinatorSource).toContain("rootMargin: '160px 0px'");
    expect(cssSource).toContain(
      '.journey-board-card-wrapper:not(.journey-world-idle-active)',
    );
    expect(cssSource).toMatch(/journey-board-card-wrapper:not\([\s\S]*?animation-play-state: paused;[\s\S]*?will-change: auto;/);
  });
});
