type JourneyHubObserverFactory = (
  callback: IntersectionObserverCallback,
  options: IntersectionObserverInit,
) => IntersectionObserver;

const ACTIVE_CLASS = 'journey-v700-runtime-active';

function getDefaultObserverFactory(): JourneyHubObserverFactory | null {
  if (typeof IntersectionObserver === 'undefined') return null;
  return (callback, options) => new IntersectionObserver(callback, options);
}

/**
 * Bounds settled Hub CSS animation work to Worlds near the scroll viewport.
 * Enter/exit remains under the existing transition owner; this scheduler only
 * takes over once the complete Hub has reached idle.
 */
export class JourneyHubRuntimeScheduler {
  private observer: IntersectionObserver | null = null;
  private hub: HTMLElement | null = null;

  public constructor(
    private readonly observerFactory: JourneyHubObserverFactory | null = getDefaultObserverFactory(),
  ) {}

  public activate(hub: HTMLElement, scrollRoot: HTMLElement | null): void {
    this.deactivate();
    this.hub = hub;
    const worldCards = Array.from(
      hub.querySelectorAll<HTMLElement>('.journey-v700-world-card'),
    );

    // Keep the accepted no-observer behavior and avoid a paused first idle
    // frame before IntersectionObserver resolves the initial viewport.
    worldCards.forEach(card => this.setWorldActive(card, true));
    if (!this.observerFactory) return;

    this.observer = this.observerFactory((entries) => {
      entries.forEach((entry) => {
        const card = entry.target as HTMLElement;
        this.setWorldActive(card, entry.isIntersecting);
      });
    }, {
      root: scrollRoot,
      rootMargin: '160px 0px',
      threshold: 0,
    });
    worldCards.forEach(card => this.observer?.observe(card));
  }

  public prepareForTransition(
    hub: HTMLElement | null,
    activeCards?: readonly HTMLElement[],
  ): void {
    this.deactivate();
    this.hub = hub;
    const activeCardSet = activeCards ? new Set(activeCards) : null;
    hub?.querySelectorAll<HTMLElement>('.journey-v700-world-card')
      .forEach(card => this.setWorldActive(card, !activeCardSet || activeCardSet.has(card)));
  }

  public deactivate(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.hub = null;
  }

  private setWorldActive(card: HTMLElement, active: boolean): void {
    card.classList.toggle(ACTIVE_CLASS, active);
    const worldId = Number(card.dataset.worldId);
    if (!this.hub || !Number.isInteger(worldId) || worldId < 1) return;

    this.hub.querySelectorAll<HTMLElement>(
      `.journey-v700-world-cloud[data-world-id="${worldId}"]`,
    ).forEach(cloud => cloud.classList.toggle(ACTIVE_CLASS, active));
  }
}
