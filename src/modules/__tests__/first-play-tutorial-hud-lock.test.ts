import { shouldLockFirstPlayTutorialHud } from '../first-play-tutorial-hud-lock';

describe('first-play tutorial HUD lock', () => {
  it('locks HUD navigation while the interactive tutorial is active', () => {
    expect(shouldLockFirstPlayTutorialHud({
      tutorialActive: true,
      completionAssistActive: false,
    })).toBe(true);
  });

  it('unlocks HUD navigation while only the post-tutorial completion assist remains', () => {
    expect(shouldLockFirstPlayTutorialHud({
      tutorialActive: false,
      completionAssistActive: true,
    })).toBe(false);
  });
});
