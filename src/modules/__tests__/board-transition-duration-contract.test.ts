import fs from 'fs';
import path from 'path';
const read = (relativePath: string): string => fs.readFileSync(
  path.join(process.cwd(), relativePath),
  'utf8',
);

describe('Board Transition duration contract', () => {
  test('moves the shared NN number another six percent upward from its accepted lift', () => {
    const source = read('src/modules/board-transition-screen.ts');
    expect(source).toContain("numberContainer.style.transform = 'translate3d(0, -21vh, 0)'");
    expect(source.indexOf("numberContainer.style.transform = 'translate3d(0, -21vh, 0)'")).toBeLessThan(
      source.indexOf('const transitionText ='),
    );
  });

  test('removes about two seconds without changing the choreography order', () => {
    const source = read('src/modules/board-transition-screen.ts');
    expect(source).toContain('export const BOARD_TRANSITION_HOLD_DURATION_SECONDS = 0.4');
    expect(source).toContain('export const BOARD_TRANSITION_EXIT_PARALLAX_LEAD_SECONDS = 0.35');
    expect(source).toContain('export const BOARD_TRANSITION_HILL_EXIT_LAG_SECONDS = 0.2');
    expect(source).toContain('const BOARD_TRANSITION_REGULAR_SCENE_EXIT_SECONDS = 0.28');
    expect(source).toContain('export const BOARD_TRANSITION_CLOUD_EXIT_ANTICIPATION_SECONDS = 0.07');
    expect(source).toContain('export const BOARD_TRANSITION_CLOUD_EXIT_REBOUND_SECONDS = 0.065');
    expect(source).toContain('export const BOARD_TRANSITION_CLOUD_EXIT_COLLAPSE_SECONDS = 0.46');
    expect(source).toContain("duration: resolvedTheme === 'area55'");
    expect(source).toContain('? Math.max(');
    expect(source).toContain('getRoboAirCombatHoldSeconds()');
    expect(source).toContain(': BOARD_TRANSITION_HOLD_DURATION_SECONDS');
    expect(source).toContain(
      'const sceneParallaxLead = BOARD_TRANSITION_EXIT_PARALLAX_LEAD_SECONDS',
    );
    expect(source).toContain(
      'const hillExitBaseStart = sceneExitStart + BOARD_TRANSITION_HILL_EXIT_LAG_SECONDS',
    );
    expect(source).toContain('const sceneExitStart = Math.max(0, digitExitEnd - 0.5)');
    expect(source).toContain('exitTimeline.to(overlay, {');
    expect(source).toContain('const latestSceneExitEnd = orderedExitEntries.reduce');
    expect(source).toContain('latestSceneExitEnd + 0.02');
    expect(source).toContain('addCloudExitAt(hillExitBaseStart)');
    expect(source).toContain('const hillContinuousDriftTimeline = trackTimeline()');
    expect(source).toContain("duration: getTransitionHillParallaxDuration(layerKey)");
    expect(source).toContain("ease: 'none'");
    expect(source).toContain('duration: 0.72 * sceneEnterSpeedFactor');
    expect(source).not.toContain('hillBaseScale * 1.12');
    expect(source).not.toContain('hillBaseScale * 0.98');
    expect(source).not.toContain('const hillDriftStart = -0.3');
    expect(source).not.toContain('trackDelayedCall(BOARD_TRANSITION_CLOUD_EXIT');
    expect(source).toContain('scaleX: 0.94');
    expect(source).toContain('scaleY: 1.07');
    expect(source).toContain('scaleX: 1.08');
    expect(source).toContain('scaleY: 0.93');
    expect(source).toContain("scaleX: 0,\n      scaleY: 0,");
    expect(source).not.toContain("opacity: 0,\n      scaleX: 0,\n      scaleY: 0,");
  });

  test('slows Robo walker by 40 percent and frontal Robo by 30 percent', () => {
    const source = read('src/modules/board-transition-screen.ts');
    expect(source).toContain('const roboWalkerTravelDurationScale = 1 / 0.60');
    expect(source).toContain('const roboFrontTravelDurationScale = 1 / 0.70');
    expect(source).toContain('duration: 0.48 * roboWalkerTravelDurationScale');
    expect(source).toContain('duration: 0.48 * roboFrontTravelDurationScale');
  });
});
