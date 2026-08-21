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

  test('keeps input open during confirmation and locks only at the atomic final commit', () => {
    const flowStart = source.indexOf('async function runNoMovesFailFlow');
    const flowEnd = source.indexOf('\n\nfunction createEmptyGrid', flowStart);
    const flow = source.slice(flowStart, flowEnd);
    expect(flow.match(/getNoMovesCommitBlockReason\(initialSignature\)/g)).toHaveLength(4);
    const confirmationWait = flow.indexOf('await waitTrackedResult(waitMs + Math.max(0, extraWaitMs))');
    const finalCommitRecheck = flow.indexOf('const finalCommitBlockReason = getNoMovesCommitBlockReason(initialSignature)');
    const terminalLock = flow.indexOf("setInputGateLock('terminal-no-moves', true");
    const postLockRecheck = flow.indexOf('const postLockBlockReason = getNoMovesCommitBlockReason(initialSignature)');
    const finalScreen = flow.indexOf('showFinalScreen({ confirmedFailFlow: true })');

    expect(confirmationWait).toBeGreaterThanOrEqual(0);
    expect(finalCommitRecheck).toBeGreaterThan(confirmationWait);
    expect(terminalLock).toBeGreaterThan(finalCommitRecheck);
    expect(postLockRecheck).toBeGreaterThan(terminalLock);
    expect(finalScreen).toBeGreaterThan(postLockRecheck);
    expect(flow.slice(0, confirmationWait)).not.toContain("setInputGateLock('terminal-no-moves', true");
    expect(source).toContain('resolveNoMovesCommitDecision({');
    expect(source).toContain("setInputGateLock('terminal-no-moves', false)");
    expect(source).toContain('__ccTerminalEndScreenPending = false');
    expect(source).toContain('scheduleCheckLevelEnd(0.2, `no_moves_cancelled:');
    expect(source).toContain('if (activeNoMovesFailFlowToken !== token)');
    expect(source).toContain('deferNoMovesFailBeforeOwnership(reason');
    expect(source).toContain("emitIOSSpecialTransactionTrace('no-moves-candidate'");
    expect(source).toContain("emitIOSSpecialTransactionTrace('no-moves-lock-acquired'");
    expect(source).toContain("emitIOSSpecialTransactionTrace('no-moves-cancelled'");
  });
});
