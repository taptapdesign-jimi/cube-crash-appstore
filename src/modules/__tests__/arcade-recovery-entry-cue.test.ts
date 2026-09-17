/** @jest-environment jsdom */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const source = ts.createSourceFile('app-core.ts', fs.readFileSync(path.join(__dirname, '../app-core.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
const recovery = source.statements.find((n) => ts.isFunctionDeclaration(n) && n.name?.text === 'recoverFreshArcadeEntryAfterFailedLoad') as ts.FunctionDeclaration;
const rebuild = source.statements.find((n) => ts.isFunctionDeclaration(n) && n.name?.text === 'rebuildBoard') as ts.FunctionDeclaration;
const rebuildPrefix = rebuild.body!.statements.slice(0, rebuild.body!.statements.findIndex((n) => n.getText(source).startsWith('stopTileIdleBounce('))).map((n) => n.getText(source)).join('\n');
const runner = rebuild.body!.statements.find((n) => ts.isVariableStatement(n) && n.declarationList.declarations[0].name.getText(source) === 'sweetPopInRunner') as ts.VariableStatement;
const options = (runner.declarationList.declarations[0].initializer as ts.CallExpression).arguments[0] as ts.ObjectLiteralExpression;
const before = (options.properties.find((n) => n.name?.getText(source) === 'beforePopIn') as ts.PropertyAssignment).initializer.getText(source);
const js = (text: string) => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture(fail = false) {
  let consumedRound = 0; let beforePopIn: (() => Promise<void>) | undefined;
  const scope: Record<string, any> = {
    window: {}, stage: { eventMode: 'static' }, app: { canvas: {} }, boardNumber: 1, activeGameplayEntryGeneration: 0,
    isArcadeHomeRunMode: () => true, isGameplayEntryGenerationLatest: (n: number) => n === scope.activeGameplayEntryGeneration,
    cancelGameplayEntryPreparation: jest.fn(), cancelArcadeEntryCueOwner: jest.fn(),
    cancelArcadeEntrySurfaceGate: jest.fn(), engageArcadeEntrySurfaceGate: jest.fn(),
    consumeArcadeEntryCue: jest.fn(async (round: number) => { consumedRound = round; }),
    emitNativeConsoleDiagnostic: jest.fn(), devLog: jest.fn(), scheduleBoardPopInSafetyNet: jest.fn(),
  };
  scope.startLevel = async (round: number) => {
    scope.activeGameplayEntryGeneration++; scope.boardNumber = round;
    if (fail) throw new Error('entry failed');
    beforePopIn = new Function('scope', `with(scope) { ${js(`${rebuildPrefix}; const callback = ${before}; return callback;`)} }`)(scope);
  };
  const run = new Function('scope', `with(scope) { ${js(recovery.getText(source).replace(/^export /, ''))}; return recoverFreshArcadeEntryAfterFailedLoad; }`)(scope) as (round?: number, score?: number) => Promise<void>;
  return { scope, run, cue: () => beforePopIn, consumed: () => consumedRound };
}

test.each([1, 3])('failed saved-load recovery prepares exactly one Stage %i cue before tile entry', async (round) => {
  const f = fixture(); await f.run(round, 42);
  expect(f.cue()).toBeDefined();
  expect(f.scope.consumeArcadeEntryCue).not.toHaveBeenCalled();
  await f.cue()?.();
  expect(f.consumed()).toBe(round);
  expect(f.scope.consumeArcadeEntryCue).toHaveBeenCalledTimes(1);
  expect(f.scope.window.__ccArcadeContinuationCueRound).toBeUndefined();
});

test('failed replacement preparation retires its cue and surface gate', async () => {
  const f = fixture(true);
  await expect(f.run()).rejects.toThrow('entry failed');
  expect(f.scope.window.__ccArcadeContinuationCueRound).toBeUndefined();
  expect(f.scope.cancelArcadeEntryCueOwner).toHaveBeenCalledTimes(2);
});

test('retired failed preparation cannot cancel a newer Stage cue', async () => {
  const f = fixture();
  let reject!: (reason: Error) => void;
  f.scope.startLevel = () => {
    f.scope.activeGameplayEntryGeneration++;
    return new Promise<void>((_resolve, rejectEntry) => { reject = rejectEntry; });
  };
  const pending = f.run();
  f.scope.activeGameplayEntryGeneration++;
  f.scope.window.__ccArcadeContinuationCueRound = 5;
  reject(new Error('retired preparation'));
  await expect(pending).rejects.toThrow('retired preparation');
  expect(f.scope.window.__ccArcadeContinuationCueRound).toBe(5);
  expect(f.scope.cancelArcadeEntryCueOwner).toHaveBeenCalledTimes(1);
});
