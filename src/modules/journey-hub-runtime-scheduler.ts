type JourneyHubObserverFactory = (
  callback: IntersectionObserverCallback,
  options: IntersectionObserverInit,
) => IntersectionObserver;

const ACTIVE_CLASS = 'journey-v700-runtime-active';
const SUSPENDED_CLASS = 'journey-v700-runtime-suspended';

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
  private generation = 0;
  private backgrounded = false;
  private worldCards: HTMLElement[] = [];

  public constructor(
    private readonly observerFactory: JourneyHubObserverFactory | null = getDefaultObserverFactory(),
  ) {}

  private readonly onVisibility = (): void => {
    this.backgrounded = document.hidden;
    this.applyActiveWorlds();
  };

  private readonly onPageHide = (): void => {
    this.backgrounded = true;
    this.applyActiveWorlds();
  };

  private readonly onNativeActive = (): void => {
    this.backgrounded = false;
    this.applyActiveWorlds();
  };

  private bindPageLifecycle(): void {
    this.backgrounded = document.hidden;
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('pageshow', this.onVisibility);
    window.addEventListener('cc:native-audio-active', this.onNativeActive);
  }

  private applyActiveWorlds(): void {
    if (!this.hub) return;
    this.hub.classList.toggle(SUSPENDED_CLASS, this.backgrounded);
    const activeIds = new Set(Array.from(this.intersectingWorldIds).slice(0, this.activeBudget));
    this.worldCards.forEach(card => this.setWorldActive(
      card,
      !this.backgrounded && activeIds.has(Number(card.dataset.worldId)),
    ));
  }

  public activate(hub: HTMLElement, scrollRoot: HTMLElement | null, initialWorldIds?: readonly number[]): void {
    this.deactivate();
    this.hub = hub;
    const worldCards = Array.from(
      hub.querySelectorAll<HTMLElement>('.journey-v700-world-card'),
    );
    this.worldCards = worldCards;
    const generation = this.generation;

    const initialSet = initialWorldIds ? new Set(initialWorldIds) : null;
    this.activeBudget = initialSet?.size || worldCards.length;
    this.intersectingWorldIds = new Set(initialSet ?? worldCards.map(card => Number(card.dataset.worldId)));
    this.bindPageLifecycle();
    this.applyActiveWorlds();
    if (!this.observerFactory) return;

    this.observer = this.observerFactory((entries) => {
      if (this.generation !== generation || this.hub !== hub) return;
      entries.forEach((entry) => {
        const worldId = Number((entry.target as HTMLElement).dataset.worldId);
        if (!Number.isInteger(worldId)) return;
        if (entry.isIntersecting) this.intersectingWorldIds.add(worldId);
        else this.intersectingWorldIds.delete(worldId);
      });
      this.applyActiveWorlds();
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
    this.worldCards = Array.from(hub?.querySelectorAll<HTMLElement>('.journey-v700-world-card') ?? []);
    this.intersectingWorldIds = new Set(this.worldCards
      .filter(card => !activeCardSet || activeCardSet.has(card))
      .map(card => Number(card.dataset.worldId)));
    if (hub) this.bindPageLifecycle();
    this.applyActiveWorlds();
  }

  public deactivate(): void {
    this.generation++;
    this.observer?.disconnect();
    this.observer = null;
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('pageshow', this.onVisibility);
    window.removeEventListener('cc:native-audio-active', this.onNativeActive);
    this.hub?.classList.add(SUSPENDED_CLASS);
    this.worldCards.forEach(card => this.setWorldActive(card, false));
    this.hub = null;
    this.worldCards = [];
    this.backgrounded = false;
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
