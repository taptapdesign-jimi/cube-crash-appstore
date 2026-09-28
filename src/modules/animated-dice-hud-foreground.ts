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
  appliedLocal: Matrix;
  hasAppliedLocal: boolean;
  hasReachedLiveStage: boolean;
};

const entries = new Map<ForegroundOwner, ForegroundEntry>();
let foregroundLayer: Container | null = null;

function getLiveStage(): Container | null {
  const stage = STATE.app?.stage as Container | null | undefined;
  return stage && !stage.destroyed ? stage : null;
}

export function isAnimatedDiceSourceOnLiveStage(
  sourceHost: Container,
  stage = getLiveStage(),
): boolean {
  if (!stage || sourceHost.destroyed) return false;
  for (let current: Container | null = sourceHost; current; current = current.parent) {
    if (current === stage) return true;
  }
  return false;
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
  if (
    displayObject.destroyed
    || sourceHost.destroyed
    || !isAnimatedDiceSourceOnLiveStage(sourceHost)
  ) return false;
  const layer = ensureForegroundLayer();
  if (!layer) return false;
  if (!entries.has(owner)) {
    // Width/height/position setters can leave localTransform stale until render.
    displayObject.updateLocalTransform();
    entries.set(owner, {
      displayObject,
      sourceHost,
      sourceLocal: displayObject.localTransform.clone(),
      desiredWorld: new Matrix(),
      inverseLayerWorld: new Matrix(),
      appliedLocal: new Matrix(),
      hasAppliedLocal: false,
      hasReachedLiveStage: true,
    });
  }
  if (displayObject.parent !== layer) layer.reparentChild(displayObject);
  return syncAnimatedDiceAboveHud(owner);
}

export function syncAnimatedDiceAboveHud(owner: ForegroundOwner): boolean {
  const entry = entries.get(owner);
  const layer = foregroundLayer;
  const stage = getLiveStage();
  if (!entry || !layer || layer.destroyed || entry.displayObject.destroyed) return false;
  const sourceIsAttached = isAnimatedDiceSourceOnLiveStage(entry.sourceHost, stage);
  if (sourceIsAttached) entry.hasReachedLiveStage = true;
  if (layer.parent !== stage || (!sourceIsAttached && entry.hasReachedLiveStage)) {
    entry.displayObject.visible = false;
    entry.displayObject.renderable = false;
    entry.hasAppliedLocal = false;
    return false;
  }
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
  const applied = entry.appliedLocal;
  entry.displayObject.updateLocalTransform();
  const actual = entry.displayObject.localTransform;
  if (entry.hasAppliedLocal
    && applied.a === entry.desiredWorld.a
    && applied.b === entry.desiredWorld.b
    && applied.c === entry.desiredWorld.c
    && applied.d === entry.desiredWorld.d
    && applied.tx === entry.desiredWorld.tx
    && applied.ty === entry.desiredWorld.ty
    && actual.a === entry.desiredWorld.a
    && actual.b === entry.desiredWorld.b
    && actual.c === entry.desiredWorld.c
    && actual.d === entry.desiredWorld.d
    && actual.tx === entry.desiredWorld.tx
    && actual.ty === entry.desiredWorld.ty) return true;
  entry.displayObject.setFromMatrix(entry.desiredWorld);
  applied.copyFrom(entry.desiredWorld);
  entry.hasAppliedLocal = true;
  return true;
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
