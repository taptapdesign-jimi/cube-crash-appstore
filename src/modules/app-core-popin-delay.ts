type PopInDelayDeps = {
  shouldDelayForHUD: boolean;
  trackAppTimeout: (fn: () => void, ms: number) => any;
  sweetPopInRunner: () => Promise<any> | any;
};

export function createPopInRunner({
  shouldDelayForHUD,
  trackAppTimeout,
  sweetPopInRunner,
}: PopInDelayDeps){
  return () =>
    shouldDelayForHUD
      ? new Promise((resolve) => trackAppTimeout(() => resolve(sweetPopInRunner()), 120))
      : sweetPopInRunner();
}
