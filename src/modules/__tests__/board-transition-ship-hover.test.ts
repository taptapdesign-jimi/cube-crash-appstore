import { sampleBoardTransitionShipHover } from '../board-transition-ship-hover';

describe('transition ship buoyancy', () => {
  test('stays bounded and smooth through flight, hold and exit handoff times', () => {
    for (const phase of [-Math.PI, -1.2, 0, 0.7, Math.PI]) {
      let previous = sampleBoardTransitionShipHover(0, phase);
      let previousVelocity = { x: 0, y: 0 };
      for (let frame = 1; frame <= 600; frame += 1) {
        const point = sampleBoardTransitionShipHover(frame / 60, phase);
        expect(Math.abs(point.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(point.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(point.bank)).toBeLessThanOrEqual(3);
        const velocity = { x: (point.x - previous.x) * 60, y: (point.y - previous.y) * 60 };
        expect(Math.abs(velocity.x)).toBeLessThan(1.3);
        expect(Math.abs(velocity.y)).toBeLessThan(1.6);
        if (frame > 1) {
          expect(Math.abs(velocity.x - previousVelocity.x) * 60).toBeLessThan(2.3);
          expect(Math.abs(velocity.y - previousVelocity.y) * 60).toBeLessThan(4.1);
        }
        previous = point;
        previousVelocity = velocity;
      }
    }
  });

  test('ships retain independent phases without frame-rate-dependent randomness', () => {
    expect(sampleBoardTransitionShipHover(1.3, 0)).not.toEqual(sampleBoardTransitionShipHover(1.3, 1));
    const expected = sampleBoardTransitionShipHover(3, 0.4);
    for (let time = 0; time < 3; time += 1 / 120) sampleBoardTransitionShipHover(time, 0.4);
    expect(sampleBoardTransitionShipHover(3, 0.4)).toEqual(expected);
  });
});
