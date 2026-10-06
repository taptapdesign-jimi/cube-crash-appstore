import fs from 'node:fs';
import ts from 'typescript';

const source = ts.createSourceFile('ui-manager.ts', fs.readFileSync('src/modules/ui-manager.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const owner = source.statements.find((n): n is ts.ClassDeclaration => ts.isClassDeclaration(n) && n.name?.text === 'UIManager')!;
const method = owner.members.find(n => ts.isMethodDeclaration(n) && n.name.getText(source) === 'showSettingsScreenWithAnimation')!;
const code = ts.transpileModule(`return class { ${method.getText(source)} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture() {
  document.body.innerHTML = '<section id="settings-screen" hidden><div class="settings-header"></div></section>';
  let zone = 'home'; let epoch = 1;
  const appZoneManager = { getCurrentZone: () => zone, getPresentationEpoch: () => epoch,
    setZone: () => { zone = 'settings'; epoch++; },
    isPresentationCurrent: (e: number, z: string) => e === epoch && z === zone };
  const screen = document.getElementById('settings-screen')!;
  const enter = jest.fn(() => {
    expect(screen.style.opacity).toBe('0');
    expect(screen.hidden).toBe(false);
    screen.querySelector<HTMLElement>('.settings-header')!.style.opacity = '0';
  });
  const noop = jest.fn();
  const dependencies = { appZoneManager, emitSettingsRouteDiagnostic: noop,
    homepageEnterTransitionOwner: { cancel: noop, isActive: () => false },
    sliderState: { isAnimatingEnter: false }, sliderManager: { getCurrentSlide: () => 2, syncHiddenSlideState: noop },
    gameState: { get: noop, set: noop }, cancelSliderEnterAnimation: noop,
    applyPaperBackground: noop, clearSliderBackgrounds: noop, logger: { info: noop, warn: noop, error: noop },
    SETTINGS_SLIDE_INDEX: 2, gsap: {}, animateSliderExit: () => Promise.resolve(),
    isHomepageExitCancelled: () => false, finalizeJourneySliderExit: noop, animateSettingsScreenEnter: enter };
  const Delegate = new Function(...Object.keys(dependencies), code)(...Object.values(dependencies));
  const delegate = new Delegate();
  Object.assign(delegate, { elements: { settingsScreen: screen }, cancelSettingsEnterTimeouts: noop,
    hideHomepage: noop, setNavigationVisibility: noop, setupSettingsToggles: noop,
    settingsBackGlobalHandlerInstalled: true, settingsEnterTimeouts: new Set(), boundEventHandlers: new Map() });
  return { delegate, screen, enter, replace: () => { zone = 'home'; epoch++; } };
}

beforeEach(() => { jest.useFakeTimers(); jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });

test.each([false, true])('Settings primes before reveal without a delayed reset, native=%s', async native => {
  const f = fixture();
  f.delegate.showSettingsScreenWithAnimation(native);
  f.delegate.showSettingsScreenWithAnimation(native);
  await Promise.resolve();
  expect(f.enter).toHaveBeenCalledTimes(1);
  expect(f.screen.style.opacity).toBe('1');
  jest.advanceTimersByTime(60);
  expect(f.enter).toHaveBeenCalledTimes(1);
});

test('replaced Settings exit completion cannot mount or replay the old route', async () => {
  const f = fixture();
  f.delegate.showSettingsScreenWithAnimation(true);
  f.replace();
  await Promise.resolve();
  expect(f.screen.hidden).toBe(true);
  expect(f.enter).not.toHaveBeenCalled();
});
