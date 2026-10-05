import {
  compileJourneyUnitScene,
  getJourneySceneUnit,
  preserveJourneySceneCardPlacement,
} from '../journey-unit-scene';

function fixture() {
  const root = document.createElement('div');
  root.innerHTML = '<div class="journey-cloud-container"></div><div class="journey-bg-container"></div><div class="journey-decor-container"></div><div class="journey-cards-container" style="top:30px"></div>';
  const cards = root.querySelector<HTMLElement>('.journey-cards-container')!;
  for (const layer of Array.from(root.children).slice(0, 3) as HTMLElement[]) {
    layer.style.cssText = 'left:-40px;top:20px;width:390px;height:760px';
  }
  for (let id = 11; id <= 20; id++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'journey-board-card-wrapper';
    wrapper.dataset.boardId = String(id);
    wrapper.dataset.journeyAreaId = `board-${id}`;
    wrapper.style.cssText = `left:calc(50% + 0px);top:${100 + id * 30}px;width:80px;height:120px;transform:translateX(-50%) rotate(5deg)`;
    wrapper.innerHTML = '<button class="journey-board-card">stage</button>';
    cards.append(wrapper);
    for (const [index, name] of ['cloud', 'island', 'prop'].entries()) {
      const img = document.createElement('img');
      img.className = name === 'island' ? 'journey-beach-island-art' : `journey-${name}`;
      img.dataset.journeyAreaId = `board-${id}`;
      img.style.cssText = `left:20%;top:${id * 5}%;width:50%;height:auto;opacity:0.8`;
      Object.defineProperties(img, { complete: { value: true, configurable: true }, naturalWidth: { value: 200 }, naturalHeight: { value: 100 } });
      root.children[index].append(img);
    }
  }
  return { root, cards };
}

describe('detached Journey Unit scene', () => {
  it('moves the original artwork and interactive card into one bounded lifecycle target', () => {
    const { root, cards } = fixture();
    const card = cards.querySelector<HTMLElement>('.journey-board-card')!;
    const clicked = jest.fn();
    card.addEventListener('click', clicked);
    const before = Array.from(root.querySelectorAll('img'));
    const rect = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => { throw new Error('no layout reads during preparation'); });
    expect(compileJourneyUnitScene(root, 2)).toBe(true);
    rect.mockRestore();
    expect(root.querySelectorAll('.journey-scene-unit')).toHaveLength(10);
    expect(Array.from(root.querySelectorAll('img'))).toEqual(expect.arrayContaining(before));
    const unit = getJourneySceneUnit(root, 11)!;
    expect(unit.contains(card)).toBe(true);
    expect(unit.style.pointerEvents).toBe('none');
    expect(unit.style.overflow).toBe('visible');
    expect(Number.parseFloat(unit.style.height)).toBeLessThan(400);
    expect(card.parentElement!.style.left).toBe('calc(50% + 0px)');
    card.click();
    expect(clicked).toHaveBeenCalledTimes(1);
    const image = unit.querySelector<HTMLElement>('.journey-beach-island-art')!;
    expect(Number.parseFloat(image.style.left)).toBeCloseTo(38);
    expect(Number.parseFloat(image.style.width)).toBeCloseTo(195);
    expect(Number.parseFloat(unit.style.top) + Number.parseFloat(image.style.top) + 30).toBeCloseTo(438);
    expect(image.style.opacity).toBe('0.8');
  });

  it('does not partially mutate a World when any final Unit image is unready', () => {
    const { root } = fixture();
    Object.defineProperty(root.querySelectorAll('img')[29], 'complete', { value: false });
    const before = root.innerHTML;
    expect(compileJourneyUnitScene(root, 2)).toBe(false);
    expect(root.innerHTML).toBe(before);
  });

  it('is idempotent and survives a retained-surface child transfer without a second build', () => {
    const { root } = fixture();
    expect(compileJourneyUnitScene(root, 2)).toBe(true);
    const unit = getJourneySceneUnit(root, 11);
    const html = root.innerHTML;
    expect(compileJourneyUnitScene(root, 2)).toBe(true);
    expect(root.innerHTML).toBe(html);
    const liveRoot = document.createElement('div');
    liveRoot.replaceChildren(...Array.from(root.children));
    document.body.append(liveRoot);
    expect(getJourneySceneUnit(liveRoot, 11)).toBe(unit);
    expect(compileJourneyUnitScene(liveRoot, 2)).toBe(false);
    liveRoot.remove();
  });

  it('keeps replacement presentation in the same local card pose', () => {
    const { root } = fixture();
    compileJourneyUnitScene(root, 2);
    const previous = root.querySelector<HTMLElement>('.journey-board-card-wrapper')!;
    const replacement = document.createElement('div');
    replacement.style.top = '9999px';
    preserveJourneySceneCardPlacement(previous, replacement);
    expect(replacement.style.top).toBe(previous.style.top);
    expect(replacement.style.left).toBe(previous.style.left);
    previous.replaceWith(replacement);
    expect(getJourneySceneUnit(root, 11)!.contains(replacement)).toBe(true);
  });

  it('leaves other Worlds and malformed geometry untouched', () => {
    const { root, cards } = fixture();
    const html = root.innerHTML;
    expect(compileJourneyUnitScene(root, 1)).toBe(false);
    expect(root.innerHTML).toBe(html);
    cards.style.top = '';
    const malformed = root.innerHTML;
    expect(compileJourneyUnitScene(root, 2)).toBe(false);
    expect(root.innerHTML).toBe(malformed);
  });
});
