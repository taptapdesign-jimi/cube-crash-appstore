
export type JourneyStageSurfaceDescriptor =
  | { view: 'hub' }
  | { view: 'world'; worldId: number };

export type JourneyStageTransitionToken = Readonly<{
  generation: number;
  fromKey: string;
  toKey: string;
}>;

type JourneyStageContainerState = {
  height: string;
  minHeight: string;
  position: string;
  width: string;
  overflow: string;
  view: string | null;
  worldId: string | null;
};

type JourneyStageSurface = {
  descriptor: JourneyStageSurfaceDescriptor;
  nodes: HTMLElement[];
  containerState: JourneyStageContainerState;
};

export type JourneyStageSwapResult = {
  committed: boolean;
  evicted: JourneyStageSurfaceDescriptor | null;
};

/** Reject queued DOM events from a surface after it has been detached. */
export function isJourneyStageInteractionCurrent(
  target: Element,
  descriptor: JourneyStageSurfaceDescriptor,
): boolean {
  const liveContainer = document.getElementById('journey-boards-container') as HTMLElement | null;
  if (!target.isConnected || !liveContainer || !liveContainer.contains(target)) return false;
  if (liveContainer.dataset.journeyV700View !== descriptor.view) return false;
  return descriptor.view === 'hub' ||
    Number(liveContainer.dataset.journeyV700WorldId || 0) === descriptor.worldId;
}

const surfaceKey = (descriptor: JourneyStageSurfaceDescriptor): string => (
  descriptor.view === 'hub' ? 'hub' : `world:${descriptor.worldId}`
);

const cloneDescriptor = (
  descriptor: JourneyStageSurfaceDescriptor,
): JourneyStageSurfaceDescriptor => (
  descriptor.view === 'hub'
    ? { view: 'hub' }
    : { view: 'world', worldId: descriptor.worldId }
);

const captureContainerState = (container: HTMLElement): JourneyStageContainerState => ({
  height: container.style.height,
  minHeight: container.style.minHeight,
  position: container.style.position,
  width: container.style.width,
  overflow: container.style.overflow,
  view: container.dataset.journeyV700View ?? null,
  worldId: container.dataset.journeyV700WorldId ?? null,
});

const applyContainerState = (
  container: HTMLElement,
  state: JourneyStageContainerState,
): void => {
  container.style.height = state.height;
  container.style.minHeight = state.minHeight;
  container.style.position = state.position;
  container.style.width = state.width;
  container.style.overflow = state.overflow;
  if (state.view === null) delete container.dataset.journeyV700View;
  else container.dataset.journeyV700View = state.view;
  if (state.worldId === null) delete container.dataset.journeyV700WorldId;
  else container.dataset.journeyV700WorldId = state.worldId;
};

/**
 * Owns the bounded Journey route surfaces that can be reused safely: one Hub
 * and one recently visited World. Retained nodes are disconnected from document, so
 * selectors, CSS animation and layout cannot compete with the visible route.
 * Runtime owners must be retired by the caller before a surface is retained.
 */
export class JourneyStageController {
  private static readonly MAX_RETAINED_WORLDS = 1;
  private retainedHub: JourneyStageSurface | null = null;
  private retainedWorlds = new Map<number, JourneyStageSurface>();
  private transitionGeneration = 0;
  private activeTransition: JourneyStageTransitionToken | null = null;

  public beginTransition(
    from: JourneyStageSurfaceDescriptor,
    to: JourneyStageSurfaceDescriptor,
  ): JourneyStageTransitionToken {
    const token = Object.freeze({
      generation: ++this.transitionGeneration,
      fromKey: surfaceKey(from),
      toKey: surfaceKey(to),
    });
    this.activeTransition = token;
    return token;
  }

  public isCurrent(token: JourneyStageTransitionToken): boolean {
    return this.activeTransition === token && token.generation === this.transitionGeneration;
  }

