import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const moduleDirectory = path.resolve(__dirname, '..');
const helperSource = fs.readFileSync(path.join(moduleDirectory, 'gameplay-sound-owner-registry.ts'), 'utf8');
const helperAst = ts.createSourceFile('cleanup.ts', helperSource, ts.ScriptTarget.Latest, true);

function registrations(): Array<{ name: string; stops: string[] }> {
  const declaration = helperAst.statements.filter(ts.isVariableStatement)
    .flatMap(statement => [...statement.declarationList.declarations])
    .find(item => item.name.getText(helperAst) === 'soundOwners');
  if (!declaration?.initializer || !ts.isArrayLiteralExpression(declaration.initializer)) throw new Error('Missing fallback owners');
  return declaration.initializer.elements.map(element => {
    if (!ts.isArrowFunction(element) || !ts.isCallExpression(element.body)
      || !ts.isPropertyAccessExpression(element.body.expression)) throw new Error('Expected lazy owner loader');
    const importCall = element.body.expression.expression;
    const callback = element.body.arguments[0];
    if (!ts.isCallExpression(importCall) || importCall.expression.kind !== ts.SyntaxKind.ImportKeyword
      || !ts.isStringLiteral(importCall.arguments[0]) || !ts.isArrowFunction(callback)
      || !ts.isArrayLiteralExpression(callback.body)) throw new Error('Expected import followed by stop references');
    return {
      name: importCall.arguments[0].text,
      stops: callback.body.elements.map(stop => {
        if (!ts.isPropertyAccessExpression(stop) || !stop.name.text.startsWith('stop')) throw new Error('Only stop exports are allowed');
        return stop.name.text;
      }),
    };
  });
}
const owners = registrations();

