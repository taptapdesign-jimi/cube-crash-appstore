import fs from 'node:fs';
import path from 'node:path';
import { shouldRenderJourneySettledIdleFrame } from '../journey-world-animation-coordinator.js';

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

  it('keeps enter idle at full cadence and culls only resolved offscreen Units', () => {
    const source = fs.readFileSync(
      path.join(root, 'src/modules/journey-world-animation-coordinator.ts'),
      'utf8',
    );
    expect(source).toContain("this.phase === 'idle'");
    expect(source).toContain('this.runtimeProfile.settledIdleMaxFramesPerSecond');
    expect(source).toContain('entry.visibilityResolved && entry.visibleTargets.size === 0');
    expect(source).toContain("rootMargin: '160px 0px'");
    expect(source).toContain('this.idleVisibilityObserver?.disconnect()');
    expect(source).toContain("x: gsap.quickSetter(cloud, 'x', 'px')");
    expect(source).not.toContain("y: gsap.quickSetter(cloud, 'y', 'px')");
    expect(source).not.toContain('setters.y(');
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
});
