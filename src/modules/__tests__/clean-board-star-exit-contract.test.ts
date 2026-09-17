import fs from 'fs';
import path from 'path';
import { gsap } from 'gsap';
import { freezeCleanBoardStarRenderedScale } from '../clean-board-star-transform';

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

  test('freezes the rendered breathing scale before GSAP takes over the exit', () => {
    const star = document.createElement('img');
    document.body.appendChild(star);
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    const computedStyle = jest.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const style = originalGetComputedStyle(element);
      Object.defineProperty(style, 'transform', {
        configurable: true,
        value: 'matrix(1.137, 0, 0, 1.137, 0, 0)',
      });
      return style;
    });

    expect(freezeCleanBoardStarRenderedScale(star)).toBeCloseTo(1.137, 3);
    expect(star.style.animation).toBe('none');
    expect(Number(gsap.getProperty(star, 'scale'))).toBeCloseTo(1.137, 3);

    computedStyle.mockRestore();
    star.remove();
  });

  test('uses the rendered-pose handoff instead of directly resetting CSS animation', () => {
    expect(source).toContain('freezeCleanBoardStarRenderedScale(filledImg);');
    expect(source).not.toContain("filledImg.style.animation = 'none';\n          const timeline = trackTimeline({");
  });
});
