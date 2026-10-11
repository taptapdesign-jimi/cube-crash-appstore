const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.resolve(__dirname,'../../..'),ts=require(root+'/node_modules/typescript'),{gsap}=require(root+'/node_modules/gsap/dist/gsap');
const original=fs.readFileSync(root+'/src/modules/honey-bee-idle-orbit.ts','utf8');
const forest=fs.readFileSync(root+'/src/modules/journey-forest-bee-orbits.ts','utf8');
const helper=forest.slice(forest.indexOf('export function getJourneyForestBeeAssetForVelocity('),forest.indexOf('/** Writes x, y, velocityX',forest.indexOf('export function getJourneyForestBeeAssetForVelocity(')));
const code=ts.transpileModule((helper+'\n'+original.replace(/^import .*;\s*$/gm,'')).replace(/^export /gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}}).outputText;
let seed=1,draws=0,kills=0,widthWrites=0;const events=[],sprites=[],roots=[];
const math=Object.create(Math);math.random=()=>{draws++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
class Container {constructor(){this.children=[];this.destroyed=false;this.x=0;this.y=0;this.alpha=1;this.visible=true;this.renderable=true;this.scale={x:1,y:1,set(x,y=x){this.x=x;this.y=y}};}addChild(...nodes){for(const n of nodes){n.parent?.removeChild(n);n.parent=this;this.children.push(n);}return nodes[0];}removeChild(n){this.children=this.children.filter(v=>v!==n);n.parent=null;}sortChildren(){}destroy(){this.destroyed=true;}}
class Sprite extends Container {constructor(texture){super();this.texture=texture;this.anchor={set(){}};}get width(){return Math.abs(this.scale.x)*this.texture.width;}set width(v){widthWrites++;this.scale.x=v/this.texture.width;}get height(){return Math.abs(this.scale.y)*this.texture.height;}set height(v){this.scale.y=v/this.texture.height;}}
const empty={id:'EMPTY',width:1,height:1};const textures=Array.from({length:7},(_,i)=>{const file=root+`/assets/shop/honey/bee${i+1}@2x.png`,png=fs.readFileSync(file);return{id:`bee${i+1}`,width:png.readUInt32BE(16)/2,height:png.readUInt32BE(20)/2};});
const host=new Container(),tile={rotG:host,visible:true,renderable:true,alpha:1,destroyed:false};
const context={Math:math,TILE:128,window:{devicePixelRatio:2},Container,Texture:{EMPTY:empty},Promise,
 Assets:{get(source){events.push({event:'cached-read',source,draws});return textures[Number(source.match(/bee(\d)/)[1])-1];},load(){throw Error('cached oracle unexpectedly loaded');}},
 isUsablePixiImageTexture:t=>!!t&&t!==empty,reloadPixiImageTexture:()=>{throw Error('cached oracle unexpectedly recovered');},
 getBubbleSpritePool:()=>({acquire(t){const s=new Sprite(t);sprites.push(s);events.push({event:'sprite-acquire',draws});return s;},release(s){s.parent?.removeChild(s);events.push({event:'sprite-release',draws});}}),
 createSpecialIdleAnimationVisibility:()=>({track(t){events.push({event:'visibility-track',draws});return t;},release(){events.push({event:'visibility-release',draws});}}),
 isSpecialDiceIdlePaintable:()=>true,MOBILE_RUNTIME_PROFILE:{settledIdleMaxFramesPerSecond:30},gsap,
 animationManager:{trackExternalTween(t){t.pause();gsap.ticker.sleep();roots.push(t);events.push({event:'root-register',duration:t.duration(),draws});return t;},killExternalTween(t){kills++;t.kill();}}
};
vm.createContext(context);vm.runInContext(code,context);
function snapshot(label,seconds){return{label,seconds,draws,bees:sprites.map(s=>({x:s.x,y:s.y,alpha:s.alpha,width:s.width,height:s.height,asset:s.texture.id,layer:s.parent?.label}))};}
(async()=>{
 const owner=context.startHoneyBeeIdleOrbit(tile);if(!owner)throw Error('original controller refused mock live host');
 if(widthWrites!==6)throw Error('initial sprite sizing receipt missing: '+widthWrites);const samples=[snapshot('synchronous-force',0)];events.push({event:'returned-before-cohort',draws});
 await new Promise(setImmediate);
 if(widthWrites!==9)throw Error('cached cohort sizing receipt missing: '+widthWrites);samples.push(snapshot('cached-cohort-force',0));events.push({event:'cohort-checkpoint',draws});
 if(draws!==78||sprites.length!==3||roots.length!==1)throw Error(`unexpected original ownership ${draws}/${sprites.length}/${roots.length}`);
 const tween=roots[0];for(const t of [0.016,0.05,0.1,0.25,0.5,0.8,1.2]){tween.totalTime(t,false);samples.push(snapshot('idle',t));}
 owner.setDragging(true);owner.updateDragMotion(20,-10,0.2,0.04);samples.push(snapshot('pointer-counter-shift',1.2));
 for(let i=1;i<=120;i++){const t=1.2+i/60;tween.totalTime(t,false);if(i%10===0)samples.push(snapshot('drag',t));}
 owner.setDragging(false);for(let i=1;i<=60;i++){const t=3.2+i/60;tween.totalTime(t,false);if(i<=5||i%10===0)samples.push(snapshot('reentry',t));}
 if(draws!==81)throw Error('three original reentry Math draws not reached: '+draws);
 owner.dispose();owner.dispose();if(kills!==1||events.filter(e=>e.event==='sprite-release').length!==3||host.children.length!==0)throw Error('captured original cleanup not exact');
 const result={authority:'Unmodified original Honey controller and heading helper transpiled/executed with installed real GSAP finite tween. Explicit cached Pixi/pool/visibility/resource endpoints and PNG logical dimensions; direct totalTime samples, not actual shared RAF/lag or GPU/Native admission.',sourceSHA256:crypto.createHash('sha256').update(original+helper).digest('hex'),seed:1,constructorDraws:78,duration:3600,events,samples,final:{draws,kills,hostChildren:host.children.length,snapshot:owner.getSnapshot()}};
 fs.writeFileSync(path.join(__dirname,'honey-source-controller-oracle.json'),JSON.stringify(result,null,2)+'\n');gsap.ticker.sleep();console.log(JSON.stringify({constructorDraws:78,finalDraws:draws,samples:samples.length,roots:roots.length,kills}));
})().catch(e=>{gsap.ticker.sleep();console.error(e);process.exitCode=1;});
