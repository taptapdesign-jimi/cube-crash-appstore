/** @jest-environment jsdom */
import {
  attachLaserGunFinaleScene, setActiveLaserGunFinaleTargets,
} from '../lasergun-finale-scene';

type Point = { x: number; y: number };
const rotate = (p: Point, degrees: number): Point => {
  const a = degrees * Math.PI / 180;
  return { x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) };
};
// Independent authored CSS hierarchy: aim -> reflected orientation -> rig.
function marker(side: 'left' | 'right', width: number, scale: number, left: number, top: number, aim: number, kind: 'axis' | 'barrel'): Point {
  const height = width * 183 / 200;
  const ratio = kind === 'axis' ? [0.72, 0.58] : [0.24, 0.32];
  let p = rotate({ x: width * (ratio[0] - 0.5) + 0.5, y: height * (ratio[1] - 0.5) + 0.5 }, aim);
  if (side === 'left') p = rotate({ x: -p.x, y: p.y }, 45);
  p = rotate(p, side === 'left' ? 0 : -8);
  return { x: left + width / 2 + p.x * scale, y: top + height / 2 + p.y * scale };
}

test('actual scene converges against the transformed DOM markers instead of a projected snapshot', () => {
  const rect = (x: number, y: number, width: number, height: number) => ({ x, y, left: x, top: y, width, height, right: x + width, bottom: y + height, toJSON() {} } as DOMRect);
  const markerReads = jest.fn();
  const spy = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
    const rig = this.closest<HTMLElement>('.cc-lasergun-rig');
    if (!rig) return rect(13, 21, 390, 844);
    const side = rig.classList.contains('cc-lasergun-rig-left') ? 'left' : 'right';
    const left = Number.parseFloat(rig.style.left) || 0, top = Number.parseFloat(rig.style.top) || 0;
    const scale = Number((rig as any)._gsap?.scaleX) || 1;
    const width = 273, height = width * 183 / 200;
    if (this === rig || !this.className.includes('-marker')) return rect(13 + left + width / 2 - width * scale / 2, 21 + top + height / 2 - height * scale / 2, width * scale, height * scale);
    const kind = this.classList.contains('cc-lasergun-axis-marker') ? 'axis' : 'barrel';
    markerReads();
    const aim = Number.parseFloat((rig.querySelector('.cc-lasergun-aim') as any)?._gsap?.rotation || '0') || 0;
    const point = marker(side, width, scale, left, top, aim, kind);
    return rect(13 + point.x - 0.5, 21 + point.y - 0.5, 1, 1);
  });
  const overlay = document.createElement('div'); document.body.append(overlay);
  const cleanup = attachLaserGunFinaleScene(overlay, { random: () => 0.5 });
  try {
    void setActiveLaserGunFinaleTargets([
      { x: 80, y: 180, shooter: 'right' }, { x: 310, y: 300, shooter: 'left' },
      { x: 100, y: 500, shooter: 'right' }, { x: 300, y: 650, shooter: 'left' },
    ]);
    expect(overlay.querySelectorAll('.cc-lasergun-rig')).toHaveLength(4);
    // Each rig needs more than the initial axis+barrel snapshot. This protects
    // WebKit mirror/scale/rotation composition from being approximated by the
    // same arithmetic model used by the test.
    expect(markerReads.mock.calls.length).toBeGreaterThan(8);
  } finally { cleanup(); overlay.remove(); spy.mockRestore(); }
});
