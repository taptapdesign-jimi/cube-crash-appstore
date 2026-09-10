import { isAnyMenuScreenVisible, requestExitToMenu } from '../menu-exit-handoff';
import { appZoneManager } from '../app-zone-manager';
import { setNoMovesNavigationLocked } from '../terminal-navigation-lock';
import { ARCADE_SLIDE_INDEX, JOURNEY_SLIDE_INDEX } from '../homepage-slide-order';

describe('menu exit handoff', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = `
      <main id="home">
        <section id="slider-container">
          <article class="slider-slide active" data-slide="${ARCADE_SLIDE_INDEX}">
            <div class="hero-container"></div>
          </article>
        </section>
      </main>
    `;
    document.querySelectorAll<HTMLElement>('#home, #slider-container, .slider-slide, .hero-container')
      .forEach((element) => {
        element.getBoundingClientRect = () => ({
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: 100,
          bottom: 100,
          width: 100,
          height: 100,
          toJSON: () => ({}),
        });
      });
    delete (window as any).exitingToMenu;
    setNoMovesNavigationLocked(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
    delete (window as any).exitToMenu;
    delete (window as any).exitingToMenu;
    setNoMovesNavigationLocked(false);
  });

  it('forwards the one-shot Journey slide intent and prepared callback to the authoritative owner', async () => {
    const onHomepageEnterPrepared = jest.fn();
    (document.querySelector('.slider-slide') as HTMLElement).dataset.slide = String(JOURNEY_SLIDE_INDEX);
    const exitToMenu = jest.fn(async (options) => {
      options.onHomepageEnterPrepared?.();
    });
    (window as any).exitToMenu = exitToMenu;

    const handoff = requestExitToMenu({
      reason: 'test-first-play-journey-homepage',
      target: 'homepage',
      homepageSlideIndex: JOURNEY_SLIDE_INDEX,
      onHomepageEnterPrepared,
      skipBoardExit: true,
    });

    await Promise.resolve();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(320);
    await handoff;

    expect(exitToMenu).toHaveBeenCalledTimes(1);
    expect(exitToMenu).toHaveBeenCalledWith({
      target: 'homepage',
      homepageSlideIndex: JOURNEY_SLIDE_INDEX,
      onHomepageEnterPrepared,
      skipBoardExit: true,
      fastArcadeCleanExit: undefined,
      visualExitAlreadyComplete: undefined,
      expectedMenuDestination: 'home',
      allowTerminalNoMovesExit: undefined,
    });
    expect(onHomepageEnterPrepared).toHaveBeenCalledTimes(1);
  });

  it('does not start or recover a menu exit while NO MOVES owns navigation', async () => {
    const exitToMenu = jest.fn();
    (window as any).exitToMenu = exitToMenu;
    setNoMovesNavigationLocked(true);

    await requestExitToMenu({
      reason: 'test-no-moves-race',
      target: 'homepage',
      skipBoardExit: true,
    });

    expect(exitToMenu).not.toHaveBeenCalled();
    expect((window as any).exitingToMenu).not.toBe(true);
  });

  it('allows the terminal Fail modal to perform its explicit exit handoff', async () => {
    const exitToMenu = jest.fn();
    (window as any).exitToMenu = exitToMenu;
    setNoMovesNavigationLocked(true);
    (document.querySelector('.slider-slide') as HTMLElement).dataset.slide = String(ARCADE_SLIDE_INDEX);

    const handoff = requestExitToMenu({
      reason: 'test-fail-modal-exit',
      target: 'homepage',
      skipBoardExit: true,
      allowTerminalNoMovesExit: true,
    });
    await Promise.resolve();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(320);
    await handoff;

    expect(exitToMenu).toHaveBeenCalledWith(expect.objectContaining({
      allowTerminalNoMovesExit: true,
    }));
  });

  it('finishes immediately when the authoritative exit already delivered its Homepage', async () => {
    (document.querySelector('.slider-slide') as HTMLElement).dataset.slide = String(JOURNEY_SLIDE_INDEX);
    const homepageRecovery = jest.spyOn(appZoneManager, 'showHomepageShell');
    (window as any).exitToMenu = jest.fn(async () => {
      appZoneManager.setZone('home', 'test-ready-home');
    });

    await requestExitToMenu({
      reason: 'test-ready-home-no-watchdog',
      target: 'homepage',
      homepageSlideIndex: JOURNEY_SLIDE_INDEX,
      skipBoardExit: true,
    });

    expect(homepageRecovery).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    homepageRecovery.mockRestore();
  });

  it('retires delayed Homepage recovery when Settings acquires a newer presentation', async () => {
    document.body.innerHTML = `
      <main id="home" hidden style="display:none;visibility:hidden;opacity:0">
        <section id="slider-container" hidden style="display:none;visibility:hidden;opacity:0">
          <article class="slider-slide active" data-slide="0">
            <div class="hero-container"></div>
          </article>
        </section>
      </main>
      <section id="settings-screen" style="display:flex;visibility:visible;opacity:1"></section>`;
    const homepageRecovery = jest.spyOn(appZoneManager, 'showHomepageShell');
    (window as any).exitToMenu = jest.fn(async () => {
      appZoneManager.setZone('home', 'test-incomplete-home');
    });

    const handoff = requestExitToMenu({
      reason: 'test-settings-successor-route',
      target: 'homepage',
      homepageSlideIndex: JOURNEY_SLIDE_INDEX,
      skipBoardExit: true,
    });
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(1);
    appZoneManager.setZone('settings', 'test-settings-successor', {
      preserveHomepageNavigation: true,
    });
    await jest.advanceTimersByTimeAsync(320);
    await handoff;

    expect(appZoneManager.getCurrentZone()).toBe('settings');
    expect(homepageRecovery).not.toHaveBeenCalled();
    homepageRecovery.mockRestore();
  });

  it('preserves a Settings nav slide selected before the authoritative exit resolves', async () => {
    (document.querySelector('.slider-slide') as HTMLElement).dataset.slide = '0';
    const homepageRecovery = jest.spyOn(appZoneManager, 'showHomepageShell');
    let resolveExit!: () => void;
    (window as any).exitToMenu = jest.fn(() => new Promise<void>((resolve) => {
      resolveExit = resolve;
      appZoneManager.setZone('home', 'test-home-before-settings-nav');
    }));

    const handoff = requestExitToMenu({
      reason: 'test-settings-nav-before-exit-resolve',
      target: 'homepage',
      homepageSlideIndex: JOURNEY_SLIDE_INDEX,
      skipBoardExit: true,
    });
    await Promise.resolve();
    await Promise.resolve();

    // The Settings nav is a Homepage-owned slide until its CTA acquires the
    // dedicated Settings app zone. This is the real rapid-nav race window.
    (document.querySelector('.slider-slide') as HTMLElement).dataset.slide = '2';
    resolveExit();
    await handoff;

    expect(appZoneManager.getCurrentZone()).toBe('home');
    expect((document.querySelector('.slider-slide.active') as HTMLElement).dataset.slide).toBe('2');
    expect(homepageRecovery).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    homepageRecovery.mockRestore();
  });

  it('keeps the bounded fallback for a genuinely incomplete unchanged exit', async () => {
    document.body.innerHTML = `
      <main id="home" hidden style="display:none;visibility:hidden;opacity:0">
        <section id="slider-container" hidden style="display:none;visibility:hidden;opacity:0">
          <article class="slider-slide active" data-slide="0">
            <div class="hero-container"></div>
          </article>
        </section>
      </main>`;
    const homepageRecovery = jest.spyOn(appZoneManager, 'showHomepageShell').mockResolvedValue();
    const homepageEnter = jest.fn(async () => {});
    (window as any).__ccPlayHomepageSliderEnterHandoff = homepageEnter;
    (window as any).exitToMenu = jest.fn(async () => {
      appZoneManager.setZone('fail-screen', 'test-stuck-exit');
    });

    const handoff = requestExitToMenu({
      reason: 'test-genuine-incomplete-exit',
      target: 'homepage',
      homepageSlideIndex: JOURNEY_SLIDE_INDEX,
      skipBoardExit: true,
    });
    await jest.advanceTimersByTimeAsync(400);
    await handoff;

    expect(homepageRecovery).toHaveBeenCalledTimes(1);
    expect(homepageEnter).toHaveBeenCalledTimes(1);
    homepageRecovery.mockRestore();
    delete (window as any).__ccPlayHomepageSliderEnterHandoff;
  });

  it('does not accept a visible Journey paper shell without a painted Unit', () => {
    document.body.innerHTML = `
      <section id="journey-screen" style="display:flex;visibility:visible;opacity:1">
        <div id="journey-boards-container" data-journey-v700-view="world"></div>
      </section>`;
    const screen = document.getElementById('journey-screen') as HTMLElement;
    screen.getBoundingClientRect = () => ({
      x: 0, y: 0, top: 0, left: 0, right: 390, bottom: 844,
      width: 390, height: 844, toJSON: () => ({}),
    });

    expect(isAnyMenuScreenVisible()).toBe(false);
  });

  it('preserves the Journey destination after the authoritative exit consumes origin flags', async () => {
    (window as any).__ccRunMode = 'journey';
    (window as any).__ccCameFromJourney = true;
    localStorage.setItem('__ccCameFromJourney', 'true');
    const homepageRecovery = jest.spyOn(appZoneManager, 'showHomepageShell');

    const exitToMenu = jest.fn(async () => {
      delete (window as any).__ccCameFromJourney;
      localStorage.removeItem('__ccCameFromJourney');
      appZoneManager.markJourneyMenu('test-consumed-origin');
      document.body.innerHTML = `
        <main id="home" hidden style="display:none;visibility:hidden;opacity:0"></main>
        <section id="slider-container" hidden style="display:none;visibility:hidden;opacity:0"></section>
        <section id="journey-screen" style="display:flex;visibility:visible;opacity:1">
          <div id="journey-boards-container" data-journey-v700-view="world">
            <div class="journey-board-card-wrapper"></div>
          </div>
        </section>`;
      const screen = document.getElementById('journey-screen') as HTMLElement;
      const unit = document.querySelector('.journey-board-card-wrapper') as HTMLElement;
      [screen, unit].forEach((element) => {
        element.getBoundingClientRect = () => ({
          x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 100,
          width: 100, height: 100, toJSON: () => ({}),
        });
      });
    });

    (window as any).exitToMenu = exitToMenu;
    const handoff = requestExitToMenu({
      reason: 'test-journey-intent',
      target: 'auto',
      skipBoardExit: true,
      visualExitAlreadyComplete: true,
    });
    await Promise.resolve();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(320);
    await handoff;

    expect(isAnyMenuScreenVisible()).toBe(true);
    expect(exitToMenu).toHaveBeenCalledWith(expect.objectContaining({
      visualExitAlreadyComplete: true,
      expectedMenuDestination: 'journey',
    }));
    expect(homepageRecovery).not.toHaveBeenCalled();
    homepageRecovery.mockRestore();
  });
});
