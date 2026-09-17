import fs from 'node:fs';
import ts from 'typescript';

function parse(path: string) { return ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true); }
function compile(code: string) { return ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText; }

const boards = parse('src/modules/journey-boards-manager.ts');
let logMethod!: ts.MethodDeclaration;
function findMethod(node: ts.Node) {
  if (ts.isMethodDeclaration(node) && node.name.getText(boards) === 'logJourneyV700Flow') logMethod = node;
  ts.forEachChild(node, findMethod);
}
findMethod(boards);

test.each([false, true])('actual flow logger builds snapshots only with detailed diagnostics=%s', (enabled) => {
  const logger = { info: jest.fn() };
  const owner = { getJourneyV700FlowSnapshot: jest.fn(() => ({ visibleTargetCount: 12 })) };
  const body = compile(`function run(label, data = {}, container) ${logMethod.body!.getText(boards)}`);
  const run = new Function('areDetailedRuntimeDiagnosticsEnabled', 'logger', `${body}; return run;`)(() => enabled, logger);
  const container = document.createElement('div');
  run.call(owner, 'hub-visible-enter-start', { source: 'homepage' }, container);
  expect(owner.getJourneyV700FlowSnapshot).toHaveBeenCalledTimes(enabled ? 1 : 0);
  expect(logger.info).toHaveBeenCalledTimes(enabled ? 1 : 0);
  if (enabled) expect(logger.info).toHaveBeenCalledWith('🧭 JourneyV700Flow', expect.objectContaining({ label: 'hub-visible-enter-start', source: 'homepage', visibleTargetCount: 12 }));
});

const collectibles = parse('src/collectibles-manager.ts');
const diagnosticBlocks: ts.IfStatement[] = [];
const messages = ['🧭 JourneyForestAnim pre-reveal-boards-ready', '🧭 JourneyForestAnim collectibles-boards-ready'];
function findBlocks(node: ts.Node) {
  if (ts.isCallExpression(node) && node.expression.getText(collectibles) === 'logger.info'
    && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && messages.includes(node.arguments[0].text)) {
    const statement = node.parent;
    const block = statement.parent;
    if (ts.isBlock(block) && ts.isIfStatement(block.parent)) diagnosticBlocks.push(block.parent);
  }
  ts.forEachChild(node, findBlocks);
}
findBlocks(collectibles);

test.each([false, true])('both actual reveal diagnostic blocks avoid readiness traversal unless detailed=%s', (enabled) => {
  expect(diagnosticBlocks).toHaveLength(2);
  for (const block of diagnosticBlocks) {
    const readiness = jest.fn(() => true);
    const logger = { info: jest.fn() };
    new Function('areDetailedRuntimeDiagnosticsEnabled', 'isJourneyViewStructurallyPrepared', 'logger', 'journeyContainer', compile(block.getText(collectibles)))(() => enabled, readiness, logger, {});
    expect(readiness).toHaveBeenCalledTimes(enabled ? 1 : 0);
    expect(logger.info).toHaveBeenCalledTimes(enabled ? 1 : 0);
  }
});
