import fs from 'node:fs';
import path from 'node:path';
import {
  createJourneyInterimShineLoop,
  JOURNEY_INTERIM_CARD_SHINE_PROFILE,
  shouldStartJourneyInterimShine,
} from '../journey-interim-card-shine.js';

describe('Journey interim card shine parity', () => {
  const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

  test('keeps the accepted New Reward pre-click cadence in one shared profile', () => {
    expect(JOURNEY_INTERIM_CARD_SHINE_PROFILE).toEqual({
      sweepDurationMs: 1700,
      cadenceMs: 3000,
      glowPulseDurationMs: 500,
      bounceDelayMs: 150,
      bounceUpDurationSeconds: 0.14,
      bounceDownDurationSeconds: 0.18,
      bounceScaleMultiplier: 1.055,
    });
  });

  test('uses the shared masked face/light owner on both interim surfaces', () => {
    const newCard = read('src/modules/journey-new-card-screen.ts');
    const world = read('src/modules/journey-boards-manager.ts');
    const css = read('src/collectibles-screen.css');

    expect(newCard).toContain("from './journey-interim-card-shine.js'");
    expect(newCard).toContain('triggerJourneyInterimShinePulse({');
    expect(newCard).toContain('JOURNEY_INTERIM_CARD_SHINE_PROFILE.cadenceMs');
    expect(newCard).toContain('cc-journey-interim-shine-face');
    expect(newCard).toContain('cc-journey-interim-shine-light');
    expect(newCard).toContain('cc-journey-interim-shine-light ${JOURNEY_INTERIM_SHINE_TRIGGER_CLASS}');

    expect(world).toContain("from './journey-interim-card-shine.js'");
    expect(world).toContain('createJourneyInterimShineLoop({');
    expect(world).toContain("image.className = 'journey-board-image cc-journey-interim-shine-face'");
    expect(world).toContain("shineLight.className = 'journey-interim-shine-light cc-journey-interim-shine-light'");
    expect(world).toContain('setJourneyInterimShineMask(shineLight, image.src);');

    expect(css).toContain('@keyframes ccJourneyInterimCardShimmer');
    expect(css).toContain('@keyframes ccJourneyInterimCardGlowPulse');
    expect(css).not.toMatch(/shine-active::after/);
    expect(css).not.toContain('@keyframes journey-interim-burn');
    expect(css).not.toContain('@keyframes journey-interim-outer-burn');
  });

  test('keeps shine transforms below the existing card and Unit owners and cleans them together', () => {
    const world = read('src/modules/journey-boards-manager.ts');
    const css = read('src/collectibles-screen.css');

    expect(world).toMatch(/startInterimCardShine\(interimCard\);/);
    expect(world).toMatch(/stopInterimCardIdleEffects\(\): void \{[\s\S]*?this\.stopInterimCardShine\(\);/);
    expect(world).toMatch(/if \(snapshot\.paintSuspended\) \{[\s\S]*?this\.interimShineController\?\.pause\(\);[\s\S]*?resume\(\);/);
    expect(world).toMatch(/bounceTimeline[\s\S]*?\.to\(card, \{/);
    expect(css).toContain('.cc-journey-interim-shine-face.cc-journey-interim-glow-pulse');
    expect(css).toMatch(/journey-world-runtime-paint-suspended[\s\S]*?journey-interim-shine-light::after/);
  });

  test('blocks an early external resume until the visible World enter has settled', () => {
    const settled = {
      enabled: true,
      renderDisposed: false,
      paintSuspended: false,
      view: 'world' as const,
      managerPhase: 'idle' as const,
      worldPhase: 'idle' as const,
      enterOwnsCard: false,
      exitOwnsCard: false,
    };

    expect(shouldStartJourneyInterimShine(settled)).toBe(true);
    expect(shouldStartJourneyInterimShine({ ...settled, managerPhase: 'entering' })).toBe(false);
    expect(shouldStartJourneyInterimShine({ ...settled, worldPhase: 'entering' })).toBe(false);
    expect(shouldStartJourneyInterimShine({ ...settled, enterOwnsCard: true })).toBe(false);
    expect(shouldStartJourneyInterimShine({ ...settled, paintSuspended: true })).toBe(false);
    expect(shouldStartJourneyInterimShine({ ...settled, view: 'hub' })).toBe(false);

    const world = read('src/modules/journey-boards-manager.ts');
    expect(world).toMatch(/activeBoardAreaEnterInProgress = false;[\s\S]*?resumeInterimCardIdleEffects\('active-area-enter-complete'\);/);
    expect(world).toContain("resumeInterimCardIdleEffects('active-area-enter-no-targets');");
    expect(world).toContain("resumeInterimCardIdleEffects('active-area-enter-error');");
  });

  test('preserves the remaining cadence across pause/resume without an immediate restart', () => {
    jest.useFakeTimers();
    const raf = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => (
      window.setTimeout(() => callback(0), 0)
    ));
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((frameId) => {
      window.clearTimeout(frameId);
    });
    const lightElement = document.createElement('div');
    const faceElement = document.createElement('img');
    document.body.append(lightElement, faceElement);
    const controller = createJourneyInterimShineLoop({ lightElement, faceElement });

    controller.start();
    jest.advanceTimersByTime(0);
    expect(raf).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(100);
    controller.pause();
    controller.resume();
    expect(raf).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(2899);
    expect(raf).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    expect(raf).toHaveBeenCalledTimes(2);

    controller.stop();
    jest.advanceTimersByTime(JOURNEY_INTERIM_CARD_SHINE_PROFILE.cadenceMs * 2);
    expect(raf).toHaveBeenCalledTimes(2);
    expect(lightElement.className).toBe('');
    expect(faceElement.className).toBe('');

    document.body.replaceChildren();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
});
