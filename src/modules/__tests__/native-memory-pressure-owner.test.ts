import {
  notifyNativeMemoryPressureOwners,
  registerNativeMemoryPressureOwner,
  resetNativeMemoryPressureOwnersForTests,
} from '../native-memory-pressure-owner';

describe('native memory pressure owners', () => {
  afterEach(resetNativeMemoryPressureOwnersForTests);

  test('notifies every registered owner and isolates cleanup failures', () => {
    const first = jest.fn(() => { throw new Error('cleanup failed'); });
    const second = jest.fn();
    registerNativeMemoryPressureOwner(first);
    const unregisterSecond = registerNativeMemoryPressureOwner(second);

    expect(() => notifyNativeMemoryPressureOwners()).not.toThrow();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    unregisterSecond();
    notifyNativeMemoryPressureOwners();
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
