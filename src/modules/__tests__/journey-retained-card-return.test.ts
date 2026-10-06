import fs from 'node:fs';
import ts from 'typescript';
import { preserveJourneySceneCardPlacement } from '../journey-unit-scene';
import { getJourneyCardOverlayReturnBoardId, markJourneyCardOverlayReturn, completeJourneyCardOverlayReturn } from '../journey-origin-state';

const source = fs.readFileSync('src/modules/journey-boards-manager.ts', 'utf8');
const parsed = ts.createSourceFile('manager.ts', source, ts.ScriptTarget.Latest, true);
const methods = new Map<string, ts.MethodDeclaration>();
function visit(node: ts.Node): void {
  if (ts.isMethodDeclaration(node)) methods.set(node.name.getText(parsed), node);
  ts.forEachChild(node, visit);
}
visit(parsed);
function bind(name: string, owner: any, scope: Record<string, unknown>) {
  const method = methods.get(name)!;
  const asyncPrefix = method.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword) ? 'async ' : '';
  const code = ts.transpileModule(`${asyncPrefix}function run(${method.parameters.map(parameter => parameter.getText(parsed)).join(',')}) ${method.body!.getText(parsed)}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function('scope', `with(scope){${code};return run;}`)(scope).bind(owner);
}

afterEach(() => { completeJourneyCardOverlayReturn(1); document.body.replaceChildren(); });

test.each(['regular-discarded', 'regular-resident', 'interim-resident'] as const)(
  'retained Forest %s card is present and normalized before its Unit is primed', async mode => {
    document.body.innerHTML = '<section id="journey-screen" hidden><div id="journey-boards-container" data-journey-v700-view="world" data-journey-v700-world-id="1"><div data-journey-area-id="forest-main"></div><div class="journey-cards-container"></div></div></section>';
    const container = document.getElementById('journey-boards-container')!;
    const cardsRoot = container.querySelector<HTMLElement>('.journey-cards-container')!;
    const boards = Array.from({ length: 10 }, (_, index) => ({ id: index + 1, unlocked: true, interim: index === 0 && mode === 'interim-resident' }));
    const presentation = (board: typeof boards[number]) => board.interim ? 'interim' : 'unlocked';
    const makeCard = (board: typeof boards[number]) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'journey-board-card-wrapper'; wrapper.dataset.boardId = String(board.id);
      wrapper.dataset.journeyAreaId = `board-${board.id}`;
      wrapper.innerHTML = `<div class="journey-board-card ${presentation(board)}" data-board-id="${board.id}"><img src="original-card-${board.id}.png"></div>`;
      return wrapper;
    };
    boards.forEach(board => cardsRoot.append(makeCard(board)));
    const previous = cardsRoot.firstElementChild as HTMLElement;
    const previousCard = previous.firstElementChild as HTMLElement;
    markJourneyCardOverlayReturn(1);
    expect(previousCard.classList.contains('journey-board-card-return-placeholder')).toBe(true);
    const unchanged = Array.from(cardsRoot.children).slice(1);
    if (mode === 'regular-discarded') previousCard.remove(); // Completed portal Play's origin.discard().
    else {
      previousCard.style.cssText = 'transform:scale(0);opacity:0;visibility:hidden';
      previousCard.classList.add('journey-card-tapping');
      (previous as any).__ccJourneyCardTapExitActive = true;
    }
    const scope = {
      gsap: { killTweensOf: jest.fn(), set: jest.fn((target: HTMLElement, vars: { clearProps?: string }) => {
        vars.clearProps?.split(',').forEach(property => target.style.removeProperty(property));
      }) },
      getJourneyWorldCardPresentation: presentation,
      preserveJourneySceneCardPlacement,
      restoreJourneyBoardCardBaseTransform: jest.fn(),
      emitIOSNativeDiagnostic: jest.fn(),
    };
    const owner: any = {
      boards, container, journeyV700View: 'world', journeyV700WorldId: 1,
      renderDisposed: false, renderLifecycleGeneration: 4,
      journeyTerminalReturnBuild: null, journeyGameplaySuspension: { surface: container },
      resumeForVisibleWorldReturn: jest.fn(), getJourneyWorldRange: () => ({ start: 1, end: 10 }),
      getJourneyV700AnimationUnits: () => Array.from(container.querySelectorAll<HTMLElement>('[data-journey-area-id]')).map(target => ({ id: target.dataset.journeyAreaId, targets: [target], clouds: [] })),
      stopInterimCardIdleEffects: jest.fn(), createBoardCardFixed: jest.fn(makeCard),
      refreshJourneyBoardCardArt: jest.fn(), updateJourneyV700Nav: jest.fn(),
      isJourneyV700TargetOwnedByRoot: (root: HTMLElement, target: HTMLElement) => root.contains(target),
      isJourneyCardTapExitProtectedTarget: (target: HTMLElement) => (target as any).__ccJourneyCardTapExitActive === true,
      getJourneyBoardCardVisualTarget: (target: HTMLElement) => target.querySelector('.journey-board-card') || target,
      renderJourneyWorldIncrementally: jest.fn(),
      primeJourneyV700WorldEnterIncrementally: jest.fn(async (_root, worldId, ownerToken) => {
        const card = cardsRoot.querySelector<HTMLElement>('.journey-board-card[data-board-id="1"]');
        expect(card).not.toBeNull();
        expect(card!.style.transform).toBe(''); expect(card!.style.opacity).toBe('');
        expect(card!.style.visibility).toBe(''); expect(card!.classList.contains('journey-card-tapping')).toBe(false);
        expect(card!.classList.contains('journey-board-card-return-placeholder')).toBe(false);
        expect(getJourneyCardOverlayReturnBoardId()).toBe(1); // Keep the later automatic reminder.
        // The exact wrapper carrying this card joins the complete board Unit,
        // before any visible-enter/idle callback is allowed to run.
        const units = owner.getJourneyV700AnimationUnits();
        expect(units.find(unit => unit.id === 'board-1').targets[0].contains(card)).toBe(true);
        return { worldId, ownerToken, renderGeneration: 4, units, targets: units.flatMap(unit => unit.targets) };
      }),
    };
    for (const name of ['isJourneyTerminalReturnBuildCurrent', 'reconcileMountedJourneyWorldCardUnits', 'restoreJourneyBoardCardVisualTarget', 'restoreJourneyRetainedReturnCardVisuals', 'prepareJourneyV700WorldEnterFromReturnIncrementally']) owner[name] = bind(name, owner, scope);
    expect(await owner.prepareJourneyV700WorldEnterFromReturnIncrementally('terminal-overlay:exit-game', 31)).toBe(true);
    expect(owner.createBoardCardFixed).toHaveBeenCalledTimes(mode === 'regular-discarded' ? 1 : 0);
    if (mode === 'regular-discarded') expect(owner.createBoardCardFixed).toHaveBeenCalledWith(boards[0], 0);
    else expect(cardsRoot.firstElementChild).toBe(previous);
    expect(Array.from(cardsRoot.children).slice(1)).toEqual(unchanged);
    expect(owner.renderJourneyWorldIncrementally).not.toHaveBeenCalled();
    expect(owner.primeJourneyV700WorldEnterIncrementally).toHaveBeenCalledTimes(1);
  },
);

test('Forest card 01 alone moves twelve pixels left without changing its Unit, top or authored rotation', () => {
  const offsetSource = source.slice(source.indexOf('const JOURNEY_BOARD_CARD_POSITION_OFFSETS_PX:'), source.indexOf('const ENABLE_INTERIM_CARD_IDLE_EFFECTS'));
  const compiled = ts.transpileModule(`${offsetSource}; function offset(id:number){return JOURNEY_BOARD_CARD_POSITION_OFFSETS_PX[id] ?? {x:0,y:0};}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const offset = new Function(`${compiled};return offset;`)();
  expect(offset(1)).toEqual({ x: -12, y: 0 });
  for (const id of [2, 3, 10, 11, 20, 22, 30]) expect(offset(id)).toEqual({ x: 0, y: 0 });
  expect(offset(21)).toEqual({ x: 0, y: 6 });
  expect(offset(23)).toEqual({ x: -4, y: 0 });
  expect(offset(24)).toEqual({ x: 6, y: 6 });
  const cardBuilder = methods.get('createBoardCardFixed')!.getText(parsed);
  const placement = cardBuilder.slice(cardBuilder.indexOf('    const position ='), cardBuilder.indexOf('    // Create card element'));
  const code = ts.transpileModule(`function place(board:{id:number},index:number){${placement};return cardWrapper;}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const scope = {
    CARD_POSITIONS: [{ x: 28 / 390 * 100, top: 10, rotation: -4, width: 90, height: 133 }],
    BASE_VIEWPORT_WIDTH: 390, FOREST_MAP_DESIGN_HEIGHT: 1472, FOREST_MAP_DESIGN_WIDTH: 390,
    STANDARD_CARD_WIDTH: 90, STANDARD_CARD_HEIGHT: 133,
    getJourneyBoardCardPositionOffsetPx: offset, getJourneyBoardUnitHorizontalOffsetPx: () => 0,
    setJourneyBoardCardBaseTransform: jest.fn(),
  };
  const place = new Function('scope', `with(scope){${code};return place;}`)(scope);
  const moved = place({ id: 1 }, 0);
  const reference = place({ id: 2 }, 0);
  expect(parseFloat(moved.style.left)).toBeCloseTo(parseFloat(reference.style.left) - 12);
  for (const property of ['top', 'transform', 'width', 'height']) expect(moved.style[property]).toBe(reference.style[property]);
});
