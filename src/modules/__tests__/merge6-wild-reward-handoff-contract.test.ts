import fs from 'node:fs';
import path from 'node:path';
import { MAGNET_TRANSIENT_TILE_FLAGS, resetTileToNormalState } from '../tile-state-utils';
import { buildGridSnapshot } from '../app-core-save-tiles';
import { getCompatibleSpecialDiceVariant } from '../special-dice-registry';

const repoRoot = path.resolve(__dirname, '../../..');

describe('regular merge-6 to wild reward handoff', () => {
  test('Magnet-family spawn interruption aborts fallback ownership and fresh holders are real owners', () => {
    const appSpawn = fs.readFileSync(path.join(repoRoot, 'src/modules/app-spawn.ts'), 'utf8');
    const appMerge = fs.readFileSync(path.join(repoRoot, 'src/modules/app-merge.ts'), 'utf8');

    expect(appSpawn).toContain('export class AppSpawnCancelledError');
    expect(appSpawn).toContain('forceFreshPlaceholder = false');
    expect(appSpawn).toContain('removeTileFully(holder');
    expect(appSpawn).toContain('onInterrupt: () => interrupted?.()');
    expect(appMerge).toContain("import { AppSpawnCancelledError, openAtCell, spawnBounce } from './app-spawn.ts'");
    expect((appMerge.match(/instanceof AppSpawnCancelledError/g) || []).length).toBeGreaterThanOrEqual(4);
    expect(appMerge).toContain('magnetLifecycleCancelled = true;');
    expect(appMerge).toContain('const postGuardCheckSource = magnetLifecycleCancelled');
  });

  test('serializes reward entry behind destination ownership and never aborts deferred cleanup', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core.ts'), 'utf8');

    const guardStart = source.indexOf('function getWildSpawnAnimationBlockReason');
    const guardEnd = source.indexOf('function scheduleWildSpawnRetry', guardStart);
    const guard = source.slice(guardStart, guardEnd);
    expect(guard).toContain('merge6DestinationCleanupOwner.hasClaim(tile)');
    expect(guard).toContain("return 'regular-merge6-handoff'");

    const terminalStart = source.indexOf("deferFailForWildContinuation('merge_moves_depleted_stuck')");
    const spawnStart = source.indexOf('// Pass wild merge target info for smart spawning', terminalStart);
    const terminal = source.slice(terminalStart, spawnStart);
    expect(terminal).toContain('resolveMerge6MovesDepletedStuckAction');
    expect(terminal).toContain("terminalHandoffAction === 'continue-merge6'");
    expect(terminal).toContain('completing regular merge-6 cleanup/spawn first');
    expect(terminal).not.toContain("if (deferFailForWildContinuation('merge_moves_depleted_stuck')) return");
  });

  test('a converted Magnet survivor cannot route a later Juice merge into Magnet pull cleanup', () => {
    const appCore = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core.ts'), 'utf8');
    const appMerge = fs.readFileSync(path.join(repoRoot, 'src/modules/app-merge.ts'), 'utf8');

    const conversionStart = appMerge.indexOf('Respawn complete — converting magnet merge-6 cell');
    const conversionEnd = appMerge.indexOf('clearSpecialDiceIdentity(dst);', conversionStart);
    const conversion = appMerge.slice(conversionStart, conversionEnd);
    expect(conversion).toContain('resetTileToNormalState(dst);');
    expect(appMerge.indexOf('resetTileToNormalState(dst);', conversionStart)).toBeLessThan(
      conversionEnd,
    );

    const completionStart = appCore.indexOf('trackTween(src, {', appCore.indexOf('const tntFramesReadyForMerge'));
    const completionEnd = appCore.indexOf('async function checkMovesDepleted', completionStart);
    const completion = appCore.slice(completionStart, completionEnd);
    expect(completion).toContain('const willPullTilesFlag = isWildMagnet &&');
    expect(completion).toContain('const willPullMerge = isWildMagnet &&');
    expect(completion).toContain('const isMagnetPullMergeStored = isWildMagnet &&');
    expect(completion).toContain('const isMagnetPullMergeFlag = isWildMagnet &&');
    expect(completion).toContain('const willPullEarly = isWildMagnet &&');
    expect(completion).toContain('const willPulledTilesMerge = isWildMagnet &&');
    expect(completion).toContain('const hasTilesToPullFlag = isWildMagnet &&');
    expect(completion).toContain('if (isWildMagnet && (dst as any)?._wildMagnetPulledTilesMerge)');
    expect(completion).toContain('if (!isWildMagnet) {');
    expect(completion).toContain('if (isMagnetMergeWithoutPull && dst && !dst.destroyed)');
    expect(completion).toContain('} else if (!isMagnetPullMergeFinal && dst && !dst.destroyed)');
    expect(completion).not.toContain('!isMagnetPullMergeFinal && dst && !dst.destroyed && STATE.tiles.includes(dst)');
  });

  test.each([
    ['core star', 'wild'],
    ['cubero', 'wild'],
    ['core juice', 'wild-juice'],
    ['mushroom', 'wild-juice'],
    ['beach ball', 'wild-juice'],
    ['core TNT', 'wild-tnt'],
    ['flower', 'wild-tnt'],
    ['core magnet', 'wild-magnet'],
    ['bottle', 'wild-magnet'],
    ['honey', 'wild-magnet'],
  ])('removes Magnet transaction identity before a recycled survivor becomes %s', (_name, special) => {
    const tile: any = {
      special,
      isWild: true,
      isWildFace: true,
      _ccWildSpecial: true,
      _ccSpecialDiceVariant: _name.split(' ').join('-'),
      specialDiceVariant: _name.split(' ').join('-'),
      _ccSpecialDiceArchetype: special,
      _ccSpecialDiceResolving: true,
      num: { visible: false },
      pips: { visible: false },
      base: { tint: 0, alpha: 0.4 },
    };
    MAGNET_TRANSIENT_TILE_FLAGS.forEach((flag) => {
      tile[flag] = true;
    });

    resetTileToNormalState(tile);

    expect(tile.special).toBeNull();
    expect(tile.isWild).toBe(false);
    expect(tile.isWildFace).toBe(false);
    expect(tile._ccWildSpecial).toBeUndefined();
    expect(tile._ccSpecialDiceVariant).toBeUndefined();
    expect(tile.specialDiceVariant).toBeUndefined();
    expect(tile._ccSpecialDiceArchetype).toBeUndefined();
    expect(tile._ccSpecialDiceResolving).toBeUndefined();
    MAGNET_TRANSIENT_TILE_FLAGS.forEach((flag) => {
      expect(tile[flag]).toBeUndefined();
    });
  });

  test('normalizes recycled holders before every regular or special spawn owner applies a new identity', () => {
    const coreOpenCell = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core-open-cell.ts'), 'utf8');
    const appSpawn = fs.readFileSync(path.join(repoRoot, 'src/modules/app-spawn.ts'), 'utf8');

    expect(coreOpenCell).toContain('resetTileToNormalState(holder);');
    expect(appSpawn).toContain('resetTileToNormalState(holder);');
  });

  test('keeps the consumed destination variant available until its finale captures visual assets', () => {
    const appMerge = fs.readFileSync(path.join(repoRoot, 'src/modules/app-merge.ts'), 'utf8');
    const clearStart = appMerge.indexOf('export function clearWildState');
    const clearEnd = appMerge.indexOf('function pulseBoardZoom', clearStart);
    const clearOwner = appMerge.slice(clearStart, clearEnd);

    expect(clearOwner).toContain('tile.special = null;');
    expect(clearOwner).not.toContain('clearSpecialDiceIdentity(tile)');
    expect(clearOwner).not.toContain('releaseSpecialDiceResolution(tile)');
  });

  test('does not persist a stale variant identity from a regular tile', () => {
    const tile: any = {
      value: 3,
      special: null,
      isWild: false,
      isWildFace: false,
      _ccSpecialDiceVariant: 'bottle',
      specialDiceVariant: 'bottle',
      gridX: 0,
      gridY: 0,
      locked: false,
    };
    const { gridSnapshot } = buildGridSnapshot({
      ROWS: 1,
      COLS: 1,
      tiles: [tile],
      grid: [[tile]],
      devLog: () => {},
      devWarn: () => {},
    });

    expect(gridSnapshot[0][0].special).toBeNull();
    expect(gridSnapshot[0][0].specialDiceVariant).toBeNull();
  });

  test.each([
    ['wild', 'bottle'],
    ['wild-juice', 'flower'],
    ['wild-magnet', 'mushroom'],
    ['wild-tnt', 'cubero'],
  ])('rejects mismatched %s + %s variant identity across save/load', (special, variantId) => {
    expect(getCompatibleSpecialDiceVariant(variantId, special)).toBeNull();

    const tile: any = {
      value: 6,
      special,
      isWild: true,
      isWildFace: true,
      _ccSpecialDiceVariant: variantId,
      specialDiceVariant: variantId,
      gridX: 0,
      gridY: 0,
      locked: false,
    };
    const { gridSnapshot } = buildGridSnapshot({
      ROWS: 1,
      COLS: 1,
      tiles: [tile],
      grid: [[tile]],
      devLog: () => {},
      devWarn: () => {},
    });
    expect(gridSnapshot[0][0].specialDiceVariant).toBeNull();
  });

  test.each([
    ['wild', 'cubero'],
    ['wild-juice', 'mushroom'],
    ['wild-magnet', 'bottle'],
    ['wild-tnt', 'flower'],
  ])('retains matching %s + %s variant identity', (special, variantId) => {
    expect(getCompatibleSpecialDiceVariant(variantId, special)?.id).toBe(variantId);
  });

  test('serializes all merge-6 archetypes before mutation and has no post-mutation bare spawn return', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core.ts'), 'utf8');
    const entryStart = source.indexOf('function merge(src: Tile');
    const mutationStart = source.indexOf('makeBoard.setValue(dst, 6, 0);', entryStart);
    const entry = source.slice(entryStart, mutationStart);
    expect(entry).toContain('merge6DestinationHandoffActive');
    expect(entry).toContain('(merge6SpawnInProgress || merge6DestinationHandoffActive)');

    const spawnGuardStart = source.indexOf('if (merge6SpawnInProgress) {', mutationStart);
    const spawnGuardEnd = source.indexOf('} else {', spawnGuardStart);
    const spawnGuard = source.slice(spawnGuardStart, spawnGuardEnd);
    expect(spawnGuard).toContain("removeTile(dst)");
    expect(spawnGuard).toContain("merge6-late-spawn-owner-conflict");
    expect(spawnGuard).not.toMatch(/if \(isWildMerge6\)[\s\S]*?return;/);
    expect(source).toContain('merge6SpawnOwnerToken = ++merge6SpawnOwnerSequence;');
    expect(source).toContain('activeMerge6SpawnOwnerToken === resetOwnerToken');
    expect(source).toContain('onInterrupt: () => {');
    expect(source).toContain("releaseSpecialDiceTransaction(specialTransactionToken, 'merge6-absorb-interrupted')");
  });
});
