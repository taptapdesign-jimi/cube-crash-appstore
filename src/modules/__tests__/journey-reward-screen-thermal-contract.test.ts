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
    expect(screen).toContain('animation: ccJourneyNewCardIdle 3s ease-in-out 1 both;');
    expect(screen).toContain('animation: ccJourneyNewCardAutoTilt 3s ease-in-out 1 both;');
    expect(screen).toContain('JOURNEY_CARD_MOBILE_IDLE_CALM_MS');
    expect(screen).not.toContain('iterations: Infinity');
    expect(screen).not.toContain('repeat: -1');
    expect(screen).not.toContain('window.setInterval(');
    expect(screen).not.toContain('scheduleContinueCoach(JOURNEY_NEW_CARD_CONTINUE_COACH_REPEAT_DELAY_MS)');
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
