import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const args = process.argv.slice(2);
const rootIndex = args.indexOf('--root');
const root = path.resolve(rootIndex >= 0 ? args[rootIndex + 1] : process.cwd());
const registryPath = path.join(root, 'src/modules/special-dice-registry.ts');
const ownersPath = path.join(root, 'docs/engineering/special-dice-archetype-owners.json');

function readJson(file, label) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { throw new Error(`${label} is unreadable: ${error.message}`); }
}

try {
  const sourceText = fs.readFileSync(registryPath, 'utf8');
  const source = ts.createSourceFile(registryPath, sourceText, ts.ScriptTarget.Latest, true);
  const archetypes = new Set();
  function visit(node) {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === 'SpecialDiceArchetype') {
      const members = ts.isUnionTypeNode(node.type) ? node.type.types : [node.type];
      for (const member of members) if (ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal)) archetypes.add(member.literal.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);

  const manifest = readJson(ownersPath, 'special-dice archetype owners');
  const records = manifest.archetypes ?? {};
  const errors = [];
  const requiredFields = ['coreSpecial', 'mergeOwner', 'endgamePolicy', 'transactionPolicy', 'savePolicy', 'inputPolicy', 'audioPolicy'];
  const requiredTests = [
    'src/modules/__tests__/final-merge-all-archetypes.test.ts',
    'src/modules/__tests__/gameplay-resolution-engine.test.ts',
    'src/modules/__tests__/special-dice-transaction-contract.test.ts',
    'src/modules/__tests__/special-dice-transaction-owner.test.ts',
    'src/modules/__tests__/endgame-checker.test.ts',
    'src/modules/__tests__/atomic-save-load.test.ts',
    'src/modules/__tests__/input-gate.test.ts',
  ];
  if (!archetypes.size) errors.push('SpecialDiceArchetype contains no string members');
  for (const archetype of archetypes) {
    const record = records[archetype];
    if (!record) { errors.push(`${archetype}: missing archetype/endgame ownership record`); continue; }
    for (const field of requiredFields) if (typeof record[field] !== 'string' || !record[field].trim()) errors.push(`${archetype}: missing ${field}`);
    if (!Array.isArray(record.tests)) errors.push(`${archetype}: missing tests`);
    for (const test of requiredTests) {
      if (!record.tests?.includes(test)) errors.push(`${archetype}: missing shared gameplay regression ${test}`);
    }
    for (const test of record.tests ?? []) {
      if (typeof test !== 'string' || !test.startsWith('src/') || !fs.existsSync(path.join(root, test))) errors.push(`${archetype}: missing test file ${String(test)}`);
    }
  }
  for (const archetype of Object.keys(records)) if (!archetypes.has(archetype)) errors.push(`${archetype}: stale archetype ownership record`);
  if (errors.length) {
    errors.forEach(error => console.error(`FAIL ${error}`));
    process.exit(1);
  }
  console.log(`PASS special-dice archetype/endgame admission: ${archetypes.size} archetypes declare merge, transaction, endgame, save/load, input, audio and shared regression ownership.`);
} catch (error) {
  console.error(`FAIL special-dice archetype/endgame admission: ${error.message}`);
  process.exit(1);
}
