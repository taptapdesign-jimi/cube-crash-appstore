const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.resolve(__dirname,'../../..'),ts=require(root+'/node_modules/typescript'),pixi=require(root+'/node_modules/pixi.js');
const sourceFiles=['shared-pixi-sheet-animation.ts','animated-svg-phase-scheduler.ts','animated-dice-hud-foreground.ts','special-dice-idle-visibility.ts','wild-star-bouncy-artwork.ts','special-dice-idle.ts'];
const hashes=Object.fromEntries(sourceFiles.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(root+'/src/modules/'+file)).digest('hex')]));
const atlasPath='assets/shop/star/star-pixi-sheet.webp',bytes=fs.readFileSync(root+'/'+atlasPath);
let dimensions;const type=bytes.toString('ascii',12,16);
if(type==='VP8X')dimensions=[bytes.readUIntLE(24,3)+1,bytes.readUIntLE(27,3)+1];
else if(type==='VP8L'){const bits=bytes.readUInt32LE(21);dimensions=[(bits&16383)+1,((bits>>>14)&16383)+1];}
else throw Error('Unsupported original WebP header '+type);
if(dimensions.join(',')!=='4077,735')throw Error('Original atlas dimensions changed');
async function profile(lateTimer=false,cold=false) {
 let wall=0,sequence=0,thermal=false,loads=0,unloads=0,resolveLoad;const timers=new Map(),callbacks=new Set(),modules=new Map();
 const ticker={elapsedMS:0,add(fn){callbacks.add(fn)},remove(fn){callbacks.delete(fn)}};
 const stage=new pixi.Container(),board=new pixi.Container();stage.addChild(board);
 const document={hidden:false,addEventListener(){},removeEventListener(){}};
 const canvas={hidden:false,style:{display:'',visibility:'',opacity:''},parentElement:null};
 const STATE={app:{stage,ticker,canvas}};
 const sheet=new pixi.Texture({source:new pixi.TextureSource({width:dimensions[0],height:dimensions[1]})});
 const endpoints={
  'pixi.js':{...pixi,Assets:{get(){return cold?undefined:sheet},async load(){loads++;return new Promise(resolve=>{resolveLoad=()=>resolve(sheet)})},async unload(){unloads++}}},
  './app-state.ts':{STATE},'./special-ticker-error.ts':{retireFailedSpecialTickerOwner(_family,error,retire){retire();throw error}},
  '../utils/thermal-isolation.js':{isThermalWorkSuppressed(){return thermal}},
  './gameplay-texture-filtering.ts':{applyGameplayTextureFiltering(){}},
  '../utils/pixi-image-texture-health.ts':{async reloadPixiImageTexture(){return sheet}},
  './mobile-runtime-profile.ts':{MOBILE_RUNTIME_PROFILE:{isMobileDevice:true}},
  './foreground-resource-coordinator.ts':{cancelDeferredForegroundResourceTask(){},deferUntilForegroundResourceIdle(_key,fn){fn()}},
  './special-dice-registry.ts':{getSpecialDiceVariantForTile(tile){return tile.variant??null}},
  './animated-special-artwork-mode.ts':{releaseAnimatedSpecialArtworkFamily(){}}
 };
 function load(file){if(modules.has(file))return modules.get(file).exports;
  const module={exports:{}};modules.set(file,module);
  const code=ts.transpileModule(fs.readFileSync(root+'/src/modules/'+file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,require(id){if(id in endpoints)return endpoints[id];return load(id.replace('./',''))},Date:{now:()=>wall},document,
   setTimeout(fn,ms){const id=++sequence;timers.set(id,{fn,at:wall+ms});return id},clearTimeout(id){timers.delete(id)}} ,{filename:file});return module.exports;
 }
 const api=load('wild-star-bouncy-artwork.ts');
 const idle=fs.readFileSync(root+'/src/modules/special-dice-idle.ts','utf8');
 const registryPrefix=idle.slice(idle.indexOf('function setSpecialDiceIdleRegistryPaused('),idle.indexOf('export function startSpecialDiceIdleMotion('));
 const registryBindings={...api};for(const stem of ['FlowerBouncy','BarrelBouncy','MushroomBouncy','RoboBouncy','BeachBallBouncy','FishSwim','PlainJuiceBounce'])registryBindings['is'+stem+'Tile']=()=>false;
 const registryCode=ts.transpileModule(registryPrefix,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}}).outputText;
 const setRegistry=vm.runInNewContext(registryCode+';setSpecialDiceIdleRegistryPaused',registryBindings);
 const phase=load('animated-svg-phase-scheduler.ts'),front=load('animated-dice-hud-foreground.ts');
 function tile(id,x){const tile=new pixi.Container();tile.label=id;tile.special='wild';tile.variant=null;tile.x=x;tile.zIndex=4;board.addChild(tile);
  const host=new pixi.Container(),base=new pixi.Sprite(new pixi.Texture({source:new pixi.TextureSource({width:128,height:128})}));
  tile.addChild(host);host.addChild(base);tile.rotG=host;tile.base=base;base.zIndex=3;return tile;}
 const a=tile('a',40),b=tile('b',170),ca=api.startWildStarBouncyArtwork(a),cb=api.startWildStarBouncyArtwork(b);
 const readyOrder=[];for(const[id,c]of [["a",ca],["b",cb]]){const original=c.onReady;c.onReady=()=>{readyOrder.push(id);original?.()}}
 const checkpoint=()=>new Promise(resolve=>setImmediate(resolve));await checkpoint();
 const samples=[];
 function capture(label){function item(c){const s=c.sprite;s?.updateLocalTransform();return{elapsed:c.elapsedMs,phase:c.phaseLease?{slot:c.phaseLease.phaseSlot,delay:c.phaseLease.delayMs,planned:c.phaseLease.plannedStartAtMs}:null,frame:c.frameIndex,running:c.running,disposed:c.disposed,visible:s?.visible??null,baseRenderable:c.base.renderable,texture:s?.texture.label??null,size:s?[s.width,s.height]:null,anchor:s?[s.anchor.x,s.anchor.y]:null,z:s?.zIndex??null,parent:s?.parent?.label??null,matrix:s?[s.localTransform.a,s.localTransform.b,s.localTransform.c,s.localTransform.d,s.localTransform.tx,s.localTransform.ty]:null}}
  samples.push({label,wall,a:item(ca),b:item(cb),stats:api.getWildStarBouncyRuntimeStats(),phases:phase.getAnimatedSvgPhaseSchedulerStats(),foreground:front.getAnimatedDiceHudForegroundStats(),tickerCallbacks:callbacks.size});}
 function tick(label,delta){ticker.elapsedMS=delta;for(const fn of [...callbacks])fn(ticker);capture(label)}
 function due(at){wall=at;const pending=[...timers].filter(([,t])=>t.at<=wall).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0]);for(const[id,t]of pending)if(timers.delete(id))t.fn();}
 if(cold){capture('cold-assets-pending');if(ca.ready||cb.ready||loads!==1)throw Error('Cold original must coalesce one genuine pending asset load');resolveLoad();await checkpoint()}
 capture('mounted');tick('first-16',16);tick('clamped-250',250);
 const pending=ca.running?cb:ca,planned=pending.phaseLease.plannedStartAtMs;due(lateTimer?2000:planned);capture(lateTimer?'late-replan':'pending-start');
 if(lateTimer){if(pending.running)throw Error('Fixture must exercise real late-timer replan');due(pending.phaseLease.plannedStartAtMs);capture('replanned-pending-start')}
 if(!ca.running||!cb.running)throw Error('Both real phase receipts required');
 tick('paired-33',33);setRegistry(a,true);tick('registry-pressure',20);setRegistry(a,false);tick('registry-release',20);a._ccSpecialIdleDragging=true;api.setWildStarBouncyArtworkDragging(a,true);tick('actual-pointer-drag',20);
 // Original complete foreground CPU matrix owner follows board transform.
 board.position.set(23,51);board.scale.set(0.8,1.1);board.rotation=0.23;tick('ancestor-transform',0);
 a.rotG.alpha=0.001;tick('host-hidden-threshold',40);a.rotG.alpha=1;tick('host-visible-resume',40);
 document.hidden=true;tick('document-hidden',55);document.hidden=false;tick('document-resume',55);
 canvas.style.opacity='0.001';tick('canvas-hidden',40);canvas.style.opacity='';tick('canvas-resume',40);
 thermal=true;tick('thermal-suppressed',70);thermal=false;tick('thermal-resume',70);
 const reused=api.startWildStarBouncyArtwork(a);if(reused!==ca)throw Error('Original repeat must retain controller');capture('repeat-retains-phase');
 a.special=null;tick('identity-regular',10);api.stopWildStarBouncyArtwork(a);tick('sibling-survives',16);
 b.removeFromParent();tick('last-host-detached',16);tick('after-last-disposal',100);
 if(callbacks.size!==0||front.getAnimatedDiceHudForegroundStats().owners!==0||phase.getAnimatedSvgPhaseSchedulerStats().leases!==0)throw Error('Original last-owner cleanup failed');
 load('shared-pixi-sheet-animation.ts').resetSharedPixiSheetAnimationForTests();
 return{lateTimer,cold,planned,readyOrder,samples,loads,unloads,pendingTimersAfterReset:timers.size};
}
(async()=>{const result={authority:'Untouched original Star/shared sheet, actual phase scheduler, visibility and foreground modules. Real installed Pixi Container/Matrix/Sprite/Texture CPU objects. Explicit logical Date/timer/ticker, texture-cache and document/canvas endpoints; no GPU/WebKit/device claim.',sourceSHA256:hashes,atlas:{path:atlasPath,dimensions,sha256:crypto.createHash('sha256').update(bytes).digest('hex')},profiles:[await profile(),await profile(true),await profile(false,true)]};
fs.writeFileSync(path.join(__dirname,'star-source-sheet-oracle.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.profiles.map(p=>({late:p.lateTimer,samples:p.samples.length,planned:p.planned,last:p.samples.at(-1).stats}))));})().catch(e=>{console.error(e);process.exitCode=1});
