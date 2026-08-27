export type MobileSaveLifecycleDeps = {
  saveGameState: () => void;
  trackAppTimeout: (callback: () => void | Promise<void>, delay: number) => unknown;
};

export type MobileSaveLifecycleCleanupLogger = {
  log?: (message: string) => void;
  warn?: (message: string, error: unknown) => void;
};

type MobileSaveLifecycleWindow = Window & {
  _saveGameStateRef?: EventListener | null;
  _iosVisibilityHandler?: EventListener | null;
  _saveGameStateResumeRef?: EventListener | null;
  _resumeHandlerRef?: EventListener | null;
};

function getLifecycleWindow(): MobileSaveLifecycleWindow {
  return window as MobileSaveLifecycleWindow;
}

function removeExistingMobileSaveLifecycleListeners(): void {
  const lifecycleWindow = getLifecycleWindow();
  const previousSave = lifecycleWindow._saveGameStateRef;
  const previousVisibility = lifecycleWindow._iosVisibilityHandler;
  const previousResumeSave = lifecycleWindow._saveGameStateResumeRef;
  const previousResume = lifecycleWindow._resumeHandlerRef;

  try { if (previousSave) window.removeEventListener('pagehide', previousSave); } catch {}
  try { if (previousSave) window.removeEventListener('beforeunload', previousSave); } catch {}
  try { if (previousResumeSave) document.removeEventListener('pause', previousResumeSave); } catch {}
  try { if (previousVisibility) document.removeEventListener('visibilitychange', previousVisibility); } catch {}
  try { if (previousResume) document.removeEventListener('resume', previousResume); } catch {}
}

export function installMobileSaveLifecycle({
  saveGameState,
  trackAppTimeout,
}: MobileSaveLifecycleDeps): void {
  removeExistingMobileSaveLifecycleListeners();

  const lifecycleWindow = getLifecycleWindow();
  const saveHandler = saveGameState as EventListener;
  const iosVisibilityHandler: EventListener = () => {
    if (document.hidden) saveGameState();
  };
  const resumeHandler: EventListener = () => {
    if (typeof window.loadGameState === 'function') {
      trackAppTimeout(() => { void window.loadGameState?.(); }, 100);
    }
  };

  lifecycleWindow._saveGameStateRef = saveHandler;
  lifecycleWindow._iosVisibilityHandler = iosVisibilityHandler;
  lifecycleWindow._saveGameStateResumeRef = saveHandler;
  lifecycleWindow._resumeHandlerRef = resumeHandler;
  window.addEventListener('pagehide', saveHandler);
  window.addEventListener('beforeunload', saveHandler);
  document.addEventListener('visibilitychange', iosVisibilityHandler);
  document.addEventListener('pause', saveHandler, false);
  document.addEventListener('resume', resumeHandler, false);
}

export function cleanupMobileSaveLifecycle({
  log,
  warn,
}: MobileSaveLifecycleCleanupLogger = {}): void {
  const lifecycleWindow = getLifecycleWindow();

  try {
    const saveGameStateRef = lifecycleWindow._saveGameStateRef;
    const iosVisibilityHandler = lifecycleWindow._iosVisibilityHandler;

    if (saveGameStateRef) {
      window.removeEventListener('pagehide', saveGameStateRef);
      log?.('✅ iOS pagehide listener removed (app-core.ts)');
      lifecycleWindow._saveGameStateRef = null;
    }

    if (iosVisibilityHandler) {
      document.removeEventListener('visibilitychange', iosVisibilityHandler);
      log?.('✅ iOS visibilitychange listener removed (app-core.ts)');
      lifecycleWindow._iosVisibilityHandler = null;
    }
  } catch (error) {
    warn?.('⚠️ Failed to remove iOS lifecycle listeners:', error);
  }

  try {
    const saveGameStateRef = lifecycleWindow._saveGameStateResumeRef;
    const resumeHandler = lifecycleWindow._resumeHandlerRef;

    if (saveGameStateRef) {
      window.removeEventListener('beforeunload', saveGameStateRef);
      document.removeEventListener('pause', saveGameStateRef, false);
      lifecycleWindow._saveGameStateResumeRef = null;
      log?.('✅ beforeunload/pause listeners removed');
    }

    if (resumeHandler) {
      document.removeEventListener('resume', resumeHandler, false);
      lifecycleWindow._resumeHandlerRef = null;
      log?.('✅ resume listener removed');
    }
  } catch (error) {
    warn?.('⚠️ Failed to remove lifecycle listeners:', error);
  }
}
