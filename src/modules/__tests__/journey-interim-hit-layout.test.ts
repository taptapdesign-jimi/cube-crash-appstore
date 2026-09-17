import fs from 'node:fs';
import ts from 'typescript';

const source = ts.createSourceFile('manager.ts', fs.readFileSync('src/modules/journey-boards-manager.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const owner = source.statements.find((n): n is ts.ClassDeclaration => ts.isClassDeclaration(n) && n.name?.text === 'JourneyBoardsManager')!;
const method = owner.members.find(n => ts.isMethodDeclaration(n) && n.name.getText(source) === 'installInterimAreaHitTargets')!;
const compiled = ts.transpileModule(`class Harness { ${method.getText(source)} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const Harness = new Function('logger', `${compiled}; return Harness;`)({ warn: jest.fn() });

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
  const append = container.appendChild.bind(container);
  jest.spyOn(container, 'appendChild').mockImplementation((node: any) => { operations.push('append'); return append(node); });
  return { instance, container, operations, baseRead, handlers };
}
afterEach(() => { jest.restoreAllMocks(); document.body.innerHTML = ''; });

test('actual hit target installation batches all layout reads before connected DOM writes', () => {
  const f = fixture(); f.instance.installInterimAreaHitTargets(f.container);
  expect(f.baseRead).toHaveBeenCalledTimes(1);
  expect(f.operations).toEqual(['read-container', 'read-area-0', 'read-area-1', 'remove-old', 'append']);
  const targets = f.container.querySelectorAll<HTMLElement>('.journey-interim-area-hit-target');
  expect(targets).toHaveLength(2);
  expect([targets[0].style.left, targets[0].style.top, targets[0].style.width, targets[0].style.height]).toEqual(['20px', '40px', '100px', '120px']);
  targets[0].click(); expect(f.handlers[0]).toHaveBeenCalledTimes(1); expect(f.handlers[1]).not.toHaveBeenCalled();
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
