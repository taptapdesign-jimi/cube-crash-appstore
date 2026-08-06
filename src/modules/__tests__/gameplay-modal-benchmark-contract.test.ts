import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('shared gameplay modal benchmark', () => {
  const benchmark = read('src/modules/gameplay-modal-benchmark.ts');
  const score = read('src/modules/score-bottom-sheet.ts');
  const reward = read('src/modules/collectible-reward-bottom-sheet.ts');
  const rewardUi = read('src/modules/collectible-reward-ui.ts');
  const rewardAnimations = read('src/modules/collectible-reward-animations.ts');
  const css = read('src/style.css');

  test('owns one timing profile for enter, exit, cleanup, and CTA reveal', () => {
    expect(benchmark).toContain('enterDurationMs: 650');
    expect(benchmark).toContain('exitDurationMs: 650');
    expect(benchmark).toContain('enterCleanupBufferMs: 34');
    expect(benchmark).toContain('ctaEnterProgress: 0.2');
    expect(benchmark).toContain('companionCtaStaggerMs: 70');
  });

  test('migrates score and collectible reward to the same structural motion owners', () => {
    for (const source of [score, rewardUi]) {
      expect(source).toContain('cc-gameplay-modal-bounce-shell');
      expect(source).toContain('cc-gameplay-modal-flip-shell');
      expect(source).toContain('cc-gameplay-modal-idle-shell');
      expect(source).toContain('cc-gameplay-modal-paper-shell');
    }

    expect(score).toContain('cc-gameplay-modal-stage');
    expect(score).not.toContain('animateBottomSheetEntrance');
    expect(score).not.toContain('function addDragFunctionality');
    expect(rewardUi).toContain('cc-gameplay-modal-stage');
    expect(reward).not.toContain('attachDragHandlers');
    expect(rewardAnimations).toContain('GAMEPLAY_MODAL_BENCHMARK.enterDurationMs');
    expect(rewardAnimations).toContain('GAMEPLAY_MODAL_BENCHMARK.exitDurationMs');
  });

  test('uses the accepted centered tilt, bounce, paper, and shadow presentation', () => {
    expect(css).toContain('.simple-bottom-sheet.cc-gameplay-modal-stage {');
    expect(css).toContain('animation: cc-gameplay-modal-flip-in 0.65s cubic-bezier(0.16, 1, 0.3, 1) both;');
    expect(css).toContain('animation: end-run-centered-modal-bounce-in 0.65s cubic-bezier(0.22, 1.18, 0.36, 1) both;');
    expect(css).toContain('animation: end-run-centered-modal-flip-out 0.65s cubic-bezier(0.68, -0.6, 0.32, 1.6) both;');
    expect(css).toContain('0 13px 33.6px 0 rgba(185, 145, 119, 0.8)');
    expect(css).toContain('background: var(--bottom-sheet-paper-texture)');
    expect(css).toContain('animation: cc-gameplay-modal-idle-float 6.8s linear infinite both;');
    expect(css).toContain('@keyframes cc-gameplay-modal-idle-float');
    expect(css).toContain('translate3d(0, -4px, 8px) scale(1.015)');
    expect(css).toContain('translate3d(0, 1px, 0) scale(0.995)');
    expect(css).toContain('animation: cc-gameplay-modal-idle-shadow 6.8s ease-in-out infinite both;');
    expect(css).not.toContain('@keyframes cc-gameplay-modal-idle-tilt');
  });

  test('starts idle only after enter and keeps it on a transform-isolated owner', () => {
    expect(score).toContain("el.classList.add('cc-gameplay-modal-idle')");
    expect(rewardAnimations).toContain("stage?.classList.add('cc-gameplay-modal-idle')");
    expect(rewardAnimations.indexOf("classList.remove('cc-gameplay-modal-entering')"))
      .toBeLessThan(rewardAnimations.indexOf("classList.add('cc-gameplay-modal-idle')"));
    expect(css).toContain('.cc-gameplay-modal-idle:has(.cc-cta[data-cta-state="pressed"])');
  });

  test('reveals reward CTAs at the benchmark progress instead of after modal entry', () => {
    expect(reward).toContain('const ctaStartMs = getGameplayModalCtaEnterDelayMs()');
    expect(reward).toContain('GAMEPLAY_MODAL_BENCHMARK.companionCtaStaggerMs');
    expect(reward).not.toContain('showSheetAnimation(sheet).then(() => {\n        rewardCtaControllers');
  });
});
