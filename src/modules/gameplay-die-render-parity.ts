import { isUsablePixiImageTexture } from '../utils/pixi-image-texture-health.ts';

export type GameplayDieRenderParityIssueReason =
  | 'duplicate-die-id'
  | 'destroyed-logical-die'
  | 'detached-die'
  | 'hidden-die'
  | 'missing-visual-carrier'
  | 'detached-visual-carrier'
  | 'hidden-visual-carrier'
  | 'transparent-visual-carrier'
  | 'non-renderable-visual-carrier'
  | 'unusable-visual-texture'
  | 'missing-asset-identity'
  | 'unexpected-asset'
  | 'stale-renderer-generation'
  | 'invalid-visual-bounds'
  | 'disabled-hit-target'
  | 'missing-hit-area'
  | 'invalid-hit-area';

export type GameplayDieRenderParityIssue = Readonly<{
  dieId: string;
  tile: any;
  reason: GameplayDieRenderParityIssueReason;
  expectedAssetPath?: string;
  actualAssetPath?: string;
  expectedRendererGeneration?: number;
  actualRendererGeneration?: number;
}>;

export type GameplayDieRenderParityRecord = Readonly<{
  dieId: string;
  boardRevision: number;
  logicalKind: string;
  value: number;
  expectedAssetPath: string;
  actualAssetPath: string;
  rendererGeneration: number | null;
  attached: boolean;
  presented: boolean;
  textureHealthy: boolean;
  hitTestEligible: boolean;
}>;

export type GameplayDieRenderParitySnapshot = Readonly<{
  boardRevision: number;
  rendererGeneration: number;
  healthy: boolean;
  records: readonly GameplayDieRenderParityRecord[];
  issues: readonly GameplayDieRenderParityIssue[];
}>;

export type GameplayDieRenderParityInput = {
  boardRevision: number;
  rendererGeneration: number;
  board: any;
  logicalDice: readonly any[];
  getDieId?: (tile: any, index: number) => string;
  getLogicalKind?: (tile: any) => string;
  getExpectedAssetPath: (tile: any) => string;
  getVisualCarrier?: (tile: any) => any;
  requiresHitTest?: (tile: any) => boolean;
  isTextureUsable?: (texture: any) => boolean;
  isCarrierPresented?: (tile: any, carrier: any) => boolean;
};

function defaultDieId(tile: any, index: number): string {
  const explicit = tile?.uid ?? tile?._ccDieId ?? tile?.dieId;
  if (explicit !== undefined && explicit !== null && String(explicit)) return String(explicit);
  if (Number.isFinite(tile?.gridX) && Number.isFinite(tile?.gridY)) {
    return `${tile.gridX}:${tile.gridY}`;
  }
  return `index:${index}`;
}

function defaultLogicalKind(tile: any): string {
  return String(
    tile?._ccSpecialDiceVariant
    || tile?.specialDiceVariant
    || tile?.special
    || (tile?.locked ? 'locked' : 'regular'),
  );
}

function defaultRequiresHitTest(tile: any): boolean {
  if (!tile || tile.destroyed || tile.locked === true) return false;
  return (tile.value | 0) > 0
    || typeof tile.special === 'string'
    || typeof tile?._ccSpecialDiceVariant === 'string'
    || typeof tile?.specialDiceVariant === 'string';
}

function isAttachedTo(node: any, ancestor: any): boolean {
  if (!node || !ancestor) return false;
  let current = node;
  for (let depth = 0; current && depth < 16; depth += 1) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}

function hasPositiveVisualBounds(carrier: any): boolean {
  const width = Number(carrier?.width ?? carrier?.texture?.orig?.width ?? carrier?.texture?.width);
  const height = Number(carrier?.height ?? carrier?.texture?.orig?.height ?? carrier?.texture?.height);
  return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;
}

function hasValidHitArea(tile: any): boolean {
  const hitArea = tile?.hitArea;
  if (!hitArea) return false;
  const width = Number(hitArea.width);
  const height = Number(hitArea.height);
  return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;
}

function defaultCarrierPresented(_tile: any, carrier: any): boolean {
  return carrier?.visible !== false
    && carrier?.renderable !== false
    && !(typeof carrier?.alpha === 'number' && carrier.alpha <= 0.01);
}

/**
 * Produces one immutable semantic/model/render/input reconciliation snapshot.
 * It does not mutate Pixi, gameplay, input or renderer state. Callers may map
 * direct-art Specials to their actual visible carrier through getVisualCarrier
 * and isCarrierPresented instead of weakening the invariant globally.
 */
