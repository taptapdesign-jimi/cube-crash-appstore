import { gsap } from 'gsap';
import { JourneyWorldAnimationCoordinator } from '../journey-world-animation-coordinator';
import { startThermalIsolation } from '../../utils/thermal-isolation';

test('Unit probe freezes settled painting only and never suppresses entering or destroys its owner', () => {
  jest.useFakeTimers();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  const setter = jest.fn();
  jest.spyOn(gsap, 'quickSetter').mockReturnValue(setter);
  const coordinator = new JourneyWorldAnimationCoordinator();
  const owner = coordinator as unknown as {
    phase: string; idleTicker: () => void; lastSettledIdlePaintAt: number | null;
    startIdle(units: Array<{ targets: HTMLElement[]; clouds: HTMLElement[] }>, reduced: boolean): void;
  };
  const target = document.createElement('div'); document.body.append(target);
  owner.phase = 'idle'; owner.startIdle([{ targets: [target], clouds: [] }], false);
  const tick = owner.idleTicker;
  const stop = startThermalIsolation({ enabled: true, group: 'journey-units', fingerprint: () => 'same', suppress: () => () => {}, emit: () => {} });
  try {
    jest.advanceTimersByTime(30000); setter.mockClear();
    tick(); expect(setter).not.toHaveBeenCalled();
    owner.phase = 'entering'; tick(); expect(setter).toHaveBeenCalledTimes(1);
    setter.mockClear(); owner.phase = 'idle'; stop?.(); owner.lastSettledIdlePaintAt = null;
    tick(); expect(setter).toHaveBeenCalledTimes(1);
    expect(owner.idleTicker).toBe(tick);
  } finally { stop?.(); coordinator.stop(); target.remove(); jest.useRealTimers(); }
});
