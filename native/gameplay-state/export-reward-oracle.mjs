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
const decision=module('app-core-wild-type'),registry=module('special-dice-registry'),rules=module('board-specific-rules');
const cases=[];
const originalRandom=Math.random;
try {
 for(const isArcade of [false,true])for(const boardNumber of [1,2,3,4,5,6,7,10,11,12,13,20,21,22,23,24,25,30,31])for(const wildSpawnCount of [0,1,2,3])for(const lastWildDropType of [null,'wild','wild-juice','wild-magnet','wild-tnt'])for(const wildDropTypeStreak of [0,2])for(const roll of [0,0.19999999999999998,0.2,0.4,0.5,0.6,0.6667,0.8,0.8334,0.999999]) {
  const additional=[0.8,0.4,0.1];let draws=0;Math.random=()=>draws++===0?roll:additional[Math.min(draws-2,additional.length-1)];
  const result=decision.decideWildType({boardNumber,isArcade,wildSpawnCount,firstWildSpawned:wildSpawnCount>0,lastWildDropType,wildDropTypeStreak,filterWildType:rules.filterWildType,devLog:()=>{},devWarn:()=>{}});
  let wildType=result.wildType;
  const beach=isArcade===false&&boardNumber>=12&&boardNumber<=20;
  const beachWildSlot=beach?registry.pickBeachWildSlotForSpawn(boardNumber,wildSpawnCount):undefined;
  if(beach)wildType=beachWildSlot===1||beachWildSlot===2?'wild-juice':'wild';
  const variant=result.specialDiceVariantId!==undefined?registry.getSpecialDiceVariant(result.specialDiceVariantId):registry.pickSpecialDiceVariantForWildSpawn({isArcade,wildSpawnCount,arcadeStage:boardNumber,journeyBoard:boardNumber,beachWildSlot,previousWildType:lastWildDropType});
  if(variant)wildType=registry.getCoreWildTypeForSpecialDiceVariant(variant)||'wild';
  cases.push({input:{isArcade,boardNumber,wildSpawnCount,lastWildDropType,wildDropTypeStreak,roll,additional},expected:{archetype:wildType,variant:variant?.id??null,additionalDraws:draws-1}});
 }
}finally{Math.random=originalRandom;}
fs.writeFileSync('native/gameplay-state/Tests/StackToSixNativeStateTests/Resources/NativeRewardOracle.json',JSON.stringify({version:1,source:'decideWildType + board filtering + registry + Beach slot at canonical app-core callsite',cases}));
console.log(`Exported ${cases.length} authored reward fixtures.`);
