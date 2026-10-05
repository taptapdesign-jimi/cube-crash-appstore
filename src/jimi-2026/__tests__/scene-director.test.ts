import { createSceneDirector, type SceneHandle, type SceneTransitionContext } from '../scene-director';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function flush() {
  for (let index = 0; index < 12; index++) await Promise.resolve();
}

function fixture() {
  const events: string[] = [];
  const handles: Array<jest.Mocked<SceneHandle> & { id: string; visible: boolean; input: boolean }> = [];
  const create = (id: string) => {
    const handle = {
      id,
      visible: false,
      input: false,
      setVisible: jest.fn((visible: boolean) => {
        handle.visible = visible;
        events.push(`${id}:visible:${visible}`);
        expect(handles.filter(scene => scene.visible).length).toBeLessThanOrEqual(1);
      }),
      setInputEnabled: jest.fn((enabled: boolean) => {
        handle.input = enabled;
        if (enabled) expect(handle.visible).toBe(true);
        events.push(`${id}:input:${enabled}`);
      }),
      enter: jest.fn((_context: SceneTransitionContext): Promise<void> | void => { events.push(`${id}:enter`); }),
      exit: jest.fn((_context: SceneTransitionContext): Promise<void> | void => { events.push(`${id}:exit`); }),
      cancelMotion: jest.fn(() => { events.push(`${id}:cancelMotion`); }),
      dispose: jest.fn(() => { events.push(`${id}:dispose`); }),
    };
    handles.push(handle);
    return handle;
  };
  const prepare = jest.fn((id: string, _context: SceneTransitionContext): Promise<SceneHandle> | SceneHandle => create(id));
  const director = createSceneDirector({ prepare });
  return { director, prepare, create, handles, events };
}

