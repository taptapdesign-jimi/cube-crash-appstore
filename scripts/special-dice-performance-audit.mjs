import fs from 'node:fs';
import ts from 'typescript';

const registryPath = 'src/modules/special-dice-registry.ts';
const source = ts.createSourceFile(registryPath, fs.readFileSync(registryPath, 'utf8'), ts.ScriptTarget.Latest, true);
const manifest = JSON.parse(fs.readFileSync('docs/engineering/special-dice-performance-owners.json', 'utf8'));
const variants = new Map();
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'SPECIAL_DICE_VARIANTS') {
    for (const property of node.initializer.properties) {
      const id = property.name.text;
      const archetype = property.initializer.properties.find((p) => p.name?.text === 'archetype')?.initializer?.text;
      variants.set(id, archetype);
    }
  }
  ts.forEachChild(node, visit);
}
visit(source);
const errors = [];
const depthPolicies = new Set(['shared-animated-dice-hud-foreground', 'dom-foreground-owner', 'contained-board-footprint']);
const foregroundRegression = 'src/modules/__tests__/animated-dice-hud-foreground.test.ts';
if (!variants.size) errors.push('Registry contains no variants; audit cannot validate admission.');
for (const [id, archetype] of variants) {
  const entry = manifest[id];
  if (!entry) { errors.push(`${id}: missing performance ownership/admission record`); continue; }
  if (entry.archetype !== archetype) errors.push(`${id}: archetype differs from registry`);
  for (const key of ['idleOwner', 'finaleOwner', 'warmupPolicy', 'cleanupPolicy', 'hudDepthPolicy']) {
    if (typeof entry[key] !== 'string' || !entry[key].trim()) errors.push(`${id}: missing ${key}`);
  }
  for (const key of ['idleOwner', 'finaleOwner']) {
    if (!entry[key]?.startsWith('src/') || !fs.existsSync(entry[key])) errors.push(`${id}: missing ${key} file`);
  }
  if (!depthPolicies.has(entry.hudDepthPolicy)) errors.push(`${id}: unsupported HUD depth policy`);
  if (entry.hudDepthPolicy === 'shared-animated-dice-hud-foreground') {
    if (!entry.tests?.includes(foregroundRegression)) errors.push(`${id}: missing shared foreground geometry regression`);
    if (fs.existsSync(entry.idleOwner ?? '')) {
      const ownerSource = fs.readFileSync(entry.idleOwner, 'utf8');
      if (!/renderAboveHud:\s*true|mountAnimatedDiceAboveHud\(/.test(ownerSource)) {
        errors.push(`${id}: shared foreground policy is not connected to its idle owner`);
      }
    }
  }
  if (!Array.isArray(entry.tests) || !entry.tests.length) errors.push(`${id}: missing regression tests`);
  for (const test of entry.tests ?? []) {
    if (!/^src\/.*\/__tests__\/.*\.test\.ts$/.test(test) || !fs.existsSync(test)) errors.push(`${id}: missing test ${test}`);
  }
}
for (const id of Object.keys(manifest)) if (!variants.has(id)) errors.push(`${id}: stale manifest entry`);
if (errors.length) {
  errors.forEach((error) => console.error(`FAIL ${error}`));
  process.exit(1);
}
console.log(`PASS special-dice admission: ${variants.size} registry variants have matching archetypes, owners, warmup/cleanup policies and existing tests.`);
console.log('Scope: admission metadata integrity only. Behavioral tests and physical acceptance remain mandatory.');
