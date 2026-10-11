// Executes the immutable Source validator and restore with real registry dependencies.
// This receipt covers restored model values, not rendered entry or live markers.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { execFileSync } = require('node:child_process');
const reference = 'production-benchmark-v9';
const cache = new Map(), hashes = {};
function load(file) {
  // These cases start with an empty live board. Removal is an unreachable
  // dependency, and must fail loudly if that assumption ever changes.
  if (file === 'src/modules/tile-lifecycle-service.ts') return {
    removeTileFully: () => { throw new Error('Unexpected removal in empty-board restore oracle'); },
  };
  if (cache.has(file)) return cache.get(file).exports;
  const source = execFileSync('git', ['show', `${reference}:${file}`], { encoding: 'utf8' });
  hashes[file] = crypto.createHash('sha256').update(source).digest('hex');
  const module = { exports: {} }; cache.set(file, module);
  const requireSource = name => {
    if (!name.startsWith('.')) throw new Error(`Unexpected external dependency: ${name}`);
    let resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), name));
    if (!resolved.endsWith('.ts')) resolved += '.ts';
    return load(resolved);
  };
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
  } }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, require: requireSource }, { filename: file });
  return module.exports;
}
const schema = load('src/modules/app-core-save-schema.ts');
const restore = load('src/modules/app-core-load-tiles.ts');
const rows = [];
for (const legacy of [false, true]) for (const kind of ['regular', 'locked-positive', 'locked-zero', 'wild']) {
  const locked = kind.startsWith('locked');
  const tile = { gridX: 0, gridY: 0, value: kind === 'locked-zero' ? 0 : kind === 'wild' ? 6 : 3,
    locked, open: !locked, special: kind === 'wild' ? 'wild' : null,
    visible: false, alpha: 0.7, renderable: false, stackDepth: 9, occluderVisible: false };
  const input = legacy ? { tiles: [tile] } : { schemaVersion: 2, grid: [[tile]] };
  const before = JSON.stringify(input);
  const normalized = schema.assertValidGameSave(input, { rows: 1, cols: 1, allowLegacy: true }).grid[0][0];
  for (const marker of ['visible', 'alpha', 'renderable', 'stackDepth', 'occluderVisible']) {
    assert.equal(Object.hasOwn(normalized, marker), false, `${kind}/${legacy}: ${marker}`);
  }
  assert.equal(JSON.stringify(input), before, 'Validator mutated source save');
  assert.equal(normalized.value, tile.value); assert.equal(normalized.locked, locked);
  const tiles = [], grid = [[null]], noop = () => {};
  const result = restore.restoreTilesFromSave({ gameState: input, tiles, grid, ROWS: 1, COLS: 1,
    board: {}, createEmptyGrid: () => grid,
    makeBoard: { createTile: args => {
      const holder = { value: args.val, locked: args.locked, depth: 1, alpha: 1, visible: true,
        renderable: true, scale: { set: noop }, occluder: { visible: false }, ghostFrame: {} };
      tiles.push(holder); grid[args.r][args.c] = holder; return holder;
    }, setValue: noop },
    applyWildSkinLocal: noop, stopWildShimmer: noop, stopMagnetIdleParticles: noop,
    trackAppTimeout: () => { throw new Error('Unexpected delayed drag binding'); },
    STATE: { drag: { bindToTile: noop } }, devLog: noop, devWarn: noop, devError: noop,
  });
  assert.equal(result.tilesToRestoreCount, 1);
  const holder = tiles[0];
  assert.equal(holder.visible, true);
  assert.equal(holder.alpha, kind === 'locked-zero' ? 0.25 : 1);
  assert.equal(holder.occluder.visible, locked);
  assert.equal(holder.renderable, true); assert.equal(holder.depth, 1);
  assert.equal(JSON.stringify(input), before);
  rows.push({ legacy, kind, normalized, restored: { value: holder.value,
    visible: holder.visible, alpha: holder.alpha, locked: holder.locked,
    occluderVisible: holder.occluder.visible, eventMode: holder.eventMode,
    deferredWildIdle: holder._ccDeferWildIdleFx === true } });
}
const result = { reference, scope: 'Immutable schema and restore function with explicit minimal board factory; no Pixi renderer, entry animation, live marker or physical proof',
  dependencies: { boardFactory: 'Minimal explicit holder/scale/occluder/ghost/drag producer', removal: 'Unreachable empty-board dependency throws if called', artwork: 'No-op; visual artwork not asserted' }, hashes, rows };
const output = process.argv[2];
if (!output) throw new Error('Supply a receipt output path');
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(`PASS immutable Source schema and restore: ${rows.length} cases strip presentation residue, restore canonical visibility/alpha, preserve input`);
