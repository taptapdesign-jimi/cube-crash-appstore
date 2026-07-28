export type FirstPlayTutorialHudLockState = {
  tutorialActive: boolean;
  completionAssistActive: boolean;
};

/**
 * The post-tutorial completion assist may keep gameplay balancing active until
 * the tutorial board ends, but it must never keep HUD navigation disabled.
 */
export function shouldLockFirstPlayTutorialHud({
  tutorialActive,
}: FirstPlayTutorialHudLockState): boolean {
  return tutorialActive;
}
