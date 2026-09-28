import {
  HAPTIC_RUNTIME_POLICY,
  installHapticRuntimeGovernor,
  resetHapticRuntimeGovernorForTests,
  triggerBoardPopInHaptic,
  triggerCleanBoardCounterHaptic,
  triggerMandatoryMerge6Haptic,
} from '../haptic-runtime-governor';

describe('haptic runtime governor', () => {
  const originalImpact = window.triggerHapticImpact;
  const originalSelection = window.triggerHapticSelection;
  const originalNotification = window.triggerHapticNotification;
  const originalNow = Date.now;
  let now = 1_000;

  beforeEach(() => {
    resetHapticRuntimeGovernorForTests();
    now = 1_000;
    Date.now = () => now;
  });

  afterEach(() => {
    window.triggerHapticImpact = originalImpact;
    window.triggerHapticSelection = originalSelection;
    window.triggerHapticNotification = originalNotification;
    delete window.__ccHapticRuntimeGovernor;
    Date.now = originalNow;
  });

  test('bounds a dense light-impact stream before it reaches the native bridge', () => {
    const rawImpact = jest.fn();
    window.triggerHapticImpact = rawImpact;
    installHapticRuntimeGovernor(window);

    for (let index = 0; index < 40; index += 1) {
      window.triggerHapticImpact?.('light');
      now += 250;
    }

    expect(rawImpact).toHaveBeenCalledTimes(HAPTIC_RUNTIME_POLICY.maxLightImpactsPerSustainedWindow);
    expect(window.__ccHapticRuntimeGovernor?.suppressedImpacts).toBe(34);
  });

  test('keeps spaced meaningful medium and heavy impacts responsive', () => {
    const rawImpact = jest.fn();
    window.triggerHapticImpact = rawImpact;
    installHapticRuntimeGovernor(window);

    window.triggerHapticImpact?.('medium');
    now += 250;
    window.triggerHapticImpact?.('heavy');
    now += 250;
    window.triggerHapticImpact?.('medium');

    expect(rawImpact.mock.calls).toEqual([['medium'], ['heavy'], ['medium']]);
  });

  test('preserves the authored double-heavy wild merge cadence', () => {
    const rawImpact = jest.fn();
    window.triggerHapticImpact = rawImpact;
    installHapticRuntimeGovernor(window);

    window.triggerHapticImpact?.('heavy');
    now += 150;
    window.triggerHapticImpact?.('heavy');

    expect(rawImpact).toHaveBeenCalledTimes(2);
  });

  test('caps all impact styles during a short burst', () => {
    const rawImpact = jest.fn();
    window.triggerHapticImpact = rawImpact;
    installHapticRuntimeGovernor(window);

    for (let index = 0; index < 8; index += 1) {
      window.triggerHapticImpact?.(index % 2 === 0 ? 'heavy' : 'medium');
      now += 150;
    }

    expect(rawImpact).toHaveBeenCalledTimes(HAPTIC_RUNTIME_POLICY.maxImpactsPerBurst);
  });

  test('never suppresses the committed Merge 6 beat after the ordinary burst budget is exhausted', () => {
    const rawImpact = jest.fn();
    window.triggerHapticImpact = rawImpact;
    installHapticRuntimeGovernor(window);

    for (let index = 0; index < 12; index += 1) {
      window.triggerHapticImpact?.(index % 2 === 0 ? 'light' : 'medium');
      now += 250;
    }
    const governedCount = rawImpact.mock.calls.length;

    expect(triggerMandatoryMerge6Haptic('heavy')).toBe(true);
    expect(rawImpact).toHaveBeenCalledTimes(governedCount + 1);
    expect(rawImpact).toHaveBeenLastCalledWith('heavy');
  });

  test('preserves every authored Clean Board counter beat at the weakest impact style', () => {
    const rawImpact = jest.fn();
    window.triggerHapticImpact = rawImpact;
    installHapticRuntimeGovernor(window);

    for (let index = 0; index < 12; index += 1) {
      window.triggerHapticImpact?.('medium');
      now += 250;
    }
    const governedCount = rawImpact.mock.calls.length;

    for (let index = 0; index < 8; index += 1) {
      expect(triggerCleanBoardCounterHaptic()).toBe(true);
      now += 65;
    }

    expect(rawImpact).toHaveBeenCalledTimes(governedCount + 8);
    expect(rawImpact.mock.calls.slice(-8)).toEqual(Array.from({ length: 8 }, () => ['light']));
  });

  test('preserves the bounded compact board-entry cadence without governor spacing', () => {
    const rawImpact = jest.fn();
    window.triggerHapticImpact = rawImpact;
    installHapticRuntimeGovernor(window);

    for (let index = 0; index < 6; index += 1) {
      expect(triggerBoardPopInHaptic()).toBe(true);
      now += 50;
    }

    expect(rawImpact.mock.calls).toEqual(Array.from({ length: 6 }, () => ['light']));
  });
});
