import type { GameplayResolutionDecision } from './gameplay-resolution-engine.ts';
import { isUsablePixiImageTexture } from '../utils/pixi-image-texture-health.ts';

export type SpecialDiceRenderHealthIssueReason =
  | 'logical-tile-hidden'
  | 'missing-base-face'
  | 'detached-base-face'
  | 'hidden-base-face'
  | 'transparent-base-face'
  | 'unusable-base-texture'
  | 'unexpected-base-asset'
  | 'stale-renderer-generation';

export type SpecialDiceRenderHealthIssue = Readonly<{
  tile: any;
  reason: SpecialDiceRenderHealthIssueReason;
  expectedAssetPath?: string;
  actualAssetPath?: string;
  expectedRendererGeneration?: number;
  actualRendererGeneration?: number;
}>;

export type SettledSpecialRenderGate =
  | Readonly<{ type: 'proceed'; issues: readonly [] }>
  | Readonly<{
      type: 'wait';
      reason: 'special-render-recovery-required';
      action: 'recover-renderer';
      issues: readonly SpecialDiceRenderHealthIssue[];
    }>;

export type SettledSpecialRecoveryClaim = Readonly<{
  action: 'none' | 'recover' | 'fallback';
  attempt: number;
  maxAttempts: number;
  incidentKey: string | null;
}>;

type SettledSpecialRenderGateInput = {
  decision: GameplayResolutionDecision | null;
  moveEnablingSpecials: readonly any[];
  currentRendererGeneration: number;
  getExpectedAssetPath?: (tile: any) => string;
  isTextureUsable?: (texture: any) => boolean;
};

function inspectSpecialBaseFace({
  tile,
  currentRendererGeneration,
  getExpectedAssetPath,
  isTextureUsable,
}: {
  tile: any;
  currentRendererGeneration: number;
  getExpectedAssetPath?: (tile: any) => string;
  isTextureUsable: (texture: any) => boolean;
}): SpecialDiceRenderHealthIssue | null {
  if (
    tile?.destroyed
    || tile?.visible === false
    || tile?.renderable === false
    || (typeof tile?.alpha === 'number' && tile.alpha <= 0.01)
  ) {
    return { tile, reason: 'logical-tile-hidden' };
  }

  const base = tile?.base;
  if (!base || base.destroyed) return { tile, reason: 'missing-base-face' };
  if (!base.parent) return { tile, reason: 'detached-base-face' };
  if (base.visible === false) return { tile, reason: 'hidden-base-face' };
  if (typeof base.alpha === 'number' && base.alpha <= 0.01) {
    return { tile, reason: 'transparent-base-face' };
  }
  // Direct PNG/SVG/sheet artwork may deliberately set base.renderable=false
  // while mirroring this canonical carrier. Structural/texture parity remains
  // authoritative; renderable alone is therefore not a health failure.
  if (!isTextureUsable(base.texture)) return { tile, reason: 'unusable-base-texture' };

  const expectedAssetPath = getExpectedAssetPath?.(tile) || '';
  const actualAssetPath = typeof base._ccTextureAssetPath === 'string'
    ? base._ccTextureAssetPath
    : '';
  if (expectedAssetPath && actualAssetPath && expectedAssetPath !== actualAssetPath) {
    return {
      tile,
      reason: 'unexpected-base-asset',
      expectedAssetPath,
      actualAssetPath,
    };
  }

  const actualRendererGeneration = Number(base._ccVisualAssetRendererGeneration);
  if (
    currentRendererGeneration > 0
    && (!Number.isInteger(actualRendererGeneration) || actualRendererGeneration !== currentRendererGeneration)
  ) {
    return {
      tile,
      reason: 'stale-renderer-generation',
      expectedRendererGeneration: currentRendererGeneration,
      actualRendererGeneration: Number.isFinite(actualRendererGeneration)
        ? actualRendererGeneration
        : undefined,
    };
  }

  return null;
}

/**
 * Semantic parity guard for a settled resolver decision. Logical Specials stay
 * in gameplay; a missing/stale visual carrier converts only this observation
 * tick into a renderer-recovery wait.
 */
export function guardSettledSpecialRenderHealth({
  decision,
  moveEnablingSpecials,
  currentRendererGeneration,
  getExpectedAssetPath,
  isTextureUsable = isUsablePixiImageTexture,
}: SettledSpecialRenderGateInput): SettledSpecialRenderGate {
  if (
    (decision?.type !== 'continue' && decision?.type !== 'fail')
    || moveEnablingSpecials.length === 0
  ) {
    return { type: 'proceed', issues: [] };
  }

  const issues = moveEnablingSpecials.flatMap((tile) => {
    const issue = inspectSpecialBaseFace({
      tile,
      currentRendererGeneration,
      getExpectedAssetPath,
      isTextureUsable,
    });
    return issue ? [issue] : [];
  });
  if (issues.length === 0) return { type: 'proceed', issues: [] };

  return {
    type: 'wait',
    reason: 'special-render-recovery-required',
    action: 'recover-renderer',
    issues,
  };
}

/** Bounds repeated semantic recovery when a renderer reports success but the
 * same logical Special still has no current canonical carrier. */
export class SettledSpecialRenderRecoveryOwner {
  private incidentKey: string | null = null;
  private attempts = 0;

  constructor(private readonly maxAttempts = 2) {}

  claim(gate: SettledSpecialRenderGate, rendererGeneration: number): SettledSpecialRecoveryClaim {
    if (gate.type === 'proceed') {
      this.reset();
      return { action: 'none', attempt: 0, maxAttempts: this.maxAttempts, incidentKey: null };
    }

    const nextIncidentKey = JSON.stringify([
      rendererGeneration,
      ...gate.issues.map((issue) => [
        issue.reason,
        issue.tile?._ccSpecialDiceVariant || issue.tile?.specialDiceVariant || issue.tile?.special || null,
        issue.tile?.gridX ?? null,
        issue.tile?.gridY ?? null,
        issue.expectedAssetPath || null,
        issue.actualAssetPath || null,
        issue.expectedRendererGeneration ?? null,
        issue.actualRendererGeneration ?? null,
      ]),
    ]);
    if (this.incidentKey !== nextIncidentKey) {
      this.incidentKey = nextIncidentKey;
      this.attempts = 0;
    }
    if (this.attempts >= this.maxAttempts) {
      return {
        action: 'fallback',
        attempt: this.attempts,
        maxAttempts: this.maxAttempts,
        incidentKey: this.incidentKey,
      };
    }

    this.attempts += 1;
    return {
      action: 'recover',
      attempt: this.attempts,
      maxAttempts: this.maxAttempts,
      incidentKey: this.incidentKey,
    };
  }

  reset(): void {
    this.incidentKey = null;
    this.attempts = 0;
  }
}
