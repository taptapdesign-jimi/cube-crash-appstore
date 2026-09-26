import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { applyGameSoundsSettingToAudio } from '../gameplay-sound-settings';
import { stopAllDecodedGameplayVoices } from '../gameplay-audio-buffer-player';
import { stopRegisteredSfxOwners } from '../gameplay-sound-owner-registry';

jest.mock('../gameplay-audio-buffer-player', () => ({ stopAllDecodedGameplayVoices: jest.fn() }));
jest.mock('../gameplay-sound-owner-registry', () => ({ stopRegisteredSfxOwners: jest.fn(() => Promise.resolve()) }));

beforeEach(() => {
  (window as any)._settings = { gameSoundsEnabled: true };
  void applyGameSoundsSettingToAudio(true);
  jest.clearAllMocks();
});
afterEach(() => { delete (window as any)._settings; });

function setEnabled(enabled: boolean): Promise<void> {
  (window as any)._settings.gameSoundsEnabled = enabled;
  return applyGameSoundsSettingToAudio(enabled);
}

test('OFF retires decoded and queued voices synchronously before any lazy owner cleanup', async () => {
  const pending = setEnabled(false);
  expect(stopAllDecodedGameplayVoices).toHaveBeenCalledTimes(1);
  expect(stopRegisteredSfxOwners).toHaveBeenCalledTimes(1);
  expect(jest.mocked(stopAllDecodedGameplayVoices).mock.invocationCallOrder[0])
    .toBeLessThan(jest.mocked(stopRegisteredSfxOwners).mock.invocationCallOrder[0]);
  expect(jest.mocked(stopRegisteredSfxOwners).mock.calls[0][0]()).toBe(true);
  await pending;
});

test('OFF to ON invalidates a pending cleanup without starting or stopping newer audio', async () => {
  await setEnabled(false);
  const oldOwner = jest.mocked(stopRegisteredSfxOwners).mock.calls[0][0];
  await setEnabled(true);
  expect(oldOwner()).toBe(false);
  expect(stopAllDecodedGameplayVoices).toHaveBeenCalledTimes(1);
  expect(stopRegisteredSfxOwners).toHaveBeenCalledTimes(1);
});

test('OFF to ON to OFF cannot make an old cleanup generation current again', async () => {
  await setEnabled(false);
  const oldOwner = jest.mocked(stopRegisteredSfxOwners).mock.calls[0][0];
  await setEnabled(true);
  await setEnabled(false);
  expect(oldOwner()).toBe(false);
  expect(jest.mocked(stopRegisteredSfxOwners).mock.calls[1][0]()).toBe(true);
  (window as any)._settings.gameSoundsEnabled = true;
  expect(jest.mocked(stopRegisteredSfxOwners).mock.calls[1][0]()).toBe(false);
});

test('actual Settings handler commits and dispatches both OFF and ON to the generation owner', () => {
  const source = fs.readFileSync('src/modules/ui-manager.ts', 'utf8');
  const ast = ts.createSourceFile('ui-manager.ts', source, ts.ScriptTarget.Latest, true);
  let handlerSource: string | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'gameSoundsHandler') {
      handlerSource = node.initializer?.getText(ast);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  expect(handlerSource).toBeDefined();
  const dispatched: Array<{ enabled: boolean; committed: boolean }> = [];
  const settings = { gameSoundsEnabled: true };
  const context = {
    window: { _settings: settings }, document: { getElementById: () => null },
    console: { log: () => {} }, playSettingsToggleBounce: () => {},
    applyGameSoundsSettingToAudio: (enabled: boolean) => {
      dispatched.push({ enabled, committed: settings.gameSoundsEnabled });
      return Promise.resolve();
    },
    handler: undefined as unknown as (event: { target: { checked: boolean } }) => void,
  };
  vm.runInNewContext(ts.transpileModule(`globalThis.handler = ${handlerSource};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText, context);
  context.handler({ target: { checked: false } });
  context.handler({ target: { checked: true } });
  expect(dispatched).toEqual([{ enabled: false, committed: false }, { enabled: true, committed: true }]);
});
