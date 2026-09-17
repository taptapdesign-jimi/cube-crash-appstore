import { Container } from 'pixi.js';
import { mountAnimatedDiceAboveHud, releaseAnimatedDiceAboveHud, syncAnimatedDiceAboveHud } from './animated-dice-hud-foreground';

/** Reparent the existing orbit, retaining its own local scale/intro/motion. */
export function createWildStarOrbitForeground(orbit: Container, host: Container, artworkZIndex: number) {
  const wrapper = new Container();
  wrapper.label = 'wild-star-orbit-foreground';
  wrapper.eventMode = 'none';
  wrapper.interactiveChildren = false;
  wrapper.zIndex = Math.max(2600, artworkZIndex) + 1;
  host.addChild(wrapper);
  if (!mountAnimatedDiceAboveHud(wrapper, wrapper, host)) {
    wrapper.destroy({ children: false });
    return null;
  }
  wrapper.addChild(orbit);
  let disposed = false;
  const sync = () => {
    if (disposed || orbit.destroyed || host.destroyed) return;
    let alpha = 1;
    let visible = true;
    // The stage still owns its own opacity; inherit only the removed branch.
    const stage = wrapper.parent?.parent;
    let current: Container | null = host;
    for (; current && current !== stage; current = current.parent) {
      alpha *= current.alpha;
      visible = visible && !current.destroyed && current.visible && current.renderable;
    }
    wrapper.alpha = alpha;
    wrapper.visible = !!stage && current === stage && visible && alpha > 0;
    if (wrapper.visible) syncAnimatedDiceAboveHud(wrapper);
  };
  sync();
  return {
    sync,
    release(): void {
      if (disposed) return;
      disposed = true;
      if (!orbit.destroyed && !host.destroyed && orbit.parent === wrapper) host.addChild(orbit);
      wrapper.removeFromParent();
      wrapper.destroy({ children: false });
      releaseAnimatedDiceAboveHud(wrapper);
    },
  };
}
