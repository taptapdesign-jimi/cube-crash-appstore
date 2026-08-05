import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

describe('regular merge-6 to wild reward handoff', () => {
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
});
