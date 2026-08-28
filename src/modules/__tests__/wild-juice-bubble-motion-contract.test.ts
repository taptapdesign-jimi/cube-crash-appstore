import fs from 'node:fs';
import path from 'node:path';

describe('wild-juice bubble motion ownership contract', () => {
  test('preserves tile idle and gives only full-screen PNG sprites the stronger weave', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/fx.ts'), 'utf8');
    const explosionSource = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/wild-juice-bubbles-explosion.ts'), 'utf8');
    const start = source.indexOf('export function startWildJuiceBubbles');
    const end = source.indexOf('export function stopWildJuiceBubbles', start);
    const bubbleSource = source.slice(start, end);

    expect(bubbleSource).toContain('const usesJuiceFizzMotion = !isHoney && !isBottle;');
    expect(bubbleSource).toContain('usesJuiceFizzMotion ? 1.4 : 1');
    expect(bubbleSource).toContain('const juiceIdleBubbleColors = [0xFFE6E1, 0xFFF2E9, 0xFFD5D6];');
    expect(bubbleSource).toContain('(idleBubbleColors || juiceIdleBubbleColors)');
    expect(bubbleSource).toContain(': (12 + Math.random() * 10) * 0.7;');
    expect(bubbleSource).toContain('startX - crossDirection * crossDistance');
    expect(bubbleSource).toContain('startX + crossDirection * crossDistance * 0.85');
    expect(bubbleSource).toContain('startX - crossDirection * crossDistance * 0.65');
    expect(bubbleSource).toContain('{ x: juiceEndX, y: endY }');
    expect(bubbleSource).toContain("isBottle || usesJuiceFizzMotion ? 'sine.inOut' : 'power1.out'");
    expect(bubbleSource).toContain('queueMicrotask(() =>');
    expect(bubbleSource).toContain('retireBubble(bubble);');
    expect(explosionSource).toContain('const weaveDistance = screenW * (0.1 + Math.random() * 0.08)');
    expect(explosionSource).toContain('x: startX + driftX * 0.38 - weaveDirection * weaveDistance * 0.92');
    expect(explosionSource).toContain("ease: 'sine.inOut'");
    expect(explosionSource).toContain("acquirePixiMobileActivityLease('juice-family-finale')");
    expect(explosionSource).toContain('if (!app.ticker?.started)');
    expect(explosionSource.match(/app\.renderer\.render\(stage\)/g)).toHaveLength(1);
    expect(explosionSource).toContain('riseTl.to(bubble.scale, {');
  });
});
