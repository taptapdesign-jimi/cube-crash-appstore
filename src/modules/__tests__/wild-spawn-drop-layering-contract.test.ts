import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve('src/modules/wild-spawn-drop.ts'), 'utf8');
const appCoreSource = fs.readFileSync(path.resolve('src/modules/app-core.ts'), 'utf8');
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

  test('keeps a landed Special die noninteractive until its selected finale assets are ready', () => {
    expect(source).toContain("if (enabled && tile._ccSpecialFinaleWarmupPending === true) return;");
    const pending = appCoreSource.indexOf('(spawnedTile as any)._ccSpecialFinaleWarmupPending = true;');
    const drop = appCoreSource.indexOf('await animateWildSpawnDropFromMeter({', pending);
    const readiness = appCoreSource.indexOf('await specialFinaleWarmup;', drop);
    const release = appCoreSource.indexOf("delete (spawnedTile as any)._ccSpecialFinaleWarmupPending;", readiness);
    const enable = appCoreSource.indexOf("spawnedTile.eventMode = 'static';", release);

    expect(pending).toBeGreaterThan(-1);
    expect(drop).toBeGreaterThan(pending);
    expect(readiness).toBeGreaterThan(drop);
    expect(release).toBeGreaterThan(readiness);
    expect(enable).toBeGreaterThan(release);
  });

  test('owns active Pixi cadence for the exact Wild drop lifecycle', () => {
    expect(source).toContain(
      "acquirePixiMobileActivityLease('wild-spawn-drop', 100)",
    );
    expect(source).toContain('activeDropCleanups.add(releaseDropFrames)');
    expect(source).toContain('releaseDropFrames();\n      resolve();');
  });
});
