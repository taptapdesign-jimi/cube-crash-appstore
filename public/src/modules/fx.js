// src/modules/fx.js
// Minimal FX surface used by app.js (stable named exports).

import { Container, Graphics, Text } from 'pixi.js';
import { gsap } from 'gsap';

/* ---------- tiny helpers ---------- */
function autoAdd(parent, child, ttlSec = 0.8){
  try { parent.addChild(child); } catch {}
  if (ttlSec > 0){
    gsap.delayedCall(ttlSec, () => {
      try { parent.removeChild(child); child.destroy?.({ children:true }); } catch {}
    });
  }
}

// Board-local center of a tile (robust against rotG wrappers)
function centerInBoard(board, tile, tileSize = 96){
  if (!board || !tile) return { x:0, y:0 };
  const node = tile.rotG || tile;
  try {
    const g = node.toGlobal({ x:0, y:0 });
    return board.toLocal(g);
  } catch {}
  try {
    const b = tile.getBounds?.();
    if (b) return board.toLocal({ x:b.x + b.width/2, y:b.y + b.height/2 });
  } catch {}
  return {
    x: (tile.x||0) + ((tile.width  ?? tileSize) / 2),
    y: (tile.y||0) + ((tile.height ?? tileSize) / 2),
  };
}

/* ---------- guaranteed stubs so app.js named imports always resolve ---------- */
export function glassCrackAtTile(){ /* noop (disabled effect) */ }
export function woodShardsAtTile(){ /* noop (disabled effect) */ }
export function innerFlashAtTile(){ /* noop (disabled effect) */ }

/* ---------- elastic settle when a tile lands/stack-places ---------- */
// Bigger, juicier "boing" for stack placements.
// Usage: FX.landBounce(tile) — app.js already calls this after merges < 6.
export function landBounce(tile, opts = {}){
  if (!tile) return;
  const g = tile.rotG || tile; // animate the visual group if present

  // Tunables (stronger than before, but still snappy)
  const amp     = opts.amp     ?? 0.14;                 // how much to squash/stretch (±14%)
  const tilt    = opts.tilt    ?? 0.055;                // playful tilt
  const durMain = opts.durMain ?? 0.34;                 // main elastic settle
  const easeOut = opts.easeOut ?? 'elastic.out(1, 0.6)';

  try { gsap.killTweensOf(g.scale); gsap.killTweensOf(g.rotation); } catch {}

  const sx = g.scale?.x ?? 1;
  const sy = g.scale?.y ?? 1;

  // 1) instant pre-impact micro-squash (feels like weight)
  gsap.set(g, { rotation: 0 });
  gsap.fromTo(
    g.scale,
    { x: sx * (1 + amp * 0.35), y: sy * (1 - amp * 0.6) },
    { x: sx * (1 - amp * 0.35), y: sy * (1 + amp), duration: 0.08, ease: 'power2.out' }
  );

  // 2) elastic settle back to 1:1 with a slight overshoot (big boing)
  gsap.to(g.scale, { x: sx, y: sy, duration: durMain, ease: easeOut, delay: 0.08 }); 

  // 3) gentle one-time tilt wiggle (no rapid shaking) 
  gsap.to(g, { rotation: (Math.random() < 0.5 ? -tilt : tilt), duration: 0.10, yoyo: true, repeat: 1, ease: 'sine.inOut', delay: 0.02 });

  // Optional tiny secondary bounce to feel "gummier"
  if (opts.secondary !== false){
    gsap.to(g.scale, {
      x: sx * (1 + amp * 0.10),
      y: sy * (1 - amp * 0.06),
      duration: 0.14,
      ease: 'sine.out',
      delay: 0.10
    });
    gsap.to(g.scale, { x: sx, y: sy, duration: 0.26, ease: 'elastic.out(1, 0.7)', delay: 0.18 });
  }
}

