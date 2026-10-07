// Build-time only: execute preserved TS owners, never ship JS in Native.
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),gsap=require('gsap/dist/gsap').gsap;
const source=fs.readFileSync('src/modules/tnt-animation.ts','utf8');
const tree=ts.createSourceFile('tnt.ts',source,ts.ScriptTarget.Latest,true);
const names=new Set(['createTntDiceDebrisPlans','createBarrelDiceDebrisPlans','getTntDebrisFlightPoint','getTntDebrisVisualScale','createTntDebrisSpriteSourceOrder']);
const functions=tree.statements.filter(s=>ts.isFunctionDeclaration(s)&&names.has(s.name?.text)).map(s=>s.getText(tree));
const constants=tree.statements.filter(s=>ts.isVariableStatement(s)&&s.declarationList.declarations.some(d=>d.name.getText(tree).startsWith('TNT_DICE_'))).map(s=>s.getText(tree));
const flowerFull=tree.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='attachDepthLayeredFlowerBurst').getText(tree);
const flower=flowerFull.slice(0,flowerFull.indexOf('  // One GSAP owner'))+`return particlePlans.map(p=>[p.sprite.texture.assetIndex,p.sprite.zIndex,p.settledScale*100,Math.atan2(p.directionY,p.directionX),p.distance,p.curve,p.startX-centerX,p.startY-centerY,p.startRotation,p.rotationTravel,p.swirlTurns,p.swirlPhase,p.swirlAmplitude,p.delay,p.duration]);\n}`;
const code=ts.transpileModule([...constants,...functions,flower].join('\n'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let random,draws;
const math=Object.create(Math);math.random=()=>random();
class Sprite { constructor(texture){this.texture=texture;this.scale={set(){}};} }
const sandbox={exports:{},Math:math,Set,Assets:{get:p=>({width:100,height:80,assetIndex:Number(p.match(/flowr(\d)/)[1])})},isRenderableTexture:()=>true,
acquireFrameSprite:(texture,zIndex)=>Object.assign(new Sprite(texture),{zIndex}),gsap,console};
vm.createContext(sandbox);vm.runInContext(code,sandbox);
function seeded(seed){let state=seed;draws=0;random=()=>{draws++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
const fields=['value','size','depth','angle','distance','curve','startX','startY','startRotation','rotationTravel','startScale','peakScale','endScale','delay','duration'];
const flowers=[],barrels=[],balls=[];
for(const seed of [1,2,7,31,83,1337,7729,2147483647]) {
 seeded(seed);sandbox.container={addChild(){}};sandbox.sources=Array.from({length:6},(_,i)=>`flowr${i+1}`);
 let plans=vm.runInContext('attachDepthLayeredFlowerBurst(container,sources,{waveTimes:[.1,.905,1.71],count:9,baseSizeScale:1.428,speedScale:.92},0,0)',sandbox);
 // atan2 wraps; store original normalized direction angle for comparison.
 flowers.push({seed,draws,plans});
 seeded(seed);const wood=sandbox.exports.createTntDiceDebrisPlans(()=>random());
 const dice=sandbox.exports.createBarrelDiceDebrisPlans(wood,.7,()=>random());
 const order=sandbox.exports.createTntDebrisSpriteSourceOrder([1,2,3,4,5,6],16,()=>random());
 barrels.push({seed,draws,wood:wood.map(p=>fields.map(f=>p[f])),dice:dice.map(p=>fields.map(f=>p[f])),order});
}
const juice=fs.readFileSync('src/modules/wild-juice-bubbles-explosion.ts','utf8');
const pre=juice.slice(juice.indexOf('    const isBig ='),juice.indexOf('    const bubbleTweens:',juice.indexOf('    const isBig =')));
const branchStart=juice.indexOf('    } else if (isCustomDownDrop) {');
const branch=juice.slice(branchStart+'    } else if (isCustomDownDrop) {'.length,juice.indexOf('\n    } else {',branchStart));
const ballCode=ts.transpileModule(`function makeBall(screenW,screenH){ const idx=Math.floor(Math.random()*6);const direction='down',isMushroomDrop=false,isCustomDownDrop=true;const bubble={x:0,y:0,rotation:0,scale:{x:1,y:1,set(p){this.x=this.y=p;}}};const explosionContainer={addChild(){}};let populatedFallbackPaintRequested=true;${pre}\nconst bubbleTweens=[];const onBubbleComplete=()=>{};${branch}\nreturn {values:[idx+1,startX,startY,bubbleScale,bubble.alpha,duration,floorY,bounceY,exitY,x1,x2,x3,impactRotation],bubble,timeline:bubbleTweens[0]};}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
sandbox.trackTimeline=()=>gsap.timeline({paused:true});vm.runInContext(ballCode,sandbox);
for(const seed of [1,7,1337,99991])for(const [width,height] of [[390,844],[430,932]]) {
 seeded(seed);sandbox.width=width;sandbox.height=height;
 const result=vm.runInContext('makeBall(width,height)',sandbox),d=result.values[5];
 const times=[0,.02,.06,d*.52-.01,d*.52+.025,d*.52+.075,d*.52+.15,d*.78+.015,d*1.2+.015];
 const boundaries=result.timeline.getChildren().map(child=>child.startTime());
 const samples=times.map(time=>{
  // Initialize overlapping property tweens at their authored start, before
  // sampling later frames. A coarse seek otherwise captures the wrong scale.
  for(const boundary of boundaries.filter(t=>t>result.timeline.time()&&t<=time).sort((a,b)=>a-b))result.timeline.totalTime(boundary,true);
  result.timeline.totalTime(time,true);
  return [time,result.bubble.x,result.bubble.y,result.bubble.scale.x,result.bubble.scale.y,result.bubble.rotation];
 });
 balls.push({seed,width,height,draws,values:result.values,samples});result.timeline.kill();
}
const swift=value=>JSON.stringify(value).replace(/null/g,'0');
const text=`// Generated from executed original TypeScript; do not hand-edit.\nenum NativeTntVariantOracle {\nstruct Flower {let seed:UInt32,draws:Int,plans:[[Double]]}\nstruct Barrel {let seed:UInt32,draws:Int,wood:[[Double]],dice:[[Double]],order:[Int]}\nstruct Ball {let seed:UInt32,width:Double,height:Double,draws:Int,values:[Double],samples:[[Double]]}\nstatic let flowers:[Flower]=[${flowers.map(p=>`.init(seed:${p.seed},draws:${p.draws},plans:${swift(p.plans)})`).join(',\n')}]\nstatic let barrels:[Barrel]=[${barrels.map(p=>`.init(seed:${p.seed},draws:${p.draws},wood:${swift(p.wood)},dice:${swift(p.dice)},order:${swift(p.order)})`).join(',\n')}]\nstatic let balls:[Ball]=[${balls.map(p=>`.init(seed:${p.seed},width:${p.width},height:${p.height},draws:${p.draws},values:${swift(p.values)},samples:${swift(p.samples)})`).join(',\n')}]\n}\n`;
fs.writeFileSync('native/gameplay-tnt-variant-tests/NativeTntVariantOracle.swift',text);
gsap.ticker.sleep();console.log(`Exported ${flowers.length*27} Flower particles, ${barrels.length*32} Barrel paths, ${balls.length} Ball plans and ${balls.length*9} actual GSAP samples.`);
