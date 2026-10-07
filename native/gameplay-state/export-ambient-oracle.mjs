import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const emitter=[{boardId:11,x:112,y:466},{boardId:13,x:112,y:714},{boardId:14,x:278,y:838},{boardId:16,x:278,y:1086},{boardId:17,x:112,y:1210},{boardId:19,x:112,y:1458},{boardId:20,x:278,y:1582}];
const output={version:1,seed:7,emitters:emitter,sceneHeight:1440,top:0,bottom:844,worlds:{}};
for (const [world,module,create] of [[2,'journey-beach-bubble-drift','createNativeBeachBubbleProjection'],[3,'journey-area55-ship-flybys','createNativeArea55ShipProjection']]) {
 let state=7;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const context={Math,console};vm.createContext(context);
 const code=fs.readFileSync(`src/modules/${module}.ts`,'utf8').replace(/^import[\s\S]*?from [^;]+;\n/gm,'').replace(/\bexport /g,'');
 vm.runInContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,context);
 const owner=world===2?context[create](emitter,1440,random):context[create](random);
 const plans=[];
 for(let cycle=0;cycle<2;cycle++)plans.push(owner.next({top:0,bottom:844}).map(plan=>({...plan,frames:[0,1,30,150,330].map(index=>plan.frames[index])})));
 output.worlds[String(world)]=plans;
}
fs.writeFileSync('native/gameplay-state/Tests/StackToSixNativeStateTests/Resources/NativeAmbientOracle.json',JSON.stringify(output));
console.log('Exported independent canonical TS ambient motion oracle: 2 worlds, 2 retained cycles.');
