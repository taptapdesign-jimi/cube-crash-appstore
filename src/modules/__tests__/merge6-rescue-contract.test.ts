import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');

describe('merge-six stuck-path rescue contract', () => {
  const rescueStart = source.indexOf('// Hard recovery: if a plain merge-6 is lingering');
  const rescueEnd = source.indexOf('const sinceMutation =', rescueStart);
  const rescue = source.slice(rescueStart, rescueEnd);

  test('only repairs a non-special, unlocked, non-final regular six while other active tiles exist', () => {
    expect(rescueStart).toBeGreaterThan(-1);
    expect(rescue).toContain('(t.value | 0) !== 6');
    expect(rescue).toContain('if (t.special) return false');
    expect(rescue).toContain('if (t.locked) return false');
    expect(rescue).toContain("if ((t as any)?._isLastMerge === true) return false");
    expect(rescue).toContain("if ((t as any)?._wildMagnetPulledTilesMerge === true) return false");
    expect(rescue).toContain("if ((t as any)?._willPullTiles === true) return false");
    expect(rescue).toContain("if ((t as any)?._hasTilesToPull === true) return false");
    expect(rescue).toContain('if (activeExcludingMerge6.length > 0)');
  });

  test('captures the cell, removes the tile coherently, requires one replacement and reevaluates', () => {
    const capture = rescue.indexOf('const rescueGX = lingeringRegularMerge6.gridX | 0');
    const gridClear = rescue.indexOf('clearTileFromGridSafe(lingeringRegularMerge6)');
    const inputDisable = rescue.indexOf("lingeringRegularMerge6.eventMode = 'none'");
    const remove = rescue.indexOf('removeTile(lingeringRegularMerge6)');
    const pending = rescue.indexOf('pendingMandatoryMergeCellSpawn = {');
    const spawn = rescue.indexOf('await ensureRepairSpawnAtCell(rescueGX, rescueGY');
    const clearPending = rescue.indexOf('pendingMandatoryMergeCellSpawn = null', spawn);
    const recheck = rescue.indexOf('checkLevelEnd()', clearPending);

    expect(capture).toBeGreaterThan(-1);
    expect(gridClear).toBeGreaterThan(capture);
    expect(inputDisable).toBeGreaterThan(gridClear);
    expect(remove).toBeGreaterThan(inputDisable);
    expect(pending).toBeGreaterThan(remove);
    expect(spawn).toBeGreaterThan(pending);
    expect(clearPending).toBeGreaterThan(spawn);
    expect(recheck).toBeGreaterThan(clearPending);
    expect(rescue).toContain("reason: 'lingering-merge6-rescue'");
  });
});
