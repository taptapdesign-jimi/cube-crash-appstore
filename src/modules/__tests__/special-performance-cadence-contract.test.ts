import fs from 'node:fs';
import path from 'node:path';

const appCore = fs.readFileSync(path.resolve('src/modules/app-core.ts'), 'utf8');
const appSpawn = fs.readFileSync(path.resolve('src/modules/app-spawn.ts'), 'utf8');
const fx = fs.readFileSync(path.resolve('src/modules/fx.ts'), 'utf8');

describe('special performance cadence ownership', () => {
  test('keeps ordinary and special merge-6 FX active until their owned boundary', () => {
    const merge6Start = appCore.indexOf('if (effSum === 6){');
    const beginLease = appCore.indexOf('beginMerge6ResolutionFrames();', merge6Start);
    const smokeAndShards = appCore.indexOf('regularMerge6ShardsTemplated(', merge6Start);

    expect(merge6Start).toBeGreaterThan(-1);
    expect(beginLease).toBeGreaterThan(merge6Start);
    expect(beginLease).toBeLessThan(smokeAndShards);
    expect(appCore).toContain("acquirePixiMobileActivityLease(\n    'merge6-resolution',\n    100,");
    expect(appCore).toContain('endMerge6ResolutionFrames();\n  if (options.releaseSpecialTransaction !== false)');
    expect(appCore).toContain('if (released) {\n    endMerge6ResolutionFrames();');
    expect(appCore).toContain("activityLeaseLabel: 'regular-merge6-shards'");
    expect(appCore).toContain("activityLeaseLabel: 'regular-merge6-smoke'");
    expect(fx).toContain('attachFxContainerActivity(layer, opts.activityLeaseLabel);');
    expect(fx).toContain('activityLeaseLabel: options.activityLeaseLabel');
    expect(fx).toContain("opts.activityLeaseLabel ?? 'special-merge6-shards'");
    expect(fx).toContain('releaseFxContainerActivity(layer);');
  });

  test('owns the complete Honey or Magnet pull including its pre-motion delay', () => {
    const nearestTiles = appCore.indexOf('if (nearestTiles.length > 0) {');
    const pullLease = appCore.indexOf("? 'honey-pull' : 'magnet-pull'", nearestTiles);
    const pullDelay = appCore.indexOf('const initialDelay = 0.300;', nearestTiles);
    const cleanup = appCore.indexOf('cleanupAllPullAnimations =', nearestTiles);
    const release = appCore.indexOf('releasePullFrames();', cleanup);

    expect(pullLease).toBeGreaterThan(nearestTiles);
    expect(pullLease).toBeLessThan(pullDelay);
    expect(release).toBeGreaterThan(cleanup);
    expect(appCore).toContain('(window as any).__ccActiveMagnetPullCleanup?.();');
  });

  test('gives every replacement bounce one lifecycle-safe activity lease', () => {
    expect(appCore).toContain("acquirePixiMobileActivityLease('spawn-bounce', 100)");
    expect(appCore).toContain('spawnBounce: playSpawnBounceWithFrames');
    expect(appCore).not.toMatch(/spawnBounce: \(t, done, o\) => SPAWN\.spawnBounce/);

    expect(appSpawn).toContain("acquirePixiMobileActivityLease('spawn-bounce', 100)");
    expect(appSpawn).toContain('animationManager.trackExternalTimeline(gsap.timeline({');
    expect(appSpawn).toContain('onInterrupt: () => {');
    expect(appSpawn).toContain('releaseFrames();');
    expect(appSpawn.match(/const tl = animationManager\.trackExternalTimeline/g)).toHaveLength(1);
  });

  test('starts one canonical Laser replacement bounce only after beam-tip arrival', () => {
    const arrivalWait = appCore.indexOf('waitForActiveLaserGunFinaleImpactArrival(i)');
    const arrivedBranch = appCore.indexOf("if (arrivalResult === 'arrived') {", arrivalWait);
    const contactCommit = appCore.indexOf('doBreak(true)', arrivedBranch);
    const laserBounce = appCore.indexOf('commitLaserGunTileImpact({');

    expect(arrivalWait).toBeGreaterThan(-1);
    expect(arrivedBranch).toBeGreaterThan(arrivalWait);
    expect(contactCommit).toBeGreaterThan(arrivedBranch);
    expect(laserBounce).toBeGreaterThan(-1);
    expect(appCore).toContain('makeBoard.setValueImmediate(target, value, depth);');
    expect(appCore).not.toContain('swapLaserValueInPlace');
    expect(appCore).not.toContain("acquirePixiMobileActivityLease(\n\t            'laser-gun-cube-impact'");
  });
});
