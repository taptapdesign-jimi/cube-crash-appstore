import { Container, Matrix, Sprite } from 'pixi.js';
import { STATE } from './app-state.ts';

export const ANIMATED_DICE_HUD_FOREGROUND_Z_INDEX = 10_001;
export const ANIMATED_DICE_HUD_FOREGROUND_LABEL = 'ANIMATED_DICE_HUD_FOREGROUND';

type ForegroundOwner = object;
type ForegroundDisplayObject = Container | Sprite;
type TransformSnapshot = { node: Container; matrix: Matrix };
type ForegroundEntry = {
  displayObject: ForegroundDisplayObject;
  sourceHost: Container;
  sourceLocal: Matrix;
  desiredWorld: Matrix;
  appliedDesired: Matrix;
  appliedActual: Matrix;
  sourceChain: TransformSnapshot[];
  layerRevisionSeen: number;
  hasAppliedLocal: boolean;
  hasReachedLiveStage: boolean;
};

const entries = new Map<ForegroundOwner, ForegroundEntry>();
let foregroundLayer: Container | null = null;
const layerChain: TransformSnapshot[] = [];
const inverseLayerWorld = new Matrix();
let layerTransformRevision = 0;
let cachedLayer: Container | null = null;
let cachedStage: Container | null = null;

function matricesEqual(first: Matrix, second: Matrix): boolean {
  return first.a === second.a
    && first.b === second.b
    && first.c === second.c
    && first.d === second.d
    && first.tx === second.tx
    && first.ty === second.ty;
}

function sampleTransformChain(
  start: Container,
  snapshots: TransformSnapshot[],
  stage: Container | null,
): { changed: boolean; reachesStage: boolean } {
  let changed = false;
  let reachesStage = false;
  let index = 0;
  for (let current: Container | null = start; current; current = current.parent) {
    if (current === stage) reachesStage = true;
    current.updateLocalTransform();
    const local = current.localTransform;
    const previous = snapshots[index];
    if (!previous || previous.node !== current) {
      snapshots[index] = { node: current, matrix: local.clone() };
      changed = true;
    } else if (!matricesEqual(previous.matrix, local)) {
      previous.matrix.copyFrom(local);
      changed = true;
    }
    index++;
  }
  if (snapshots.length !== index) {
    snapshots.length = index;
    changed = true;
  }
  return { changed, reachesStage };
}

function updateLayerInverse(layer: Container, stage: Container): number {
  const sample = sampleTransformChain(layer, layerChain, stage);
  if (cachedLayer === layer && cachedStage === stage && !sample.changed) return layerTransformRevision;
  cachedLayer = layer;
  cachedStage = stage;
  inverseLayerWorld.identity();
  layerChain.forEach(({ matrix }) => inverseLayerWorld.prepend(matrix));
  inverseLayerWorld.invert();
  layerTransformRevision++;
  return layerTransformRevision;
}

function resetLayerTransformCache(): void {
  layerChain.length = 0;
  inverseLayerWorld.identity();
  cachedLayer = null;
  cachedStage = null;
  layerTransformRevision++;
}

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
      appliedDesired: new Matrix(),
      appliedActual: new Matrix(),
      sourceChain: [],
      layerRevisionSeen: -1,
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
  const sourceSample = sampleTransformChain(entry.sourceHost, entry.sourceChain, stage);
  const sourceIsAttached = sourceSample.reachesStage;
  if (sourceIsAttached) entry.hasReachedLiveStage = true;
  if (layer.parent !== stage || (!sourceIsAttached && entry.hasReachedLiveStage)) {
    entry.displayObject.visible = false;
    entry.displayObject.renderable = false;
    entry.hasAppliedLocal = false;
    return false;
  }
  const layerRevision = updateLayerInverse(layer, stage!);
  const appliedDesired = entry.appliedDesired;
  const appliedActual = entry.appliedActual;
  entry.displayObject.updateLocalTransform();
  const actual = entry.displayObject.localTransform;
  if (entry.hasAppliedLocal
    && !sourceSample.changed
    && entry.layerRevisionSeen === layerRevision
    && matricesEqual(actual, appliedActual)) return true;
  entry.desiredWorld.copyFrom(entry.sourceLocal);
  entry.sourceChain.forEach(({ matrix }) => {
    // Walking from child to root: parent * child, never child * parent.
    entry.desiredWorld.prepend(matrix);
  });
  entry.desiredWorld.prepend(inverseLayerWorld);
  if (entry.hasAppliedLocal
    && matricesEqual(appliedDesired, entry.desiredWorld)
    && matricesEqual(actual, appliedActual)) {
    entry.layerRevisionSeen = layerRevision;
    return true;
  }
  entry.displayObject.setFromMatrix(entry.desiredWorld);
  appliedDesired.copyFrom(entry.desiredWorld);
  // Pixi decomposes and recomposes the supplied matrix into position/scale/
  // skew. Preserve that exact round-tripped local matrix for the clean-frame
  // guard; comparing it with the pre-decomposition desired coefficients can
  // differ by a few floating-point bits and defeat the cache forever.
  entry.displayObject.updateLocalTransform();
  appliedActual.copyFrom(entry.displayObject.localTransform);
  entry.layerRevisionSeen = layerRevision;
  entry.hasAppliedLocal = true;
  return true;
}

export function releaseAnimatedDiceAboveHud(owner: ForegroundOwner): void {
  entries.delete(owner);
  if (entries.size > 0 || !foregroundLayer) return;
  try { foregroundLayer.destroy({ children: false }); } catch {}
  foregroundLayer = null;
  resetLayerTransformCache();
}

export function getAnimatedDiceHudForegroundStats() {
  return { owners: entries.size, attached: !!foregroundLayer?.parent };
}

export function resetAnimatedDiceHudForegroundForTests(): void {
  entries.clear();
  try { foregroundLayer?.destroy({ children: false }); } catch {}
  foregroundLayer = null;
  resetLayerTransformCache();
}
