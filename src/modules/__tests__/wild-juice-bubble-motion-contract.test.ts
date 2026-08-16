import fs from 'node:fs';
import path from 'node:path';

describe('wild-juice idle bubble motion contract', () => {
  test('uses a gentle independent fizzy cross-flow while preserving Bottle and Honey branches', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/fx.ts'), 'utf8');
    const start = source.indexOf('export function startWildJuiceBubbles');
    const end = source.indexOf('export function stopWildJuiceBubbles', start);
    const bubbleSource = source.slice(start, end);

    expect(bubbleSource).toContain('const usesJuiceFizzMotion = !isHoney && !isBottle;');
    expect(bubbleSource).toContain(': 12 + Math.random() * 10;');
    expect(bubbleSource).toContain('startX - crossDirection * crossDistance');
    expect(bubbleSource).toContain('startX + crossDirection * crossDistance * 0.85');
    expect(bubbleSource).toContain('startX - crossDirection * crossDistance * 0.65');
    expect(bubbleSource).toContain('{ x: juiceEndX, y: endY }');
    expect(bubbleSource).toContain("isBottle || usesJuiceFizzMotion ? 'sine.inOut' : 'power1.out'");
    expect(bubbleSource).toContain('queueMicrotask(() =>');
    expect(bubbleSource).toContain('retireBubble(bubble);');
  });
});
