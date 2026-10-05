import type { SceneHandle, SceneTransitionContext } from '../scene-director';

jest.mock('../styles.css', () => ({}));
jest.mock('../scene-resources', () => ({ prepareSceneImages: jest.fn() }));
jest.mock('../scene-presentation', () => ({ createScenePresentation: jest.fn() }));
jest.mock('../scene-assembly', () => ({ buildBeachSceneIncrementally: jest.fn() }));
// Historical observer is intentionally absent; catch accidental reintroduction.
jest.mock('../transition-measurement', () => ({ measureTransition: jest.fn() }), { virtual: true });
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
  let assembleBeach: jest.Mock;
  let nextEnter: Promise<void> | undefined;
  let scrollAtEnter: Array<number | null>;
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
    delete document.documentElement.dataset.jimiMetrics;
    delete document.documentElement.dataset.jimiInputMetrics;
    document.body.innerHTML = '<main id="jimi-root"></main><aside id="jimi-status"></aside><button id="jimi-retry" hidden type="button">Retry screen</button>';
    host = document.getElementById('jimi-root')!;
    status = document.getElementById('jimi-status')!;
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    nextEnter = undefined;
    scrollAtEnter = [];
    handles = [];
    prepareImages = require('../scene-resources').prepareSceneImages;
    prepareImages.mockResolvedValue(undefined);
    assembleBeach = require('../scene-assembly').buildBeachSceneIncrementally;
    // Timer/Unit scheduling is tested by scene-assembly.test.ts. Entry tests
    // exercise routing with an immediate completed assembly unless deferred below.
    assembleBeach.mockImplementation((progress: unknown) => Promise.resolve(require('../scene-builders').buildBeachScene(progress)));
    present = require('../scene-presentation').createScenePresentation;
    present.mockImplementation((root: HTMLElement, target: HTMLElement): SceneHandle => {
      const enter = nextEnter;
      nextEnter = undefined;
      let disposed = false;
      const resetBrowserScroll = () => {
        const scroll = root.querySelector<HTMLElement>('.jimi-scroll');
        if (scroll) scroll.scrollTop = 0;
      };
      root.hidden = true;
      resetBrowserScroll();
      root.inert = true;
      const handle: jest.Mocked<SceneHandle> = {
        setVisible: jest.fn((visible: boolean) => {
          if (disposed) return;
          if (visible && root.parentElement !== target) target.append(root);
          root.hidden = !visible;
          // Model the actual WKWebView regression: hidden/detached overflow DOM
          // does not retain its native scroll position like jsdom normally does.
          if (!visible) resetBrowserScroll();
        }),
        setInputEnabled: jest.fn((enabled: boolean) => { if (!disposed) root.inert = !enabled; }),
        enter: jest.fn((_context: SceneTransitionContext) => {
          scrollAtEnter.push(root.querySelector<HTMLElement>('.jimi-scroll')?.scrollTop ?? null);
          return enter;
        }),
        exit: jest.fn(),
        cancelMotion: jest.fn(),
        dispose: jest.fn(() => {
          disposed = true;
          root.hidden = true;
          root.inert = true;
          root.remove();
          resetBrowserScroll();
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
    delete document.documentElement.dataset.jimiMetrics;
    delete document.documentElement.dataset.jimiInputMetrics;
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
    expect(assembleBeach).toHaveBeenCalledTimes(1);
    expect(host.querySelectorAll('[data-jimi-scene]')).toHaveLength(1);
    expect(beach.inert).toBe(false);
    for (const previous of handles.slice(0, -1)) expect(previous.handle.dispose).toHaveBeenCalledTimes(1);
    expect(handles[handles.length - 1].handle.dispose).not.toHaveBeenCalled();
  });

  it.each(['background', 'persisted-pagehide'])('cancels cold Beach on %s, restores Hub and ignores late assembly/cache publication', async boundary => {
    await boot();
    await click('[data-jimi-action="open-hub"]');
    const hub = visibleScene()!;
    const pending = deferred();
    const lateRoot: HTMLElement = require('../scene-builders').buildBeachScene({});
    assembleBeach.mockReturnValueOnce(pending.promise.then(() => lateRoot));
    await click('[data-jimi-action="open-world"][data-world-id="2"]');
    const cancelledContext = assembleBeach.mock.calls[0][1] as SceneTransitionContext;
    expect(visibleScene()).toBe(hub);
    expect(hub.inert).toBe(true);
    expect(cancelledContext.signal.aborted).toBe(false);
    expect(prepareImages.mock.calls.some(([root]) => root === lateRoot)).toBe(false);

    if (boundary === 'background') setHidden(true);
    else pageEvent('pagehide', true);
    await flush();
    expect(cancelledContext.signal.aborted).toBe(true);
    expect(cancelledContext.isCurrent()).toBe(false);
    expect(visibleScene()).toBe(hub);
    expect(hub.inert).toBe(false);
    expect(host.inert).toBe(true);
    if (boundary === 'background') setHidden(false);
    else pageEvent('pageshow', true);
    await flush();
    expect(host.inert).toBe(false);
    expect(visibleScene()).toBe(hub);

    await click('[data-jimi-action="open-world"][data-world-id="2"]');
    const freshBeach = visibleScene()!;
    expect(freshBeach.dataset.jimiScene).toBe('beach');
    expect(freshBeach).not.toBe(lateRoot);
    expect(freshBeach.inert).toBe(false);
    expect(assembleBeach).toHaveBeenCalledTimes(2);
    pending.resolve();
    await flush();
    expect(lateRoot.isConnected).toBe(false);
    expect(lateRoot.querySelector('[data-jimi-action="art-preview"]')).toBeNull();
    expect(prepareImages.mock.calls.some(([root]) => root === lateRoot)).toBe(false);
    expect(present.mock.calls.some(([root]) => root === lateRoot)).toBe(false);
    expect(visibleScene()).toBe(freshBeach);
    expect((document.getElementById('jimi-retry') as HTMLButtonElement).hidden).toBe(true);
    freshBeach.querySelector('.jimi-scroll')!.scrollTop = 275;
    await click('[data-jimi-action="hub"]');
    await click('[data-jimi-action="open-world"][data-world-id="2"]');
    expect(visibleScene()).toBe(freshBeach);
    expect(freshBeach.querySelector('.jimi-scroll')!.scrollTop).toBe(275);
    expect(assembleBeach).toHaveBeenCalledTimes(2);
  });

  it('restores native Beach scroll after preview hide/detach, before the return enter', async () => {
    await boot();
    await click('[data-jimi-action="open-hub"]');
    await click('[data-jimi-action="open-world"][data-world-id="2"]');
    const beach = visibleScene()!;
    const scroll = beach.querySelector<HTMLElement>('.jimi-scroll')!;
    scroll.scrollTop = 365;
    await click('[data-jimi-action="art-preview"]');
    expect(beach.isConnected).toBe(false);
    expect(scroll.scrollTop).toBe(0); // Deliberate WebKit emulation, not jsdom retention.
    await click('[data-jimi-action="close-card"]');
    expect(visibleScene()).toBe(beach);
    expect(scroll.scrollTop).toBe(365);
    expect(scrollAtEnter[scrollAtEnter.length - 1]).toBe(365);
    expect(assembleBeach).toHaveBeenCalledTimes(1);

    // Repeated hide/retire of an already-hidden root must not overwrite 365 with 0.
    await click('[data-jimi-action="art-preview"]');
    await click('[data-jimi-action="close-card"]');
    expect(visibleScene()).toBe(beach);
    expect(scroll.scrollTop).toBe(365);
    expect(scrollAtEnter[scrollAtEnter.length - 1]).toBe(365);
  });

  it.each(['preparing', 'entering'])('keeps the newest user scroll on %s cancellation and rollback', async phase => {
    await boot();
    await click('[data-jimi-action="open-hub"]');
    await click('[data-jimi-action="open-world"][data-world-id="2"]');
    const beach = visibleScene()!;
    const scroll = beach.querySelector<HTMLElement>('.jimi-scroll')!;
    scroll.scrollTop = 365;
    await click('[data-jimi-action="art-preview"]');
    await click('[data-jimi-action="close-card"]');
    expect(scroll.scrollTop).toBe(365);
    scroll.scrollTop = 420;
    const pending = deferred();
    if (phase === 'preparing') prepareImages.mockReturnValueOnce(pending.promise);
    else nextEnter = pending.promise;
    await click('[data-jimi-action="art-preview"]');
    if (phase === 'preparing') {
      expect(visibleScene()).toBe(beach);
      expect(scroll.scrollTop).toBe(420);
    } else {
      expect(visibleScene()?.dataset.jimiScene).toBe('card');
      expect(beach.hidden).toBe(true);
      expect(scroll.scrollTop).toBe(0);
    }
    setHidden(true);
    await flush();
    expect(visibleScene()).toBe(beach);
    expect(scroll.scrollTop).toBe(420);
    setHidden(false);
    await flush();
    expect(scroll.scrollTop).toBe(420);
    pending.resolve();
    await flush();
    expect(visibleScene()).toBe(beach);
    expect(scroll.scrollTop).toBe(420);
    expect(beach.inert).toBe(false);
  });

  it('allows a failed cold Beach assembly to retry without caching failure or losing Hub input', async () => {
    await boot();
    await click('[data-jimi-action="open-hub"]');
    const hub = visibleScene()!;
    assembleBeach.mockRejectedValueOnce(new Error('Unit assembly failed'));
    await click('[data-jimi-action="open-world"][data-world-id="2"]');
    expect(visibleScene()).toBe(hub);
    expect(hub.inert).toBe(false);
    expect(status.textContent).toContain('Previous screen restored');
    const retry = document.getElementById('jimi-retry') as HTMLButtonElement;
    expect(retry.hidden).toBe(false);
    expect(prepareImages.mock.calls.filter(([root]) => root.dataset.jimiScene === 'beach')).toHaveLength(0);
    retry.click();
    await flush();
    expect(assembleBeach).toHaveBeenCalledTimes(2);
    expect(visibleScene()?.dataset.jimiScene).toBe('beach');
    expect(visibleScene()?.inert).toBe(false);
    expect(retry.hidden).toBe(true);
  });

  it('permanent disposal during cold assembly prevents late image preparation, presentation and resurrection', async () => {
    await boot();
    await click('[data-jimi-action="open-hub"]');
    const pending = deferred();
    const lateRoot: HTMLElement = require('../scene-builders').buildBeachScene({});
    assembleBeach.mockReturnValueOnce(pending.promise.then(() => lateRoot));
    await click('[data-jimi-action="open-world"][data-world-id="2"]');
    const context = assembleBeach.mock.calls[0][1] as SceneTransitionContext;
    pageEvent('pagehide', false);
    await flush();
    expect(context.signal.aborted).toBe(true);
    pending.resolve();
    await flush();
    expect(visibleScene()).toBeNull();
    expect(lateRoot.isConnected).toBe(false);
    expect(prepareImages.mock.calls.some(([root]) => root === lateRoot)).toBe(false);
    expect(present.mock.calls.some(([root]) => root === lateRoot)).toBe(false);
    pageEvent('pageshow', true);
    setHidden(false);
    await flush();
    expect(visibleScene()).toBeNull();
    expect(assembleBeach).toHaveBeenCalledTimes(1);
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

  it.each([false, true])('keeps identical route ownership with diagnostics enabled=%s and never starts the old RAF observer', async enabled => {
    document.documentElement.dataset.jimiMetrics = String(enabled);
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextId = 0;
    let peak = 0;
    const raf = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callbacks.set(++nextId, callback);
      peak = Math.max(peak, callbacks.size);
      return nextId;
    });
    const cancel = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { callbacks.delete(id); });
    const previousWebkit = Object.getOwnPropertyDescriptor(window, 'webkit');
    const postMessage = jest.fn();
    Object.defineProperty(window, 'webkit', { configurable: true, value: { messageHandlers: { consoleLog: { postMessage } } } });
    try {
      await boot();
      const home = visibleScene();
      await click('[data-jimi-action="open-hub"]');
      const hub = visibleScene();
      await click('[data-jimi-action="open-world"][data-world-id="2"]');
      expect(visibleScene()?.dataset.jimiScene).toBe('beach');
      await click('[data-jimi-action="hub"]');
      expect(visibleScene()).toBe(hub);
      await click('[data-jimi-action="home"]');
      expect(visibleScene()).toBe(home);
      expect(visibleScene()?.inert).toBe(false);
      expect(callbacks.size).toBe(0);
      expect(require('../transition-measurement').measureTransition).not.toHaveBeenCalled();
      if (enabled) {
        expect(peak).toBe(1);
        expect(raf).toHaveBeenCalledTimes(5);
        expect(cancel).toHaveBeenCalledTimes(5);
        const records = postMessage.mock.calls.map(([message]) => message.message as string);
        expect(records).toHaveLength(5);
        expect(records.every(message => message.startsWith('[JIMI_SCENE_DIAGNOSTICS]'))).toBe(true);
        expect(records.some(message => message.startsWith('[JIMI_TRANSITION]'))).toBe(false);
        const hubRecord = JSON.parse(records[1].slice(records[1].indexOf('{')));
        expect(hubRecord.phases.map((phase: { name: string }) => phase.name)).toEqual(expect.arrayContaining([
          'build', 'presentation.create', 'home.exit.setup', 'home.visible.false',
          'hub.visible.true', 'hub.enter.setup', 'home.dispose',
        ]));
        expect(hubRecord.marks.map((mark: { name: string }) => mark.name)).toEqual(expect.arrayContaining([
          'prepare.cold', 'images.start', 'images.end', 'home.exit.start', 'home.exit.end',
          'hub.enter.start', 'hub.enter.end', 'art.visible',
        ]));
      } else {
        expect(raf).not.toHaveBeenCalled();
        expect(postMessage).not.toHaveBeenCalled();
        expect(document.querySelector('.jimi-diagnostic-toggle')).toBeNull();
      }
    } finally {
      pageEvent('pagehide', false);
      await flush();
      raf.mockRestore(); cancel.mockRestore();
      if (previousWebkit) Object.defineProperty(window, 'webkit', previousWebkit);
      else delete (window as any).webkit;
    }
  });

  it('does not register input snapshot observers when only route timing is enabled', async () => {
    document.documentElement.dataset.jimiMetrics = 'true';
    const listen = jest.spyOn(host, 'addEventListener');
    await boot();
    expect(listen.mock.calls.some(([type]) => type === 'pointerdown' || type === 'touchstart' || type === 'scroll')).toBe(false);
    listen.mockRestore();
  });

  it('enables and cleans input observations independently from route timing', async () => {
    document.documentElement.dataset.jimiInputMetrics = 'true';
    const listen = jest.spyOn(host, 'addEventListener');
    const remove = jest.spyOn(host, 'removeEventListener');
    await boot();
    expect(listen).toHaveBeenCalledWith('pointerdown', expect.any(Function), { capture: true, passive: true });
    pageEvent('pagehide', false);
    await flush();
    expect(remove).toHaveBeenCalledWith('pointerdown', expect.any(Function), { capture: true, passive: true });
    listen.mockRestore();
    remove.mockRestore();
  });

  it('samples Beach animation admission from the current scroll position without replacing or hiding its content', async () => {
    await boot();
    await click('[data-jimi-action="open-hub"]');
    expect(present.mock.calls[1][2]).toBeUndefined();
    await click('[data-jimi-action="open-world"][data-world-id="2"]');
    const root = visibleScene()!;
    const scroll = root.querySelector<HTMLElement>('.jimi-scroll')!;
    const options = present.mock.calls.find(([scene]) => scene === root)![2];
    const markup = root.outerHTML;
    const top = options.getAdmittedUnitIds('enter') as ReadonlySet<string>;
    expect(top.has('header')).toBe(true);
    expect(top.has('beach-main')).toBe(true);
    expect(top.has('board-20')).toBe(false);
    scroll.scrollTop = 1120;
    const bottom = options.getAdmittedUnitIds('exit') as ReadonlySet<string>;
    expect(bottom.has('header')).toBe(true);
    expect(bottom.has('beach-main')).toBe(false);
    expect(bottom.has('board-20')).toBe(true);
    expect(root.outerHTML).toBe(markup);
  });

  it('starts diagnostic art ON and toggles only host paint class without changing images, save data or scene preparation', async () => {
    document.documentElement.dataset.jimiMetrics = 'true';
    const saveWrite = jest.spyOn(Storage.prototype, 'setItem');
    await boot();
    const toggle = document.querySelector<HTMLButtonElement>('.jimi-diagnostic-toggle')!;
    expect(toggle).not.toBeNull();
    expect(toggle.textContent).toBe('Diagnostic art: ON');
    expect(host.classList.contains('jimi-diagnostic-no-art')).toBe(false);
    await click('[data-jimi-action="open-hub"]');
    await click('[data-jimi-action="open-world"][data-world-id="2"]');
    const root = visibleScene()!;
    const images = [...root.querySelectorAll('img')];
    const imageMarkup = images.map(image => image.outerHTML);
    const preparedCount = prepareImages.mock.calls.length;
    const presentedCount = present.mock.calls.length;
    toggle.click();
    expect(host.classList.contains('jimi-diagnostic-no-art')).toBe(true);
    expect(toggle.textContent).toBe('Diagnostic art: OFF');
    expect(visibleScene()).toBe(root);
    expect([...root.querySelectorAll('img')]).toEqual(images);
    expect(images.map(image => image.outerHTML)).toEqual(imageMarkup);
    toggle.click();
    expect(host.classList.contains('jimi-diagnostic-no-art')).toBe(false);
    expect(images.map(image => image.outerHTML)).toEqual(imageMarkup);
    expect(prepareImages).toHaveBeenCalledTimes(preparedCount);
    expect(present).toHaveBeenCalledTimes(presentedCount);
    expect(saveWrite).not.toHaveBeenCalled();
    pageEvent('pagehide', false);
    await flush();
    expect(document.querySelector('.jimi-diagnostic-toggle')).toBeNull();
    saveWrite.mockRestore();
  });
});