/* ---------- visible multiplier badge (x2, x3, …) ---------- */
export function showMultiplierTile(board, tile, mult = 2, tileSize = 96, life = 0.45){
  // exact center over the tile, in board-local space
  const { x, y } = centerInBoard(board, tile, tileSize);

  const c = new Container();
  c.x = x; c.y = y; c.zIndex = 10000; c.alpha = 0;
  autoAdd(board, c, Math.min(0.9, (life || 0.45) + 0.35)); 

  // When sitting over a Wild, switch to white badge for contrast.
  const overWild =
    !!(tile && (tile.special === 'wild' || tile.isWildFace === true || tile.isWild === true));

  const FILL   = overWild ? 0xFFFFFF : 0xAB806E; // white over wild, taupe otherwise
  const STROKE = overWild ? 0xE6DCD2 : 0xFAEDE0; // soft stroke
  const TXT    = overWild ? 0x6B5444 : 0xF5F5F5; // readable text
  const rr     = tileSize * 0.28;

  // disk + ring + soft outer halo
  const disk = new Graphics();
  disk.circle(0, 0, rr).fill({ color: FILL, alpha: 1.0 });
  c.addChild(disk);

  const ring = new Graphics();
  ring.circle(0, 0, rr).stroke({ color: STROKE, width: 1.4, alpha: 0.9 });

  const halo = new Graphics();
  halo.circle(0, 0, rr * 1.08).stroke({ color: STROKE, width: 3.0, alpha: 0.20 });
  c.addChild(halo, ring);

  const t = new Text({
    text: `×${mult}`,
    style: { fill: TXT, fontSize: Math.round(tileSize * 0.26), fontWeight: '800' }
  });
  t.anchor.set(0.5);
  c.addChild(t);

  // animation: elastic pop with subtle wiggle → brief hold → elastic shrink
  const tl = gsap.timeline();
  c.scale.set(0.12);
  const hold = Math.max(0.05, Math.min(0.14, (life || 0.45) - 0.30));
  tl.to(c,       { alpha: 1,              duration: 0.06, ease: 'power2.out' }, 0)
    .to(c.scale, { x: 1.26, y: 1.26,     duration: 0.18, ease: 'elastic.out(1, 0.55)' }, 0)
    .to(c.scale, { x: 1.00, y: 1.00,     duration: 0.10, ease: 'back.out(3)' }, '>-0.06')
    .to(c,       { rotation: 0.05,       duration: 0.08, ease:'sine.inOut', yoyo:true, repeat:1 }, '<')
    .to(c.scale, { x: 0.0,  y: 0.0,      duration: 0.22, ease: 'elastic.in(1, 0.6)' }, `+=${hold}`)
    .to(c,       { alpha: 0,             duration: 0.16, ease: 'power1.in' }, '<');
}

