import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve('src/modules/wild-spawn-drop.ts'), 'utf8');

describe('wild spawn drop layering contract', () => {
  test('keeps the crate/backpack and emitted special die above the gameplay HUD for the full animation', () => {
    expect(source).toContain('const WILD_SPAWN_CONTAINER_Z_INDEX = 2_100_000');
    expect(source).toContain('const WILD_SPAWN_TILE_Z_INDEX = WILD_SPAWN_CONTAINER_Z_INDEX + 1');
    expect(source).toContain('forceSpawnVisualAboveHud(stage, backpack, baseZ)');
    expect(source).toContain('onUpdate: () => forceSpawnVisualAboveHud(stage, backpack, baseZ)');
    expect(source).toContain('forceSpawnVisualAboveHud(stage, tile, WILD_SPAWN_TILE_Z_INDEX)');
    expect(source).toContain('WILD_SPAWN_CONTAINER_Z_INDEX,');
  });

  test('restores the emitted die to its original board layer after landing or interruption', () => {
    expect(source.match(/tile\.zIndex = originalZIndex/g)).toHaveLength(2);
    expect(source).toContain('cleanupBackpackSpawn()');
  });
});
