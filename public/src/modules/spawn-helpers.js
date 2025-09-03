// public/src/modules/spawn-helpers.js
// Spawn/deal animacije – iOS friendly, Promise-based, bez side‑effecta izvan proslijeđenih argumenata.

export function spawnBounce(t, gsap, opts = {}, done){
  const {
    startScale = 0.30,
    max       = 1.08,
    compress  = 0.96,
    rebound   = 1.02,
    wiggle    = 0.035,
    fadeIn    = 0.10
  } = opts || {};

  const trg = t.rotG || t;
  t.alpha = 0;
  t.scale.set(startScale);

  const dir = Math.random() < 0.5 ? 1 : -1;
  const finish = () => { t._spawned = true; if (typeof done === 'function') done(); };
  const tl = gsap.timeline({ onComplete: finish });

  tl.to(t,       { alpha: 1,            duration: fadeIn,  ease: 'power1.out' }, 0)
    .to(t.scale, { x: max,  y: max,     duration: 0.12,    ease: 'back.out(2.1)' }, 0)
    .to(t.scale, { x: compress, y: compress, duration: 0.08, ease: 'power2.inOut' })
    .to(t.scale, { x: rebound,  y: rebound,  duration: 0.08, ease: 'power2.out' })
    .to(t.scale, { x: 1.00,     y: 1.00,     duration: 0.10, ease: 'back.out(2)' });

  gsap.timeline()
    .to(trg, { rotation:  wiggle*dir,        duration: 0.08, ease: 'power2.out' })
    .to(trg, { rotation: -wiggle*0.6*dir,    duration: 0.10, ease: 'power2.out' })
    .to(trg, { rotation:  0,                 duration: 0.12, ease: 'power2.out' });
}

export function sweepForUnanimatedSpawns(tiles, gsap){
  try{
    tiles.forEach(t=>{
      if (!t || t.locked) return;
      if (!t._spawned){
        spawnBounce(t, gsap, { max: 1.08, compress: 0.96, rebound: 1.02, startScale: 0.30, wiggle: 0.035 });
      }
    });
  }catch{}
}

export function dealFromRim({ listTiles = [], board, boardSize, gsap } = {}){
  // brži deal-in – uvijek vraća Promise
  return new Promise(resolve=>{
    if (!Array.isArray(listTiles) || listTiles.length === 0) { resolve(); return; }
    const size = boardSize || { w: 0, h: 0 };
    const center={x:size.w/2,y:size.h/2};
    const ring=Math.max(size.w,size.h)*0.65;

    const list=[...listTiles]; for(let i=list.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [list[i],list[j]]=[list[j],list[i]]; }
    let done=0;

    list.forEach((t)=>{
      const target={x:t.x,y:t.y}; t.visible=true; t.zIndex=100; board.sortChildren?.();
      const dx=target.x-center.x, dy=target.y-center.y; const len=Math.hypot(dx,dy)||1; const ux=dx/len, uy=dy/len; const sx=target.x+ux*ring, sy=target.y+uy*ring;
      const enterDur=0.62+Math.random()*0.18; const enterDel=0.04+Math.random()*0.12;
      t.position.set(sx,sy); t.scale.set(0.94+Math.random()*0.04);
      const tl=gsap.timeline({ delay:enterDel, onComplete:()=>{ t.zIndex=10; t._spawned = true; board.sortChildren?.();

        const r0=t.rotG?.rotation||0; const trg=t.rotG||t; const amp=0.035+Math.random()*0.012;
        if(!t.locked && t.value>0){
          gsap.timeline().to(trg,{rotation:r0+amp,duration:0.08,ease:'power2.out'}).to(trg,{rotation:r0-amp*0.7,duration:0.10,ease:'power2.out'}).to(trg,{rotation:r0+amp*0.35,duration:0.10,ease:'power2.out'}).to(trg,{rotation:r0,duration:0.12,ease:'power2.out'});
          gsap.timeline().to(t.scale,{x:1.02,y:1.02,duration:0.08,ease:'power2.out'}).to(t.scale,{x:0.996,y:0.996,duration:0.10,ease:'power2.inOut'}).to(t.scale,{x:1.00,y:1.00,duration:0.12,ease:'power2.out'});
        }else{
          gsap.to(t.scale,{x:1,y:1,duration:0.12,ease:'power1.out'});
        }

        if(++done===list.length) resolve();
      }});
      tl.to(t,{x:target.x,y:target.y,duration:enterDur,ease:'back.out(1.4)'},0)
        .to(t.scale,{x:1,y:1,duration:enterDur,ease:'back.out(1.6)'},0);
    });
  });
}

export async function openEmpties({ count=0, tiles=[], drag, makeBoard, gsap, drawBoardBG, TILE, fixHoverAnchor } = {}){
  if (count <= 0) return;
  const locked = tiles.filter(t => t.locked);
  if (!locked.length) return;

  for (let i=locked.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [locked[i],locked[j]]=[locked[j],locked[i]]; }
  const picks = locked.slice(0, Math.min(count, locked.length));

  await Promise.all(picks.map(t => new Promise(res=>{
    t.locked=false; t.eventMode='static'; t.cursor='pointer';
    if (drag && typeof drag.bindToTile === 'function') drag.bindToTile(t);
    makeBoard.setValue(t, [1,2,3,4,5][(Math.random()*5)|0], 0);
    try { fixHoverAnchor?.(t); } catch {}
    spawnBounce(t, gsap, { max: 1.08, compress: 0.96, rebound: 1.02, startScale: 0.30, wiggle: 0.035 }, res);
  })));

  try { drawBoardBG?.(); } catch {}
  sweepForUnanimatedSpawns(tiles, gsap);
}