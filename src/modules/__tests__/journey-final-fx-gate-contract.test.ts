import fs from 'node:fs';
import path from 'node:path';

describe('Journey return final-FX handoff', () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/endgame-flow.ts'), 'utf8');

  test('does not block the already-settled Clean Board return on stale final-FX activity', () => {
    const handler = source.slice(source.indexOf('async function handleJourneyCleanBoardExit'));
    const exitIndex = handler.indexOf('await requestExitToMenu({');

    expect(exitIndex).toBeGreaterThanOrEqual(0);
    expect(handler).not.toContain('waitForJourneyReturnFinalFxIdle');
    expect(source).not.toContain('maxWaitMs = 6500');
  });
});
