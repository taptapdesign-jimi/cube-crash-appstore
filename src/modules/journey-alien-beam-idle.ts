/** Each Unit gets a long, independent CSS sequence; no per-beam timers/tickers. */
export function createJourneyAlienBeamIdleSequence(random: () => number = Math.random) {
  const points: Array<{ time: number; opacity: number }> = [{ time: 0, opacity: 0.5 }];
  let time = 0;
  const add = (seconds: number, opacity: number) => {
    time += seconds;
    points.push({ time, opacity });
  };
  for (let pulse = 0; pulse < 10; pulse += 1) {
    // Keep every beam continuously readable. Each Unit gets slightly different
    // idle and hold intervals, while slow transitions prevent any flicker.
    add(0.7 + random() * 0.5, 0.5);
    const brightness = 0.55 + random() * 0.05;
    add(0.32 + random() * 0.18, brightness);
    add(1.8 + random() * 1.0, brightness);
    add(0.36 + random() * 0.2, 0.5);
  }
  return { points, duration: time, phase: random() * time };
}

let nextSequenceId = 0;

export function installJourneyAlienBeamIdle(unit: HTMLElement, visual: HTMLElement): void {
  const sequence = createJourneyAlienBeamIdleSequence();
  const name = `journey-alien-beam-${++nextSequenceId}`;
  const style = document.createElement('style');
  style.textContent = `@keyframes ${name}{${sequence.points.map(({ time, opacity }) =>
    `${(time / sequence.duration * 100).toFixed(5)}%{opacity:${opacity.toFixed(3)}}`).join('')}}`;
  // The stylesheet dies with its Unit on replacement/teardown. The existing
  // idle-ready class is still the sole start/stop owner on transitions.
  unit.appendChild(style);
  visual.style.setProperty('--journey-beam-idle-name', name);
  visual.style.setProperty('--journey-beam-idle-duration', `${sequence.duration}s`);
  visual.style.setProperty('--journey-beam-idle-phase', `${-sequence.phase}s`);
}
