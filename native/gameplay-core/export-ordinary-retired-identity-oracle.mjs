import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';
const root=process.cwd(),ts=createRequire(root+'/package.json')('typescript');
function compile(s,cjs=false){return ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:cjs?ts.ModuleKind.CommonJS:ts.ModuleKind.ES2022}}).outputText}
function ast(file){return ts.createSourceFile(file,fs.readFileSync(root+'/src/modules/'+file+'.ts','utf8'),ts.ScriptTarget.Latest,true)}
function moduleCode(file){const a=ast(file);return compile(a.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(a)).join('\n'),true)}
const app=ast('app-core');let endgameCallback,cleanupCallback,reset,stackGate,hardFallback;const arrows={};
function walk(n){
 if(ts.isVariableDeclaration(n)&&['createMergeOpenCellSpawnCommit','commitMergeSpawnAtBoundary','openAtCellForMerge','openPrimarySpecialMergeCell','hardFallbackSpawnAtCellForMerge','hardFallbackPrimarySpecialMergeCell'].includes(n.name.getText(app)))arrows[n.name.getText(app)]=n.initializer.getText(app);
 if(ts.isFunctionDeclaration(n)&&n.name?.text==='hardFallbackSpawnAtCell')hardFallback=n.getText(app);
 if(ts.isFunctionDeclaration(n)&&n.name?.text==='resetMerge6SpawnState')reset=n.getText(app);
 if(ts.isFunctionDeclaration(n)&&n.name?.text==='canOrdinaryStackDuringMerge6Handoff')stackGate=n.getText(app);
 if(ts.isCallExpression(n)&&n.expression.getText(app)==='trackAppTimeout'&&n.arguments[0]?.getText(app).includes('const doEndgameSpawns'))endgameCallback=n.arguments[0].getText(app);
 if(ts.isCallExpression(n)&&n.expression.getText(app)==='trackAppTimeout'&&n.arguments[0]?.getText(app).includes('END-GAME: Removing dst tile after spawn is scheduled'))cleanupCallback=n.arguments[0].getText(app);
 ts.forEachChild(n,walk);
}walk(app);if(!endgameCallback||!cleanupCallback||!reset||!stackGate)throw Error('Missing original ownership callbacks');
const marker=app.text.indexOf('function merge(src:'),start=app.text.indexOf('  const isInternalPulledTilesMerge =',marker),end=app.text.indexOf('  if (src === dst)',start),guard=app.text.slice(start,end);
const rows=[];
for(const mode of ['normal','interrupted','stale']){
 const interrupted=mode==='interrupted',stale=mode==='stale';
 let now=130,sequence=0,faceDraws=0;const timers=[],trace=[],grid=[Array(5).fill(null)],dst={id:'old',value:6,locked:false,gridX:1,gridY:0,scale:{set(){}}},tiles=[dst,{id:'other',value:5,locked:false,gridX:2,gridY:0,scale:{set(){}}}],src=tiles[1];grid[0][1]=dst;grid[0][2]=src;
 const context={logger:{debug(){},info(){},warn(){}},exports:{},console,Math,src,dst,grid,tiles,gx:1,gy:0,spawnC:1,spawnR:0,board:{},STATE:{tiles},drag:{},devLog(){},devWarn(...args){trace.push({at:now,kind:"warning",args:args.map(a=>a?.stack??a)})},specialTransactionKind:null,specialTransactionToken:null,merge6SpawnOwnerToken:1,activeMerge6SpawnOwnerToken:1,merge6SpawnInProgress:true,regularMerge6CleanupToken:null,helpers:{snapBack(){trace.push({at:now,kind:'blocked-six'})}},regularMergeHandoffTokens:new Set(),isWildLikeTile:()=>false,isTntBonusTileOwned:()=>false,isSpecialDiceResolutionOwned:()=>false,getSpecialDiceVariantForTile:()=>null,collectBoardGameplayTiles:()=>tiles,shouldBlockMergeDuringRegularHandoff:()=>false,emitIOSSpecialTransactionTrace(){},clearMerge6SpawnResetTimer(){},endMerge6ResolutionFrames(){},queueWildSpawnAfterGuardRelease(){},clearEndGameCache(){},releaseSpecialDiceResolution(){},stopSpecialDiceIdleMotion(){},clearSpecialDiceIdentity(){},MAGNET_TRANSIENT_TILE_FLAGS:[],gsap:{},isArcadeSimpleWildMergeSpawn:false,merge6SpawnFinale:{isWild:false,isJuice:false},wildMergeTarget:null,pendingMandatoryMergeCellSpawn:{},maybeForceCleanBoardFromPreSpawnFinalMerge:async()=>false,maybeForceCleanBoardFromSingleMerge6:async()=>false,runWildStarExtraLockedOpens:async()=>{},scheduleSpawnOpacitySafetySweep(){},randomRegularTileValue:()=>1,randomEmptyCell:()=>null,hardFallbackPrimarySpecialMergeCell:()=>false,settleSpecialMergeTransaction:()=>true,clearTileFromGridSafe:null};
 vm.createContext(context);
 for(const file of ['tile-state-utils','tile-lifecycle-service','merge6-destination-cleanup-owner','app-core-open-cell','endgame-checker','special-dice-transaction-owner','board-mutation-epoch-owner'])vm.runInContext(moduleCode(file),context);
 context.resetTileToNormalState=context.exports.resetTileToNormalState;context.tileIsActive=context.exports.tileIsActive;
 context.merge6DestinationCleanupOwner=new context.exports.Merge6DestinationCleanupOwner();context.regularMerge6CleanupToken=context.merge6DestinationCleanupOwner.claim(dst);
 context.isStableOrdinarySubSixStack=context.exports.isStableOrdinarySubSixStack;
 context.removeTile=t=>{context.exports.removeTileFully(t,{grid,tiles,board:{}});t.destroyed=true;trace.push({at:now,kind:'retire-identity',id:t.id})};
 context.clearTileFromGridSafe=t=>context.exports.detachTileFromGrid(t,grid);
 context.specialMergeTransactionReceipt=null;context.boardMutationEpochOwner=new context.exports.BoardMutationEpochOwner();context.mergeBoardMutationEpoch=context.boardMutationEpochOwner.beginMutation();if(stale)context.boardMutationEpochOwner.invalidate();
 context.openAtCell=async(c,r,options)=>{faceDraws++;return await context.exports.openAtCellCore({c,r,options,grid,tiles,board:{},devWarn(...args){trace.push({at:now,kind:"warning",args:args.map(a=>a?.stack??a)})},bindTileWithFallback(){},makeBoard:{createTile({c,r,val,locked}){const t={id:'fresh',value:val,locked,gridX:c,gridY:r,scale:{set(){}}};tiles.push(t);grid[r][c]=t;return t},setValue(t,v){t.value=v;trace.push({at:now,kind:'assign-primary'})}},spawnBounce(t,done,_opts,interrupt){timers.push({at:interrupted?140:690,id:++sequence,fn:interrupted?interrupt:done})}})};
 vm.runInContext(compile(hardFallback),context);
 for(const [name,code] of Object.entries(arrows))vm.runInContext(compile(`globalThis.${name}=${code};`),context);
 context.resetMerge6SpawnState=undefined;
 vm.runInContext(compile(reset+'\n'+stackGate+'\n globalThis.sourceEndgame='+endgameCallback+';globalThis.sourceCleanup='+cleanupCallback+';globalThis.sourceEntryGuard=(probeSource,probeDestination)=>{const src=probeSource,dst=probeDestination;'+guard+'return true;};'),context);
 context.sourceEndgame();timers.push({at:180,id:++sequence,fn:context.sourceCleanup});
 const flush=async()=>{for(let n=0;n<64;n++)await Promise.resolve()};await flush();
 const before={active:context.merge6SpawnInProgress,oldCleanupOwned:context.merge6DestinationCleanupOwner.hasClaim(dst),sixAllowed:!!grid[0][1]&&context.sourceEntryGuard(grid[0][1],src)===true};
 while(timers.length){timers.sort((a,b)=>a.at-b.at||a.id-b.id);const t=timers.shift();now=t.at;t.fn();await flush();trace.push({at:now,kind:'ownership',active:context.merge6SpawnInProgress,oldCleanupOwned:context.merge6DestinationCleanupOwner.hasClaim(dst),sixAllowed:!!grid[0][1]&&context.sourceEntryGuard(grid[0][1],src)===true,freshID:grid[0][1]?.id??null})}
 if(trace.some(r=>r.kind==='warning'&&r.args.some(a=>String(a).includes('ReferenceError')||String(a).includes('TypeError'))))throw Error(JSON.stringify(trace));
 rows.push({interrupted,stale,faceDraws,before,trace});
}
fs.writeFileSync('/tmp/NativeOrdinaryRetiredIdentityOracle.json',JSON.stringify(rows));
fs.writeFileSync(root+'/native/gameplay-core/Tests/StackToSixGameplayTests/NativeOrdinaryRetiredIdentityOracle.swift', 'import Foundation\n// Executed original primary/epoch/hard-fallback helpers, endgame/cleanup callbacks and ownership guard.\nenum NativeOrdinaryRetiredIdentityOracle {static let data=Data(#\"\"\"\n'+JSON.stringify(rows)+'\n\"\"\"#.utf8)}\n');console.log(rows.length+' original ordinary retired-identity callback fixtures');
