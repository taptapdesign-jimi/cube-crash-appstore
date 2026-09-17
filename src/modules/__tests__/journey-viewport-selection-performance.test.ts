import fs from 'node:fs';
import ts from 'typescript';

// Execute the production selector without loading unrelated animation runtimes.
const source = ts.createSourceFile('collectibles-animations.ts', fs.readFileSync('src/ui/collectibles-animations.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const names = new Set(['isElementViewportVisible', 'selectJourneyViewportTransitionTargets']);
const functions = source.statements.filter((node) => ts.isFunctionDeclaration(node) && names.has(node.name?.text || '')).map((node) => node.getText(source)).join('\n');
const compiled = ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const select = new Function('document', 'window', 'getActiveJourneyBoardAreaId', 'isActiveJourneyAreaElement', `
const JOURNEY_VIEWPORT_EXIT_SELECTOR = '.target';
const JOURNEY_VIEWPORT_EXIT_MARGIN_PX = 300;
const JOURNEY_VIEWPORT_EXIT_MAX_TARGETS = 64;
${compiled}
return selectJourneyViewportTransitionTargets;
`)(document, window, () => 8, (element: HTMLElement) => element.dataset.active === 'true') as (root: HTMLElement, opts: { excludeActiveArea: boolean; includeHiddenPrepared: boolean }) => HTMLElement[];

function target(root: HTMLElement, top: number, options: { hidden?: boolean; prepared?: boolean; active?: boolean; width?: number } = {}) {
  const el = document.createElement('div');
  el.className = 'target';
  if (options.hidden) el.style.visibility = 'hidden';
  if (options.prepared) el.dataset.ccJourneyEnterPrepared = 'true';
  if (options.active) el.dataset.active = 'true';
  root.appendChild(el);
  const width = options.width ?? 100;
  const read = jest.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top, bottom: top + 20, left: 0, right: width, width, height: 20 } as DOMRect);
  return { el, read };
}

beforeEach(() => { document.body.innerHTML = '<section id="root"></section>'; });

test('keeps center-distance ordering and stable equal-distance order with one geometry read per candidate', () => {
  const root = document.getElementById('root')!;
  const center = window.innerHeight / 2;
  const fixtures = [120, -30, 0, 30, -120].map((offset) => target(root, center - 10 + offset));
  expect(select(root, { excludeActiveArea: false, includeHiddenPrepared: true })).toEqual([fixtures[2].el, fixtures[1].el, fixtures[3].el, fixtures[0].el, fixtures[4].el]);
  fixtures.forEach(({ read }) => expect(read).toHaveBeenCalledTimes(1));
});

test('preserves prepared-hidden, active-area, viewport and empty geometry eligibility', () => {
  const root = document.getElementById('root')!;
  const prepared = target(root, 10, { hidden: true, prepared: true });
  const hidden = target(root, 20, { hidden: true });
  const active = target(root, 30, { active: true });
  const outside = target(root, -400);
  const empty = target(root, 30, { width: 0 });
  expect(select(root, { excludeActiveArea: true, includeHiddenPrepared: true })).toEqual([prepared.el]);
  expect(active.read).not.toHaveBeenCalled();
  [prepared, hidden, outside, empty].forEach(({ read }) => expect(read).toHaveBeenCalledTimes(1));
  expect(select(root, { excludeActiveArea: false, includeHiddenPrepared: false })).toEqual([active.el]);
});

test('retains the 64 nearest targets without extra sort-time geometry reads', () => {
  const root = document.getElementById('root')!;
  const fixtures = Array.from({ length: 100 }, (_, index) => target(root, window.innerHeight / 2 - 10 + index));
  expect(select(root, { excludeActiveArea: false, includeHiddenPrepared: true })).toEqual(fixtures.slice(0, 64).map(({ el }) => el));
  fixtures.forEach(({ read }) => expect(read).toHaveBeenCalledTimes(1));
});
