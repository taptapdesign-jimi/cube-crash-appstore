import fs from 'node:fs';
import path from 'node:path';

describe('Journey return final-FX gate', () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/endgame-flow.ts'), 'utf8');

  test('waits for active final gameplay FX before Journey exit preparation can begin', () => {
    const handler = source.slice(source.indexOf('async function handleJourneyCleanBoardExit'));
    const waitIndex = handler.indexOf('await waitForJourneyReturnFinalFxIdle()');
    const exitIndex = handler.indexOf('await requestExitToMenu({');

    expect(source).toContain('tnt.isTntAnimationActive?.() === true');
    expect(source).toContain('bubbles.isWildJuiceFinaleAnimationActive?.() === true');
    expect(source).toContain('splash.isMagneticTextActive?.() === true');
    expect(source).toContain('splash.isSparkleTextActive?.() === true');
    expect(waitIndex).toBeGreaterThanOrEqual(0);
    expect(exitIndex).toBeGreaterThan(waitIndex);
    expect(source.match(/requestAnimationFrame\(\(\) => resolve\(\)\)/g)).toHaveLength(2);
  });
});
