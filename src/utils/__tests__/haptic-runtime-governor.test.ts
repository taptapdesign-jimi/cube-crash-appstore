import {
  HAPTIC_RUNTIME_POLICY,
  installHapticRuntimeGovernor,
  resetHapticRuntimeGovernorForTests,
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
});