describe('Jimi 2026 scene director', () => {
  it('owns strict exit-hide-show-enter order and enables input only after entry', async () => {
    const f = fixture();
    expect(await f.director.navigate('home')).toEqual({ id: 'home', status: 'shown' });
    const home = f.handles[0];
    const exit = deferred();
    const enter = deferred();
    home.exit.mockImplementation(() => exit.promise);
    const hub = f.create('hub');
    hub.enter.mockImplementation(() => enter.promise);
    f.prepare.mockReturnValueOnce(hub);
    const result = f.director.navigate('hub');
    await flush();
    expect(f.director.getState()).toMatchObject({ currentId: 'home', transitionId: 'hub', phase: 'exiting' });
    expect(home.visible).toBe(true);
    expect(home.input).toBe(false);
    expect(hub.visible).toBe(false);
    expect(hub.enter).not.toHaveBeenCalled();
    exit.resolve();
    await flush();
    expect(home.visible).toBe(false);
    expect(hub.visible).toBe(true);
    expect(hub.input).toBe(false);
    expect(home.dispose).not.toHaveBeenCalled();
    enter.resolve();
    await expect(result).resolves.toEqual({ id: 'hub', status: 'shown' });
    expect(hub.input).toBe(true);
    expect(home.dispose).toHaveBeenCalledTimes(1);
    expect(f.director.getState()).toEqual({ phase: 'idle', currentId: 'hub', transitionId: null, pendingId: null });
  });

  it('starts outgoing exit synchronously during pending preparation and retains the only visible root', async () => {
    const f = fixture();
    await f.director.navigate('home');
    const gate = deferred<SceneHandle>();
    f.prepare.mockReturnValueOnce(gate.promise);
    const next = f.director.navigate('hub');
    expect(f.handles[0].exit).toHaveBeenCalledTimes(1);
    expect(f.prepare).toHaveBeenCalledTimes(2);
    await flush();
    expect(f.director.getState().phase).toBe('exiting');
    expect(f.handles[0].visible).toBe(true);
    expect(f.handles[0].input).toBe(false);
    gate.resolve(f.create('hub'));
    await expect(next).resolves.toMatchObject({ status: 'shown' });
  });

  it('serializes transitions with one latest pending request, settling superseded promises', async () => {
    const f = fixture();
    const gate = deferred();
    const home = f.create('home');
    home.enter.mockImplementation(() => gate.promise);
    f.prepare.mockReturnValueOnce(home);
    const first = f.director.navigate('home');
    await flush();
    const skipped = f.director.navigate('hub');
    const latest = f.director.navigate('beach');
    await expect(skipped).resolves.toEqual({ id: 'hub', status: 'superseded' });
    expect(f.director.getState()).toMatchObject({ transitionId: 'home', pendingId: 'beach' });
    expect(f.prepare).toHaveBeenCalledTimes(1);
    gate.resolve();
    await expect(first).resolves.toMatchObject({ status: 'shown' });
    await expect(latest).resolves.toMatchObject({ id: 'beach', status: 'shown' });
    expect(f.prepare.mock.calls.map(call => call[0])).toEqual(['home', 'beach']);
  });

  it('joins repeated active/pending requests and cancels an obsolete pending destination on reselect', async () => {
    const f = fixture();
    const gate = deferred<SceneHandle>();
    f.prepare.mockReturnValueOnce(gate.promise);
    const active = f.director.navigate('home');
    expect(f.director.navigate('home')).toBe(active);
    const pending = f.director.navigate('hub');
    expect(f.director.navigate('hub')).toBe(pending);
    expect(f.director.navigate('home')).toBe(active);
    await expect(pending).resolves.toMatchObject({ status: 'superseded' });
    gate.resolve(f.create('home'));
    await active;
    await expect(f.director.navigate('home')).resolves.toMatchObject({ status: 'shown' });
    expect(f.prepare).toHaveBeenCalledTimes(1);
  });

  it.each(['prepare', 'exit', 'enter'])('rolls back a %s failure without losing current input or leaking incoming', async (phase) => {
    const f = fixture();
    await f.director.navigate('home');
    const home = f.handles[0];
    const hub = f.create('hub');
    const failure = new Error(`${phase} failed`);
    if (phase === 'prepare') f.prepare.mockImplementationOnce(() => { throw failure; });
    else {
      f.prepare.mockReturnValueOnce(hub);
      (phase === 'exit' ? home.exit : hub.enter).mockRejectedValueOnce(failure);
    }
    await expect(f.director.navigate('hub')).resolves.toEqual({ id: 'hub', status: 'failed', error: failure });
    expect(home.visible).toBe(true);
    expect(home.input).toBe(true);
    expect(home.dispose).not.toHaveBeenCalled();
    if (phase !== 'prepare') expect(hub.dispose).toHaveBeenCalledTimes(1);
    expect(f.director.getState().currentId).toBe('home');
    await expect(f.director.navigate('beach')).resolves.toMatchObject({ status: 'shown' });
  });

  it.each(['exit', 'enter'])('cancels a hanging %s immediately, restores current and catches later rejection', async (phase) => {
    const f = fixture();
    await f.director.navigate('home');
    const home = f.handles[0];
    const hub = f.create('hub');
    const gate = deferred();
    (phase === 'exit' ? home.exit : hub.enter).mockImplementationOnce(() => gate.promise);
    f.prepare.mockReturnValueOnce(hub);
    const active = f.director.navigate('hub');
    await flush();
    const pending = f.director.navigate('beach');
    const motionCalls = (phase === 'exit' ? home.exit : hub.enter).mock.calls;
    const context = motionCalls[motionCalls.length - 1][0];
    f.director.cancel();
    expect(home.visible).toBe(true);
    expect(home.input).toBe(true);
    expect(hub.visible).toBe(false);
    expect(context.signal.aborted).toBe(true);
    expect(context.isCurrent()).toBe(false);
    await expect(active).resolves.toMatchObject({ status: 'cancelled' });
    await expect(pending).resolves.toMatchObject({ status: 'cancelled' });
    await expect(f.director.navigate('forest')).resolves.toMatchObject({ status: 'shown' });
    gate.reject(new Error('late rejection must be consumed'));
    await flush();
    expect(f.director.getState().currentId).toBe('forest');
    expect(hub.dispose).toHaveBeenCalledTimes(1);
  });

  it('disposes a late prepared handle after cancellation without blocking subsequent navigation', async () => {
    const f = fixture();
    const gate = deferred<SceneHandle>();
    f.prepare.mockReturnValueOnce(gate.promise);
    const active = f.director.navigate('hub');
    await flush();
    const context = f.prepare.mock.calls[0][1];
    f.director.cancel();
    await expect(active).resolves.toMatchObject({ status: 'cancelled' });
    await expect(f.director.navigate('home')).resolves.toMatchObject({ status: 'shown' });
    const late = f.create('hub');
    gate.resolve(late);
    await flush();
    expect(late.dispose).toHaveBeenCalledTimes(1);
    expect(late.enter).not.toHaveBeenCalled();
    expect(context.isCurrent()).toBe(false);
    expect(f.director.getState().currentId).toBe('home');
  });

  it('retires initial synchronous preparation cancelled before its first await completes', async () => {
    const f = fixture();
    const result = f.director.navigate('home');
    f.director.cancel();
    await expect(result).resolves.toMatchObject({ status: 'cancelled' });
    await flush();
    expect(f.prepare).toHaveBeenCalledTimes(1);
    expect(f.handles[0].enter).not.toHaveBeenCalled();
    expect(f.handles[0].dispose).toHaveBeenCalledTimes(1);
    expect(f.director.getState().currentId).toBeNull();
  });

  it('retires a prepared handle cancelled between preparation fulfillment and enter', async () => {
    const f = fixture();
    const gate = deferred<SceneHandle>();
    f.prepare.mockReturnValueOnce(gate.promise);
    const result = f.director.navigate('home');
    await Promise.resolve();
    const late = f.create('home');
    gate.resolve(late);
    // Cancel from the preparation chain before run can resume its owned await.
    await Promise.resolve();
    await Promise.resolve();
    f.director.cancel();
    await expect(result).resolves.toMatchObject({ status: 'cancelled' });
    await flush();
    expect(late.dispose).toHaveBeenCalledTimes(1);
    expect(late.enter).not.toHaveBeenCalled();
    expect(late.visible).toBe(false);
  });

  it('handles late preparation rejection after disposal and settles every request', async () => {
    const f = fixture();
    await f.director.navigate('home');
    const gate = deferred<SceneHandle>();
    f.prepare.mockReturnValueOnce(gate.promise);
    const active = f.director.navigate('hub');
    await flush();
    const pending = f.director.navigate('beach');
    f.director.dispose();
    f.director.dispose();
    await expect(active).resolves.toMatchObject({ status: 'disposed' });
    await expect(pending).resolves.toMatchObject({ status: 'disposed' });
    gate.reject(new Error('late prepare failure'));
    await flush();
    expect(f.handles[0].dispose).toHaveBeenCalledTimes(1);
    expect(f.handles[0].visible).toBe(false);
    expect(f.director.getState()).toEqual({ phase: 'disposed', currentId: null, transitionId: null, pendingId: null });
    await expect(f.director.navigate('forest')).resolves.toMatchObject({ status: 'disposed' });
  });

  it('rolls back failed outgoing exit immediately and retires its still-pending prepared handle later', async () => {
    const f = fixture();
    await f.director.navigate('home');
    const gate = deferred<SceneHandle>();
    f.prepare.mockReturnValueOnce(gate.promise);
    const failure = new Error('exit failed before load');
    f.handles[0].exit.mockRejectedValueOnce(failure);
    const result = f.director.navigate('hub');
    const prepareContext = f.prepare.mock.calls[1][1];
    await expect(result).resolves.toEqual({ id: 'hub', status: 'failed', error: failure });
    expect(prepareContext.signal.aborted).toBe(true);
    expect(f.handles[0].visible).toBe(true);
    expect(f.handles[0].input).toBe(true);
    const late = f.create('hub');
    gate.resolve(late);
    await flush();
    expect(late.dispose).toHaveBeenCalledTimes(1);
    expect(late.enter).not.toHaveBeenCalled();
  });

  it('disposes both retained handles exactly once during incoming enter without replay or late resurrection', async () => {
    const f = fixture();
    await f.director.navigate('home');
    const home = f.handles[0];
    const hub = f.create('hub');
    const gate = deferred();
    hub.enter.mockReturnValueOnce(gate.promise);
    f.prepare.mockReturnValueOnce(hub);
    const active = f.director.navigate('hub');
    await flush();
    f.director.dispose();
    gate.resolve();
    await active;
    await flush();
    expect(home.dispose).toHaveBeenCalledTimes(1);
    expect(hub.dispose).toHaveBeenCalledTimes(1);
    expect(home.visible).toBe(false);
    expect(hub.visible).toBe(false);
    expect(f.director.getState().currentId).toBeNull();
  });

  it('continues cleanup even when an adapter cancellation/disposal throws', async () => {
    const f = fixture();
    await f.director.navigate('home');
    f.handles[0].cancelMotion.mockImplementation(() => { throw new Error('cancel'); });
    f.handles[0].dispose.mockImplementation(() => { throw new Error('dispose'); });
    expect(() => f.director.dispose()).not.toThrow();
    expect(f.handles[0].visible).toBe(false);
    expect(f.handles[0].input).toBe(false);
    expect(f.handles[0].dispose).toHaveBeenCalledTimes(1);
  });
});
