import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Execute the actual public owner method with its expensive board operation
// injected, so a cold import can remain unresolved across repeated gestures.
const source = ts.createSourceFile('ui-manager.ts', fs.readFileSync(path.resolve('src/modules/ui-manager.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
const owner = source.statements.find((node): node is ts.ClassDeclaration => ts.isClassDeclaration(node) && node.name?.text === 'UIManager')!;
const method = owner.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === 'startNewGame')!;
const code = ts.transpileModule(`return class { freshGameStartPromise = null; ${method.getText(source)} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const Entry = new Function(code)() as new () => { startNewGame(): Promise<void>; startNewGameOwned: () => Promise<void> };

test.each([false, true])('cold entry coalesces repeated calls and releases after failure=%s', async fail => {
  const entry = new Entry();
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const pending = new Promise<void>((done, failed) => { resolve = done; reject = failed; });
  entry.startNewGameOwned = jest.fn(() => pending);
  const first = entry.startNewGame();
  const second = entry.startNewGame();
  expect(entry.startNewGameOwned).toHaveBeenCalledTimes(1);
  const settled = Promise.allSettled([first, second]);
  if (fail) reject(new Error('module load failed')); else resolve();
  expect((await settled).map(result => result.status)).toEqual([fail ? 'rejected' : 'fulfilled', fail ? 'rejected' : 'fulfilled']);
  entry.startNewGameOwned = jest.fn(async () => {});
  await entry.startNewGame();
  expect(entry.startNewGameOwned).toHaveBeenCalledTimes(1);
});
