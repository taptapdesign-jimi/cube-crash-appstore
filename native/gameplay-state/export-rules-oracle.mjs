import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const cache=new Map();
function load(name) {
 const filename=path.resolve(name).replace(/\.(js|ts)$/,'')+'.ts';
 if(cache.has(filename))return cache.get(filename);
 const exports={};cache.set(filename,exports);
 if(filename.endsWith('/special-dice-idle.ts')) {exports.stopSpecialDiceIdleMotion=()=>{};return exports;}
 if(filename.endsWith('/core/logger.ts')) {exports.logger=new Proxy({}, {get:()=>()=>{}});return exports;}
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const require=dep=> {if(!dep.startsWith('.'))throw Error(`Unexpected runtime dependency ${dep}`);return load(path.resolve(path.dirname(filename),dep));};
 vm.runInNewContext(`(function(exports,require,module){${code}\n})`,{Math,console,Date,performance,window:{},navigator:{},devicePixelRatio:1,Set,Map})(exports,require,{exports});
 return exports;
}
const module=name=>load(`src/modules/${name}.ts`);
const final=module('final-merge-rules'),resolution=module('gameplay-resolution-engine'),snapshots=module('gameplay-snapshot');
const cases=[];
const add=(kind,input,expected)=>cases.push({kind,input,expected});
const tile=(id,value,special=null,extra={})=>({id,value,special,locked:false,visible:true,alpha:1,gridX:Number(id.replace(/\D/g,''))||0,gridY:0,stackDepth:1,...extra});
for(const [valueA,valueB,special,blockers] of [[2,4,null,[]],[2,4,null,[tile('c2',1)]],[3,3,null,[]],[6,1,'wild',[]],[6,2,'wild-juice',[]],[6,3,'wild-magnet',[]],[6,4,'wild-tnt',[]],[6,2,'wild-magnet',[tile('c2',1)]],[2,4,null,[tile('c2',0,null,{locked:true})]],[2,4,null,[tile('c2',1,null,{visible:false})]]]) {
 const src=tile('s0',valueA,special),dst=tile('d1',valueB),tiles=[src,dst,...blockers],effSum=special?6:valueA+valueB;
 const input={tiles,sourceID:src.id,destinationID:dst.id,effSum,hasTilesToPull:special==='wild-magnet'&&blockers.some(t=>t.value>0)};
 const classified=final.getFinalMergeTileSets({tiles,src,dst});
 const snapshot=final.getFinalMergeSnapshot({activeTilesBeforeMerge:classified.activeTilesBeforeMerge,finalMergeBlockersBefore:classified.finalMergeBlockersBefore,src,dst,effSum,isWildMagnetMerge:special==='wild-magnet',hasTilesToPull:input.hasTilesToPull});
 add('finalMerge',input,snapshot);
 for(const mode of ['journey','arcade']) {
  const makeBoard={anyMergePossible:()=>true};
  const snapshot=snapshots.createGameplaySnapshot({tiles,moves:50,src,dst,effSum,mode,phase:'before-merge',makeBoard,flags:{hasTilesToPull:input.hasTilesToPull}});
  add('resolver',{...input,mode,anyMergePossible:true,phase:'before-merge'},resolution.resolveGameplayState(snapshot));
 }
}
const regular=module('regular-merge6-spawn-count');
for(const count of [0,1,2,3,4,5,6,9])add('regularSpawnCount',{spawnMult:count},regular.resolveRegularMerge6SpawnCount(count));
const wild=module('wild-merge-spawn-bonus-decision'),mult=module('wild-endgame-spawn-mult-decision');
for(const archetype of ['wild','wild-juice','wild-magnet','wild-tnt'])for(const starCount of [1,2,3])for(const final of [false,true]) {
 const input={isWildMerge:true,isLastMerge:final,isArcadeSimpleWildMergeSpawn:false,isFinalWildSnapshotBeforeSpawn:false,isJuice:archetype==='wild-juice',isStar:archetype==='wild',isMagnet:archetype==='wild-magnet',isTnt:archetype==='wild-tnt',starOrbitCount:starCount};
 add('wildBonus',{archetype,starOrbitCount:starCount,isLastMerge:final},wild.resolveWildMergeSpawnBonus(input));
}
for(const count of [0,1,2,3,4])for(const wildMerge of [false,true])for(const locked of [0,5])for(const final of [false,true]) {const input={spawnMult:count,isWildMerge:wildMerge,lockedEmptyPlaceholderCount:locked,isLastMerge:final};add('wildEndgameMult',input,mult.resolveWildEndgameSpawnMult(input));}
const magnet=module('magnet-post-spawn-resolution'),pull=module('magnet-pull-progress-decision');
for(const count of [0,1,2,3,4,5])for(const available of [false,true]) {add('magnetRespawn',{pulledCellCount:count,hasTilesToRespawn:available},magnet.createMagnetRespawnPlan(count,available));add('magnetDelays',{count,intervalMs:150},magnet.createMagnetRespawnDelays(count));}
for(const count of [0,1,2,3,4,5])for(const tileCount of [1,2,3,4]) {
 const tiles=Array.from({length:tileCount},(_,id)=>tile('t'+id,2));
 add('magnetProgress',{tiles,mergeID:tiles[0].id,pulledTileCount:count},pull.resolveMagnetPullProgressDecision({activeTilesBeforePull:tiles,mergeTile:tiles[0],pulledTileCount:count}));
}
const tnt=module('tnt-bonus-target-selection');
for(const roll of [0,0.2,0.6,0.99])for(const count of [0,1,2,3,4]) {
 const candidates=[tile('c0',1,null,{gridX:0,gridY:0}),tile('c1',2,null,{gridX:1,gridY:0}),tile('c2',3,null,{gridX:4,gridY:0}),tile('c3',4,null,{gridX:4,gridY:8}),tile('c4',5,null,{gridX:0,gridY:8})];
 add('tntSeparated',{tiles:candidates,count,roll},tnt.selectSpatiallySeparatedTntTargets(candidates,count,()=>roll).map(t=>t.id));
}
const permit=module('wild-spawn-permission'),progress=module('wild-meter-progress-decision');
for(const options of [{wildMeter:0},{wildMeter:0.999998},{wildMeter:0.999999},{wildMeter:1},{wildMeter:1,boardWildMeterEnabled:false},{wildMeter:1,boardWildSpawnEnabled:false},{wildMeter:1,wildSpawnInProgress:true},{wildMeter:1,busyEnding:true},{wildMeter:1,boardTransitionActive:true},{wildMeter:1,failScreenPending:true},{wildMeter:1,activeAnimationBlockReason:'board-settling'},{wildMeter:1,activeAnimationBlockReason:'merge6-spawn-in-progress'},{wildMeter:1,activeAnimationBlockReason:'wild-transaction'},{wildMeter:1,tiles:[tile('final',6)]}]) {
 const input={tiles:[],...options};const result=permit.resolveWildSpawnPermission(input);
 add('wildPermission',input,result);
 for(const confirmedNonFinal of [false,true])add('wildProgress',{permission:result,confirmedNonFinal},progress.resolveWildMeterProgressDecision({permission:result,confirmedNonFinal}));
}
const reward=module('clean-board-score-utils');
for(const bonus of [0,500,1000])for(const movesRemaining of [0,1,12,25,49,50,75])for(const maxStackDepth of [1,2,4,8]) {const input={bonus,boardNumber:1,movesRemaining,maxMoves:50,maxStackDepth};add('efficiencyBonus',input,reward.computeEfficiencyBonus(input));}
for(const currentScore of [0,999998,999999])for(const comboBonus of [0,1000])for(const efficiencyBonus of [0,5000]) {const input={currentScore,comboBonus,efficiencyBonus,scoreCap:999999};add('finalScore',input,reward.computeCleanBoardFinalScore(input));}
fs.writeFileSync('native/gameplay-state/Tests/StackToSixNativeStateTests/Resources/NativeRulesOracle.json',JSON.stringify({version:1,source:'current canonical TypeScript pure decision owners',cases}));
console.log(`Exported ${cases.length} independent TS decision fixtures.`);
