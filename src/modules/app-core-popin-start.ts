type PopInStartDeps = {
  appEl: HTMLElement | null;
  runPopIn: () => Promise<any> | any;
  trackAppTimeout: (fn: () => void, ms: number) => any;
};

export function createSweetPopPromise({
  appEl,
  runPopIn,
  trackAppTimeout,
}: PopInStartDeps){
  return new Promise((resolve) => {
    const isHidden = () =>
      !!appEl && (appEl.hasAttribute('hidden') || appEl.style.display === 'none' || appEl.style.visibility === 'hidden');
    const startAt = Date.now();
    const tryStart = () => {
      if (!isHidden() || (Date.now() - startAt) > 1500) {
        if (isHidden()) {
          try {
            appEl?.removeAttribute('hidden');
            if (appEl) {
              appEl.style.display = 'block';
              appEl.style.visibility = 'visible';
              appEl.style.opacity = '1';
            }
          } catch {}
        }
        Promise.resolve(runPopIn()).then(resolve);
        return;
      }
      trackAppTimeout(tryStart, 100);
    };
    tryStart();
  });
}
