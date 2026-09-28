import fs from 'node:fs';
import path from 'node:path';
import {
  createJourneyInterimShineLoop,
  JOURNEY_INTERIM_BURN_PULSE_CLASS,
  JOURNEY_INTERIM_CARD_SHINE_PROFILE,
  shouldStartJourneyInterimShine,
  triggerJourneyInterimShinePulse,
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

  test('keeps New Reward shimmer while World interim uses face-local burn/glow only', () => {
    const newCard = read('src/modules/journey-new-card-screen.ts');
    const world = read('src/modules/journey-boards-manager.ts');
    const css = read('src/collectibles-screen.css');

    expect(newCard).toContain("from './journey-interim-card-shine.js'");
    expect(newCard).toContain('triggerJourneyInterimShinePulse({');
    expect(newCard).toContain('const playSprite9ShineOnce = (withHaptic = true) => {');
    expect(newCard).not.toContain('window.setInterval(');
    expect(newCard).toContain('cc-journey-interim-shine-face');
    expect(newCard).toContain('cc-journey-interim-shine-light');
    expect(newCard).toContain('cc-journey-interim-shine-light ${JOURNEY_INTERIM_SHINE_TRIGGER_CLASS}');

    expect(world).toContain("from './journey-interim-card-shine.js'");
    expect(world).toContain('createJourneyInterimShineLoop({');
    expect(world).toContain("image.className = 'journey-board-image cc-journey-interim-shine-face'");
    expect(world).not.toContain("shineLight.className = 'journey-interim-shine-light cc-journey-interim-shine-light'");
    expect(world).not.toContain('setJourneyInterimShineMask(');
    expect(world).toContain("image.src = './assets/colelctibles/interim.png';");
    expect(world).toContain("image.srcset = './assets/colelctibles/interim.png 1x, ./assets/colelctibles/interim@2x.png 2x';");
    expect(world).toContain('lightElement: null');
    expect(world).toContain('burnElement: card');
    expect(world).toContain('burnGlowInitialDelayMs');
    expect(world).toContain('burnGlowCadenceMs');
    expect(world).toContain('burnGlowDurationMs');

    expect(css).toContain('@keyframes ccJourneyInterimCardShimmer');
    expect(css).toContain('@keyframes ccJourneyInterimCardGlowPulse');
    expect(css).toContain('@keyframes ccJourneyInterimCardBurnPulse');
    expect(css).toContain('.journey-board-card.interim.cc-journey-interim-burn-pulse::before');
    expect(css).not.toMatch(/shine-active::after/);
    expect(css).not.toContain('@keyframes journey-interim-burn');
    expect(css).not.toContain('@keyframes journey-interim-outer-burn');
  });

  test('keeps burn/glow below the existing card and Unit owners and cleans them together', () => {
    const world = read('src/modules/journey-boards-manager.ts');
    const css = read('src/collectibles-screen.css');
    const interimBounce = world.slice(
      world.indexOf('private startInterimBounce('),
      world.indexOf('private commitOverlayCardLandingPose('),
    );

    expect(world).toMatch(/claimInterimCardIdleSession\(interimCard, cardWrapper\);/);
    expect(world).toMatch(/stopInterimCardIdleEffects\(\): void \{[\s\S]*?this\.stopInterimCardShine\(\);/);
    expect(world).toContain('this.canRunJourneyInterimLocalEffects(interimCard, interimWrapper, true)');
    expect(world).toMatch(/shouldRun: \(\) => \([\s\S]*?this\.canRunJourneyInterimLocalEffects\(card, undefined, true\)/);
    expect(world).toMatch(/this\.interimShineController\?\.pause\(\);[\s\S]*?this\.interimShineController\?\.resume\(\);/);
    expect(world).toMatch(/bounceTimeline[\s\S]*?\.to\(card, \{/);
    expect(world).not.toContain('onComplete: triggerLandingSmoke');
    expect(world).toContain('.call(triggerMotionSmoke, [], JOURNEY_INTERIM_IDLE_MOTION.smokeStartSeconds)');
    expect(world).toMatch(/_interimBounceStartedAt = Date\.now\(\);[\s\S]*?this\.claimInterimCardIdleSession\(card, cardWrapper\);[\s\S]*?const bounceTimeline/);
    expect(world).toMatch(/claimInterimCardIdleSession[\s\S]*?interimIdleEffectsCard = card;[\s\S]*?startInterimCardShine\(card\)/);
    expect(interimBounce).not.toContain('_interimSettledSmokeTimer');
    expect(interimBounce).not.toContain('particleColorRgb:');
    expect(interimBounce).not.toContain('haloColorRgb:');
    expect(interimBounce).not.toContain("blendMode: 'normal'");
    expect(interimBounce).toContain('sizeScale: 0.54');
    expect(interimBounce).toContain('distanceScale: 0.58');
    expect(interimBounce).toContain('countScale: 0.28');
    expect(interimBounce).toContain('haloScale: 0.52');
    expect(css).toContain('.cc-journey-interim-shine-face.cc-journey-interim-glow-pulse');
    expect(css).not.toContain('journey-world-runtime-paint-suspended .cc-journey-interim-shine-face');
    expect(css).not.toContain('.journey-interim-shine-light {');
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

  test('supports a delayed face-only World pulse on a custom staggered cadence', () => {
    jest.useFakeTimers();
    const raf = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => (
      window.setTimeout(() => callback(0), 0)
    ));
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((frameId) => {
      window.clearTimeout(frameId);
    });
    const faceElement = document.createElement('img');
    document.body.append(faceElement);
    const controller = createJourneyInterimShineLoop({
      lightElement: null,
      faceElement,
      initialDelayMs: 1950,
      cadenceMs: 2490,
    });

    controller.start();
    jest.advanceTimersByTime(1949);
    expect(raf).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(raf).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(2490);
    expect(raf).toHaveBeenCalledTimes(2);

    controller.stop();
    document.body.replaceChildren();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('retires the World face glow and warm burn after their own duration', () => {
    const faceElement = document.createElement('img');
    const burnElement = document.createElement('div');
    const scheduled = new Map<number, () => void>();
    triggerJourneyInterimShinePulse({
      lightElement: null,
      faceElement,
      burnElement,
      pulseDurationMs: 1100,
      scheduleFrame: (callback) => { callback(); return 1; },
      scheduleTimeout: (callback, delayMs) => { scheduled.set(delayMs, callback); return delayMs; },
    });

    const cleanupAt = JOURNEY_INTERIM_CARD_SHINE_PROFILE.bounceDelayMs
      + 1100;
    expect(scheduled.has(JOURNEY_INTERIM_CARD_SHINE_PROFILE.sweepDurationMs)).toBe(false);
    scheduled.get(JOURNEY_INTERIM_CARD_SHINE_PROFILE.bounceDelayMs)?.();
    expect(faceElement).toHaveClass('cc-journey-interim-glow-pulse');
    expect(burnElement).toHaveClass(JOURNEY_INTERIM_BURN_PULSE_CLASS);
    scheduled.get(cleanupAt)?.();
    expect(faceElement).not.toHaveClass('cc-journey-interim-glow-pulse');
    expect(burnElement).not.toHaveClass(JOURNEY_INTERIM_BURN_PULSE_CLASS);
  });

  test('moves the World burn edge-to-edge with one transform-only pseudo-element', () => {
    const css = read('src/collectibles-screen.css');
    const burnRule = css.slice(
      css.indexOf('.journey-board-card.interim.cc-journey-interim-burn-pulse::before'),
      css.indexOf('@keyframes ccJourneyInterimCardShimmer'),
    );
    const burnKeyframes = css.slice(
      css.indexOf('@keyframes ccJourneyInterimCardBurnPulse'),
      css.indexOf('/* Existing unlocked Journey cards'),
    );

    expect(burnRule).toContain('left: -62%');
    expect(burnRule).toContain('width: 72%');
    expect(burnRule).not.toContain('mask');
    expect(burnKeyframes).toContain('translate3d(0, -50%, 0) rotate(45deg)');
    expect(burnKeyframes).toContain('translate3d(225%, 50%, 0) rotate(45deg)');
    expect(burnKeyframes).not.toContain('background-position');
  });
});

 test('World interim has neither rectangular nor inherited drop shadow', () => {
  const css = fs.readFileSync(path.resolve(process.cwd(), 'src/collectibles-screen.css'), 'utf8');
  const rule = css.match(/\.journey-board-card\.interim \{([^}]+)\}/)?.[1];
  expect(rule).toContain('box-shadow: none !important');
  expect(rule).toContain('filter: none !important');
  expect(css).not.toContain('journey-world-runtime-paint-suspended .cc-journey-interim-shine-face');
 });
