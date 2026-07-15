import {
  getJourneyV700EnterOffset,
  getJourneyV700MotionProfile,
  getJourneyV700UnitStagger,
} from '../journey-v700-motion.js';

describe('Journey V700 motion contract', () => {
  it('uses matching cartoon bounce easing for standard enter and exit', () => {
    const motion = getJourneyV700MotionProfile(false);

    expect(motion.enter.ease).toMatch(/^back\.out/);
    expect(motion.exit.ease).toMatch(/^back\.in/);
    expect(motion.enter.groupStagger).toBe(0.065);
    expect(motion.exit.groupStagger).toBe(0.065);
    expect(motion.exit.groupStagger).toBeLessThan(motion.exit.duration / 4);
  });

  it('keeps lifecycle sequencing but removes bounce for reduced motion', () => {
    const motion = getJourneyV700MotionProfile(true);

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

  it('keeps main first and gives Units stable irregular enter offsets', () => {
    const ids = ['forest-main', ...Array.from({ length: 10 }, (_, index) => `board-${index + 1}`)];
    const offsets = ids.map((id, index) => getJourneyV700EnterOffset(id, index, false));

    expect(offsets[0]).toBe(0);
    expect(Math.max(...offsets)).toBeLessThanOrEqual(0.22);
    expect(new Set(offsets.slice(1).map((offset) => offset.toFixed(4))).size).toBeGreaterThan(7);
    expect(getJourneyV700EnterOffset('board-4', 4, false)).toBe(offsets[4]);
  });
});
