import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from '../../node_modules/typescript/lib/typescript.js';
const root = path.resolve(import.meta.dirname,'../..');
const cache = new Map();
function sourceModule(relative) {
 const file = path.resolve(root,relative); if(cache.has(file)) return cache.get(file);
 const exports={};cache.set(file,exports);
 const code = ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const require=(name)=>{
  if(name.includes('tnt-bonus-target-selection')) return sourceModule('src/modules/tnt-bonus-target-selection.ts');
  if(name.includes('laser-gun-impact-scheduler')) return sourceModule('src/modules/laser-gun-impact-scheduler.ts');
  // Imported runtime effect/audio owners are not invoked by the real exported geometry functions.
  return {default:{},logger:{},gsap:{},areContinuousRuntimeDiagnosticsEnabled:()=>false};
 };
 vm.runInNewContext(code,{exports,require,window:{devicePixelRatio:2},navigator:{userAgent:'iPhone'},console,Math},{filename:file});return exports;
}
const ship=sourceModule('src/modules/spaceship-finale-scene.ts'),laser=sourceModule('src/modules/lasergun-finale-scene.ts');
const result={source:'Actual exported source functions; runtime presentation/audio imports unused.',exit:[],laser:[],scatter:[],pull:[],timing:[]};
for(const [width,height] of [[320,667],[390,844],[768,1024]]) for(const lane of [-1,1]) for(const progress of [0,.05,.1,.2,.3,.4,.5,.6,.7,.8,.9,1]) {
 const pose=ship.getSpaceshipSaucerExitPose({lane,finalXRatio:lane*1.12,finalRotation:lane*20},progress,height,width);
 result.exit.push({width,height,lane,seconds:progress*ship.SPACESHIP_SAUCER_EXIT_SECONDS,...pose});
}
for(const [width,height] of [[280,320],[320,667],[390,844],[768,1024]]) for(const x of [0,width/2,width]) for(const scale of [1,.875,.75]) {
 const side=laser.getLaserGunNoTargetSide(x,width),stageX=laser.getLaserGunStageCenterX(side,scale,width);
 result.laser.push({width,height,x,y:height/2,scale,left:side==='left',stageX,offscreen:laser.getLaserGunOffscreenTravel(side,scale,width,stageX)});
}
for(const plan of ship.SPACESHIP_PULL_PLAN) {
 result.timing.push({id:plan.id,...ship.getSpaceshipDebrisMotion(plan)});
 for(const roll of [0,.5,.999999]) result.scatter.push({id:plan.id,roll,...ship.getSpaceshipScatterLayout(plan,()=>roll)});
}
for(const progress of [-1,0,.1,.25,.5,.75,.9,1,2]) result.pull.push({progress,value:ship.getSpaceshipMagneticPullProgress(progress)});
const json=JSON.stringify(result,null,2);
fs.writeFileSync(path.resolve(import.meta.dirname,'NativeArea55Oracle.swift'),'import Foundation\n\n// Regenerate with export-area55-oracle.mjs; actual TypeScript owners, no Swift model involved.\nenum NativeArea55Oracle { static let data = Data(#"""\n'+json+'\n"""#.utf8) }\n');
console.log(`Area55 source oracle: ${result.exit.length+result.laser.length+result.scatter.length+result.pull.length+result.timing.length} cases`);
