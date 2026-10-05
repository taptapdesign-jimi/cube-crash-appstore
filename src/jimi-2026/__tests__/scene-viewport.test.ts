import fs from 'node:fs';
import path from 'node:path';
import { getBeachVisibleUnitIds } from '../scene-viewport';
import { JIMI_BEACH_MAIN, JIMI_BEACH_UNITS, type JimiImageSpec } from '../scene-catalog';
import { getJourneyV700MotionProfile } from '../../modules/journey-v700-motion';

const boards = (first: number, last: number) => Array.from({ length: last - first + 1 }, (_, index) => `board-${first + index}`);

test('first, middle and end views select conservative authored ranges and always include the fixed header', () => {
  expect([...getBeachVisibleUnitIds(0, 700)]).toEqual(['header', 'beach-main', ...boards(11, 14)]);
  expect([...getBeachVisibleUnitIds(800, 400)]).toEqual(['header', ...boards(11, 19)]);
  expect([...getBeachVisibleUnitIds(1400, 500)]).toEqual(['header', ...boards(15, 20)]);
  expect([...getBeachVisibleUnitIds(4000, 700)]).toEqual(['header']);
});

test('overscan only expands admission, elastic negative scrolling starts at zero, and calls retain no previous selection', () => {
  const exact = getBeachVisibleUnitIds(0, 700, 0);
  const buffered = getBeachVisibleUnitIds(0, 700, 100);
  for (const id of exact) expect(buffered.has(id)).toBe(true);
  expect([...getBeachVisibleUnitIds(-60, 700)]).toEqual([...buffered]);
  expect([...getBeachVisibleUnitIds(0, 700, -100)]).toEqual([...exact]);
  const first = [...buffered];
  getBeachVisibleUnitIds(1400, 500);
  expect([...buffered]).toEqual(first);
  expect([...getBeachVisibleUnitIds(0, 700)]).toEqual(first);
});

test.each([[NaN, 700, 100], [Infinity, 700, 100], [0, NaN, 100], [0, 0, 100], [0, -1, 100], [0, 700, Infinity]])(
  'unknown geometry fails open instead of dropping Units (%s, %s, %s)', (top, height, overscan) => {
    expect([...getBeachVisibleUnitIds(top, height, overscan)]).toEqual(['header', 'beach-main', ...boards(11, 20)]);
  },
);

function imageHeight(spec: JimiImageSpec): number {
  const fd = fs.openSync(path.resolve(process.cwd(), spec.src), 'r');
  try {
    const header = Buffer.alloc(24);
    fs.readSync(fd, header, 0, 24, 0);
    return spec.width * header.readUInt32BE(20) / header.readUInt32BE(16);
  } finally { fs.closeSync(fd); }
}

function verticalBounds(_x: number, y: number, width: number, height: number, rotation = 0): [number, number] {
  const radians = rotation * Math.PI / 180;
  const halfHeight = (Math.abs(Math.sin(radians)) * width + Math.abs(Math.cos(radians)) * height) / 2;
  return [y + height / 2 - halfHeight, y + height / 2 + halfHeight];
}

test('original PNG aspect ratios, rotated cards, props and all clouds fit the conservative motion envelopes', () => {
  const assertBounds = (id: `board-${number}` | 'beach-main', y: number, origin: number, bounds: [number, number]) => {
    for (const scale of [0, .65, 1, 1.25]) for (const translate of [-32, 0, 32]) for (const edge of bounds) {
      const at = y + origin + (edge - origin) * scale + translate;
      if (at < 0) continue;
      expect(getBeachVisibleUnitIds(at, .01, 0).has(id)).toBe(true);
    }
  };
  for (const unit of JIMI_BEACH_UNITS) {
    for (const spec of [unit.island, unit.prop, ...unit.clouds, ...unit.stars.map(star => ({ ...star, src: star.filled }))]) {
      assertBounds(`board-${unit.boardId}`, unit.y, 100, verticalBounds(spec.x, spec.y, spec.width, imageHeight(spec), 'rotation' in spec ? spec.rotation : 0));
    }
    const card = unit.card;
    assertBounds(`board-${unit.boardId}`, unit.y, 100, verticalBounds(card.x, card.y, card.width, card.height, card.rotation));
  }
  for (const spec of [{ ...JIMI_BEACH_MAIN, x: 0, y: 0 }, ...JIMI_BEACH_MAIN.clouds]) {
    assertBounds('beach-main', JIMI_BEACH_MAIN.y, 195, verticalBounds(spec.x, spec.y, spec.width, imageHeight(spec)));
  }
  for (const reduced of [false, true]) {
    const profile = getJourneyV700MotionProfile(reduced);
    expect(profile.enter.y).toBeLessThanOrEqual(32);
    expect(profile.exit.anticipationScale).toBeLessThanOrEqual(1.25);
  }
});

test('helper depends only on authored data and contains no geometry reads or background work', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../scene-viewport.ts'), 'utf8');
  expect(source).not.toMatch(/document\.|window\.|getBoundingClientRect|offsetHeight|clientHeight|IntersectionObserver|requestAnimationFrame|setTimeout|node:fs/);
});
