/** @jest-environment jsdom */
import { createJourneyAlienBeamIdleSequence, installJourneyAlienBeamIdle } from '../journey-alien-beam-idle';

test('keeps every Unit beam softly visible for longer, with varied idle intervals and no flicker', () => {
  let seed = 73641;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
  const sequences = Array.from({ length: 10 }, () => createJourneyAlienBeamIdleSequence(random));
  expect(new Set(sequences.map((sequence) => JSON.stringify(sequence))).size).toBe(10);
  for (const { points, duration, phase } of sequences) {
    expect(points[0]).toEqual({ time: 0, opacity: 0.5 });
    expect(points[points.length - 1]).toEqual({ time: duration, opacity: 0.5 });
    expect(phase).toBeGreaterThanOrEqual(0);
    expect(phase).toBeLessThan(duration);
    let brightHoldSeconds = 0;
    let quietHoldSeconds = 0;
    for (let i = 1; i < points.length; i += 1) {
      const elapsed = points[i].time - points[i - 1].time;
      expect(elapsed).toBeGreaterThan(0);
      expect(points[i].opacity).toBeGreaterThanOrEqual(0.5);
      expect(points[i].opacity).toBeLessThanOrEqual(0.6);
      if (points[i].opacity > 0.5 && points[i - 1].opacity > 0.5) brightHoldSeconds += elapsed;
      if (points[i].opacity === 0.5 && points[i - 1].opacity === 0.5) quietHoldSeconds += elapsed;
    }
    expect(points.some(({ opacity }) => opacity > 0.5)).toBe(true);
    expect(brightHoldSeconds).toBeGreaterThan(quietHoldSeconds);
  }
});

test('owns the generated stylesheet inside each Unit and leaves outer motion untouched', () => {
  const units = Array.from({ length: 2 }, () => {
    const unit = document.createElement('div');
    const visual = document.createElement('img');
    unit.append(visual);
    document.body.append(unit);
    installJourneyAlienBeamIdle(unit, visual);
    expect(unit.style.animation).toBe('');
    expect(visual.style.animation).toBe('');
    const name = visual.style.getPropertyValue('--journey-beam-idle-name');
    expect(unit.querySelector('style')?.textContent).toContain(`@keyframes ${name}`);
    return { unit, name };
  });
  expect(units[0].name).not.toBe(units[1].name);
  units.forEach(({ unit }) => unit.remove());
  expect(document.querySelectorAll('style')).toHaveLength(0);
});
