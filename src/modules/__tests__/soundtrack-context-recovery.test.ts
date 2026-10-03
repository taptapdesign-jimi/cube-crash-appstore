import { SoundtrackContextRecovery } from '../soundtrack-context-recovery';

describe('shared Web Audio context recovery', () => {
  it('coalesces every caller onto one pending native resume attempt', async () => {
    let finishResume!: () => void;
    const context = {
      state: 'suspended',
      resume: jest.fn(() => new Promise<void>((resolve) => { finishResume = resolve; })),
    } as unknown as AudioContext;
    const recovery = new SoundtrackContextRecovery(context);

    const first = recovery.resume();
    const second = recovery.resume();
    const third = recovery.resume();

    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(recovery.pending).toBe(true);

    finishResume();
    await expect(Promise.all([first, second, third])).resolves.toEqual([undefined, undefined, undefined]);
    expect(recovery.pending).toBe(false);
  });
});