export function inspectGameplayDieRenderParity({
  boardRevision,
  rendererGeneration,
  board,
  logicalDice,
  getDieId = defaultDieId,
  getLogicalKind = defaultLogicalKind,
  getExpectedAssetPath,
  getVisualCarrier = (tile) => tile?.base,
  requiresHitTest = defaultRequiresHitTest,
  isTextureUsable = isUsablePixiImageTexture,
  isCarrierPresented = defaultCarrierPresented,
}: GameplayDieRenderParityInput): GameplayDieRenderParitySnapshot {
  const issues: GameplayDieRenderParityIssue[] = [];
  const records: GameplayDieRenderParityRecord[] = [];
  const seenIds = new Set<string>();

  logicalDice.forEach((tile, index) => {
    const dieId = getDieId(tile, index);
    const expectedAssetPath = getExpectedAssetPath(tile) || '';
    const carrier = getVisualCarrier(tile);
    const actualAssetPath = typeof carrier?._ccTextureAssetPath === 'string'
      ? carrier._ccTextureAssetPath
      : '';
    const actualGenerationValue = Number(carrier?._ccVisualAssetRendererGeneration);
    const actualRendererGeneration = Number.isInteger(actualGenerationValue)
      ? actualGenerationValue
      : null;
    const dieAttached = !!tile && !tile.destroyed && tile.parent === board;
    const carrierAttached = !!carrier && !carrier.destroyed && isAttachedTo(carrier, tile);
    const carrierPresented = carrierAttached && isCarrierPresented(tile, carrier);
    const textureHealthy = !!carrier && isTextureUsable(carrier.texture);
    const needsHitTest = requiresHitTest(tile);
    const hitModeHealthy = !needsHitTest
      || (tile?.eventMode === 'static' && tile?.interactive !== false);
    const hitAreaHealthy = !needsHitTest || hasValidHitArea(tile);

    const push = (reason: GameplayDieRenderParityIssueReason, extra: Partial<GameplayDieRenderParityIssue> = {}) => {
      issues.push({ dieId, tile, reason, ...extra });
    };

    if (seenIds.has(dieId)) push('duplicate-die-id');
    seenIds.add(dieId);
    if (!tile || tile.destroyed) push('destroyed-logical-die');
    else if (!dieAttached) push('detached-die');
    if (tile && (
      tile.visible === false
      || tile.renderable === false
      || (typeof tile.alpha === 'number' && tile.alpha <= 0.01)
    )) push('hidden-die');

    if (!carrier || carrier.destroyed) push('missing-visual-carrier');
    else {
      if (!carrierAttached) push('detached-visual-carrier');
      if (carrier.visible === false) push('hidden-visual-carrier');
      if (typeof carrier.alpha === 'number' && carrier.alpha <= 0.01) {
        push('transparent-visual-carrier');
      }
      if (carrier.renderable === false && !isCarrierPresented(tile, carrier)) {
        push('non-renderable-visual-carrier');
      }
      if (!textureHealthy) push('unusable-visual-texture');
      if (!hasPositiveVisualBounds(carrier)) push('invalid-visual-bounds');
      if (expectedAssetPath && !actualAssetPath) {
        push('missing-asset-identity', { expectedAssetPath });
      } else if (expectedAssetPath && actualAssetPath !== expectedAssetPath) {
        push('unexpected-asset', { expectedAssetPath, actualAssetPath });
      }
      if (rendererGeneration > 0 && actualRendererGeneration !== rendererGeneration) {
        push('stale-renderer-generation', {
          expectedRendererGeneration: rendererGeneration,
          actualRendererGeneration: actualRendererGeneration ?? undefined,
        });
      }
    }

    if (!hitModeHealthy) push('disabled-hit-target');
    if (needsHitTest && !tile?.hitArea) push('missing-hit-area');
    else if (!hitAreaHealthy) push('invalid-hit-area');

    records.push({
      dieId,
      boardRevision,
      logicalKind: getLogicalKind(tile),
      value: Number(tile?.value) | 0,
      expectedAssetPath,
      actualAssetPath,
      rendererGeneration: actualRendererGeneration,
      attached: dieAttached && carrierAttached,
      presented: tile?.visible !== false && carrierPresented,
      textureHealthy,
      hitTestEligible: hitModeHealthy && hitAreaHealthy,
    });
  });

  return {
    boardRevision,
    rendererGeneration,
    healthy: issues.length === 0,
    records,
    issues,
  };
}

export function getGameplayDieRenderParityFingerprint(
  snapshot: GameplayDieRenderParitySnapshot,
): string {
  return JSON.stringify([
    snapshot.boardRevision,
    snapshot.rendererGeneration,
    ...snapshot.records.map((record) => [
      record.dieId,
      record.logicalKind,
      record.value,
      record.expectedAssetPath,
      record.actualAssetPath,
      record.rendererGeneration,
      record.attached,
      record.presented,
      record.textureHealthy,
      record.hitTestEligible,
    ]),
    ...snapshot.issues.map((issue) => [issue.dieId, issue.reason]),
  ]);
}
