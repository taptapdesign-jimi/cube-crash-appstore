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
  private intersectingWorldIds = new Set<number>();
  private activeBudget = Number.POSITIVE_INFINITY;

  public constructor(
    private readonly observerFactory: JourneyHubObserverFactory | null = getDefaultObserverFactory(),
  ) {}

  public activate(hub: HTMLElement, scrollRoot: HTMLElement | null, initialWorldIds?: readonly number[]): void {
    this.deactivate();
    this.hub = hub;
    const worldCards = Array.from(
      hub.querySelectorAll<HTMLElement>('.journey-v700-world-card'),
    );

    const initialSet = initialWorldIds ? new Set(initialWorldIds) : null;
    this.activeBudget = initialSet?.size || worldCards.length;
    this.intersectingWorldIds = new Set(initialSet ?? worldCards.map(card => Number(card.dataset.worldId)));
    worldCards.forEach(card => this.setWorldActive(card, !initialSet || initialSet.has(Number(card.dataset.worldId))));
    if (!this.observerFactory) return;

    this.observer = this.observerFactory((entries) => {
      entries.forEach((entry) => {
        const worldId = Number((entry.target as HTMLElement).dataset.worldId);
        if (!Number.isInteger(worldId)) return;
        if (entry.isIntersecting) this.intersectingWorldIds.add(worldId);
        else this.intersectingWorldIds.delete(worldId);
      });
      const activeIds = new Set(Array.from(this.intersectingWorldIds).slice(0, this.activeBudget));
      worldCards.forEach(card => this.setWorldActive(card, activeIds.has(Number(card.dataset.worldId))));
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
    this.intersectingWorldIds.clear();
    this.activeBudget = Number.POSITIVE_INFINITY;
  }

  public getActiveWorldIds(): readonly number[] {
    if (!this.hub) return [];
    return Array.from(this.hub.querySelectorAll<HTMLElement>(`.journey-v700-world-card.${ACTIVE_CLASS}`))
      .map(card => Number(card.dataset.worldId))
      .filter(worldId => Number.isInteger(worldId));
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
