import fs from 'node:fs';
import {
  guardSettledSpecialRenderHealth,
  SettledSpecialRenderRecoveryOwner,
} from '../special-dice-render-health';

function makeKanta(baseOverrides: Record<string, unknown> = {}) {
  const host = {};
  const base = {
    destroyed: false,
    parent: host,
    visible: true,
    renderable: true,
    alpha: 1,
    texture: { healthy: true },
    _ccTextureAssetPath: './assets/shop/kanta/04.png',
    _ccVisualAssetRendererGeneration: 4,
    ...baseOverrides,
  };
  return {
    special: 'wild',
    _ccSpecialDiceVariant: 'kanta',
    destroyed: false,
    visible: true,
    renderable: true,
    alpha: 1,
    parent: {},
    base,
  };
}

const inspect = (tile: any, currentRendererGeneration = 4) => guardSettledSpecialRenderHealth({
  decision: { type: 'continue', reason: 'wild_continuation_available' },
  moveEnablingSpecials: [tile],
  currentRendererGeneration,
  getExpectedAssetPath: () => './assets/shop/kanta/04.png',
  isTextureUsable: (texture) => texture?.healthy === true,
});

test('one logical active Kanta with no painted base requests recovery instead of silent continue', () => {
  const kanta = makeKanta();
  kanta.base = null as any;

  const gate = inspect(kanta);

  expect(kanta.special).toBe('wild');
  expect(kanta.destroyed).toBe(false);
  expect(gate).toMatchObject({
    type: 'wait',
    reason: 'special-render-recovery-required',
    action: 'recover-renderer',
    issues: [{ tile: kanta, reason: 'missing-base-face' }],
  });
});

test('a Kanta base from an older VisualAssetBroker generation requests recovery', () => {
  const kanta = makeKanta({ _ccVisualAssetRendererGeneration: 3 });

  expect(inspect(kanta, 4)).toMatchObject({
    type: 'wait',
    action: 'recover-renderer',
    issues: [{
      reason: 'stale-renderer-generation',
      expectedRendererGeneration: 4,
      actualRendererGeneration: 3,
    }],
  });
});

test('direct artwork may hide base rendering while retaining a healthy canonical carrier', () => {
  const kanta = makeKanta({ renderable: false });

  expect(inspect(kanta)).toEqual({ type: 'proceed', issues: [] });
});

test('an unhealthy logical Special also blocks a false Fail decision', () => {
  const kanta = makeKanta({ visible: false });
  const gate = guardSettledSpecialRenderHealth({
    decision: { type: 'fail', reason: 'no_moves' },
    moveEnablingSpecials: [kanta],
    currentRendererGeneration: 4,
    isTextureUsable: () => true,
  });

  expect(gate).toMatchObject({
    type: 'wait',
    action: 'recover-renderer',
    issues: [{ reason: 'hidden-base-face' }],
  });
});

test('settled app-core endgame requests guarded recovery before any terminal or continue branch', () => {
  const source = fs.readFileSync('src/modules/app-core.ts', 'utf8');
  const settledEndgame = source.split('const checkLevelEndResult = checkEndGame(checkLevelEndContext, true);')[1]
    ?.split('const { appVisible, homeVisible, journeyVisible } = getScreenVisibility();')[0] ?? '';
  const parityIndex = settledEndgame.indexOf('guardSettledSpecialRenderHealth({');
  const recoveryIndex = settledEndgame.indexOf("'settled-special-render-parity'", parityIndex);
  const waitBranchIndex = settledEndgame.indexOf("if (levelEndDecision.type === 'wait')");
  const stuckBranchIndex = settledEndgame.indexOf("if (levelEndDecision.type !== 'continue')");

  expect(parityIndex).toBeGreaterThanOrEqual(0);
  expect(recoveryIndex).toBeGreaterThan(parityIndex);
  expect(waitBranchIndex).toBeGreaterThan(recoveryIndex);
  expect(stuckBranchIndex).toBeGreaterThan(waitBranchIndex);
  expect(settledEndgame).toContain("return;\n    }\n    if (levelEndDecision.type !== 'continue'");
});

test('Special repair paths use the broker owner and never bless a raw Pixi cache texture', () => {
  const source = fs.readFileSync('src/modules/app-core.ts', 'utf8');
  const repair = source.split('function repairBoardTileVisuals(')[1]
    ?.split('function collectBoardGameplayTiles(')[0] ?? '';
  const refresh = source.split('function refreshLiveCoreGameSpriteTextures(')[1]
    ?.split("try { (window as any).__ccEnsureCoreGameTexturesLoaded")[0] ?? '';

  const repairSpecialBranch = repair.split('if (isWildLike) {')[1]
    ?.split('if (base && !base.destroyed) {')[1] ?? '';
  const refreshSpecialBranch = refresh.split('if (isSpecialTile) {')[1]
    ?.split('const assetPath = getTileBaseTextureAssetPath(tile);')[0] ?? '';

  expect(repairSpecialBranch).toContain('applyWildSkinLocal(t);');
  expect(repairSpecialBranch).not.toContain('_ccVisualAssetRendererGeneration');
  expect(refreshSpecialBranch).toContain('specialRebinds.push(applyWildSkinLocal(tile));');
  expect(refresh).toContain('await Promise.all(specialRebinds);');
  expect(refreshSpecialBranch).not.toContain('_ccVisualAssetRendererGeneration');
  expect(refreshSpecialBranch).not.toContain('Assets.get(assetPath)');
});

test('the same unresolved Special incident has a bounded recovery budget', () => {
  const owner = new SettledSpecialRenderRecoveryOwner(2);
  const gate = inspect(makeKanta({ visible: false }));

  expect(owner.claim(gate, 4)).toMatchObject({ action: 'recover', attempt: 1 });
  expect(owner.claim(gate, 4)).toMatchObject({ action: 'recover', attempt: 2 });
  expect(owner.claim(gate, 4)).toMatchObject({ action: 'fallback', attempt: 2 });
  expect(owner.claim({ type: 'proceed', issues: [] }, 4)).toMatchObject({ action: 'none' });
  expect(owner.claim(gate, 4)).toMatchObject({ action: 'recover', attempt: 1 });
});
