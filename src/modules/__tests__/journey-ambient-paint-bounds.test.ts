import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

function drawOwner(file: string, name: string): (...args: unknown[]) => void {
  const source = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\n}', start) + 2;
  const js = ts.transpileModule(source.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText;
  return new Function(`${js}; return ${name};`)() as (...args: unknown[]) => void;
}

const context = () => ({ save: jest.fn(), restore: jest.fn(), translate: jest.fn(), rotate: jest.fn(),
  scale: jest.fn(), drawImage: jest.fn(), globalAlpha: 1 });
const image = { complete: true, naturalWidth: 100 };

function expectCornersCovered(bounds: number[], cx: number, cy: number, width: number, height: number, angle: number) {
  const [x, y, w, h] = bounds;
  for (const dx of [-width / 2, width / 2]) for (const dy of [-height / 2, height / 2]) {
    const px = cx + dx * Math.cos(angle) - dy * Math.sin(angle);
    const py = cy + dx * Math.sin(angle) + dy * Math.cos(angle);
    expect(px).toBeGreaterThanOrEqual(x - 1e-8);
    expect(px).toBeLessThanOrEqual(x + w + 1e-8);
    expect(py).toBeGreaterThanOrEqual(y - 1e-8);
    expect(py).toBeLessThanOrEqual(y + h + 1e-8);
  }
}

test('actual bee painter reports bounds covering rotated/scaled pixels and blend draws', () => {
  const draw = drawOwner('journey-forest-bee-orbits.ts', 'drawBeeAsset');
  const ctx = context();
  const markPaintedBounds = jest.fn();
  for (const angle of [-180, -45, -7, 0, 7, 45, 180]) {
    draw(ctx, image, 50, 1000, 40, angle, 1.4, 0.6, 0.5, 900, { markPaintedBounds }, 'behind');
    const call = markPaintedBounds.mock.calls[markPaintedBounds.mock.calls.length - 1];
    expect(call[0]).toBe('behind');
    expectCornersCovered(call.slice(1), 70, 120, 56, 24, angle * Math.PI / 180);
  }
  const count = markPaintedBounds.mock.calls.length;
  draw(ctx, image, 50, 1000, 40, 0, 1, 1, 0, 900, { markPaintedBounds }, 'front');
  draw(ctx, { complete: false }, 50, 1000, 40, 0, 1, 1, 1, 900, { markPaintedBounds }, 'front');
  expect(markPaintedBounds).toHaveBeenCalledTimes(count);
  expect(ctx.drawImage).toHaveBeenCalledTimes(count);
});

test('actual bubble and ship painters report correct local bounds and depth', () => {
  const markPaintedBounds = jest.fn();
  const ctx = context();
  drawOwner('journey-beach-bubble-drift.ts', 'drawBubble')(ctx, image, 30, 940, 20, 1, 900, { markPaintedBounds }, 'front');
  expect(markPaintedBounds).toHaveBeenLastCalledWith('front', 30, 40, 20, 20);
  const draw = drawOwner('journey-area55-ship-flybys.ts', 'drawShip');
  for (const angle of [-Math.PI, -0.4, 0, 0.4, Math.PI]) {
    draw(ctx, image, { x: 100, y: 950, depth: 'behind' }, 75, angle, 900, { markPaintedBounds });
    const call = markPaintedBounds.mock.calls[markPaintedBounds.mock.calls.length - 1];
    expect(call[0]).toBe('behind');
    expectCornersCovered(call.slice(1), 100, 50, 75, 75 * 188 / 194, angle);
  }
});
