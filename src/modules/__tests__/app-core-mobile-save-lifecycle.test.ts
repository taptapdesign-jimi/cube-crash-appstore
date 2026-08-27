import {
  cleanupMobileSaveLifecycle,
  installMobileSaveLifecycle,
} from '../app-core-mobile-save-lifecycle';

type LifecycleWindow = Window & {
  _saveGameStateRef?: EventListener | null;
  _iosVisibilityHandler?: EventListener | null;
  _saveGameStateResumeRef?: EventListener | null;
  _resumeHandlerRef?: EventListener | null;
};

const lifecycleWindow = (): LifecycleWindow => window as LifecycleWindow;

describe('app-core mobile save lifecycle ownership', () => {
  const originalHidden = Object.getOwnPropertyDescriptor(document, 'hidden');

  afterEach(() => {
    cleanupMobileSaveLifecycle();
    delete window.loadGameState;
    if (originalHidden) Object.defineProperty(document, 'hidden', originalHidden);
  });

  test('replaces every previous boot listener before installing one fresh set', () => {
    const oldSave = jest.fn() as EventListener;
    const oldVisibility = jest.fn() as EventListener;
    const oldResumeSave = jest.fn() as EventListener;
    const oldResume = jest.fn() as EventListener;
    Object.assign(lifecycleWindow(), {
      _saveGameStateRef: oldSave,
      _iosVisibilityHandler: oldVisibility,
      _saveGameStateResumeRef: oldResumeSave,
      _resumeHandlerRef: oldResume,
    });
    const windowRemove = jest.spyOn(window, 'removeEventListener');
    const documentRemove = jest.spyOn(document, 'removeEventListener');
    const windowAdd = jest.spyOn(window, 'addEventListener');
    const documentAdd = jest.spyOn(document, 'addEventListener');
    const saveGameState = jest.fn();

    installMobileSaveLifecycle({ saveGameState, trackAppTimeout: jest.fn() });

    expect(windowRemove).toHaveBeenCalledWith('pagehide', oldSave);
    expect(windowRemove).toHaveBeenCalledWith('beforeunload', oldSave);
    expect(documentRemove).toHaveBeenCalledWith('pause', oldResumeSave);
    expect(documentRemove).toHaveBeenCalledWith('visibilitychange', oldVisibility);
    expect(documentRemove).toHaveBeenCalledWith('resume', oldResume);
    expect(windowAdd).toHaveBeenCalledWith('pagehide', saveGameState);
    expect(windowAdd).toHaveBeenCalledWith('beforeunload', saveGameState);
    expect(documentAdd).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(documentAdd).toHaveBeenCalledWith('pause', saveGameState, false);
    expect(documentAdd).toHaveBeenCalledWith('resume', expect.any(Function), false);

    windowRemove.mockRestore();
    documentRemove.mockRestore();
    windowAdd.mockRestore();
    documentAdd.mockRestore();
  });

  test('saves only when hidden and resumes load through the tracked 100ms owner', async () => {
    const saveGameState = jest.fn();
    const trackAppTimeout = jest.fn((callback: () => void | Promise<void>, delay: number) => {
      expect(delay).toBe(100);
      return callback();
    });
    const loadGameState = jest.fn().mockResolvedValue(true);
    window.loadGameState = loadGameState;
    installMobileSaveLifecycle({ saveGameState, trackAppTimeout });
    const owner = lifecycleWindow();

    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    owner._iosVisibilityHandler?.(new Event('visibilitychange'));
    expect(saveGameState).not.toHaveBeenCalled();

    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    owner._iosVisibilityHandler?.(new Event('visibilitychange'));
    expect(saveGameState).toHaveBeenCalledTimes(1);

    owner._resumeHandlerRef?.(new Event('resume'));
    expect(trackAppTimeout).toHaveBeenCalledTimes(1);
    expect(loadGameState).toHaveBeenCalledTimes(1);
  });

  test('cleanup removes the current boot listeners and releases all retained references', () => {
    const saveGameState = jest.fn();
    installMobileSaveLifecycle({ saveGameState, trackAppTimeout: jest.fn() });
    const owner = lifecycleWindow();
    const visibilityHandler = owner._iosVisibilityHandler;
    const resumeHandler = owner._resumeHandlerRef;
    const windowRemove = jest.spyOn(window, 'removeEventListener');
    const documentRemove = jest.spyOn(document, 'removeEventListener');

    cleanupMobileSaveLifecycle();

    expect(windowRemove).toHaveBeenCalledWith('pagehide', saveGameState);
    expect(windowRemove).toHaveBeenCalledWith('beforeunload', saveGameState);
    expect(documentRemove).toHaveBeenCalledWith('visibilitychange', visibilityHandler);
    expect(documentRemove).toHaveBeenCalledWith('pause', saveGameState, false);
    expect(documentRemove).toHaveBeenCalledWith('resume', resumeHandler, false);
    expect(owner._saveGameStateRef).toBeNull();
    expect(owner._iosVisibilityHandler).toBeNull();
    expect(owner._saveGameStateResumeRef).toBeNull();
    expect(owner._resumeHandlerRef).toBeNull();

    windowRemove.mockRestore();
    documentRemove.mockRestore();
  });
});
