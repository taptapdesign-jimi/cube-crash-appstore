import type { SceneHandle, SceneTransitionContext } from '../scene-director';

jest.mock('../styles.css', () => ({}));
jest.mock('../scene-resources', () => ({ prepareSceneImages: jest.fn() }));
jest.mock('../scene-presentation', () => ({ createScenePresentation: jest.fn() }));
jest.mock('../../utils/app-paper-background', () => ({ applyAppPaperBackground: jest.fn() }));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(yes => { resolve = yes; });
  return { promise, resolve };
}

async function flush() {
  for (let index = 0; index < 40; index++) await Promise.resolve();
}

describe('Jimi standalone entry lifecycle and route wiring', () => {
  let host: HTMLElement;
  let status: HTMLElement;
  let prepareImages: jest.Mock;
  let present: jest.Mock;
  let nextEnter: Promise<void> | undefined;
  let handles: Array<{ root: HTMLElement; handle: jest.Mocked<SceneHandle> }>;

  const visibleScene = () => host.querySelector<HTMLElement>('[data-jimi-scene]:not([hidden])');
  const setHidden = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
    document.dispatchEvent(new Event('visibilitychange'));
  };
  const pageEvent = (type: 'pagehide' | 'pageshow', persisted: boolean) => {
    const event = new Event(type);
    Object.defineProperty(event, 'persisted', { value: persisted });
    window.dispatchEvent(event);
  };
  const click = async (selector: string) => {
    const target = host.querySelector<HTMLButtonElement>(selector);
    expect(target).not.toBeNull();
    target!.click();
    await flush();
  };
  const boot = async () => {
    require('../main');
    await flush();
  };

  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '<main id="jimi-root"></main><aside id="jimi-status"></aside><button id="jimi-retry" hidden type="button">Retry screen</button>';
    host = document.getElementById('jimi-root')!;
    status = document.getElementById('jimi-status')!;
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    nextEnter = undefined;
    handles = [];
    prepareImages = require('../scene-resources').prepareSceneImages;
    prepareImages.mockResolvedValue(undefined);
    present = require('../scene-presentation').createScenePresentation;
    present.mockImplementation((root: HTMLElement, target: HTMLElement): SceneHandle => {
      const enter = nextEnter;
      nextEnter = undefined;
      let disposed = false;
      root.hidden = true;
      root.inert = true;
      const handle: jest.Mocked<SceneHandle> = {
        setVisible: jest.fn((visible: boolean) => {
          if (disposed) return;
          if (visible) target.append(root);
          root.hidden = !visible;
        }),
        setInputEnabled: jest.fn((enabled: boolean) => { if (!disposed) root.inert = !enabled; }),
        enter: jest.fn((_context: SceneTransitionContext) => enter),
        exit: jest.fn(),
        cancelMotion: jest.fn(),
        dispose: jest.fn(() => {
          disposed = true;
          root.hidden = true;
          root.inert = true;
          root.remove();
        }),
      };
      handles.push({ root, handle });
      return handle;
    });
  });

  afterEach(async () => {
    pageEvent('pagehide', false);
    await flush();
    document.body.innerHTML = '';
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });

  it('offers an honest initial artwork failure and retries the same Home root into a usable scene', async () => {
    prepareImages.mockRejectedValueOnce(new Error('Image failed'));
    await boot();
    const retry = document.getElementById('jimi-retry') as HTMLButtonElement;
    const failedRoot = prepareImages.mock.calls[0][0];
    expect(visibleScene()).toBeNull();
    expect(status.textContent).toContain('Could not load artwork');
    expect(status.textContent).not.toContain('Previous screen restored');
    expect(retry.hidden).toBe(false);
    expect(present).not.toHaveBeenCalled();
    retry.click();
    await flush();
    expect(prepareImages).toHaveBeenCalledTimes(2);
    expect(prepareImages.mock.calls[1][0]).toBe(failedRoot);
    expect(visibleScene()).toBe(failedRoot);
    expect(visibleScene()?.dataset.jimiScene).toBe('home');
    expect(visibleScene()?.inert).toBe(false);
    expect(retry.hidden).toBe(true);
    expect(status.textContent).toBe('Presentation prototype · gameplay not connected');
    await click('[data-jimi-action="open-hub"]');
    expect(visibleScene()?.dataset.jimiScene).toBe('hub');
  });

  it('recovers Home after background interrupts the first enter before a committed scene exists', async () => {
    const firstEnter = deferred();
    nextEnter = firstEnter.promise;
    await boot();
    const first = handles[0];
    expect(visibleScene()?.dataset.jimiScene).toBe('home');
    expect(first.root.inert).toBe(true);
    setHidden(true);
    await flush();
    expect(host.inert).toBe(true);
    expect(visibleScene()).toBeNull();
    expect(first.handle.dispose).toHaveBeenCalledTimes(1);
    setHidden(false);
    await flush();
    expect(host.inert).toBe(false);
    expect(visibleScene()).toBe(first.root);
    expect(visibleScene()?.inert).toBe(false);
    expect(handles).toHaveLength(2);
    firstEnter.resolve();
    await flush();
    expect(visibleScene()).toBe(handles[1].root);
    expect(handles[1].handle.dispose).not.toHaveBeenCalled();
    await click('[data-jimi-action="open-hub"]');
    expect(visibleScene()?.dataset.jimiScene).toBe('hub');
  });

  it('survives persisted pagehide/pageshow without disposing the current scene or losing its listeners', async () => {
    await boot();
    await click('[data-jimi-action="open-hub"]');
    const hub = visibleScene()!;
    const hubHandle = handles[1].handle;
    pageEvent('pagehide', true);
    await flush();
    expect(host.inert).toBe(true);
    expect(hubHandle.dispose).not.toHaveBeenCalled();
    pageEvent('pageshow', true);
    await flush();
    expect(host.inert).toBe(false);
    expect(visibleScene()).toBe(hub);
    await click('[data-jimi-action="open-world"][data-world-id="2"]');
    expect(visibleScene()?.dataset.jimiScene).toBe('beach');
  });

  it('bootstraps Home on persisted pageshow after first preparation was cancelled, ignoring its late completion', async () => {
    const initial = deferred();
    prepareImages.mockReturnValueOnce(initial.promise);
    await boot();
    expect(visibleScene()).toBeNull();
    pageEvent('pagehide', true);
    await flush();
    pageEvent('pageshow', true);
    await flush();
    expect(visibleScene()?.dataset.jimiScene).toBe('home');
    initial.resolve();
    await flush();
    expect(handles).toHaveLength(1);
    expect(handles[0].handle.dispose).not.toHaveBeenCalled();
    expect(visibleScene()?.inert).toBe(false);
  });

  it('reuses Home, Hub and Beach roots across real actions with fresh leases and preserved scroll', async () => {
    await boot();
    const home = visibleScene()!;
    await click('[data-jimi-action="open-hub"]');
    const hub = visibleScene()!;
    await click('[data-jimi-action="open-world"][data-world-id="2"]');
    const beach = visibleScene()!;
    beach.querySelector('.jimi-scroll')!.scrollTop = 333;
    await click('[data-jimi-action="hub"]');
    expect(visibleScene()).toBe(hub);
    await click('[data-jimi-action="home"]');
    expect(visibleScene()).toBe(home);
    await click('[data-jimi-action="open-hub"]');
    expect(visibleScene()).toBe(hub);
    await click('[data-jimi-action="open-world"][data-world-id="2"]');
    expect(visibleScene()).toBe(beach);
    expect(beach.querySelector('.jimi-scroll')!.scrollTop).toBe(333);
    expect(host.querySelectorAll('[data-jimi-scene]')).toHaveLength(1);
    expect(beach.inert).toBe(false);
    for (const previous of handles.slice(0, -1)) expect(previous.handle.dispose).toHaveBeenCalledTimes(1);
    expect(handles[handles.length - 1].handle.dispose).not.toHaveBeenCalled();
  });

  it('keeps unsupported game actions in the slice, announces the boundary and does not invoke native/game hooks', async () => {
    const gameHook = jest.fn();
    const nativeHook = jest.fn();
    const saveWrite = jest.spyOn(Storage.prototype, 'setItem');
    const testWindow = window as any;
    const previousStart = testWindow.startGame;
    const previousWebkit = testWindow.webkit;
    testWindow.startGame = gameHook;
    testWindow.webkit = { messageHandlers: { startGame: { postMessage: nativeHook } } };
    try {
      await boot();
      const home = visibleScene();
      // Existing slice has no legal Play button; exercise its defensive action
      // handler without inventing canonical progress or exposing an unlock.
      const request = document.createElement('button');
      request.dataset.jimiAction = 'play-board';
      home!.append(request);
      request.click();
      await flush();
      expect(status.textContent).toContain('Gameplay is not connected');
      expect(visibleScene()).toBe(home);
      expect(gameHook).not.toHaveBeenCalled();
      expect(nativeHook).not.toHaveBeenCalled();
      expect(saveWrite).not.toHaveBeenCalled();
      await click('[data-jimi-action="open-hub"]');
      await click('[data-jimi-action="open-world"][data-world-id="3"]');
      expect(status.textContent).toContain('not migrated yet');
      expect(visibleScene()?.dataset.jimiScene).toBe('hub');
    } finally {
      testWindow.startGame = previousStart;
      testWindow.webkit = previousWebkit;
      saveWrite.mockRestore();
    }
  });

  it('permanently disposes on nonpersisted pagehide and does not resurrect from a later pageshow', async () => {
    await boot();
    pageEvent('pagehide', false);
    await flush();
    expect(visibleScene()).toBeNull();
    expect(handles[0].handle.dispose).toHaveBeenCalledTimes(1);
    pageEvent('pageshow', true);
    setHidden(false);
    await flush();
    expect(visibleScene()).toBeNull();
    expect(handles).toHaveLength(1);
  });
});
