import * as fs from 'node:fs';
import * as path from 'node:path';

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('mobile Special idle registry integration', () => {
  test('suspends at the canonical drag lifecycle and releases through shared cleanup', () => {
    const source = read('src/modules/drag-core.ts');
    expect(source).toContain("acquireSpecialDiceIdleSuspension('drag')");
    const cleanup = source.slice(
      source.indexOf('function clearDragRuntime'),
      source.indexOf('function resetTileDragShadowPose'),
    );
    expect(cleanup).toContain('releaseSpecialDiceIdleSuspension?.()');
  });

  test('suspends regular and Merge-6 handoffs and retires every reset token', () => {
    const source = read('src/modules/app-core.ts');
    expect(source).toContain("acquireSpecialDiceIdleSuspension('merge6-resolution')");
    expect(source).toContain("acquireSpecialDiceIdleSuspension('regular-merge-handoff')");
    expect(source).toContain('regularMergeIdleSuspensionReleases.forEach');
    expect(source).toContain('releaseMerge6IdleSuspension = null');
  });

  test('registers every settled live Special without recency winners or exemptions', () => {
    const source = read('src/modules/special-dice-idle.ts');
    expect(source).toContain('tile._ccWildSpawnDropping === true');
    expect(source).toContain('new SpecialDiceIdleRegistry<any>');
    expect(source).toContain('specialDiceIdleRegistry.register(tile');
    expect(source).not.toContain('Number.POSITIVE_INFINITY');
    expect(source).not.toContain('hasContinuousSpecialDiceIdle');
    expect(source).not.toContain('maxActive');
  });

  test('shares one settled cadence lease at registry level instead of per tile', () => {
    const source = read('src/modules/special-dice-idle.ts');
    expect(source).toContain("acquireSettledCadence: () => acquirePixiSettledMotionLease('special-dice-idle-registry')");
    expect(source).not.toContain('_ccSpecialIdleFrameLease');
  });
});
