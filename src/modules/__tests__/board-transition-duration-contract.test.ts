import fs from 'fs';
import path from 'path';
const read = (relativePath: string): string => fs.readFileSync(
  path.join(process.cwd(), relativePath),
  'utf8',
);

describe('Board Transition duration contract', () => {
  test('removes about two seconds without changing the choreography order', () => {
    const source = read('src/modules/board-transition-screen.ts');
    expect(source).toContain('export const BOARD_TRANSITION_HOLD_DURATION_SECONDS = 0.4');
    expect(source).toContain('export const BOARD_TRANSITION_EXIT_PARALLAX_LEAD_SECONDS = 0.35');
    expect(source).toContain('export const BOARD_TRANSITION_HILL_EXIT_LAG_SECONDS = 0.2');
    expect(source).toContain('const BOARD_TRANSITION_REGULAR_SCENE_EXIT_SECONDS = 0.28');
    expect(source).toContain('export const BOARD_TRANSITION_CLOUD_EXIT_ANTICIPATION_SECONDS = 0.07');
    expect(source).toContain('export const BOARD_TRANSITION_CLOUD_EXIT_REBOUND_SECONDS = 0.065');
    expect(source).toContain('export const BOARD_TRANSITION_CLOUD_EXIT_COLLAPSE_SECONDS = 0.46');
    expect(source).toContain('duration: BOARD_TRANSITION_HOLD_DURATION_SECONDS');
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
});
