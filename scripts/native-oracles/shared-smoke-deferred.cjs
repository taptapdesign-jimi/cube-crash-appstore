// Execute immutable approved v9 and its actual installed GSAP global roots.
const fs=require('node:fs'),vm=require('node:vm'),cp=require('node:child_process');
const ts=require('typescript');
let gsap;
const read=p=>cp.execFileSync('git',['show','production-benchmark-v9:'+p],{encoding:'utf8'});
const functions=(text,names)=>ts.createSourceFile('source',text,ts.ScriptTarget.Latest,true).statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name?.text)).map(n=>n.getText()).join('\n');
const poolOriginal=ts.createSourceFile('pool',read('src/modules/object-pool.ts'),ts.ScriptTarget.Latest,true).statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='GraphicsPool').getText();
const original=functions(read('src/modules/fx.ts'),['smokeBubblesAtTile'])+'\n'+functions(read('src/modules/gameplay-fx-profile.ts'),['getOrganicRadialSmokeLayout','getSmokeCloudParticleAlpha']);
class Container {constructor(){this.children=[];this.alpha=1;this.scale={x:1,y:1,set(x,y=x){this.x=x;this.y=y}};this.x=0;this.y=0;this.rotation=0;this.destroyed=false;}addChild(c){c.parent=this;this.children.push(c);return c;}addChildAt(c,i){c.parent=this;this.children.splice(i,0,c);return c;}removeChild(c){this.children=this.children.filter(n=>n!==c);c.parent=null;}destroy(){this.destroyed=true;this.parent?.removeChild(this);}}
class Graphics extends Container {clear(){return this;}circle(x,y,r){this.rx=r;this.ry=r;return this;}ellipse(x,y,rx,ry){this.rx=rx;this.ry=ry;return this;}fill(v){this.fillStyle=v;return this;}}
const scenarios=[['special',.035,[.017,.034,.035,.051,.070,.097,.105,.140,.153,.249,.361,.479,.631,1.017]],['magnet',.035,[.017,.035,.070,.105,.140,.249,.479,1.017]],['laser',.035,[.017,.035,.070,.105,.140,.249,.479,1.017]],['reentry',.24,[.017,.249,.479,.490,.631,.749,.990,1.017]],['coarse',.035,[.479,.490,.631,1.017]]];
const rows=[];
for(const [name,gap,times] of scenarios){
 delete require.cache[require.resolve('gsap/dist/gsap')];gsap=require('gsap/dist/gsap').gsap;gsap.ticker.sleep();gsap.ticker.wake=()=>{};gsap.globalTimeline.clear();gsap.updateRoot(0);
 let seed=127,draws=0;const math=Object.create(Math);math.random=()=>{draws++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const board=new Container(),recipe={tileSize:166.4,strength:name==='magnet'?.6:3,sizeScale:.91,countScale:.83,distanceScale:.55,trailAlpha:.92,maxParticles:name==='magnet'?36:72,groupedOwner:true,deferFutureBursts:true,bursts:5,burstGap:gap};
 if(name==='laser')Object.assign(recipe,{tileSize:128,strength:1.3,sizeScale:1.15,countScale:.55,distanceScale:.65,maxParticles:36});
 const box={exports:{},Math:math,Number,console,Container,Graphics,gsap,centerInBoard:()=>({x:0,y:0}),getFxHotFactor:()=>1,graphicsPool:null,trackTimeline:opts=>{const t=gsap.timeline(opts);if(process.env.SMOKE_DEBUG && name==='coarse'){const add=t.add;t.add=function(child,pos){console.log('ADD',pos,this._time,this._dur,this._start,gsap.globalTimeline._time);return add.call(this,child,pos)}}return t;},trackDelayedCall:(delay,cb)=>gsap.delayedCall(delay,cb),trackTween:(target,vars)=>gsap.to(target,vars),autoAdd(parent,layer,ttl){parent.addChild(layer);gsap.delayedCall(ttl,()=>{for(const p of [...layer.children]){gsap.killTweensOf(p);layer.removeChild(p);}layer.destroy();});}};
 vm.createContext(box);vm.runInContext(ts.transpileModule(poolOriginal+'\nthis.graphicsPool=new GraphicsPool();',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,box);vm.runInContext(ts.transpileModule(original,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,box);box.exports.smokeBubblesAtTile(board,{},recipe);
 const samples=[];for(const seconds of times){gsap.updateRoot(seconds);samples.push({wall:seconds*1000,draws,layers:board.children.map(layer=>({tag:'A',puffs:layer.children.map(p=>({x:p.x,y:p.y,alpha:p.alpha,fill:p.fillStyle.alpha,rx:p.rx,ry:p.ry,scale:p.scale.x,rotation:p.rotation}))}))});}
 // Codable Native recipe needs defaults; overlay separately in test via name/gap.
 rows.push({name,gap,samples});gsap.globalTimeline.clear();gsap.ticker.sleep();
}
fs.writeFileSync('native/standalone/Stack to SixTests/shared-smoke-deferred-oracle.json',JSON.stringify({source:cp.execFileSync('git',['rev-parse','production-benchmark-v9'],{encoding:'utf8'}).trim(),version:gsap.version,rows}));gsap.globalTimeline.clear();gsap.ticker.sleep();console.log('Executed v9 deferred smoke:',rows.length,'scenarios');
