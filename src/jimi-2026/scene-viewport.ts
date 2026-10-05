import { JIMI_BEACH_MAIN, JIMI_BEACH_UNITS } from './scene-catalog.js';

export type BeachUnitId = 'header' | 'beach-main' | `board-${number}`;

// Authored visual envelopes, not the smaller wrapper border boxes. Board cards
// rise above their island and clouds overflow both ends. Tests check these
// conservative ranges against the original PNG ratios and rotated child art.
// 1.25 bounds the standard enter/exit Back overshoot; 32px covers enter's 30px
// translation plus rounding. Expand around each wrapper's actual center.
const MAX_SCALE = 1.25;
const TRANSLATION_MARGIN = 32;
const DEFAULT_OVERSCAN = 100;
const range = (id: BeachUnitId, y: number, min: number, max: number, origin: number) => Object.freeze({
  id,
  top: y + origin + (min - origin) * MAX_SCALE - TRANSLATION_MARGIN,
  bottom: y + origin + (max - origin) * MAX_SCALE + TRANSLATION_MARGIN,
});
const ranges = Object.freeze([
  range('beach-main', JIMI_BEACH_MAIN.y, -60, 450, 195),
  ...JIMI_BEACH_UNITS.map(unit => range(`board-${unit.boardId}`, unit.y, -100, 330, 100)),
]);

/** Animation admission only: never hides/detaches art or gates resource loading.
 * Input coordinates belong to the existing .jimi-scroll owner, in CSS pixels.
 * Sample again for each transition; do not reuse a selection after scrolling.
 * There are no DOM reads, observers, timers or progression writes here.
 */
export function getBeachVisibleUnitIds(
  scrollTop: number,
  viewportHeight: number,
  overscan = DEFAULT_OVERSCAN,
): ReadonlySet<BeachUnitId> {
  const ids = new Set<BeachUnitId>(['header']);
  // Missing/stale viewport dimensions must not accidentally exclude artwork.
  const unknown = !Number.isFinite(scrollTop) || !Number.isFinite(viewportHeight)
    || viewportHeight <= 0 || !Number.isFinite(overscan);
  const top = Math.max(0, scrollTop) - Math.max(0, overscan);
  const bottom = Math.max(0, scrollTop) + viewportHeight + Math.max(0, overscan);
  for (const unit of ranges) {
    if (unknown || (unit.bottom >= top && unit.top <= bottom)) ids.add(unit.id);
  }
  return ids;
}