  public hasRetained(descriptor: JourneyStageSurfaceDescriptor): boolean {
    return this.getSurface(descriptor) !== null;
  }

  public releaseRetainedWorldExcept(worldId: number): JourneyStageSurfaceDescriptor | null {
    const obsolete = Array.from(this.retainedWorlds.entries()).find(([id]) => id !== worldId);
    if (!obsolete) return null;
    this.retainedWorlds.delete(obsolete[0]);
    const released = cloneDescriptor(obsolete[1].descriptor);
    this.disposeSurface(obsolete[1]);
    return released;
  }

  /**
   * Retain nodes already owned by a live surface. They may still be connected
   * while a cold prepaint host is promoted; the caller detaches them immediately
   * after this synchronous ownership transfer.
   */
  public retainNodes(
    descriptor: JourneyStageSurfaceDescriptor,
    nodes: readonly HTMLElement[],
    container: HTMLElement,
  ): JourneyStageSurfaceDescriptor | null {
    const surface: JourneyStageSurface = {
      descriptor: cloneDescriptor(descriptor),
      nodes: Array.from(nodes),
      containerState: captureContainerState(container),
    };
    return this.storeSurface(surface);
  }

  /** Atomically replaces the live children with one retained destination. */
  public commitRetainedSwap(
    token: JourneyStageTransitionToken,
    container: HTMLElement,
    outgoing: JourneyStageSurfaceDescriptor,
  ): JourneyStageSwapResult {
    if (!this.isCurrent(token) || token.fromKey !== surfaceKey(outgoing)) {
      return { committed: false, evicted: null };
    }

    const incoming = this.getSurfaceByKey(token.toKey);
    if (!incoming || incoming.nodes.length === 0) {
      return { committed: false, evicted: null };
    }

    const outgoingSurface: JourneyStageSurface = {
      descriptor: cloneDescriptor(outgoing),
      nodes: Array.from(container.children).filter(
        (node): node is HTMLElement => node instanceof HTMLElement,
      ),
      containerState: captureContainerState(container),
    };

    this.removeSurface(incoming.descriptor);
    container.replaceChildren(...incoming.nodes);
    applyContainerState(container, incoming.containerState);
    const evicted = this.storeSurface(outgoingSurface);
    this.activeTransition = null;
    return { committed: true, evicted };
  }

  public completeTransition(token: JourneyStageTransitionToken): boolean {
    if (!this.isCurrent(token)) return false;
    this.activeTransition = null;
    return true;
  }

  public cancelTransition(token: JourneyStageTransitionToken): void {
    if (!this.isCurrent(token)) return;
    this.activeTransition = null;
    this.transitionGeneration += 1;
  }

  /** Release only inactive surfaces without invalidating an in-flight route. */
  public clearRetained(): JourneyStageSurfaceDescriptor[] {
    const released = [this.retainedHub, ...this.retainedWorlds.values()]
      .filter((surface): surface is JourneyStageSurface => surface !== null)
      .map((surface) => cloneDescriptor(surface.descriptor));
    this.disposeSurface(this.retainedHub);
    this.retainedWorlds.forEach((surface) => this.disposeSurface(surface));
    this.retainedHub = null;
    this.retainedWorlds.clear();
    return released;
  }

  /**
   * Release the expensive retained World while preserving the bounded Hub.
   *
   * A Hub contains only the three route Units and their shared cloud layer;
   * it is the exact destination required by every World X action. A retained
   * World contains the complete ten-stage map and is the pressure-sensitive
   * surface. Keeping those two policies separate prevents a native warning
   * from forcing a new connected Hub raster during the next active exit.
   */
  public clearRetainedWorld(): JourneyStageSurfaceDescriptor | null {
    const retained = this.retainedWorlds.values().next().value as JourneyStageSurface | undefined;
    if (!retained) return null;
    const released = cloneDescriptor(retained.descriptor);
    if (retained.descriptor.view === 'world') this.retainedWorlds.delete(retained.descriptor.worldId);
    this.disposeSurface(retained);
    return released;
  }

