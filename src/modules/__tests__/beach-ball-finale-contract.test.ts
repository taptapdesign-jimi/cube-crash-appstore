import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('Beach Ball finale regression contract', () => {
  const registrySource = read('src/modules/special-dice-registry.ts');
  const appCoreSource = read('src/modules/app-core.ts');
  const juiceSource = read('src/modules/wild-juice-bubbles-explosion.ts');

  test('routes both merge entry points into the dedicated downward profile', () => {
    const beachBallDefinition = registrySource.slice(
      registrySource.indexOf("  'beach-ball': {"),
      registrySource.indexOf('\n};', registrySource.indexOf("  'beach-ball': {")),
    );
    expect(beachBallDefinition).toContain("juiceDropProfile: 'beach-ball'");
    expect(appCoreSource.match(/direction: getSpecialDiceJuiceDropProfile\([^)]*\) \? 'down' : 'up'/g)).toHaveLength(2);
    expect(appCoreSource.match(/dropProfile: getSpecialDiceJuiceDropProfile\(/g)).toHaveLength(2);
  });

  test('keeps the v800 fall, floor squash, rebound, and below-screen exit', () => {
    const mushroomBranch = juiceSource.indexOf('if (isMushroomDrop) {');
    const beachBallBranch = juiceSource.indexOf('} else if (isCustomDownDrop) {', mushroomBranch);
    expect(mushroomBranch).toBeGreaterThan(-1);
    expect(beachBallBranch).toBeGreaterThan(mushroomBranch);
    const branch = juiceSource.slice(beachBallBranch, juiceSource.indexOf('\n    } else {', beachBallBranch));
    expect(branch).toContain('const floorY = screenH * (0.93 + Math.random() * 0.07)');
    expect(branch).toContain('y: floorY');
    expect(branch).toContain('x: bubbleScale * 1.26');
    expect(branch).toContain('y: bubbleScale * 0.70');
    expect(branch).toContain('y: bounceY');
    expect(branch).toContain("ease: 'power2.out'");
    expect(branch).toContain('y: exitY');
    expect(branch).toContain("ease: 'power2.in'");
    expect(branch).toContain('onComplete: onBubbleComplete');
  });
});
