import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const sourceRoots = ['src/modules', 'src/utils'];

function collectTypescriptFiles(directory: string): string[] {
  const absolute = path.join(root, directory);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const next = path.join(absolute, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') return [];
      return collectTypescriptFiles(path.relative(root, next));
    }
    return entry.name.endsWith('.ts') ? [next] : [];
  });
}

function directPixiTextureCalls(file: string): string[] {
  const source = fs.readFileSync(file, 'utf8');
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const calls: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const owner = node.expression.expression.getText(parsed);
      const method = node.expression.name.text;
      if ((owner === 'Assets' && ['get', 'load', 'unload'].includes(method))
        || (owner === 'Texture' && method === 'from')) {
        calls.push(`${owner}.${method}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return calls;
}

const inventory = {
  brokerInfrastructure: [
    'src/utils/pixi-image-texture-health.ts',
    'src/utils/visual-asset-broker.ts',
  ],
  runtimeGeneratedTexture: [
    'src/modules/drag-core.ts',
    'src/modules/drag-utils.ts',
  ],
  liveDieOrRecoveryCritical: [
    'src/modules/app-core.ts',
    'src/modules/app-spawn.ts',
    'src/modules/bee-dice-idle.ts',
    'src/modules/board-tile.ts',
    'src/modules/board.ts',
    'src/modules/honey-bee-idle-orbit.ts',
    'src/modules/robo-cube-idle.ts',
    'src/modules/shared-pixi-sheet-animation.ts',
    'src/modules/tnt-animation.ts',
  ],
  visibleEffectOrHud: [
    'src/modules/app-merge.ts',
    'src/modules/center-celebration.ts',
    'src/modules/flower-bouncy-artwork.ts',
    'src/modules/fx.ts',
    'src/modules/hud-helpers.ts',
    'src/modules/juice-finale-prop-flight.ts',
    'src/modules/juice-finale-textures.ts',
    'src/modules/robo-bouncy-artwork.ts',
    'src/modules/stars-collector.ts',
    'src/modules/wild-spawn-drop.ts',
    'src/modules/wild-stars.ts',
  ],
  preloadOnly: [
    'src/modules/app-core-helpers.ts',
    'src/modules/arcade-stage-one-special-visual-warmup.ts',
    'src/modules/asset-preloader.ts',
    'src/utils/comprehensive-image-preloader.ts',
  ],
} as const;

test('all remaining direct Pixi texture acquisition owners are explicitly inventoried', () => {
  const discovered = sourceRoots
    .flatMap(collectTypescriptFiles)
    .flatMap((file) => directPixiTextureCalls(file).length > 0
      ? [path.relative(root, file).split(path.sep).join('/')]
      : [])
    .sort();
  const expected = Object.values(inventory).flat().sort();

  expect(discovered).toEqual(expected);
});

test('already migrated canonical Special and idle owners cannot regress to raw Pixi acquisition', () => {
  const migratedOwners = [
    'src/modules/app-core-wild-skin.ts',
    'src/modules/kanta-dice-idle.ts',
    'src/modules/special-dice-idle.ts',
  ];

  migratedOwners.forEach((relativePath) => {
    expect(directPixiTextureCalls(path.join(root, relativePath))).toEqual([]);
  });
});

test('canvas-generated textures remain separated from image-backed broker migration', () => {
  expect(inventory.runtimeGeneratedTexture).toEqual([
    'src/modules/drag-core.ts',
    'src/modules/drag-utils.ts',
  ]);
  expect(inventory.liveDieOrRecoveryCritical).toEqual(expect.arrayContaining([
    'src/modules/board.ts',
    'src/modules/app-spawn.ts',
    'src/modules/bee-dice-idle.ts',
    'src/modules/honey-bee-idle-orbit.ts',
    'src/modules/robo-cube-idle.ts',
    'src/modules/shared-pixi-sheet-animation.ts',
    'src/modules/tnt-animation.ts',
  ]));
});