  /** Memory pressure releases every expensive World while preserving Hub. */
  public clearRetainedWorlds(): JourneyStageSurfaceDescriptor[] {
    const protectedWorldId = this.activeTransition?.toKey.startsWith('world:')
      ? Number(this.activeTransition.toKey.slice('world:'.length))
      : null;
    const released: JourneyStageSurfaceDescriptor[] = [];
    this.retainedWorlds.forEach((surface, worldId) => {
      if (worldId === protectedWorldId) return;
      released.push(cloneDescriptor(surface.descriptor));
      this.retainedWorlds.delete(worldId);
      this.disposeSurface(surface);
    });
    return released;
  }

  /** Release retained surfaces and invalidate all late transition completions. */
  public dispose(): JourneyStageSurfaceDescriptor[] {
    const released = this.clearRetained();
    this.activeTransition = null;
    this.transitionGeneration += 1;
    return released;
  }

  public getRetainedDescriptors(): JourneyStageSurfaceDescriptor[] {
    return [this.retainedHub, ...this.retainedWorlds.values()]
      .filter((surface): surface is JourneyStageSurface => surface !== null)
      .map((surface) => cloneDescriptor(surface.descriptor));
  }

  private getSurface(descriptor: JourneyStageSurfaceDescriptor): JourneyStageSurface | null {
    return this.getSurfaceByKey(surfaceKey(descriptor));
  }

  private getSurfaceByKey(key: string): JourneyStageSurface | null {
    if (this.retainedHub && surfaceKey(this.retainedHub.descriptor) === key) return this.retainedHub;
    if (key.startsWith('world:')) {
      const worldId = Number(key.slice('world:'.length));
      return this.retainedWorlds.get(worldId) ?? null;
    }
    return null;
  }

  private removeSurface(descriptor: JourneyStageSurfaceDescriptor): void {
    if (descriptor.view === 'hub') {
      this.retainedHub = null;
      return;
    }
    this.retainedWorlds.delete(descriptor.worldId);
  }

  private storeSurface(surface: JourneyStageSurface): JourneyStageSurfaceDescriptor | null {
    const previous = surface.descriptor.view === 'hub'
      ? this.retainedHub
      : this.retainedWorlds.get(surface.descriptor.worldId) ?? null;
    if (previous && previous.nodes.length === surface.nodes.length &&
      previous.nodes.every((node, index) => node === surface.nodes[index])) {
      previous.descriptor = surface.descriptor;
      previous.containerState = surface.containerState;
      return null;
    }
    if (surface.descriptor.view === 'hub') this.retainedHub = surface;
    else this.retainedWorlds.set(surface.descriptor.worldId, surface);

    if (surface.descriptor.view === 'world' && this.retainedWorlds.size > JourneyStageController.MAX_RETAINED_WORLDS) {
      const insertedWorldId = surface.descriptor.worldId;
      const oldest = Array.from(this.retainedWorlds.entries()).find(([worldId]) => worldId !== insertedWorldId);
      if (oldest) {
        this.retainedWorlds.delete(oldest[0]);
        const evicted = cloneDescriptor(oldest[1].descriptor);
        this.disposeSurface(oldest[1], new Set(surface.nodes));
        return evicted;
      }
    }
    if (!previous || previous === surface) return null;
    const evicted = cloneDescriptor(previous.descriptor);
    this.disposeSurface(previous, new Set(surface.nodes));
    return evicted;
  }

  private disposeSurface(
    surface: JourneyStageSurface | null,
    preservedNodes: ReadonlySet<HTMLElement> = new Set<HTMLElement>(),
  ): void {
    if (!surface) return;
    surface.nodes.forEach((node) => {
      if (preservedNodes.has(node)) return;
      try { node.remove(); } catch {}
    });
    surface.nodes.length = 0;
  }
}
