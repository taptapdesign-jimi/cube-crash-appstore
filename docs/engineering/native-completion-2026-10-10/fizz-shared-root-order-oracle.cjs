// Execute the untouched original producer with installed GSAP. No native model.
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'../../..');
const ts=require(root+'/node_modules/typescript'),{gsap}=require(root+'/node_modules/gsap/dist/gsap');
const text=fs.readFileSync(root+'/src/modules/fx.ts','utf8');
const ast=ts.createSourceFile('fx.ts',text,ts.ScriptTarget.Latest,true);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='startWildJuiceBubbles');
const code=ts.transpileModule(fn.getText(ast).replace('export ',''),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
class Container {constructor(){this.children=[];this.parent=null;} addChild(n){n.parent=this;this.children.push(n);} sortChildren(){} removeChild(n){this.children=this.children.filter(x=>x!==n);n.parent=null;} }
class Bubble {constructor(){this.scale={x:1,y:1,set(v){this.x=this.y=v}};this.x=this.y=0;this.alpha=1;} circle(){}fill(paint){this.color=paint.color}stroke(){} }
gsap.globalTimeline.clear();gsap.globalTimeline.time(0);gsap.ticker.sleep();
let rng=1,draws=0,owner=null,events=[],arrivals=[],roots=[],rootTrace=[],microtaskTrace=[],created=[];
const systems=new Map(),microtasks=[];
const context={Container,console,Math:Object.assign(Object.create(Math),{random(){rng=(Math.imul(rng,1664525)+1013904223)>>>0;draws++;events.push({draw:draws,owner,time:gsap.globalTimeline.time()});return rng/4294967296;}}),
getSpecialDiceIdleBubbleColors:t=>t.variant==='honey'?[0xF7D58A,0xF2BB4F]:[0xCCF3F1,0xFFFFFF],getSpecialDiceVariantForTile:t=>({id:t.variant}),
stopWildJuiceBubbles(){},wildJuiceBubbleSystems:systems,isSpecialDiceIdlePaintable:t=>t.paintable,
createSpecialIdleAnimationVisibility:()=>({track:a=>a,forget(){}}),
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
vm.createContext(context);vm.runInContext(code+';this.run=startWildJuiceBubbles;',context);
const tiles=['bottle','honey'].map((variant,i)=>({variant,id:i,rotG:new Container(),paintable:true}));
for(const tile of tiles){owner=tile.variant;context.run(tile);}owner=null;
const checkpoints=[];
for(const seconds of [0.3,0.5,0.8,1.1,1.4,1.7,2.0]){
 gsap.updateRoot(seconds);while(microtasks.length)microtasks.shift()();
 checkpoints.push({seconds,draws,live:tiles.map(t=>systems.get(t).bubbles.length),systems:tiles.map(t=>({owner:t.variant,bubbles:systems.get(t).bubbles.map(b=>({id:b.oracleID,x:b.x,y:b.y,scaleX:b.scale.x,scaleY:b.scale.y,alpha:b.alpha,tint:b.tint,color:b.tint===0xFFFFFF ? b.color:b.tint}))}))});
}
if(arrivals.length<6||events.some(e=>!e.owner))throw Error('missing actual multi-system callbacks');
const expectedArrivals=[['bottle',0,0],['honey',0,12],['bottle',0.5,25],['honey',0.5,37],['bottle',1.1,50],['honey',1.4,62],['bottle',1.7,75]];
if(JSON.stringify(arrivals.map(a=>[a.owner,a.time,a.drawsBefore]))!==JSON.stringify(expectedArrivals))throw Error('original shared-root regression');
if(draws!==87)throw Error('original common-RNG budget regression');
const firstComposition=rootTrace.slice(0,9).map(r=>r.owner+':'+r.kind);
if(JSON.stringify(firstComposition)!==JSON.stringify(['bottle:scale','bottle:rise','bottle:tint','bottle:fade','bottle:producer','honey:scale','honey:rise','honey:fade','honey:producer']))throw Error('original root composition changed');
if(rootTrace.length!==32||microtaskTrace.length===0)throw Error('missing authored root or deferred retirement');
const expectedRetirement=[['queued','bottle',1.1],['drained','bottle',1.1],['queued','honey',1.7],['drained','honey',1.7],['queued','bottle',2],['queued','honey',2],['queued','bottle',2],['drained','bottle',2],['drained','honey',2],['drained','bottle',2]];
if(JSON.stringify(microtaskTrace.map(e=>[e.phase,e.owner,e.time]))!==JSON.stringify(expectedRetirement))throw Error('original RAF microtask checkpoint order changed');
const result={rootTrace,microtaskTrace,gsapVersion:gsap.version,authority:'Untouched actual startWildJuiceBubbles, installed GSAP global root; stubbed Pixi paint/pool and visibility endpoints, manual root arrivals. This proves root/RNG ordering, not ticker wall-lag, visibility, pixels or native parity.',sourceSHA256:require('crypto').createHash('sha256').update(fn.getText(ast)).digest('hex'),arrivals,checkpoints,draws,events};
const out=path.join(__dirname,'fizz-shared-root-order-oracle.json');fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
roots.forEach(t=>t.kill());gsap.globalTimeline.clear();gsap.ticker.sleep();console.log(JSON.stringify({out,arrivals,checkpoints,draws}));
