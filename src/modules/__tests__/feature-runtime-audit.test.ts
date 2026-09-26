import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const auditScript = path.resolve(process.cwd(), 'scripts/feature-runtime-audit.mjs');

function write(root: string, relativePath: string, content: string): void {
  const destination = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content);
}

function createFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-feature-runtime-'));
  write(root, 'src/existing-screen.ts', `export function openExistingScreen() {
  const timer = window.setInterval(() => undefined, 1000);
  return () => window.clearInterval(timer);
}
`);
  write(root, 'docs/engineering/feature-runtime-owners.json', JSON.stringify({ version: 1, features: [] }, null, 2));
  const baseline = execFileSync(process.execPath, [auditScript, '--root', root, '--print-baseline'], { encoding: 'utf8' });
  write(root, 'docs/engineering/feature-runtime-baseline.json', baseline);
  return root;
}

function runAudit(root: string) {
  return spawnSync(process.execPath, [auditScript, '--root', root], { encoding: 'utf8' });
}

describe('feature runtime architecture audit', () => {
  const fixtures: string[] = [];

  afterEach(() => {
    for (const fixture of fixtures.splice(0)) fs.rmSync(fixture, { recursive: true, force: true });
  });

  it('accepts the frozen existing runtime baseline', () => {
    const root = createFixture();
    fixtures.push(root);

    const result = runAudit(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('PASS feature runtime architecture');
  });

  it('rejects a new screen until its lifecycle ownership is registered', () => {
    const root = createFixture();
    fixtures.push(root);
    write(root, 'src/dice-gallery-screen.ts', 'export function openDiceGalleryScreen() { return true; }\n');

    const result = runAudit(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('new runtime surface lacks a feature ownership record');
  });

  it('accepts a registered screen with complete policies and a real test', () => {
    const root = createFixture();
    fixtures.push(root);
    write(root, 'src/dice-gallery-screen.ts', 'export function openDiceGalleryScreen() { return true; }\n');
    write(root, 'src/__tests__/dice-gallery-screen.test.ts', 'test("gallery", () => expect(true).toBe(true));\n');
    write(root, 'docs/engineering/feature-runtime-owners.json', JSON.stringify({
      version: 1,
      features: [{
        id: 'dice-gallery',
        surfaces: ['src/dice-gallery-screen.ts'],
        entryOwner: 'single screen lifetime',
        exitOwner: 'idempotent close',
        resourcePolicy: 'eligible visible cards only',
        animationPolicy: 'finite enter and reveal',
        audioPolicy: 'shared event owner',
        hapticPolicy: 'event only',
        visibilityPolicy: 'hidden work suspended',
        tests: ['src/__tests__/dice-gallery-screen.test.ts'],
        physicalAcceptance: 'NEEDS PHYSICAL TEST',
      }],
    }, null, 2));

    expect(runAudit(root).status).toBe(0);
  });

  it('rejects a new raw recurring-work primitive even inside a registered screen', () => {
    const root = createFixture();
    fixtures.push(root);
    write(root, 'src/existing-screen.ts', `export function openExistingScreen() {
  const timer = window.setInterval(() => undefined, 1000);
  const secondTimer = window.setInterval(() => undefined, 500);
  return () => { window.clearInterval(timer); window.clearInterval(secondTimer); };
}
`);

    const result = runAudit(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('new interval primitive');
  });
});
