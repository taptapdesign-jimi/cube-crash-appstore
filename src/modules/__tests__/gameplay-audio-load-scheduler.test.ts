import { GameplayAudioLoadScheduler } from '../gameplay-load-scheduler';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('GameplayAudioLoadScheduler', () => {
  test('never exceeds the mobile two-job fetch and decode ceiling', async () => {
    const scheduler = new GameplayAudioLoadScheduler(2);
    const gates = [deferred(), deferred(), deferred(), deferred()];
    let active = 0; let peak = 0;
    const jobs = gates.map((gate, index) => scheduler.enqueue(`s${index}`, 'preload', async () => {
      active += 1; peak = Math.max(peak, active);
      await gate.promise;
      active -= 1;
    }));
    expect(active).toBe(2);
    gates[0].resolve(); await flush();
    expect(active).toBe(2);
    gates.slice(1).forEach((gate) => gate.resolve());
    await Promise.all(jobs);
    expect(peak).toBe(2);
    expect(scheduler.snapshot()).toMatchObject({ active: 0, queued: 0, peakActive: 2 });
  });

  test('audible play overtakes queued speculative preload work', async () => {
    const scheduler = new GameplayAudioLoadScheduler(1);
    const first = deferred(); const second = deferred(); const play = deferred();
    const order: string[] = [];
    const a = scheduler.enqueue('first', 'preload', async () => { order.push('first'); await first.promise; });
    const b = scheduler.enqueue('second', 'preload', async () => { order.push('second'); await second.promise; });
    const c = scheduler.enqueue('play', 'play', async () => { order.push('play'); await play.promise; });
    first.resolve(); await flush();
    expect(order).toEqual(['first', 'play']);
    play.resolve(); await flush();
    second.resolve();
    await Promise.all([a, b, c]);
    expect(order).toEqual(['first', 'play', 'second']);
  });

  test('promotes a duplicate queued source without executing it twice', async () => {
    const scheduler = new GameplayAudioLoadScheduler(1);
    const blocker = deferred(); const target = deferred(); const other = deferred();
    const order: string[] = []; const targetTask = jest.fn(async () => { order.push('target'); await target.promise; });
    const a = scheduler.enqueue('blocker', 'preload', async () => { order.push('blocker'); await blocker.promise; });
    const b = scheduler.enqueue('target', 'preload', targetTask);
    const duplicate = scheduler.enqueue('target', 'play', targetTask);
    const c = scheduler.enqueue('other', 'state', async () => { order.push('other'); await other.promise; });
    expect(duplicate).toBe(b);
    blocker.resolve(); await flush();
    expect(order).toEqual(['blocker', 'target']);
    target.resolve(); await flush(); other.resolve();
    await Promise.all([a, b, c]);
    expect(targetTask).toHaveBeenCalledTimes(1);
  });

  test('cancel settles queued jobs without running them', async () => {
    const scheduler = new GameplayAudioLoadScheduler(1);
    const blocker = deferred(); const queuedTask = jest.fn(async () => {});
    const running = scheduler.enqueue('running', 'preload', () => blocker.promise);
    const queued = scheduler.enqueue('queued', 'preload', queuedTask);
    scheduler.cancelQueued();
    await queued;
    expect(queuedTask).not.toHaveBeenCalled();
    blocker.resolve(); await running;
  });

  test('suspends optional work during a visual transition but still admits play', async () => {
    const scheduler = new GameplayAudioLoadScheduler(1);
    const release = scheduler.suspendSpeculative();
    const preloadGate = deferred(); const stateGate = deferred(); const playGate = deferred();
    const order: string[] = [];
    const preload = scheduler.enqueue('preload', 'preload', async () => { order.push('preload'); await preloadGate.promise; });
    const state = scheduler.enqueue('state', 'state', async () => { order.push('state'); await stateGate.promise; });
    const play = scheduler.enqueue('play', 'play', async () => { order.push('play'); await playGate.promise; });

    expect(order).toEqual(['play']);
    expect(scheduler.snapshot().speculativeSuspended).toBe(true);
    playGate.resolve(); await flush();
    expect(order).toEqual(['play']);

    release();
    expect(order).toEqual(['play', 'state']);
    stateGate.resolve(); await flush();
    preloadGate.resolve();
    await Promise.all([preload, state, play]);
    expect(order).toEqual(['play', 'state', 'preload']);
    expect(scheduler.snapshot().speculativeSuspended).toBe(false);
  });

  test('nested transition suspensions resume only after the last owner releases', async () => {
    const scheduler = new GameplayAudioLoadScheduler(1);
    const releaseA = scheduler.suspendSpeculative();
    const releaseB = scheduler.suspendSpeculative();
    const task = jest.fn(async () => {});
    const queued = scheduler.enqueue('preload', 'preload', task);

    releaseA();
    expect(task).not.toHaveBeenCalled();
    releaseA();
    expect(task).not.toHaveBeenCalled();
    releaseB();
    await queued;
    expect(task).toHaveBeenCalledTimes(1);
  });
});
