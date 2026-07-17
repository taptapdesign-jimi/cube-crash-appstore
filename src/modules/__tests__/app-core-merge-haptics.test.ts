import { triggerMergeHaptics } from '../app-core-merge-haptics';

describe('merge haptic hierarchy', () => {
  const originalTrigger = (window as any).triggerHapticImpact;

  afterEach(() => {
    (window as any).triggerHapticImpact = originalTrigger;
  });

  test('uses medium impact for a regular successful merge', () => {
    const trigger = jest.fn();
    (window as any).triggerHapticImpact = trigger;

    triggerMergeHaptics({ wildActive: false, trackAppTimeout: jest.fn() });

    expect(trigger).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveBeenCalledWith('medium');
  });

  test('keeps the double-heavy cadence for a wild merge', () => {
    const trigger = jest.fn();
    const trackAppTimeout = jest.fn((callback: () => void) => callback());
    (window as any).triggerHapticImpact = trigger;

    triggerMergeHaptics({ wildActive: true, trackAppTimeout });

    expect(trackAppTimeout).toHaveBeenCalledWith(expect.any(Function), 150);
    expect(trigger).toHaveBeenNthCalledWith(1, 'heavy');
    expect(trigger).toHaveBeenNthCalledWith(2, 'heavy');
  });
});
