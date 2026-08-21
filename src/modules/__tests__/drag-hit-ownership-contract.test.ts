import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('gameplay drag hit ownership', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/modules/drag-core.ts'), 'utf8');

  test('gives every regular tile a stable parent hit area and disables child interception', () => {
    const bindStart = source.indexOf('function bindToTile(t)');
    const bindEnd = source.indexOf('\n\n  function onDown', bindStart);
    const bind = source.slice(bindStart, bindEnd);

    expect(bind).toContain('t.hitArea = new Rectangle(-regularHalf, -regularHalf, tileSize, tileSize)');
    expect(bind).toContain('t.interactiveChildren = false');
    expect(bind).toContain("t.rotG.eventMode = 'none'");
    expect(bind).toContain('t.rotG.interactive = false');
    expect(bind).toContain('t.rotG.interactiveChildren = false');

    const regularHitArea = bind.indexOf('const regularHalf = tileSize / 2');
    const specialBranch = bind.indexOf('if (special)');
    expect(regularHitArea).toBeGreaterThanOrEqual(0);
    expect(specialBranch).toBeGreaterThan(regularHitArea);
    expect(bind.slice(specialBranch)).toContain('t.interactiveChildren = true');
    expect(bind.slice(specialBranch)).toContain('t.rotG.eventMode = \'static\'');
  });
});
