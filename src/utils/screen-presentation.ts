// Paint preparation is not navigation. Keep this separate from CSS opacity:
// an actual entering screen owns its route even before its first visible frame.
const preparingScreens = new WeakMap<HTMLElement, symbol>();

export function beginScreenPreparation(screen: HTMLElement): () => void {
  const owner = Symbol('screen-preparation');
  preparingScreens.set(screen, owner);
  return () => {
    if (preparingScreens.get(screen) === owner) preparingScreens.delete(screen);
  };
}

export function isScreenPresented(screen: HTMLElement | null): boolean {
  if (!screen || !screen.isConnected || screen.hidden || preparingScreens.has(screen)) return false;
  const style = window.getComputedStyle(screen);
  return style.display !== 'none' && style.visibility !== 'hidden';
}
