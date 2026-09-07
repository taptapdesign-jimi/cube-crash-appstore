import { isAnyMenuScreenVisible, requestExitToMenu } from '../menu-exit-handoff';
import { appZoneManager } from '../app-zone-manager';

describe('menu exit handoff', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = `
      <main id="home">
        <section id="slider-container">
          <article class="slider-slide active" data-slide="1">
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
  });

  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
    delete (window as any).exitToMenu;
    delete (window as any).exitingToMenu;
  });

  it('forwards the one-shot Slider 2 intent and prepared callback to the authoritative owner', async () => {
    const onHomepageEnterPrepared = jest.fn();
    const exitToMenu = jest.fn(async (options) => {
      options.onHomepageEnterPrepared?.();
    });
    (window as any).exitToMenu = exitToMenu;

    const handoff = requestExitToMenu({
      reason: 'test-first-play-journey-homepage',
      target: 'homepage',
      homepageSlideIndex: 1,
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
      homepageSlideIndex: 1,
      onHomepageEnterPrepared,
      skipBoardExit: true,
      fastArcadeCleanExit: undefined,
      visualExitAlreadyComplete: undefined,
      expectedMenuDestination: 'home',
    });
    expect(onHomepageEnterPrepared).toHaveBeenCalledTimes(1);
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
