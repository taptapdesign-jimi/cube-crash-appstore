import { gsap } from 'gsap';
import animationManager from '../animation-manager';
import { attachBoltSprites } from '../text-bolts';
import { attachBeeFinaleScene } from '../bee-finale-scene';
import { attachSpaceshipFinaleScene, getSpaceshipDebrisMotion, SPACESHIP_PULL_PLAN, SPACESHIP_DEBRIS_HIDE_DELAY_SECONDS } from '../spaceship-finale-scene';

function trackTimelines() {
  const timelines: gsap.core.Timeline[] = [];
  jest.spyOn(animationManager, 'trackExternalTimeline').mockImplementation((tl) => { timelines.push(tl); return tl; });
  return timelines;
}

afterEach(() => { document.body.replaceChildren(); });

test('Spaceship debris stays hidden on later frames and replays after backwards seek', () => {
  const timelines = trackTimelines();
  const overlay = document.createElement('div'); document.body.append(overlay);
  const cleanup = attachSpaceshipFinaleScene(overlay, { exitRandom: () => 0 });
  try {
    timelines.forEach((tl) => tl.pause(0));
    const item = SPACESHIP_PULL_PLAN[0];
    const node = overlay.querySelector<HTMLElement>(`.cc-spaceship-finale-debris-mover[data-spaceship-debris="${item.id}"]`)!;
    const arrival = getSpaceshipDebrisMotion(item).arrivalAt;
    const hide = arrival + SPACESHIP_DEBRIS_HIDE_DELAY_SECONDS + 0.001;
    const paint = (time: number) => { timelines[0].seek(time, true); timelines[0].eventCallback('onUpdate')?.(); };
    paint(hide);
    expect(Number(node.style.opacity)).toBe(0);
    expect(Number(gsap.getProperty(node, 'scaleX'))).toBeCloseTo(0.06);
    const observer = new MutationObserver(() => {});
    observer.observe(node, { subtree: true, attributes: true });
    try {
      paint(hide + 1 / 60); paint(hide + 2 / 60);
      expect(Number(node.style.opacity)).toBe(0);
      expect(observer.takeRecords()).toHaveLength(0);
      paint(arrival - 0.1);
      expect(Number(node.style.opacity)).toBe(1);
      paint(hide);
      expect(Number(node.style.opacity)).toBe(0);
      paint(hide + 1 / 60);
      expect(Number(node.style.opacity)).toBe(0);
    } finally { observer.disconnect(); }
  } finally { cleanup(); }
});

test('Honey snapshots each live pose once while matching the original eight-pass relaxation exactly', () => {
  jest.spyOn(Math, 'random').mockReturnValue(0.5);
  const timelines = trackTimelines();
  let tick: (() => void) | undefined;
  jest.spyOn(gsap.ticker, 'add').mockImplementation((callback) => { tick = callback as () => void; return callback; });
  jest.spyOn(gsap.ticker, 'remove').mockImplementation(() => {});
  const overlay = document.createElement('div'); document.body.append(overlay);
  const cleanup = attachBoltSprites(overlay, { count: 8, motion: { beeFlight: true } });
  try {
    timelines.forEach((tl) => tl.pause());
    const nodes = Array.from(overlay.querySelectorAll<HTMLElement>('.cc-bolt-sprite'));
    nodes.forEach((node, index) => { node.style.left = `${index * 9}px`; node.style.top = `${index * 4}px`; });
    const expected = nodes.map(() => ({ x: 0, y: 0 }));
    let frame = 0;
    const pose = (index: number) => ({ x: index * 3 + frame, y: -index * 2 + frame * 0.5, scale: 0.7 + index * 0.03 });
    const get = jest.spyOn(gsap, 'getProperty').mockImplementation(((target: HTMLElement, property: string) => {
      const index = nodes.indexOf(target);
      if (property === 'opacity') return index === 7 && frame === 1 ? 0 : 1;
      return pose(index)[property as 'x' | 'y' | 'scale'];
    }) as typeof gsap.getProperty);
    for (frame = 0; frame < 3; frame++) {
      const visible = nodes.map((_, index) => index).filter((index) => !(index === 7 && frame === 1));
      expected.forEach((offset) => { offset.x *= 0.9; offset.y *= 0.9; });
      // Reference preserves the old first-point snapshot per outer iteration,
      // including offsets updated earlier in the same relaxation pass.
      for (let pass = 0; pass < 8; pass++) for (let i = 0; i < visible.length; i++) {
        const a = visible[i], pa = pose(a);
        const ax = a * 9 + pa.x + expected[a].x, ay = a * 4 + pa.y + expected[a].y;
        for (let j = i + 1; j < visible.length; j++) {
          const b = visible[j], pb = pose(b);
          let dx = b * 9 + pb.x + expected[b].x - ax, dy = b * 4 + pb.y + expected[b].y - ay;
          let distance = Math.hypot(dx, dy);
          const minimum = ((66.5 * pa.scale + 66.5 * pb.scale) * 0.5) * 1.6;
          if (distance >= minimum) continue;
          if (distance < 0.001) { const angle = i * 2.399963229728653 + j * 0.71; dx = Math.cos(angle); dy = Math.sin(angle); distance = 1; }
          const correction = (minimum - distance) * 0.51;
          const cx = dx / distance * correction, cy = dy / distance * correction;
          expected[a].x -= cx; expected[a].y -= cy; expected[b].x += cx; expected[b].y += cy;
        }
      }
      get.mockClear(); tick!();
      expect(get).toHaveBeenCalledTimes(nodes.length + visible.length * 3);
      nodes.forEach((node, index) => expect(node.style.translate).toBe(`${expected[index].x.toFixed(2)}px ${expected[index].y.toFixed(2)}px`));
    }
  } finally { cleanup(); }
});

test('Bee repeated identical poses avoid style/data writes while movement and leaf visibility still update', () => {
  const timelines = trackTimelines();
  const overlay = document.createElement('div'); document.body.append(overlay);
  const cleanup = attachBeeFinaleScene(overlay, 1, { x: 195, y: 430 });
  try {
    const sampler = timelines[0].getChildren().find((child) => child.vars.time === 4) as gsap.core.Tween;
    const clock = sampler.targets()[0] as { time: number };
    const paint = (time: number) => { clock.time = time; sampler.vars.onUpdate!(); };
    paint(0.4); paint(0.4);
    const hero = overlay.querySelector<HTMLElement>('.cc-bee-finale-hero')!;
    const pose = hero.style.transform;
    const observer = new MutationObserver(() => {});
    observer.observe(overlay, { subtree: true, attributes: true });
    try {
      paint(0.4);
      expect(observer.takeRecords()).toHaveLength(0);
      paint(0.8);
      expect(hero.style.transform).not.toBe(pose);
      expect(observer.takeRecords().length).toBeGreaterThan(0);
      paint(3.9); paint(3.9);
      observer.takeRecords(); paint(3.9);
      expect(observer.takeRecords()).toHaveLength(0);
      paint(0.4);
      expect(Array.from(overlay.querySelectorAll<HTMLElement>('.cc-bee-finale-leaf-wrap')).some((leaf) => leaf.style.visibility === 'visible')).toBe(true);
    } finally { observer.disconnect(); }
  } finally { cleanup(); }
});
