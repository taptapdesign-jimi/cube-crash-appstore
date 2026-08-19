import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/modules/app-core.ts'),
  'utf8',
);

describe('NO MOVES terminal commit ownership', () => {
  test('serializes regular stack mutation before a meter wild may spawn', () => {
    expect(source).toContain("if (regularMergeHandoffTokens.size > 0) return 'regular-merge-handoff';");
    expect(source).toContain('regularMergeHandoffToken = beginRegularMergeHandoff();');
    expect(source).toContain('releaseRegularMergeHandoff(regularMergeHandoffToken, reason)');
    expect(source).toContain('registerRegularMergeHandoffFinalizer(regularMergeHandoffToken');
    expect(source).toContain("finalizeRegularMergeBoardCommit('source-absorb-interrupted')");
    expect(source).not.toContain("queueWildSpawnAfterGuardRelease('regular-merge-handoff-timeout')");
  });

  test('revalidates the live board before terminal lock and final commit', () => {
    const flowStart = source.indexOf('async function runNoMovesFailFlow');
    const flowEnd = source.indexOf('\n\nfunction createEmptyGrid', flowStart);
    const flow = source.slice(flowStart, flowEnd);
    expect(flow.match(/getNoMovesCommitBlockReason\(initialSignature\)/g)).toHaveLength(3);
    expect(source).toContain('resolveNoMovesCommitDecision({');
    expect(source).toContain("setInputGateLock('terminal-no-moves', false)");
    expect(source).toContain('__ccTerminalEndScreenPending = false');
    expect(source).toContain('scheduleCheckLevelEnd(0.2, `no_moves_cancelled:');
    expect(source).toContain('if (activeNoMovesFailFlowToken !== token)');
    expect(source).toContain('deferNoMovesFailBeforeOwnership(reason');
  });
});
