// @ts-nocheck
import { gsap } from 'gsap';
import animationManager from './animation-manager.js';

const trackTimeline = (options: any = {}) => animationManager.trackExternalTimeline(gsap.timeline(options));

interface LandBounceOptions {
  amp?: number;      // 0..1  koliki squash/stretch (default 0.18)
  tilt?: number;     // radijani nagiba za playful feel (default 0.07)
  leadIn?: number;   // s trajanje inicijalnog "udarca" (default 0.12)
  settle?: number;   // trajanje glavnog elastic settle-a (default 0.42)
  secondary?: boolean;  // hoćemo li mali sekundarni povrat (default true)
}

/**
 * Stronger, juicier elastic "boing" when tile se spusti/stacka na drugu.
 * Ovo NE dira merge-6 efekte; koristi se kod standardnog spajanja (<6) i
 * kad pločica "sjedne" na mjesto.
 *
 * @param tile - tile container; koristimo tile.rotG ako postoji
 * @param opts - animation options
 */
export function landBounce(tile: any, opts: LandBounceOptions = {}): void {
  if (!tile) return;

  // Pulsiraj CIJELI tile (ne rotG), da puls bude ravnomjeran oko centra
  const host = tile;

  // kraći, elastični puls (uniformno), bez rotacije
  const A = opts.amp ?? 0.16;  // squash/stretch
  const leadIn = opts.leadIn ?? 0.07;  // mrvicu duži udar
  const settle = opts.settle ?? 0.26;  // nježnije, duže smirivanje

  try {
    gsap.killTweensOf(host);
    gsap.killTweensOf(host.scale);
  } catch {}

  const sx = (host.scale && host.scale.x) || 1;
  const sy = (host.scale && host.scale.y) || 1;

  const tl = trackTimeline();

  // 1) micro-impact (simetrični squash/stretch oko centra)
  tl.fromTo(
    host.scale,
    { x: sx * (1 + A * 0.30), y: sy * (1 - A * 0.65) },
    { x: sx * (1 - A * 0.20), y: sy * (1 + A * 0.70), duration: leadIn, ease: 'power2.out' }
  );

  // 2) elastic settle natrag na 1:1 (mekši završetak)
  tl.to(host.scale, { x: sx, y: sy, duration: settle, ease: 'elastic.out(1, 0.8)' }, '>-0.01');
}

// default export koji app.js očekuje kao FX.landBounce
export default {
  landBounce,
};
