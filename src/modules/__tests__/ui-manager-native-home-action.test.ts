import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Execute the real delegate with existing CTA handlers injected; do not boot a
// second gameplay runtime merely to prove dispatch and input admission.
const source = ts.createSourceFile('ui-manager.ts', fs.readFileSync(path.resolve('src/modules/ui-manager.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
const owner = source.statements.find((node): node is ts.ClassDeclaration => ts.isClassDeclaration(node) && node.name?.text === 'UIManager')!;
const method = owner.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === 'activateNativeHomepageAction')!;
const code = ts.transpileModule(`return class { ${method.getText(source)} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture() {
  const zone = { getCurrentZone: jest.fn(() => 'home') };
  const state = { get: jest.fn(() => false) };
  const Delegate = new Function('appZoneManager', 'gameState', code)(zone, state);
  const delegate = new Delegate();
  Object.assign(delegate, { isInitialized: true, elements: { home: document.createElement('section'), settingsScreen: document.createElement('section') },
    handlePlayClick: jest.fn(async () => {}), handleSettingsClick: jest.fn(), handleStatsClick: jest.fn() });
  return { delegate, zone, state };
}

test.each(['arcade', 'settings', 'journey'] as const)('native %s dispatches exactly the existing authored handler without synthesizing a click', async action => {
  const f = fixture();
  expect(await f.delegate.activateNativeHomepageAction(action)).toBe(true);
  expect(f.delegate.handlePlayClick).toHaveBeenCalledTimes(action === 'arcade' ? 1 : 0);
  expect(f.delegate.handleSettingsClick).toHaveBeenCalledTimes(action === 'settings' ? 1 : 0);
  expect(f.delegate.handleStatsClick).toHaveBeenCalledTimes(action === 'journey' ? 1 : 0);
});

test.each(['uninitialized', 'wrong-zone', 'locked', 'hidden', 'missing-settings'])('native action rejects unsafe source: %s', async condition => {
  const f = fixture();
  if (condition === 'uninitialized') f.delegate.isInitialized = false;
  if (condition === 'wrong-zone') f.zone.getCurrentZone.mockReturnValue('board-arcade');
  if (condition === 'locked') f.state.get.mockReturnValue(true);
  if (condition === 'hidden') f.delegate.elements.home.hidden = true;
  if (condition === 'missing-settings') f.delegate.elements.settingsScreen = null;
  expect(await f.delegate.activateNativeHomepageAction('settings')).toBe(false);
  expect(f.delegate.handlePlayClick).not.toHaveBeenCalled();
  expect(f.delegate.handleSettingsClick).not.toHaveBeenCalled();
});
