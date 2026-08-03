import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

describe('Arcade terminal lifecycle regression contract', () => {
  test('Magnet commit abort rolls back ownership and schedules the central endgame check', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core.ts'), 'utf8');
    expect(source).toContain('const magnetMergeCommitted = await handleWildMagnetMergedPulledTiles');
    expect(source).toContain('if (!magnetMergeCommitted)');
    expect(source).toContain("setWildMagnetPullInProgress(false, 'commit-validation-abort')");
    expect(source).toContain("scheduleCheckLevelEnd(0.18, 'wild-magnet-commit-validation-abort')");
    const commitCheck = source.indexOf('if (!magnetMergeCommitted)');
    const committedProgress = source.indexOf('if (shouldAddWildProgress)', commitCheck);
    expect(committedProgress).toBeGreaterThan(commitCheck);
    expect(source.slice(source.lastIndexOf('const magnetMergeCommitted', commitCheck), commitCheck)).not.toContain('addWildProgress(');
  });

  test('Arcade startLevel cannot write into Journey progression', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core.ts'), 'utf8');
    const start = source.indexOf('function startLevel(');
    const end = source.indexOf('function rebuildBoard(', start);
    const startLevelSource = source.slice(start, end);
    expect(startLevelSource).toContain('if (isArcadeHomeRunMode())');
    expect(startLevelSource).toContain('updateJourneyRunState({ n, score, devLog, devWarn });');
    expect(startLevelSource).toContain('if (!isArcadeHomeRunMode()) {\n    syncJourneyBoards');
  });

  test('terminal handoff force-cleans protected stars and summary skips a completed board exit', () => {
    const handoff = fs.readFileSync(path.join(repoRoot, 'src/modules/game-over-animation-handoff.ts'), 'utf8');
    const modal = fs.readFileSync(path.join(repoRoot, 'src/modules/clean-board-modal.ts'), 'utf8');
    expect(handoff).toContain('fxModule.forceCleanupAllStarAnimations?.()');
    expect(modal).toContain("arcadeRunReached && (window as any).__ccGameOverBoardExitComplete === true");
  });
});
