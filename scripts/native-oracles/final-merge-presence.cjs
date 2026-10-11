// Read-only immutable Source oracle; never part of the shipping runtime.
const cp=require('node:child_process'),vm=require('node:vm'),ts=require('typescript');
const sourceReference='8e4364e8ee571f16c6322727a9ae79fee5a982eb';
const source=cp.execFileSync('git',['show',sourceReference+':src/modules/final-merge-rules.ts'],{encoding:'utf8'}),m={exports:{}};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:m,exports:m.exports});
let seed=7;const draw=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const recipe=()=>({wild:draw()<.5,value:[0,1,6][Math.floor(draw()*3)],depth:1+Math.floor(draw()*4),alpha:[0,.01,.02,.35,.36,1][Math.floor(draw()*6)],visible:draw()<.8,locked:draw()<.5,destroyed:draw()<.1,pendingRemoval:draw()<.1,beingRemoved:draw()<.1,cleanupQueued:draw()<.1,magnetAffected:draw()<.1,wildDropping:draw()<.3,excluded:draw()<.1});
const tile=c=>({value:c.value,stackDepth:c.depth,special:c.wild?'wild':null,alpha:c.alpha,visible:c.visible,locked:c.locked,destroyed:c.destroyed,_pendingRemoval:c.pendingRemoval,_beingRemoved:c.beingRemoved,_cleanupQueued:c.cleanupQueued,_wildMagnetAffected:c.magnetAffected,_ccWildSpawnDropping:c.wildDropping});
const finish=c=>{const t=tile(c);return {...c,blocks:m.exports.tileBlocksFinalMerge(t,c.excluded?t:{},{}),active:m.exports.tileCountsAsFinalMergeActive(t)}};
const cases=Array.from({length:640},()=>finish(recipe())),snapshots=[];
for(let i=0;i<256;i++) {
 const a=finish(recipe()),b=finish(recipe()),c=finish(recipe()),src=tile(a),dst=tile(b),other=tile(c),roster=[src,dst,other];
 const effectiveSum=draw()<.5?6:src.value+dst.value,magnetWillPull=draw()<.3;
 const expected=m.exports.getFinalMergeSnapshot({activeTilesBeforeMerge:roster.filter(m.exports.tileCountsAsFinalMergeActive),src,dst,effSum:effectiveSum,finalMergeBlockersBefore:roster.filter(t=>m.exports.tileBlocksFinalMerge(t,src,dst)),isWildMagnetMerge:magnetWillPull,hasTilesToPull:magnetWillPull});
 snapshots.push({source:a,destination:b,other:c,effectiveSum,magnetWillPull,expected});
}
process.stdout.write(JSON.stringify({sourceReference,cases,snapshots},null,2)+'\n');
