// Execute the untouched original producer with installed GSAP. No native model.
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'../../..');
const ts=require(root+'/node_modules/typescript'),{gsap}=require(root+'/node_modules/gsap/dist/gsap');
const text=fs.readFileSync(root+'/src/modules/fx.ts','utf8');
const ast=ts.createSourceFile('fx.ts',text,ts.ScriptTarget.Latest,true);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='startWildJuiceBubbles');
const code=ts.transpileModule(fn.getText(ast).replace('export ',''),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
const names=['stopWildJuiceBubbles','startMagnetIdleParticles'];
const originals=names.map(name=>{const declaration=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);return ts.transpileModule(declaration.getText(ast).replace('export ',''),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText}).join('\n');
class Container {constructor(){this.children=[];this.parent=null;} addChild(n){n.parent=this;this.children.push(n);} sortChildren(){} destroy(){this.destroyed=true;this.children=[];} removeChild(n){this.children=this.children.filter(x=>x!==n);n.parent=null;} }
class Bubble {constructor(){this.scale={x:1,y:1,set(v){this.x=this.y=v}};this.x=this.y=0;this.alpha=1;} circle(){}fill(paint){this.color=paint.color}stroke(){} }
gsap.globalTimeline.clear();gsap.globalTimeline.time(0);gsap.ticker.sleep();
let rng=1,draws=0,owner=null,events=[],arrivals=[],roots=[],rootTrace=[],microtaskTrace=[],created=[];
const systems=new Map(),microtasks=[];
const context={Container,console,gsap,releaseJuiceBounceFrontBubbles(){},releaseBallBouncyFrontBubbles(){},stopMagnetIdleParticles(){},Math:Object.assign(Object.create(Math),{random(){rng=(Math.imul(rng,1664525)+1013904223)>>>0;draws++;events.push({draw:draws,owner,time:gsap.globalTimeline.time()});return rng/4294967296;}}),
getSpecialDiceIdleBubbleColors:t=>t.variant==='honey'?[0xF7D58A,0xF2BB4F]:[0xCCF3F1,0xFFFFFF],getSpecialDiceVariantForTile:t=>({id:t.variant}),
stopWildJuiceBubbles(){},wildJuiceBubbleSystems:systems,isSpecialDiceIdlePaintable:t=>t.paintable,
createSpecialIdleAnimationVisibility:()=>({track:a=>a,forget(){},release(){}}),
graphicsPool:{acquire(){arrivals.push({owner,time:gsap.globalTimeline.time(),drawsBefore:draws});const bubble=new Bubble();bubble.oracleID=created.length+1;created.push(bubble);return bubble},isInPool:()=>false,release(){}},
animationManager:{killExternalTween:t=>t.kill()},queueMicrotask:f=>{
 const captured=owner;microtaskTrace.push({phase:'queued',owner:captured,time:gsap.globalTimeline.time()});
 microtasks.push(()=>{microtaskTrace.push({phase:'drained',owner:captured,time:gsap.globalTimeline.time()});f();});
},
trackTween:(target,vars)=>{
 const captured=owner;
 const kind=vars.keyframes || vars.onComplete ? 'rise':('_ccBottleTintProgress' in vars) ? 'tint':('alpha' in vars) ? 'fade':'scale';
 rootTrace.push({owner:captured,kind,time:gsap.globalTimeline.time(),duration:vars.duration,delay:vars.delay||0});
 for(const key of ['onComplete','onUpdate'])if(vars[key]){
  const original=vars[key];vars[key]=function(...args){const previous=owner;owner=captured;try{return original.apply(this,args)}finally{owner=previous}};
 }
 const tween=gsap.to(target,vars);roots.push(tween);return tween;
},
trackDelayedCall:(delay,callback)=>{const captured=owner;rootTrace.push({owner:captured,kind:"producer",time:gsap.globalTimeline.time(),duration:0,delay});const tween=gsap.delayedCall(delay,()=>{const previous=owner;owner=captured;callback();owner=previous;});roots.push(tween);return tween;}};
vm.createContext(context);vm.runInContext(code+originals+';this.run=startWildJuiceBubbles;this.magnet=startMagnetIdleParticles;',context);
const tiles=['bottle','honey'].map((variant,i)=>({variant,special:"wild-magnet",id:i,rotG:new Container(),paintable:true}));
for(const tile of tiles){owner=tile.variant;context.run(tile);}owner=null;
const previous=tiles.map(t=>systems.get(t));
const before=draws;const raf=tiles.map(tile=>()=>{owner=tile.variant;context.magnet(tile);owner=null});
// Explicit original one-shot RAF endpoint, independent of GSAP global pause.
gsap.globalTimeline.pause();raf.forEach(callback=>callback());
if(before!==25||draws!==50)throw Error('original late Magnet restart RNG changed');
const retired=previous.map((old,i)=>({owner:tiles[i].variant,disposed:old.disposed,bubbles:old.bubbles.length,detached:old.container.parent===null,replaced:systems.get(tiles[i])!==old}));
if(retired.some(o=>!o.disposed||o.bubbles!==0||!o.detached||!o.replaced))throw Error('original restart did not retire captured old system');
const attachedRoots=roots.filter(root=>root.parent===gsap.globalTimeline).length;
if(attachedRoots!==9)throw Error('old original tween handles survived restart');
const ordinary={special:null,variant:'bottle',rotG:new Container()};owner='ordinary';context.magnet(ordinary);owner=null;
if(ordinary.special!==null||draws!==50||systems.has(ordinary))throw Error('original guard corrupted ordinary merge6');
const result={authority:'Untouched fx.ts start/stopWildJuiceBubbles and startMagnetIdleParticles, installed GSAP; explicit queued RAF and stopMagnet/Pixi/visibility endpoints. RAF remains independent of global GSAP pause. This is original composition evidence, not full native/app/physical acceptance.',before,draws,ordinaryGuard:true,retired,attachedRoots,arrivals,rootTrace};
const out=path.join(__dirname,'fizz-magnet-raf-oracle.json');fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
roots.forEach(root=>root.kill());gsap.globalTimeline.clear();gsap.globalTimeline.resume();gsap.ticker.sleep();console.log(JSON.stringify({before,draws,retired,attachedRoots,out}));
