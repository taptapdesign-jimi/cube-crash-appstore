import { Container, Matrix, Sprite } from 'pixi.js';
import { STATE } from './app-state.ts';

export const ANIMATED_DICE_HUD_FOREGROUND_Z_INDEX = 10_001;
export const ANIMATED_DICE_HUD_FOREGROUND_LABEL = 'ANIMATED_DICE_HUD_FOREGROUND';

type ForegroundOwner = object;
type ForegroundDisplayObject = Container | Sprite;
type ForegroundEntry = {
  displayObject: ForegroundDisplayObject;
  sourceHost: Container;
  sourceLocal: Matrix;
  desiredWorld: Matrix;
  inverseLayerWorld: Matrix;
};

const entries = new Map<ForegroundOwner, ForegroundEntry>();
let foregroundLayer: Container | null = null;

function getLiveStage(): Container | null {
  const stage = STATE.app?.stage as Container | null | undefined;
  return stage && !stage.destroyed ? stage : null;
}

function ensureForegroundLayer(): Container | null {
  const stage = getLiveStage();
  if (!stage) return null;
  if (!foregroundLayer || foregroundLayer.destroyed) {
    foregroundLayer = new Container();
    foregroundLayer.label = ANIMATED_DICE_HUD_FOREGROUND_LABEL;
    foregroundLayer.eventMode = 'none';
    foregroundLayer.interactive = false;
    foregroundLayer.interactiveChildren = false;
    foregroundLayer.sortableChildren = true;
  }
  if (foregroundLayer.parent !== stage) {
    foregroundLayer.removeFromParent();
    stage.sortableChildren = true;
    stage.addChild(foregroundLayer);
  }
  foregroundLayer.zIndex = ANIMATED_DICE_HUD_FOREGROUND_Z_INDEX;
  stage.sortChildren?.();
  return foregroundLayer;
}

export function mountAnimatedDiceAboveHud(
  owner: ForegroundOwner,
  displayObject: ForegroundDisplayObject,
  sourceHost: Container,
): boolean {
  const layer = ensureForegroundLayer();
  if (!layer || displayObject.destroyed || sourceHost.destroyed) return false;
  if (!entries.has(owner)) {
    // Width/height/position setters can leave localTransform stale until render.
    displayObject.updateLocalTransform();
    entries.set(owner, {
      displayObject,
      sourceHost,
      sourceLocal: displayObject.localTransform.clone(),
      desiredWorld: new Matrix(),
      inverseLayerWorld: new Matrix(),
    });
  }
  if (displayObject.parent !== layer) layer.reparentChild(displayObject);
  syncAnimatedDiceAboveHud(owner);
  return true;
}

export function syncAnimatedDiceAboveHud(owner: ForegroundOwner): void {
  const entry = entries.get(owner);
  const layer = foregroundLayer;
  if (!entry || !layer || layer.destroyed || entry.displayObject.destroyed || entry.sourceHost.destroyed) return;
  entry.desiredWorld.copyFrom(entry.sourceLocal);
  for (let current: Container | null = entry.sourceHost; current; current = current.parent) {
    current.updateLocalTransform();
    // Walking from child to root: parent * child, never child * parent.
    entry.desiredWorld.prepend(current.localTransform);
  }
  entry.inverseLayerWorld.identity();
  for (let current: Container | null = layer; current; current = current.parent) {
    current.updateLocalTransform();
    entry.inverseLayerWorld.prepend(current.localTransform);
  }
  entry.inverseLayerWorld.invert();
  entry.desiredWorld.prepend(entry.inverseLayerWorld);
  entry.displayObject.setFromMatrix(entry.desiredWorld);
}

export function releaseAnimatedDiceAboveHud(owner: ForegroundOwner): void {
  entries.delete(owner);
  if (entries.size > 0 || !foregroundLayer) return;
  try { foregroundLayer.destroy({ children: false }); } catch {}
  foregroundLayer = null;
}

export function getAnimatedDiceHudForegroundStats() {
  return { owners: entries.size, attached: !!foregroundLayer?.parent };
}

export function resetAnimatedDiceHudForegroundForTests(): void {
  entries.clear();
  try { foregroundLayer?.destroy({ children: false }); } catch {}
  foregroundLayer = null;
}
