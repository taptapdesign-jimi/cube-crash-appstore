// public/src/modules/level-flow.js

export function checkLevelEnd({ makeBoard, tiles, onCleanBoard } = {}){
  if (!makeBoard?.anyMergePossible || !Array.isArray(tiles)) return;
  if (!makeBoard.anyMergePossible(tiles)) onCleanBoard?.();
}

export async function openLockedBounceParallel({ tiles=[], k=0, drag, makeBoard, gsap, drawBoardBG, TILE, fixHoverAnchor, spawnBounce, wildMergeTarget=null } = {}){
  const locked = tiles.filter(t => t.locked);
  if (!locked.length || k <= 0) return;

  for (let i=locked.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [locked[i],locked[j]]=[locked[j],locked[i]]; }
  const picks = locked.slice(0, Math.min(k, locked.length));

  const promises = picks.map(t => new Promise(res=>{
    t.locked=false; t.eventMode='static'; t.cursor='pointer';
    if (drag && typeof drag.bindToTile === 'function') drag.bindToTile(t);
    
    // Smart spawning: if this is after wild merge, avoid the target number
    let spawnValue;
    if (wildMergeTarget) {
      // Import pickWildValue function (assuming it's available globally or we need to pass it)
      const candidates = [1,2,3,4,5].filter(v => v !== wildMergeTarget);
      spawnValue = candidates[(Math.random() * candidates.length) | 0];
      console.log('🎯 Smart spawn: avoiding', wildMergeTarget, 'spawning', spawnValue);
    } else {
      spawnValue = [1,2,3,4,5][(Math.random()*5)|0];
    }
    
    makeBoard.setValue(t, spawnValue, 0);
    try { fixHoverAnchor?.(t); } catch {}
    spawnBounce(t, res, { max: 1.08, compress: 0.96, rebound: 1.02, startScale: 0.30, wiggle: 0.035 });
  }));
  await Promise.all(promises);
  try { drawBoardBG?.(); } catch {}
}

export async function checkGameOver({
  makeBoard, tiles, hasWildOnBoard,
  getScore, setScore, bestScore, updateBest, updateHUD, ENDLESS,
  showStarsModal, app, stage, board,
  level, startLevel,
  animateScore,
  wildAPI, openEmpties, isBoardClean, gsap
} = {}){
  if (makeBoard?.anyMergePossible?.(tiles)) return;
  if (hasWildOnBoard?.()) return;

  // mali bonus kad ostanu 2 tile-a
  const active = tiles.filter(t => !t.locked && t.value > 0);
  if (active.length === 2){
    const add = (active[0].value|0) + (active[1].value|0);
    setScore(Math.min(999999, (getScore?.()|0) + Math.max(0, add))); updateHUD?.();
  }

  if ((getScore?.()|0) > (bestScore|0)){ updateBest?.(getScore?.()|0); updateHUD?.(); }

  const { pass } = await showStarsModal?.({
    app, stage, board, score: getScore?.(),
    thresholds:{one:200,two:300,three:360},
    ...(ENDLESS ? { buttonLabel:'Keep Going' } : {})
  }) ?? { pass:false };

  if (ENDLESS){
    if (pass){
      startLevel?.(level + 1);
    } else {
      startLevel?.(level);
    }
    return;
  }

  if (pass){
    startLevel?.(level + 1);
  } else {
    setScore(0); updateHUD?.();
    startLevel?.(level);
  }
}