/* ---------- “book‑thud” cartoony dust burst for merge‑6 ---------- */
export function smokeBubblesAtTile(board, tile, tileSize = 96, strength = 1){
  const { x, y } = centerInBoard(board, tile, tileSize);
  const layer = new Container();
  layer.x = x; layer.y = y;
  layer.zIndex = 9990; // under multiplier badge
  autoAdd(board, layer, 1.0); 

  // fast clusters at edges → explode outward (kept short & punchy)
  const COUNT      = Math.round((44 + Math.random()*14) * Math.max(1, strength)); // 44–58
  const BASE_R     = Math.max(4, Math.round(tileSize * 0.034));
  const MAX_R      = Math.max(12, Math.round(tileSize * 0.16));
  const INSET      = tileSize * 0.02;             // spawn just inside the edge
  const OUT_MIN    = tileSize * 0.15;             // closer outside the tile
  const OUT_MAX    = tileSize * 0.34;             // reduced distance for closer burst
  const BURSTS     = 5;                            // clustered emission
  const BURST_GAP  = 0.035;                        // rapid-fire rhythm

  const spawnOnSide = (side)=>{
    const half = tileSize * 0.5;
    const along = (Math.random()*(tileSize - INSET*2)) - (tileSize/2 - INSET);
    if (side===0) return { sx: along,          sy: -half + INSET }; // top
    if (side===1) return { sx: +half - INSET,  sy: along        }; // right 
    if (side===2) return { sx: along,          sy: +half - INSET }; // bottom
    return              { sx: -half + INSET,   sy: along        }; // left
  };

  for (let b=0; b<BURSTS; b++){
    const burstDelay = b * BURST_GAP;
    const perBurst   = Math.ceil(COUNT / BURSTS);

    for (let i=0; i<perBurst; i++){
      const g = new Graphics();
      let r0 = BASE_R + Math.random() * (MAX_R - BASE_R);
      if (Math.random() < 0.22) r0 *= (1.35 + Math.random()*0.9); // a few oversized puffs
      g.circle(0, 0, r0).fill({ color: 0xFFFFFF, alpha: 1.0 });
      g.alpha = 0.0;
      g.blendMode = 'add';
      layer.addChild(g);

      const side = (i + b) % 4;
      const { sx, sy } = spawnOnSide(side);

      g.x = sx; g.y = sy;

      // spawn already fairly big (no wiggle), then move and vanish
      const startScale = 0.65 + Math.random()*0.25;
      g.scale.set(startScale);

      // contained scatter: bias direction along the outward normal of the chosen edge,
      // with a limited cone so it doesn’t look like fireworks
      const normals = [
        { nx: 0,  ny: -1 }, // top    → up
        { nx: 1,  ny:  0 }, // right  → right
        { nx: 0,  ny:  1 }, // bottom → down
        { nx: -1, ny:  0 }, // left   → left
      ];
      const { nx, ny } = normals[side]; 
      const baseAngle = Math.atan2(ny, nx);
      const SPREAD = 0.9; // ~50° cone
      const theta = baseAngle + (Math.random() - 0.5) * SPREAD;

      const distance = OUT_MIN + Math.random() * (OUT_MAX - OUT_MIN);
      const dx = sx + Math.cos(theta) * distance;
      const dy = sy + Math.sin(theta) * distance;

      // small drift so it’s not perfectly radial
      const driftX = (Math.random()-0.5) * (tileSize * 0.06);
      const driftY = (Math.random()-0.5) * (tileSize * 0.06);

      // timings: snappy spawn, short outward rush, tiny hold, quick vanish
      const tIn   = 0.018 + Math.random()*0.022; // very quick in
      const tRun  = 0.16  + Math.random()*0.12;  // quick outward push
      const tHold = 0.02  + Math.random()*0.03;  // barely a breath
      const tOut  = 0.08  + Math.random()*0.06;  // quick pop-out

      const stg = burstDelay + Math.random()*0.018;
      const tl = gsap.timeline({
        defaults: { overwrite: false },
        onComplete: ()=>{ try{ if(g && g.parent){ g.parent.removeChild(g); g.destroy(); } }catch{} }
      });

      tl.to(g, { alpha: 0.95, duration: tIn, ease: 'power2.out' }, stg)
        .to(g, { x: dx + driftX, y: dy + driftY, duration: tRun, ease: 'sine.out' }, `>${0}`)
        .to(g, { alpha: 0.95, duration: tHold, ease: 'none' }, `>${0}`)
        .to(g, { alpha: 0, duration: tOut, ease: 'power1.in' }, `>${0}`);
    }
  }

  // subtle global halo under everything
  const halo = new Graphics();
  const rr = tileSize * (0.22 + 0.05*strength); 
  halo.circle(0, 0, rr).fill({ color: 0xFFFFFF, alpha: 0.10 });
  halo.alpha = 0;
  layer.addChildAt(halo, 0);
  gsap.to(halo, { alpha: 0.22, duration: 0.08, ease: 'power2.out' });
  gsap.to(halo, { alpha: 0, duration: 0.28, delay: 0.18, ease: 'power2.in',
    onComplete: ()=>{ try{ layer.removeChild(halo); halo.destroy(); }catch{} }
  });
}

// Subtle screen shake for impactful events (e.g., merge-6)
export function screenShake(app, opts = {}){
  try {
    const target = app?.canvas || app?.view || null;
    if (!target) return;
    const {
      duration = 0.35,
      strength = 18,   // px amplitude (pojačano)
      steps    = 15,   // jitter steps (više koraka)
      ease     = 'sine.inOut',
    } = opts || {};

    // kill any ongoing shake
    try { gsap.killTweensOf(target); } catch {}

    const tl = gsap.timeline({
      onComplete: () => { try { gsap.set(target, { x: 0, y: 0 }); } catch {} }
    });
    const dt = Math.max(0.01, duration / Math.max(1, steps));
    for (let i = 0; i < steps; i++){
      const p = 1 - (i / steps);
      const amp = strength * p * p; // quadratic decay
      const dx = (Math.random() * 2 - 1) * amp;
      const dy = (Math.random() * 2 - 1) * amp;
      tl.to(target, { x: dx, y: dy, duration: dt, ease }, 0 + i * dt);
    }
    tl.to(target, { x: 0, y: 0, duration: Math.min(0.12, duration * 0.45), ease: 'power2.out' }, '>');
  } catch {}
}
