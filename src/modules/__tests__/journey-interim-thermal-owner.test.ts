import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const source = fs.readFileSync(path.resolve(__dirname, '../journey-boards-manager.ts'), 'utf8');
const methods = source.slice(source.indexOf('  private refreshInterimViewportEffects(): void {'), source.indexOf('  private canRunJourneyInterimLocalEffects('));
const js = ts.transpileModule(`class Probe { ${methods} }`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const smoke = { cleanupSmokeEffects: jest.fn() };
const Probe = new Function('JOURNEY_CARD_IDLE_BOUNCE', `${js}; return Probe;`)(smoke);

test('actual interim refresh pauses recurring motion and shine, then restores the same owners once', () => {
  document.body.innerHTML = '<div class="journey-board-card-wrapper"><div class="journey-board-card interim"></div></div>';
  const card = document.querySelector('.journey-board-card') as HTMLElement;
  let paused = false;
  let shining = true;
  const timeline = { paused: () => paused, pause: jest.fn(() => { paused = true; }), resume: jest.fn(() => { paused = false; }) };
  (card.parentElement as any)._interimBounceTimeline = timeline;
  const shine = { pause: jest.fn(() => { shining = false; }), resume: jest.fn(() => { shining = true; }), isRunning: () => shining };
  const owner = new Probe();
  let admitted = true;
  Object.assign(owner, {
    interimIdleEffectsCard: card, interimShineController: shine,
    canRunJourneyInterimLocalEffects: () => admitted && !owner.interimThermalTestSuspended,
    startInterimBounce: jest.fn(),
  });
  const release = owner.suspendInterimForThermalTest();
  expect(paused).toBe(true); expect(shining).toBe(false);
  expect(smoke.cleanupSmokeEffects).toHaveBeenCalledWith(card);
  release(); release();
  expect(timeline.resume).toHaveBeenCalledTimes(1);
  expect(shining).toBe(true);
  expect(owner.startInterimBounce).not.toHaveBeenCalled();
  const releaseAfterExit = owner.suspendInterimForThermalTest();
  admitted = false;
  releaseAfterExit();
  expect(timeline.resume).toHaveBeenCalledTimes(1);
  expect(shining).toBe(false);
  document.body.innerHTML = '';
});
