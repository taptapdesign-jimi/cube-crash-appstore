import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.resolve(__dirname, '../first-play-tutorial.ts'),
  'utf8',
);

describe('first-play tutorial cold-start readiness', () => {
  test('keeps one lifecycle-owned readiness loop until the cold board exists', () => {
    const activation = source.slice(
      source.indexOf('export function activateFirstPlayTutorialWhenReady'),
      source.indexOf('export function completeFirstPlayTutorial'),
    );

    expect(activation).toContain('if (!isBrowser() || !active || activationPending) return;');
    expect(activation).toContain('if (!active) {');
    expect(activation).toContain('scheduleAnimationFrame(tick);');
    expect(activation).not.toContain('Date.now()');
    expect(activation).not.toContain('5000');
  });

  test('never paints a blocking overlay until at least two tutorial tiles are prepared', () => {
    const activation = source.slice(
      source.indexOf('export function activateFirstPlayTutorialWhenReady'),
      source.indexOf('export function completeFirstPlayTutorial'),
    );

    expect(activation).toContain('if (!prepareTutorialBoard())');
    expect(activation.indexOf('if (!prepareTutorialBoard())'))
      .toBeLessThan(activation.indexOf('renderOverlay();'));
    expect(source).toContain('if (tiles.length < 2) return false;');
  });
});
