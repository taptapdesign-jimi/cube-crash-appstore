import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string): string => fs.readFileSync(
  path.resolve(process.cwd(), relativePath),
  'utf8',
);

describe('Journey reward screen thermal ownership', () => {
  test('New Reward settles every passive presentation owner and masks with 1x artwork', () => {
    const screen = read('src/modules/journey-new-card-screen.ts');
    const flow = read('src/modules/journey-completion-flow.ts');

    expect(screen).toContain('cardMaskImagePath?: string;');
    expect(screen).toContain('const safeCardMaskPath = cardMaskImagePath');
    expect(screen).toContain('setLightMask(unlockedLight, safeCardMaskPath);');
    expect(screen).toContain('setLightMask(unlockedLegendaryHolo, safeCardMaskPath);');
    expect(flow).toContain('cardMaskImagePath: rewardAsset.path1x');
    expect(screen).toContain('JOURNEY_NEW_CARD_INTERIM_IDLE_DURATION_MS = 3000');
    expect(screen).toContain('const startInterimIdleMotion = () => {');
    expect(screen).toContain('Promise.allSettled([motionAnimation.finished, tiltAnimation.finished])');
    expect(screen).toContain('playInterimIdleShineOnce();');
    expect(screen).toContain('playInterimIdleShineOnce = () => {');
    expect(screen).toContain('startInterimIdleMotion();');
    expect(screen).toContain('JOURNEY_CARD_MOBILE_IDLE_CALM_MS');
    expect(screen).not.toContain('iterations: Infinity');
    expect(screen).not.toContain('repeat: -1');
    expect(screen).not.toContain('window.setInterval(');
    expect(screen).toContain('JOURNEY_NEW_CARD_CONTINUE_COACH_REPEAT_CADENCE_MS = 3000');
    expect(screen).toContain('JOURNEY_NEW_CARD_UNLOCKED_IDLE_REPEAT_DELAY_MS = 3000');
    expect(screen).toContain('scheduleUnlockedIdleMotion(JOURNEY_NEW_CARD_UNLOCKED_IDLE_REPEAT_DELAY_MS);');
    expect(screen).toContain('const activeTimelines = new Set<gsap.core.Timeline>();');
    expect(screen).toContain("timeline.eventCallback('onComplete', () => {");
    expect(screen).toContain("timeline.eventCallback('onInterrupt', () => {");
    expect(screen).toContain('const retire = () => activeTimelines.delete(timeline);');
    expect(screen).toContain('activeTimelines.clear();');
    expect(screen).toContain('let newCardScreenPresentationGeneration = 0;');
    expect(screen).toContain('let promiseSettled = false;');
    expect(screen).toContain("resolve({ action: 'cancelled' });");
    expect(screen).toContain('if (promiseSettled) return;');
    expect(screen).toContain('const presentationGeneration = newCardScreenPresentationGeneration;');
    expect(screen).toContain('presentationGeneration !== newCardScreenPresentationGeneration');
    expect(screen).toContain("return { action: 'cancelled' };");
    expect(flow).toContain("if (newCardResult.action === 'cancelled')");
    expect(screen).toContain("document.addEventListener('visibilitychange', onVisibilityChange);");
    expect(screen).toContain("document.removeEventListener('visibilitychange', onVisibilityChange)");
    expect(screen).toContain('if (document.hidden) {');
    expect(screen).toContain('clearInterimIdleShineWork();');
    expect(screen).toContain('const interimIdleShineTimelines = new Set<gsap.core.Timeline>();');
    expect(screen).toContain('shouldRun: () => !document.hidden && !revealed');
    expect(flow).toContain('return { isFromInterimBoard, cleanupNewCardHandoffCover, cancelled: true };');
    expect(screen).toContain('stopContinueCoach();');
    expect(screen).toContain('stopInterimIdleMotion();');
    expect(screen).toContain('stopUnlockedIdleMotion();');
  });

  test('Special Dice unlock has one-shot hero, mask shine, shadow, and CTA motion', () => {
    const screen = read('src/modules/journey-special-dice-screen.ts');

    expect(screen).toContain('animation: ccJourneySpecialDiceIdle 3s ease-in-out 1 both;');
    expect(screen).toContain('animation: ccJourneySpecialDiceShimmer 1.7s linear 1 both;');
    expect(screen).toContain('animation-iteration-count: 1;');
    expect(screen).toContain('const playShineOnce = () => {');
    expect(screen).toContain("light.classList.remove('is-shine-active')");
    expect(screen).not.toContain('animation: ccJourneySpecialDiceShimmer 1.7s linear infinite;');
    expect(screen).not.toContain('repeat: -1');
    expect(screen).not.toContain('window.setInterval(');
  });

  test('collection card idle, Legendary mask, coach, and NEW ribbon are bounded', () => {
    const modal = read('src/modules/journey-card-overlay-modal.ts');
    const css = read('src/collectibles-screen.css');
    const coachCompletion = modal.slice(
      modal.indexOf('const coachAnimations = [cardAnimation, handAnimation];'),
      modal.indexOf('const cancelMotion = () => {'),
    );

    expect(modal).toContain('const legendaryShineMaskPath = options.cardImagePath1x ?? options.cardImagePath2x');
    expect(modal).toContain('setJourneyInterimShineMask(legendaryShine, legendaryShineMaskPath);');
    expect(modal).not.toContain('iterations: Infinity');
    expect(coachCompletion).not.toContain('scheduleIdleCoach();');
    expect(css).toContain('animation: cc-gameplay-modal-idle-float 6.8s linear 1 both;');
    expect(css).toContain('animation: journey-card-ribbon-shimmer 3s ease-in-out 1 both;');
  });

  test('the active Journey detail card settles its float and full-card shimmer', () => {
    const manager = read('src/modules/journey-boards-manager.ts');
    const css = read('src/collectibles-screen.css');

    expect(manager).toContain("detailMotionEl.style.animation = 'detailImageIdle 3s ease-in-out 1 both'");
    expect(css).toContain('animation: detailImageIdle 3s ease-in-out 1 both;');
    expect(css).toContain('animation: card-detail-shimmer 3s linear 1 both;');
    expect(css).not.toContain('animation: detailImageIdle 3s ease-in-out infinite;');
    expect(css).not.toContain('animation: card-detail-shimmer 3s linear infinite;');
  });
});
