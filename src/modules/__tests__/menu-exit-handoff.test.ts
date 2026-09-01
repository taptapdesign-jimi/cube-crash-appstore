import { requestExitToMenu } from '../menu-exit-handoff';

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
    });
    expect(onHomepageEnterPrepared).toHaveBeenCalledTimes(1);
  });
});
