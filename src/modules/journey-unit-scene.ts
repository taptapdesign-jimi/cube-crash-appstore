/** Structural presentation only. Progression, card listeners and artwork stay
 * with their existing owners. Compile a detached, scoped World before priming;
 * never reconstruct or measure the scene on the visible return path. */
export const JOURNEY_SCENE_UNIT_CLASS = 'journey-scene-unit';

interface PartPlacement {
  element: HTMLElement;
  top: number;
  left?: number;
  width?: number;
  height: number;
}

function length(value: string, reference: number): number {
  if (!/^-?[\d.]+(?:px|%)$/.test(value)) return NaN;
  const number = Number.parseFloat(value);
  return value.endsWith('%') ? number * reference / 100 : number;
}

export function getJourneySceneUnit(root: ParentNode, boardId: number): HTMLElement | null {
  return root.querySelector<HTMLElement>(`.${JOURNEY_SCENE_UNIT_CLASS}[data-board-id="${boardId}"]`);
}

/** Beach is the acceptance slice. Other Worlds retain their current renderer
 * until the complete game/return route has passed the Simulator visual gate.
 * All placements are validated before any DOM mutation (including image
 * readiness). A failed preparation leaves the existing renderer intact. */
export function compileJourneyUnitScene(root: HTMLElement, worldId: number): boolean {
  if (worldId !== 2 || root.isConnected) return false;
  const cards = root.querySelector<HTMLElement>('.journey-cards-container');
  if (!cards) return false;
  if (cards.querySelector(`.${JOURNEY_SCENE_UNIT_CLASS}`)) return true;
  const cardsTop = length(cards.style.top, 0);
  if (!Number.isFinite(cardsTop)) return false;
  const plans: Array<{ boardId: number; parts: PartPlacement[]; top: number; height: number; originX: number; originY: number }> = [];
  for (let boardId = 11; boardId <= 20; boardId += 1) {
    const wrapper = cards.querySelector<HTMLElement>(`.journey-board-card-wrapper[data-board-id="${boardId}"]`);
    if (!wrapper || wrapper.parentElement !== cards) return false;
    const cardTop = length(wrapper.style.top, 0);
    const cardHeight = length(wrapper.style.height, 0);
    const parts: PartPlacement[] = [{ element: wrapper, top: cardTop, height: cardHeight }];
    const scenery = Array.from(root.querySelectorAll<HTMLElement>(`[data-journey-area-id="board-${boardId}"]`))
      .filter(element => element !== wrapper);
    let island: PartPlacement | undefined;
    for (const element of scenery) {
      const parent = element.parentElement;
      if (!(element instanceof HTMLImageElement) || !parent || !element.complete || element.naturalWidth <= 0
        || !parent.matches('.journey-bg-container, .journey-cloud-container, .journey-decor-container')) return false;
      const parentWidth = length(parent.style.width, 0);
      const parentHeight = length(parent.style.height, 0);
      const width = length(element.style.width, parentWidth);
      const placement: PartPlacement = {
        element,
        left: length(parent.style.left, 0) + length(element.style.left, parentWidth),
        top: length(parent.style.top, 0) - cardsTop + length(element.style.top, parentHeight),
        width,
        height: width * element.naturalHeight / element.naturalWidth,
      };
      parts.push(placement);
      if (element.classList.contains('journey-beach-island-art')) island = placement;
    }
    if (!island || parts.some(part => !Number.isFinite(part.top) || !Number.isFinite(part.height) || part.height <= 0
      || (part.left !== undefined && !Number.isFinite(part.left))
      || (part.width !== undefined && (!Number.isFinite(part.width) || part.width <= 0)))) return false;
    // Vertical padding covers the authored card rotation and independent cloud
    // drift. Overflow remains visible: these bounds are not a clipping mask.
    const top = Math.min(...parts.map(part => part.top)) - 32;
    const bottom = Math.max(...parts.map(part => part.top + part.height)) + 32;
    plans.push({ boardId, parts, top, height: bottom - top,
      originX: island.left! + island.width! / 2, originY: island.top + island.height / 2 - top });
  }
  for (const plan of plans) {
    const unit = document.createElement('div');
    unit.className = JOURNEY_SCENE_UNIT_CLASS;
    unit.dataset.boardId = String(plan.boardId);
    unit.dataset.journeyAreaId = `board-${plan.boardId}`;
    unit.dataset.journeyMotionTransformOrigin = `${plan.originX}px ${plan.originY}px`;
    Object.assign(unit.style, { position: 'absolute', left: '0px', top: `${plan.top}px`, width: '100%',
      height: `${plan.height}px`, overflow: 'visible', pointerEvents: 'none', zIndex: '10',
      transformOrigin: unit.dataset.journeyMotionTransformOrigin });
    for (const part of plan.parts) {
      part.element.style.top = `${part.top - plan.top}px`;
      if (part.left !== undefined) part.element.style.left = `${part.left}px`;
      if (part.width !== undefined) part.element.style.width = `${part.width}px`;
      unit.appendChild(part.element);
    }
    cards.appendChild(unit);
  }
  return true;
}

/** Reconciliation replaces only the card's presentation, not its scene pose. */
export function preserveJourneySceneCardPlacement(previous: HTMLElement, replacement: HTMLElement): void {
  if (!previous.parentElement?.classList.contains(JOURNEY_SCENE_UNIT_CLASS)) return;
  for (const property of ['left', 'top', 'width', 'height'] as const) replacement.style[property] = previous.style[property];
}
