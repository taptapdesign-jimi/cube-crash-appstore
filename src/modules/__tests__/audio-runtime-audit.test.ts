import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const auditScript = path.resolve(process.cwd(), 'scripts/audio-runtime-audit.mjs');

function write(root: string, relativePath: string, content: string): void {
  const destination = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content);
}

function createFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-audio-runtime-'));
  write(root, 'src/modules/existing-sound.ts', `export function playExistingSound() {
  return new Audio('./assets/sound/existing.wav');
}
`);
  write(root, 'src/modules/gameplay-sound-owner-registry.ts', 'export const registry = true;\n');
  write(root, 'docs/audio/audio-runtime-owners.json', JSON.stringify({ version: 1, owners: [] }, null, 2));
  const baseline = execFileSync(process.execPath, [auditScript, '--root', root, '--print-baseline'], { encoding: 'utf8' });
  write(root, 'docs/audio/audio-runtime-baseline.json', baseline);
  return root;
}

function runAudit(root: string) {
  return spawnSync(process.execPath, [auditScript, '--root', root], { encoding: 'utf8' });
}

function newOwnerRecord() {
  return {
    id: 'new-special-cue',
    ownerFile: 'src/modules/new-special-sound.ts',
    family: 'Wild/Special',
    eventOwner: 'committed special merge contact',
    transport: 'shared decoded gameplay SFX engine',
    voicePolicy: 'one stable bounded voice',
    preloadPolicy: 'eligible live/restored variant only',
    settingsPolicy: 'Sounds OFF stops active and pending voice',
    interruptionPolicy: 'replacement, route exit and hard reset stop the owner',
    stopExport: 'stopNewSpecialSound',
    globalRegistryRequired: true,
    sources: ['./assets/sound/new-special.wav'],
    tests: ['src/modules/__tests__/new-special-sound.test.ts'],
    physicalAcceptance: 'NEEDS PHYSICAL TEST',
  };
}

describe('audio runtime architecture audit', () => {
  const fixtures: string[] = [];
  afterEach(() => fixtures.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })));

  it('accepts the frozen existing audio baseline', () => {
    const root = createFixture();
    fixtures.push(root);
    expect(runAudit(root).status).toBe(0);
  });

  it('rejects a new sound owner and source without an ownership record', () => {
    const root = createFixture();
    fixtures.push(root);
    write(root, 'src/modules/new-special-sound.ts', `const source = './assets/sound/new-special.wav';\nexport function stopNewSpecialSound() {}\nexport { source };\n`);
    const result = runAudit(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('new audio owner lacks an audio ownership record');
    expect(result.stderr).toContain('new sound source');
  });

  it('accepts a complete owner connected to the global full-stop registry', () => {
    const root = createFixture();
    fixtures.push(root);
    write(root, 'src/modules/new-special-sound.ts', `const source = './assets/sound/new-special.wav';\nexport function stopNewSpecialSound() {}\nexport { source };\n`);
    write(root, 'src/modules/__tests__/new-special-sound.test.ts', 'test("new cue", () => expect(true).toBe(true));\n');
    write(root, 'src/modules/gameplay-sound-owner-registry.ts', `() => import('./new-special-sound.js').then(owner => [owner.stopNewSpecialSound]);\n`);
    write(root, 'docs/audio/audio-runtime-owners.json', JSON.stringify({ version: 1, owners: [newOwnerRecord()] }, null, 2));
    expect(runAudit(root).status).toBe(0);
  });

  it('rejects new raw media allocation even when another occurrence is grandfathered', () => {
    const root = createFixture();
    fixtures.push(root);
    write(root, 'src/modules/existing-sound.ts', `export function playExistingSound() {
  const first = new Audio('./assets/sound/existing.wav');
  const second = new Audio('./assets/sound/existing.wav');
  return [first, second];
}
`);
    const result = runAudit(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('new raw audio-element primitive');
  });
});
