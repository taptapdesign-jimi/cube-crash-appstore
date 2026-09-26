import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const auditScript = path.resolve(process.cwd(), 'scripts/special-dice-archetype-audit.mjs');
const sharedTests = [
  'src/modules/__tests__/final-merge-all-archetypes.test.ts',
  'src/modules/__tests__/gameplay-resolution-engine.test.ts',
  'src/modules/__tests__/special-dice-transaction-contract.test.ts',
  'src/modules/__tests__/special-dice-transaction-owner.test.ts',
  'src/modules/__tests__/endgame-checker.test.ts',
  'src/modules/__tests__/atomic-save-load.test.ts',
  'src/modules/__tests__/input-gate.test.ts',
];

function write(root: string, relativePath: string, content: string): void {
  const destination = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content);
}

function record(coreSpecial: string) {
  return {
    coreSpecial,
    mergeOwner: 'committed merge owner',
    endgamePolicy: 'explicit complete, continue and blocker policy',
    transactionPolicy: 'immutable token with rollback and release',
    savePolicy: 'versioned save and restored identity',
    inputPolicy: 'central input gate release boundary',
    audioPolicy: 'modular registered cue owner',
    tests: sharedTests,
  };
}

function createFixture(archetypeUnion: string, archetypes: Record<string, ReturnType<typeof record>>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-special-archetype-'));
  write(root, 'src/modules/special-dice-registry.ts', `export type SpecialDiceArchetype = ${archetypeUnion};\n`);
  for (const test of sharedTests) write(root, test, 'test("contract", () => expect(true).toBe(true));\n');
  write(root, 'docs/engineering/special-dice-archetype-owners.json', JSON.stringify({ version: 1, archetypes }, null, 2));
  return root;
}

describe('special-dice archetype/endgame admission', () => {
  const fixtures: string[] = [];
  afterEach(() => fixtures.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })));

  it('accepts an archetype with the complete gameplay and endgame matrix', () => {
    const root = createFixture("'wild-star'", { 'wild-star': record('wild') });
    fixtures.push(root);
    expect(spawnSync(process.execPath, [auditScript, '--root', root]).status).toBe(0);
  });

  it('blocks a newly declared archetype without its ownership record', () => {
    const root = createFixture("'wild-star' | 'wild-freeze'", { 'wild-star': record('wild') });
    fixtures.push(root);
    const result = spawnSync(process.execPath, [auditScript, '--root', root], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('wild-freeze: missing archetype/endgame ownership record');
  });

  it('accepts a new archetype only after its complete record exists', () => {
    const root = createFixture("'wild-star' | 'wild-freeze'", {
      'wild-star': record('wild'),
      'wild-freeze': record('wild-freeze'),
    });
    fixtures.push(root);
    expect(spawnSync(process.execPath, [auditScript, '--root', root]).status).toBe(0);
  });

  it('blocks an archetype whose shared endgame regression is missing', () => {
    const incomplete = record('wild');
    incomplete.tests = incomplete.tests.filter(test => !test.endsWith('/endgame-checker.test.ts'));
    const root = createFixture("'wild-star'", { 'wild-star': incomplete });
    fixtures.push(root);
    const result = spawnSync(process.execPath, [auditScript, '--root', root], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('missing shared gameplay regression');
  });
});
