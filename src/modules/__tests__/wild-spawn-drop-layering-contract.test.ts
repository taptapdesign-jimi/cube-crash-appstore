import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve('src/modules/wild-spawn-drop.ts'), 'utf8');
const foregroundSource = fs.readFileSync(path.resolve('src/modules/wild-spawn-carrier-foreground.ts'), 'utf8');
const styleSource = fs.readFileSync(path.resolve('src/style.css'), 'utf8');

describe('wild spawn drop layering contract', () => {
  test('keeps the crate/backpack and emitted special die above the gameplay HUD for the full animation', () => {
    expect(source).toContain('const WILD_SPAWN_CONTAINER_Z_INDEX = 2_100_000');
    expect(source).toContain('const WILD_SPAWN_TILE_Z_INDEX = WILD_SPAWN_CONTAINER_Z_INDEX + 1');
    expect(source).toContain('forceSpawnVisualAboveHud(stage, backpack, baseZ)');
    expect(source).toContain('onUpdate: () => forceSpawnVisualAboveHud(stage, backpack, baseZ)');
    expect(source).toContain('carrierForeground = createCarrierForeground(backpack, playbackSources)');
    expect(source).toContain('carrierForeground?.setFrame(source)');
    expect(source).toContain('carrierForeground?.release()');
    expect(foregroundSource).toContain('getAnimatedSpecialArtworkCarrierForegroundRoot');
    expect(foregroundSource).toContain('getAnimatedSpecialArtworkSpawnedDieForegroundRoot');
    expect(foregroundSource).toContain('for (const source of new Set(playbackSources))');
    expect(source).toContain('createSpawnedDieForeground(tile.base, emittedSource)');
    expect(source).toContain('releaseSpawnedDieForeground()');
    expect(source).toContain('forceSpawnVisualAboveHud(stage, tile, WILD_SPAWN_TILE_Z_INDEX)');
    expect(source).toContain('WILD_SPAWN_CONTAINER_Z_INDEX,');
    expect(source).toContain("document.getElementById('app')?.classList.add(BACKPACK_BODY_CLASS)");
    expect(styleSource).toContain('#app.cc-wild-backpack-active canvas');
    expect(styleSource).toContain('z-index: 3 !important');
  });

  test('restores the emitted die to its original board layer after landing or interruption', () => {
    expect(source.match(/tile\.zIndex = originalZIndex/g)).toHaveLength(2);
    expect(source).toContain('cleanupBackpackSpawn()');
    expect(source.match(/document\.getElementById\('app'\)\?\.classList\.remove\(BACKPACK_BODY_CLASS\)/g)).toHaveLength(2);
  });
});
