import {
  getJourneyElasticPull,
  getJourneyHubEntryScrollTop,
  getJourneyV700EnterOffset,
  getJourneyV700HubEnterStagger,
  getJourneyV700MotionProfile,
  getJourneyV700UnitStagger,
  isJourneyInterimIdleOwnedByEnter,
  JOURNEY_V700_UNIT_CARD_EXIT_DURATION,
  JOURNEY_V700_UNIT_CARD_EXIT_EASE,
  shouldRestoreJourneyInterimWrapperForIdle,
  shouldCorrectJourneyHubAutomaticScroll,
  shouldIgnoreJourneyV700HubVisibleEnterRequest,
} from '../journey-v700-motion.js';

describe('Journey V700 motion contract', () => {
  it('keeps ordinary Unit-card bounce-out inside the structural Unit exit', () => {
    const motion = getJourneyV700MotionProfile(false);

    expect(JOURNEY_V700_UNIT_CARD_EXIT_DURATION).toBe(0.4);
    expect(JOURNEY_V700_UNIT_CARD_EXIT_DURATION).toBeLessThan(motion.exit.duration);
    expect(JOURNEY_V700_UNIT_CARD_EXIT_EASE).toBe('back.in(1.7)');
  });

  it('uses matching cartoon bounce easing for standard enter and exit', () => {
    const motion = getJourneyV700MotionProfile(false);
    expect(motion.exit.anticipationScale).toBeGreaterThan(1);
    expect(motion.exit.anticipationDuration).toBeGreaterThan(0);

    expect(motion.enter.ease).toMatch(/^back\.out/);
    expect(motion.exit.ease).toMatch(/^back\.in/);
    expect(motion.enter.groupStagger).toBe(0.065);
    expect(motion.exit.groupStagger).toBe(0.065);
    expect(motion.exit.groupStagger).toBeLessThan(motion.exit.duration / 4);
  });

  it('keeps lifecycle sequencing but removes bounce for reduced motion', () => {
    const motion = getJourneyV700MotionProfile(true);
    expect(motion.exit.anticipationScale).toBe(1);
    expect(motion.exit.anticipationDuration).toBe(0);

    expect(motion.enter.ease).toBe('power1.out');
    expect(motion.exit.ease).toBe('power1.in');
    expect(motion.enter.duration).toBeLessThan(getJourneyV700MotionProfile(false).enter.duration);
    expect(motion.exit.groupStagger).toBeGreaterThan(0);
  });

  it('keeps a ten-Unit world inside the short World-tile cascade window', () => {
    const stagger = getJourneyV700UnitStagger(10, false);

    expect(stagger).toBeCloseTo(0.13 / 9);
    expect(stagger).toBeLessThan(0.03);
  });

  it('enters the three hub worlds sequentially inside a fast cascade', () => {
    const stagger = getJourneyV700HubEnterStagger(false);

    expect(stagger).toBeGreaterThanOrEqual(0.08);
    expect(stagger * 2).toBeLessThanOrEqual(0.2);
    expect(getJourneyV700HubEnterStagger(true)).toBeLessThan(stagger);
  });

  it('makes repeated visible Hub enter requests idempotent', () => {
    expect(shouldIgnoreJourneyV700HubVisibleEnterRequest({
      phase: 'entering', timelineActive: true, idleReady: false,
    })).toBe(true);
    expect(shouldIgnoreJourneyV700HubVisibleEnterRequest({
      phase: 'idle', timelineActive: false, idleReady: true,
    })).toBe(true);
    expect(shouldIgnoreJourneyV700HubVisibleEnterRequest({
      phase: 'hidden', timelineActive: false, idleReady: false,
    })).toBe(false);
  });

  it('keeps main first and gives Units stable irregular enter offsets', () => {
    const ids = ['forest-main', ...Array.from({ length: 10 }, (_, index) => `board-${index + 1}`)];
    const offsets = ids.map((id, index) => getJourneyV700EnterOffset(id, index, false));

    expect(offsets[0]).toBe(0);
    expect(Math.max(...offsets)).toBeLessThanOrEqual(0.22);
    expect(new Set(offsets.slice(1).map((offset) => offset.toFixed(4))).size).toBeGreaterThan(7);
    expect(getJourneyV700EnterOffset('board-4', 4, false)).toBe(offsets[4]);
  });

  it('restores an interim wrapper before idle when exit residue left it hidden', () => {
    expect(shouldRestoreJourneyInterimWrapperForIdle({ opacity: 0, scale: 0, visibility: 'visible' })).toBe(true);
    expect(shouldRestoreJourneyInterimWrapperForIdle({ opacity: 1, scale: 1, visibility: 'hidden' })).toBe(true);
    expect(shouldRestoreJourneyInterimWrapperForIdle({ opacity: 1, scale: 1, visibility: 'visible' })).toBe(false);
  });

  it('does not let a remembered board id block interim idle after enter ownership ended', () => {
    expect(isJourneyInterimIdleOwnedByEnter({
      activeEnter: false,
      pendingEnter: false,
      connectedPreparedTargets: 0,
    })).toBe(false);
    expect(isJourneyInterimIdleOwnedByEnter({
      activeEnter: false,
      pendingEnter: true,
      connectedPreparedTargets: 0,
    })).toBe(true);
  });

  it('starts elastic pull at zero when the swipe first reaches an edge', () => {
    expect(getJourneyElasticPull(0, 'bottom')).toBe(0);
    expect(getJourneyElasticPull(-30, 'bottom')).toBeCloseTo(-10.2);
    expect(getJourneyElasticPull(30, 'bottom')).toBe(0);
    expect(getJourneyElasticPull(30, 'top')).toBeCloseTo(10.2);
  });

  it('leaves vertical Journey edge bounce to native iOS scrolling', () => {
    const managerSource = require('fs').readFileSync(
      require('path').join(process.cwd(), 'src/modules/journey-boards-manager.ts'),
      'utf8',
    );
    expect(managerSource).toContain('const pullingTop = false;');
    expect(managerSource).toContain('const pullingBottom = false;');
  });

  it('always starts the Journey Worlds hub at the absolute top', () => {
    expect(getJourneyHubEntryScrollTop()).toBe(0);
  });

  it('rejects automatic hub movement until manual scroll ownership begins', () => {
    expect(shouldCorrectJourneyHubAutomaticScroll('hub', 420)).toBe(true);
    expect(shouldCorrectJourneyHubAutomaticScroll('hub', 0)).toBe(false);
    expect(shouldCorrectJourneyHubAutomaticScroll('world', 420)).toBe(false);
  });

});
