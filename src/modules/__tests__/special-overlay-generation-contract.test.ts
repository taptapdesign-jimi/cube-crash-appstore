import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/modules/splash-text-overlay.ts'),
  'utf8',
);

describe('special overlay generation ownership', () => {
  test('stale S.O.S. callbacks cannot exit or clean a newer Bottle run', () => {
    expect(source).toContain('let magneticRunId = 0;');
    expect(source).toContain('runId = ++magneticRunId;');
    expect(source).toContain("if (typeof expectedRunId === 'number' && expectedRunId !== magneticRunId) return;");
    expect(source).toContain('if (runId !== magneticRunId) return;');
    expect(source).toContain('cleanupBuzzzOverlay(runId)');
    expect(source).toContain('(particleCleanup as any)?.startExit?.()');
    expect(source).not.toContain('(swoopFxCleanup as any)?.startExit?.()');
  });
});