function fixture() {
  let suppressed = false;
  const loaded: string[] = [];
  const modules = new Map(owners.map(owner => [owner.name, Object.fromEntries(owner.stops.map(name => [name, jest.fn()]))]));
  let load: (name: string) => unknown = name => modules.get(name);
  const module = { exports: {} as typeof import('../gameplay-sound-owner-registry') };
  vm.runInNewContext(ts.transpileModule(helperSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText, {
    module, exports: module.exports,
    require: (name: string) => {
      if (name === '../utils/thermal-audio-isolation.js') return { isThermalAudioSuppressed: () => suppressed };
      loaded.push(name);
      return load(name);
    },
  });
  return {
    cleanup: (isCurrent: () => boolean) => module.exports.stopRegisteredSfxOwners(() => suppressed && isCurrent()),
    loaded, modules,
    suppress: (value: boolean) => { suppressed = value; },
    setLoader: (loader: typeof load) => { load = loader; },
    stops: () => [...modules.values()].flatMap(owner => Object.values(owner)),
  };
}

test('registry covers every media SFX/timer owner and references callable full-stop exports', () => {
  const sourceFiles = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === '__tests__' || entry.name === '__mocks__') return [];
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(filename) : /\.(?:ts|js)$/.test(entry.name) && !/\.(?:test|spec|d)\.ts$/.test(entry.name) ? [filename] : [];
  });
  const excluded = new Set(['asset-preloader.ts', 'soundtrack-manager.ts']);
  const candidates = sourceFiles(path.resolve(moduleDirectory, '..')).filter(filename => {
    if (excluded.has(path.basename(filename))) return false;
    const source = fs.readFileSync(filename, 'utf8');
    const mediaOwner = /\bnew\s+(?:window\.)?Audio\s*\(|createElement\(\s*['"]audio['"]/.test(source);
    const timerSoundOwner = /-sound\.ts$/.test(filename) && /\b(?:setTimeout|setInterval|requestAnimationFrame)\s*\(/.test(source);
    const decodedCueOwner = /-sound\.ts$/.test(filename) && /\bplayDecodedGameplaySound\s*\(/.test(source);
    const decodedResidencyOwner = /-audio-working-set\.ts$/.test(filename)
      && /\bstopJourneyCriticalAudioWorkingSets\s*\(/.test(source);
    // This semantic lease has no transport of its own, but Sounds OFF must
    // retire it so later native callbacks cannot restart its delegated cues.
    const nativeSemanticLease = path.basename(filename) === 'native-home-hub-feedback.ts';
    return mediaOwner || timerSoundOwner || decodedCueOwner || decodedResidencyOwner || nativeSemanticLease;
  });
  expect(owners.map(owner => path.resolve(moduleDirectory, owner.name.replace(/\.js$/, '.ts'))).sort()).toEqual(candidates.sort());
  expect(new Set(owners.map(owner => owner.name)).size).toBe(owners.length);
  for (const owner of owners) {
    const filename = path.resolve(moduleDirectory, owner.name.replace(/\.js$/, '.ts'));
    const parsed = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
    const exportedStops = parsed.statements.filter(ts.isFunctionDeclaration)
      .filter(fn => fn.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword))
      .filter(fn => fn.parameters.every(parameter => parameter.questionToken || parameter.initializer || parameter.dotDotDotToken))
      .map(fn => fn.name?.text);
    for (const stop of owner.stops) expect(exportedStops).toContain(stop);
    // These subset stops are deliberately covered by their family's full stop.
    const partialStops = new Set(['stopFailScreenCtaBounceSounds', 'stopCoreTntBonusImpactSounds',
      'stopLaserGunFinaleSounds', 'stopSpaceshipFinaleSounds']);
    expect(owner.stops.slice().sort()).toEqual(exportedStops.filter((name): name is string =>
      !!name?.startsWith('stop') && !partialStops.has(name)).sort());
  }
});

test('normal use and stale ownership perform no lazy imports or stop calls', async () => {
  const f = fixture();
  expect(f.loaded).toEqual([]);
  await f.cleanup(() => true);
  f.suppress(true);
  await f.cleanup(() => false);
  expect(f.loaded).toEqual([]);
  f.stops().forEach(stop => expect(stop).not.toHaveBeenCalled());
});

test('enabled cleanup calls only the registered existing stops, including both digit families', async () => {
  const f = fixture(); f.suppress(true);
  await f.cleanup(() => true);
  expect(f.loaded).toEqual(owners.map(owner => owner.name));
  f.stops().forEach(stop => expect(stop).toHaveBeenCalledTimes(1));
  expect(f.modules.get('./arcade-round-digit-sound.js')?.stopArcadeRoundDigitSounds).toHaveBeenCalledTimes(1);
  expect(f.modules.get('./arcade-round-digit-sound.js')?.stopBoardTransitionDigitSounds).toHaveBeenCalledTimes(1);
  expect(f.modules.get('./native-home-hub-feedback.js')?.stopNativeHomeHubFeedback).toHaveBeenCalledTimes(1);
});

test.each(['unmute', 'replace'])('pending module completion after %s cannot stop newer audio or load further owners', async reason => {
  const f = fixture(); f.suppress(true);
  let current = true;
  let finishImport!: (value: unknown) => void;
  f.setLoader(() => new Promise(resolve => { finishImport = resolve; }));
  const pending = f.cleanup(() => current);
  await Promise.resolve();
  expect(f.loaded).toHaveLength(1);
  if (reason === 'unmute') f.suppress(false);
  else current = false;
  finishImport(f.modules.get(owners[0].name));
  await pending;
  expect(f.loaded).toHaveLength(1);
  f.stops().forEach(stop => expect(stop).not.toHaveBeenCalled());
});

test('one broken import or stop cannot strand later families', async () => {
  const f = fixture(); f.suppress(true);
  f.setLoader(name => {
    if (name === owners[0].name) throw new Error('import failed');
    return f.modules.get(name);
  });
  f.modules.get('./arcade-round-digit-sound.js')!.stopArcadeRoundDigitSounds.mockImplementation(() => { throw new Error('stop failed'); });
  await expect(f.cleanup(() => true)).resolves.toBeUndefined();
  expect(f.loaded).toHaveLength(owners.length);
  expect(f.modules.get('./arcade-round-digit-sound.js')!.stopBoardTransitionDigitSounds).toHaveBeenCalledTimes(1);
  expect(f.modules.get(owners[owners.length - 1].name)![owners[owners.length - 1].stops[0]]).toHaveBeenCalledTimes(1);
});

test('thermal wrapper delegates to the sole registry with isolation and owner checks', async () => {
  let suppressed = false;
  let current = true;
  let captured!: () => boolean;
  const stop = jest.fn((predicate: () => boolean) => { captured = predicate; return Promise.resolve(); });
  const module = { exports: {} as typeof import('../thermal-gameplay-audio-cleanup') };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(moduleDirectory, 'thermal-gameplay-audio-cleanup.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText, {
    module, exports: module.exports,
    require: (name: string) => name.includes('thermal-audio-isolation')
      ? { isThermalAudioSuppressed: () => suppressed }
      : { stopRegisteredSfxOwners: stop },
  });
  await module.exports.stopThermalGameplayAudioFallbacks(() => current);
  expect(stop).toHaveBeenCalledTimes(1);
  expect(captured()).toBe(false);
  suppressed = true;
  expect(captured()).toBe(true);
  current = false;
  expect(captured()).toBe(false);
});
