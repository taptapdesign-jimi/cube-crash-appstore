import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
function imports(file, includeDynamic = false) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const dependencies = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
    if (statement.isTypeOnly || statement.importClause?.isTypeOnly || !statement.moduleSpecifier) continue;
    const clause = statement.importClause;
    if (clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings)
      && clause.namedBindings.elements.length && clause.namedBindings.elements.every(item => item.isTypeOnly)) continue;
    dependencies.push(statement.moduleSpecifier.text);
  }
  if (includeDynamic) {
    const visit = node => {
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
        && node.arguments.length && ts.isStringLiteral(node.arguments[0])) dependencies.push(node.arguments[0].text);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return dependencies.filter(value => value.startsWith('.')).map(value => {
    const base = path.resolve(path.dirname(file), value);
    const resolved = [base, base.replace(/\.js$/, '.ts'), `${base}.ts`, path.join(base, 'index.ts')]
      .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (!resolved) throw new Error(`Unresolved local dependency ${value} from ${file}`);
    return resolved;
  });
}
function graph(entry, includeDynamic = false) {
  const routes = new Map();
  const pending = [[entry, [entry]]];
  while (pending.length) {
    const [file, route] = pending.shift();
    if (routes.has(file)) continue;
    routes.set(file, route);
    for (const dependency of imports(file, includeDynamic)) pending.push([dependency, [...route, dependency]]);
  }
  return routes;
}
function requireDeferred(routes, target) {
  if (routes.has(target)) throw new Error(`Eager board runtime: ${routes.get(target).map(file => path.relative(root, file)).join(' -> ')}`);
}
try {
  const sourceRoutes = graph(path.resolve('src/main.ts'));
  requireDeferred(sourceRoutes, path.resolve('src/modules/app-core.ts'));
  console.log(`PASS startup source graph: ${sourceRoutes.size} eager modules, board runtime deferred`);
  if (process.argv.includes('--built')) {
    const html = fs.readFileSync('dist/index.html', 'utf8');
    const entry = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/i)?.[1];
    if (!entry) throw new Error('Built module entry missing');
    const builtEntry = path.resolve('dist', entry);
    const staticRoutes = graph(builtEntry);
    const allRoutes = graph(builtEntry, true);
    const coreFiles = [...allRoutes.keys()].filter(file => /^app-core-[^.]+\.js$/.test(path.basename(file)));
    if (!coreFiles.length) throw new Error('No reachable separate app-core chunk; board boundary may have collapsed');
    for (const core of coreFiles) {
      requireDeferred(staticRoutes, core);
      if (html.includes(`href="./${path.basename(core)}"`)) throw new Error('Board runtime explicitly preloaded');
    }
    console.log(JSON.stringify({ verdict: 'PASS', staticChunks: [...staticRoutes.keys()].map(file => path.basename(file)), deferredBoardChunks: coreFiles.map(file => ({ file: path.basename(file), bytes: fs.statSync(file).size })) }, null, 2));
  }
} catch (error) {
  console.error(`FAIL startup dependency audit: ${error.message}`);
  process.exitCode = 1;
}
