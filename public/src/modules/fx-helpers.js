import { Container, Graphics } from 'pixi.js';
import { gsap } from 'gsap';

/**
 * Stronger, juicier elastic "boing" when tile se spusti/stacka na drugu.
 * Ovo NE dira merge-6 efekte; koristi se kod standardnog spajanja (<6) i
 * kad pločica "sjedne" na mjesto.
 *
 * @param {PIXI.DisplayObject} tile - tile container; koristimo tile.rotG ako postoji
 * @param {Object} [opts]
 *   amp:     0..1  koliki squash/stretch (default 0.18)
 *   tilt:    radijani nagiba za playful feel (default 0.07)
 *   leadIn:  s trajanje inicijalnog "udarca" (default 0.12)
 *   settle:  trajanje glavnog elastic settle-a (default 0.42)
 *   secondary:  hoćemo li mali sekundarni povrat (default true)
 */
export function landBounce(tile, opts = {}) {
  if (!tile) return;

  // Pulsiraj CIJELI tile (ne rotG), da puls bude ravnomjeran oko centra
  const host = tile;

  // kraći, elastični puls (uniformno), bez rotacije
  const A       = opts.amp     ?? 0.16;  // squash/stretch
  const leadIn  = opts.leadIn  ?? 0.07;  // mrvicu duži udar
  const settle  = opts.settle  ?? 0.26;  // nježnije, duže smirivanje

  try { gsap.killTweensOf(host); gsap.killTweensOf(host.scale); } catch {}

  const sx = (host.scale && host.scale.x) || 1;
  const sy = (host.scale && host.scale.y) || 1;

  const tl = gsap.timeline();

  // 1) micro-impact (simetrični squash/stretch oko centra)
  tl.fromTo(
    host.scale,
    { x: sx * (1 + A * 0.30), y: sy * (1 - A * 0.65) },
    { x: sx * (1 - A * 0.20), y: sy * (1 + A * 0.70), duration: leadIn, ease: 'power2.out' }
  );

  // 2) elastic settle natrag na 1:1 (mekši završetak)
  tl.to(host.scale, { x: sx, y: sy, duration: settle, ease: 'elastic.out(1, 0.8)' }, '>-0.01');
}

/* ---------- Wild Loader FX (helper used by HUD) ---------- */
/**
 * Create a fluid wild-meter loader with:
 *  - fixed 8px track height
 *  - flat top edge (no jitter)
 *  - brighter, denser bubbles
 * Returns controller: { view, start, stop, setProgress, destroy }
 *
 * NOTE: This is a pure helper — it does NOT add itself to stage.
 * Caller should add `ctrl.view` to desired parent container.
 */
export function createWildLoaderFX({
  width = 300,
  color = 0xD59477,
  trackColor = 0xEBE2D8,
  bubbleRate = 42,    // ↑ denser per second
} = {}) {
  const view = new Container();
  view.name = 'wild-loader-fx';

  // Track (8px height)
  const H = 8;
  const track = new Graphics();
  track.roundRect(0, 0, width, H, H/2).fill(trackColor);
  view.addChild(track);

  // Fill + mask (wavy top)
  const fill = new Graphics();
  fill.roundRect(0, 0, width, H, H/2).fill(color);
  view.addChild(fill);

  const mask = new Graphics();
  view.addChild(mask);
  fill.mask = mask;

  // Bubble layer (above fill)
  const bubbles = new Container(); 
  view.addChild(bubbles);

  let progress = 0;   // 0..1
  let running = false;

  function redrawMask() {
    const w = width;
    mask.clear();

    const waveY = (H * (1 - progress));

    // Build a flat polygon mask (no sine wave) 
    mask.beginFill(0xFFFFFF, 1); 
    mask.moveTo(0, 0);
    mask.lineTo(w, 0);
    mask.lineTo(w, H);
    mask.lineTo(0, H);
    mask.lineTo(0, 0);
    mask.endFill();
  } 

  // Simple bubble sprite as Graphics circle
  function spawnBubble() {
    const g = new Graphics();
    const r = 2.2 + Math.random() * 5.2; // bigger range, chunkier comic bubbles
    g.circle(0, 0, r).fill(0xFFFFFF, 1.0);
    g.alpha = 0.0;

    // Spawn along current fill line (flat top)
    const x0 = Math.random() * width;
    const waveY = H * (1 - progress);
    const y0 = Math.min(Math.max(waveY, 1), H - 1);

    g.x = x0;
    g.y = y0;

    bubbles.addChild(g);

    // Stronger motion but still contained inside the 8px bar
    const rise  = 3 + Math.random() * 7;          // rise inside the bar
    const drift = (Math.random() - 0.5) * 10;      // lateral sway
    const life  = 0.65 + Math.random() * 0.45;     // a bit longer on screen
    const scaleUp = 1.25 + Math.random() * 0.45;   // punchier pop size

    const tl = gsap.timeline({
      onComplete: () => { try { bubbles.removeChild(g); g.destroy(); } catch {} }
    });

    // punchy pop in
    tl.to(g, { alpha: 1, duration: 0.06, ease: 'sine.out' }, 0)
      .to(g.scale, { x: scaleUp, y: scaleUp, duration: Math.min(0.22, life * 0.35), ease: 'elastic.out(1, 0.7)' }, 0)
      .to(g, { x: x0 + drift, y: g.y - rise, duration: life, ease: 'sine.inOut' }, 0)
      .to(g, { alpha: 0, duration: Math.min(0.16, life * 0.35), ease: 'sine.in' }, Math.max(0, life - 0.16));

    // micro “shimmy” to feel more lively (scale + slight rotation)
    gsap.to(g.scale, { x: '+=0.10', y: '+=0.10', duration: 0.18, repeat: Math.ceil(life / 0.18), yoyo: true, ease: 'sine.inOut' });
    gsap.to(g, { rotation: (Math.random() * 0.18) - 0.09, duration: 0.22, repeat: Math.ceil(life / 0.22), yoyo: true, ease: 'sine.inOut' });
  }

  let bubbleAccumulator = 0; 

  const tick = (dt) => {
    // dt is in seconds on gsap.ticker
    if (!running) return;

    redrawMask();

    // spawn bubbles at target rate (per second)
    bubbleAccumulator += bubbleRate * dt;
    while (bubbleAccumulator >= 1) {
      spawnBubble();
      // occasional mini-burst
      if (Math.random() < 0.25) spawnBubble();
      bubbleAccumulator -= 1;
    }
  };

  function start() {
    if (running) return;
    running = true;
    gsap.ticker.add(tick);
  }
  function stop() {
    if (!running) return;
    running = false;
    gsap.ticker.remove(tick);
  }
  function setProgress(ratio, animate = false) {
    const target = Math.max(0, Math.min(1, ratio || 0)); 
    if (!animate) {
      progress = target;
      redrawMask();
      return;
    }
    const obj = { p: progress };
    gsap.to(obj, {
      p: target, duration: 0.25, ease: 'power2.out',
      onUpdate: () => { progress = obj.p; redrawMask(); }
    });
  }
  function destroy() {
    stop();
    try { bubbles.removeChildren(); } catch {}
    try { view.removeChildren(); } catch {}
    try { view.destroy({ children: true }); } catch {}
  }

  // initial draw
  redrawMask();

  return { view, start, stop, setProgress, destroy };
}

// default export koji app.js očekuje kao FX.landBounce
export default {
  landBounce,
};
