import fs from 'fs';
import path from 'path';

describe('Clean Board earned-Star exit ownership', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'src/modules/clean-board-modal.ts'),
    'utf8',
  );

  test('earned Stars exit in reverse order while their parent remains at identity', () => {
    expect(source).toContain('delay: Math.max(0, numEarned - 1 - index) * 0.07');
    expect(source).toContain('scale: 1.22');
    expect(source).toContain("ease: 'back.out(2.7)'");
    expect(source).toContain("ease: 'back.in(1.7)'");
    expect(source).toContain("hero.style.transition = 'none'");
    expect(source).not.toContain("hero.style.transform = 'scale(0)'");
  });

  test('one idempotent Star owner settles before ancestor card scale begins', () => {
    expect(source).toContain('if (starExitPromise) return starExitPromise');
    expect(source).toContain('const earnedStarsExitPromise = playEarnedStarsExit(numStars)');
    expect(source).toContain('void earnedStarsExitPromise.then(() => {');
    expect(source.match(/playEarnedStarsExit\(numStars\)/g)).toHaveLength(2);
    expect(source).not.toContain('try { stopAllStarAnimations({ exit: true, numStars }); } catch {}');
  });

  test('late Star enter callbacks are tracked and guarded during exit', () => {
    expect(source).toContain("el.getAttribute('data-clean-board-exiting') === 'true'");
    expect(source).toContain('abortStarAnimations = cancelStarExit');
    expect(source).toContain('animationManager.killExternalTimeline(timeline)');
  });
});
