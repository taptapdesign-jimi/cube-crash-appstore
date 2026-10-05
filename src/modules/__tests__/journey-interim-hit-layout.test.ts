import fs from 'node:fs';
import ts from 'typescript';
import { getJourneySceneUnit } from '../journey-unit-scene';

const source = ts.createSourceFile('manager.ts', fs.readFileSync('src/modules/journey-boards-manager.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const owner = source.statements.find((n): n is ts.ClassDeclaration => ts.isClassDeclaration(n) && n.name?.text === 'JourneyBoardsManager')!;
const members = owner.members.filter(n => (ts.isMethodDeclaration(n) || ts.isPropertyDeclaration(n)) && [
  'installInterimAreaHitTargets', 'getJourneyInterimHitLayout', 'canReuseJourneyInterimHitTargets',
  'getJourneyInterimHitScenery', 'journeyInterimHitTargets', 'playJourneyV700WorldEnterFromReturn',
].includes(n.name!.getText(source)));
const compiled = ts.transpileModule(`class Harness { ${members.map(n => n.getText(source)).join('\n')} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const spans: any[] = [];
const viewportWidthDescriptor = Object.getOwnPropertyDescriptor(window, 'innerWidth')!;
const Harness = new Function('logger', 'beginTransitionPerformance', 'getJourneySceneUnit', `${compiled}; return Harness;`)(
  { warn: jest.fn() }, () => {
    const span = { phase: jest.fn((_name: string, work: () => unknown) => work()), finish: jest.fn() };
    spans.push(span); return span;
  },
  getJourneySceneUnit,
);

function fixture() {
  document.body.innerHTML = '<div id="cards"><div class="journey-interim-area-hit-target"></div></div>';
  const container = document.getElementById('cards')!;
  const operations: string[] = [];
  const rect = (left: number, top: number, width: number, height: number) => ({ left, top, right: left + width, bottom: top + height, width, height } as DOMRect);
  const baseRead = jest.spyOn(container, 'getBoundingClientRect').mockImplementation(() => { operations.push('read-container'); return rect(10, 20, 400, 900); });
  const old = container.firstElementChild!;
  const oldRemove = old.remove.bind(old);
  jest.spyOn(old, 'remove').mockImplementation(() => { operations.push('remove-old'); oldRemove(); });
  const handlers = [jest.fn(), jest.fn()];
  const areas = handlers.map((handler, i) => {
    const wrapper = document.createElement('div'); wrapper.className = 'journey-board-card-wrapper';
    (wrapper as any)._journeyInterimTapHandler = handler;
    wrapper.innerHTML = `<div class="journey-board-card interim" data-board-id="${i + 1}"></div>`;
    container.appendChild(wrapper);
    const area = document.createElement('div');
    area.getBoundingClientRect = () => { operations.push(`read-area-${i}`); return rect(30 + i * 40, 60, 100, 120); };
    return [area];
  });
  const instance = new Harness(); instance.getJourneyAreaElements = (id: number) => areas[id - 1];
  instance.journeyV700Phase = 'idle';
  const append = container.appendChild.bind(container);
  jest.spyOn(container, 'appendChild').mockImplementation((node: any) => { operations.push('append'); return append(node); });
  return { instance, container, operations, baseRead, handlers };
}
afterEach(() => {
  jest.restoreAllMocks(); Object.defineProperty(window, 'innerWidth', viewportWidthDescriptor);
  document.body.innerHTML = ''; spans.length = 0;
});

test('actual hit target installation batches all layout reads before connected DOM writes', () => {
  const f = fixture(); f.instance.installInterimAreaHitTargets(f.container);
  expect(f.baseRead).toHaveBeenCalledTimes(1);
  expect(f.operations).toEqual(['read-container', 'read-area-0', 'read-area-1', 'remove-old', 'append']);
  const targets = f.container.querySelectorAll<HTMLElement>('.journey-interim-area-hit-target');
  expect(targets).toHaveLength(2);
  expect([targets[0].style.left, targets[0].style.top, targets[0].style.width, targets[0].style.height]).toEqual(['20px', '40px', '100px', '120px']);
  targets[0].click(); expect(f.handlers[0]).toHaveBeenCalledTimes(1); expect(f.handlers[1]).not.toHaveBeenCalled();
});

test('scene motion bounds never become a full-width interim input blocker', () => {
  const f = fixture();
  const wrapper = f.container.querySelector<HTMLElement>('.journey-board-card-wrapper')!;
  const root = document.createElement('div');
  root.className = 'journey-scene-unit'; root.dataset.boardId = '1';
  f.container.append(root); root.append(wrapper);
  const rootRead = jest.spyOn(root, 'getBoundingClientRect');
  const scenery = document.createElement('img'); root.append(scenery);
  const rect = { left: 30, top: 60, right: 130, bottom: 180, width: 100, height: 120 } as DOMRect;
  jest.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue(rect);
  jest.spyOn(scenery, 'getBoundingClientRect').mockReturnValue(rect);
  f.instance.installInterimAreaHitTargets(f.container);
  const target = f.container.querySelector<HTMLElement>('.journey-interim-area-hit-target[data-board-id="1"]')!;
  expect([target.style.left, target.style.top, target.style.width, target.style.height]).toEqual(['20px', '40px', '100px', '120px']);
  expect(rootRead).not.toHaveBeenCalled();
  target.click(); expect(f.handlers[0]).toHaveBeenCalledTimes(1);
});

test('actual replacement keeps drag suppression and skips geometry when no eligible interim exists', () => {
  const f = fixture(); f.instance.installInterimAreaHitTargets(f.container);
  const target = f.container.querySelector('.journey-interim-area-hit-target')!;
  const touch = (type: string, x: number) => { const event = new Event(type); Object.defineProperty(event, 'touches', { value: [{ clientX: x, clientY: 0 }] }); target.dispatchEvent(event); };
  touch('touchstart', 0); touch('touchmove', 20); touch('touchend', 20);
  expect(f.handlers[0]).not.toHaveBeenCalled();
  f.container.querySelectorAll('.journey-board-card').forEach(card => card.classList.remove('interim'));
  f.baseRead.mockClear(); f.instance.installInterimAreaHitTargets(f.container);
  expect(f.baseRead).not.toHaveBeenCalled(); expect(f.container.querySelectorAll('.journey-interim-area-hit-target')).toHaveLength(0);
});

test('retained receipt validates exact nodes and layout without any rectangle reads', () => {
  const f = fixture(); f.instance.installInterimAreaHitTargets(f.container);
  const originalTargets = Array.from(f.container.querySelectorAll('.journey-interim-area-hit-target'));
  f.operations.length = 0;
  expect(f.instance.canReuseJourneyInterimHitTargets(f.container)).toBe(true);
  expect(f.instance.canReuseJourneyInterimHitTargets(f.container)).toBe(true);
  expect(f.operations).toEqual([]);
  expect(Array.from(f.container.querySelectorAll('.journey-interim-area-hit-target'))).toEqual(originalTargets);
  originalTargets[0].dispatchEvent(new MouseEvent('click'));
  expect(f.handlers[0]).toHaveBeenCalledTimes(1);
  const wrapper = f.container.querySelector<HTMLElement>('.journey-board-card-wrapper')!;
  wrapper.style.top = '200px';
  expect(f.instance.canReuseJourneyInterimHitTargets(f.container)).toBe(false);
});

test('changed wrapper, handler, viewport, or unsettled receipt cannot reuse an old target', () => {
  const f = fixture(); f.instance.installInterimAreaHitTargets(f.container);
  const wrapper = f.container.querySelector<HTMLElement>('.journey-board-card-wrapper')!;
  (wrapper as any)._journeyInterimTapHandler = jest.fn();
  expect(f.instance.canReuseJourneyInterimHitTargets(f.container)).toBe(false);
  (wrapper as any)._journeyInterimTapHandler = f.handlers[0];
  const receipt = f.instance.journeyInterimHitTargets.get(f.container);
  receipt.viewportWidth += 1;
  expect(f.instance.canReuseJourneyInterimHitTargets(f.container)).toBe(false);
  receipt.viewportWidth -= 1; receipt.settled = false;
  expect(f.instance.canReuseJourneyInterimHitTargets(f.container)).toBe(false);
  receipt.settled = true;
  const replacement = wrapper.cloneNode(true) as HTMLElement;
  (replacement as any)._journeyInterimTapHandler = f.handlers[0];
  wrapper.replaceWith(replacement);
  expect(f.instance.canReuseJourneyInterimHitTargets(f.container)).toBe(false);
});

test('scenery replacement or authored layout changes invalidate receipt without reading rectangles', () => {
  const f = fixture();
  const scenery = document.createElement('div'); scenery.dataset.journeyAreaId = 'board-1';
  scenery.style.top = '10%'; f.container.appendChild(scenery);
  const rect = jest.spyOn(scenery, 'getBoundingClientRect');
  f.instance.installInterimAreaHitTargets(f.container);
  f.operations.length = 0;
  expect(f.instance.canReuseJourneyInterimHitTargets(f.container)).toBe(true);
  scenery.style.top = '11%';
  expect(f.instance.canReuseJourneyInterimHitTargets(f.container)).toBe(false);
  scenery.style.top = '10%';
  expect(f.instance.canReuseJourneyInterimHitTargets(f.container)).toBe(true);
  scenery.replaceWith(scenery.cloneNode(true));
  expect(f.instance.canReuseJourneyInterimHitTargets(f.container)).toBe(false);
  expect(f.operations).toEqual([]); expect(rect).not.toHaveBeenCalled();
});

function returnFixture() {
  const f = fixture();
  f.container.className = 'journey-cards-container';
  const world = document.createElement('div'); world.id = 'journey-boards-container';
  world.dataset.journeyV700View = 'world';
  f.container.replaceWith(world); world.appendChild(f.container);
  Object.assign(f.instance, {
    journeyV700WorldId: 2, journeyV700View: 'world', renderLifecycleGeneration: 4,
    journeyV700WorldMotionEpoch: 1, renderDisposed: false,
    resumeForVisibleWorldReturn: jest.fn(), reconcileMountedJourneyWorldCardUnits: jest.fn(),
    installJourneyScreenElasticOverscroll: jest.fn(), setupIdleInteractionListeners: jest.fn(),
    trackRAF: jest.fn(),
    journeyV700PreparedWorldEnter: { worldId: 2, renderGeneration: 4, targets: [f.container], reusedRetainedSurface: true },
  });
  let finish!: () => void;
  f.instance.playJourneyV700WorldEnter = jest.fn(() => {
    f.instance.journeyV700WorldMotionEpoch += 1;
    f.instance.journeyV700Phase = 'entering';
    return new Promise<void>(resolve => { finish = () => { f.instance.journeyV700Phase = 'idle'; resolve(); }; });
  });
  return { ...f, finish: () => finish() };
}

test('actual return reuses settled nodes and does not schedule a first-frame hit rebuild', async () => {
  const f = returnFixture(); f.instance.installInterimAreaHitTargets(f.container);
  const target = f.container.querySelector('.journey-interim-area-hit-target');
  f.operations.length = 0;
  f.instance.playJourneyV700WorldEnterFromReturn('game-return');
  f.instance.trackRAF.mock.calls.forEach(([callback]: [() => void]) => callback());
  expect(f.operations).toEqual([]);
  f.finish(); await Promise.resolve();
  expect(f.container.querySelector('.journey-interim-area-hit-target')).toBe(target);
  expect(spans[0].finish).toHaveBeenCalledWith('retained-targets-reused');
  f.instance.playJourneyV700WorldEnterFromReturn('game-return-again');
  f.finish(); await Promise.resolve();
  expect(f.operations).toEqual([]);
  expect(f.container.querySelector('.journey-interim-area-hit-target')).toBe(target);
  expect(spans[1].finish).toHaveBeenCalledWith('retained-targets-reused');
  target!.dispatchEvent(new MouseEvent('click'));
  expect(f.handlers[0]).toHaveBeenCalledTimes(1);
});

test.each([false, true])('changed return refreshes only after settled enter; stale=%s', async stale => {
  const f = returnFixture(); f.instance.installInterimAreaHitTargets(f.container);
  const target = f.container.querySelector<HTMLElement>('.journey-interim-area-hit-target')!;
  const wrapper = f.container.querySelector<HTMLElement>('.journey-board-card-wrapper')!;
  (wrapper as any)._journeyInterimTapHandler = jest.fn();
  f.operations.length = 0;
  f.instance.playJourneyV700WorldEnterFromReturn('game-return');
  f.instance.trackRAF.mock.calls.forEach(([callback]: [() => void]) => callback());
  expect(f.operations).toEqual([]);
  expect(target.style.pointerEvents).toBe('none');
  if (stale) f.instance.renderLifecycleGeneration += 1;
  f.finish(); await Promise.resolve();
  if (stale) {
    expect(f.operations).toEqual([]);
    expect(f.container.querySelector('.journey-interim-area-hit-target')).toBe(target);
    expect(spans[0].finish).toHaveBeenCalledWith('stale-enter');
  } else {
    expect(f.container.querySelector('.journey-interim-area-hit-target')).not.toBe(target);
    expect(f.instance.canReuseJourneyInterimHitTargets(f.container)).toBe(true);
    expect(spans[0].finish).toHaveBeenCalledWith('settled-targets-installed');
  }
});

test('a resize during an initially reusable enter refreshes only after completion', async () => {
  const f = returnFixture(); f.instance.installInterimAreaHitTargets(f.container);
  const target = f.container.querySelector('.journey-interim-area-hit-target');
  f.operations.length = 0;
  f.instance.playJourneyV700WorldEnterFromReturn('game-return');
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 780 });
  expect(f.operations).toEqual([]);
  f.finish(); await Promise.resolve();
  expect(f.container.querySelector('.journey-interim-area-hit-target')).not.toBe(target);
  expect(f.instance.canReuseJourneyInterimHitTargets(f.container)).toBe(true);
  expect(spans[0].finish).toHaveBeenCalledWith('settled-targets-installed');
});

test.each(['motion', 'disposal', 'background-disposal'])('late reused completion cannot mutate after %s', async interruption => {
  const f = returnFixture(); f.instance.installInterimAreaHitTargets(f.container);
  const target = f.container.querySelector('.journey-interim-area-hit-target');
  f.operations.length = 0;
  f.instance.playJourneyV700WorldEnterFromReturn('game-return');
  f.container.style.width = '50%';
  if (interruption === 'motion') f.instance.journeyV700WorldMotionEpoch += 1;
  if (interruption === 'disposal' || interruption === 'background-disposal') f.instance.renderDisposed = true;
  if (interruption === 'background-disposal') jest.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  f.finish(); await Promise.resolve();
  expect(f.operations).toEqual([]);
  expect(f.container.querySelector('.journey-interim-area-hit-target')).toBe(target);
  expect(spans[0].finish).toHaveBeenCalledWith('stale-enter');
});

test('a still-owned completion while hidden leaves working hit targets for foreground', async () => {
  const f = returnFixture(); f.instance.installInterimAreaHitTargets(f.container);
  f.container.style.width = '50%';
  f.instance.playJourneyV700WorldEnterFromReturn('game-return');
  jest.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  f.finish(); await Promise.resolve();
  expect(f.instance.canReuseJourneyInterimHitTargets(f.container)).toBe(true);
  const target = f.container.querySelector<HTMLElement>('.journey-interim-area-hit-target')!;
  expect(target.style.pointerEvents).toBe('auto');
  target.click(); expect(f.handlers[0]).toHaveBeenCalledTimes(1);
  expect(spans[0].finish).toHaveBeenCalledWith('settled-targets-installed');
});
