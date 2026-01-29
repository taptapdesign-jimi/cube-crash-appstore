type BindTileDeps = {
  tile: any;
  skipBind: boolean;
  drag: { bindToTile?: (tile: any) => void; t?: any } | null;
  trackAppAnimationFrame: (fn: () => void) => any;
  trackAppTimeout: (fn: () => void, ms: number) => any;
};

export function bindTileWithFallbackCore({
  tile,
  skipBind,
  drag,
  trackAppAnimationFrame,
  trackAppTimeout,
}: BindTileDeps){
  const attemptBind = () => {
    if (drag && typeof drag.bindToTile === 'function') {
      drag.bindToTile(tile);
      return true;
    }
    return false;
  };

  if (!skipBind || !(drag && drag.t)) {
    attemptBind();
    return;
  }

  let attempts = 0;
  const maxAttempts = 60;
  const schedule = (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
    ? trackAppAnimationFrame
    : (cb: () => void) => trackAppTimeout(cb, 16);

  const retry = () => {
    if (!drag?.t || attempts >= maxAttempts) {
      attemptBind();
      return;
    }
    attempts += 1;
    schedule(retry);
  };

  retry();
}
