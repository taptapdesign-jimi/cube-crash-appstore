const fs=require('node:fs'),vm=require('node:vm'),cp=require('node:child_process'),ts=require('../../../node_modules/typescript'),{gsap}=require('../../../node_modules/gsap/dist/gsap');
const source=cp.execFileSync('git',['show','production-benchmark-v9:src/modules/splash-text-overlay.ts'],{encoding:'utf8'});
const constants=source.slice(source.indexOf('const ENTER_BOUNCE_SCALE'),source.indexOf('export function resolveSplashLetterOpacity'));
const show=source.slice(source.indexOf('export function showNoMovesText'),source.indexOf('export function clearNoMovesText'));
const exit=source.slice(source.indexOf('export function exitNoMovesText'));
class Element {constructor(){this.children=[];this.style={};this.isConnected=false;for(const k of ['scale','opacity','rotation','rotationX','rotationY','z','x','y'])this[k]=0}appendChild(el){el.parentNode=this;this.children.push(el);el.isConnected=true;return el}querySelector(){return this.children[0]}remove(){this.isConnected=false}}
const rows=[],styles=[];
for(const seed of [7,19,91]){
 let state=seed;const math=Object.create(Math);math.random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
 const delayed=[];
 const box={exports:{},Math:math,console,document:{createElement:()=>new Element(),body:new Element()},gsap,playNoMovesSound(){},attachPuffyClouds(){return ()=>{}},trackTimeline:options=>gsap.timeline({...options,paused:true}),trackDelayedCall:(delay,cb)=>{const x={delay,cb,kill(){}};delayed.push(x);return x},killTrackedTimeline:t=>t.kill(),killTrackedTween:t=>t.kill(),setTimeout:()=>1,clearTimeout(){},cleanupNoMovesOverlay(){}};
 vm.createContext(box);
 const declarations='let noMovesOverlay=null,noMovesExitPromise=null,noMovesExiting=false,cancelNoMovesExit=null,noMovesCloudCleanup=null;let noMovesTimelinesRef=[],noMovesBounceTimelinesRef=[],noMovesDelayedCallsRef=[],noMovesLetterScales=[],noMovesLetterRotations=[];';
 vm.runInContext(ts.transpileModule(declarations+constants+show+exit,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,box);
 box.exports.showNoMovesText();const glyphs=vm.runInContext('noMovesOverlay.children[0].children',box);
 styles.push({seed,tilt:vm.runInContext('noMovesOverlay.children[0].style.transform',box),letters:glyphs.map(el=>({style:el.style.cssText,bounce:0}))});
 delayed.find(x=>x.delay===0.2).cb();const enter=vm.runInContext('noMovesTimelinesRef',box),bounce=vm.runInContext('noMovesBounceTimelinesRef',box);
 for(let i=0;i<8;i++){
  styles.at(-1).letters[i].bounce=bounce[i].getChildren()[0].vars.scale;
  for(let ms=0;ms<=1500;ms+=3){const t=ms/1000,local=t-.2-i*.05;enter[i].totalTime(Math.max(0,local),true);if(local>=.54){bounce[i].invalidate();glyphs[i].scale=1;bounce[i].totalTime(local-.54,true)}const el=glyphs[i];rows.push({seed,index:i,phase:'enter',seconds:t,pose:[el.scale,Math.min(1,Math.max(0,el.opacity)),el.rotationX,el.rotationY,el.rotation,el.z]})}
 }
 // Capture one actual interrupted/settled exit; each target's current pose is
 // retained exactly when the source kills its enter/bounce timelines.
 const exitAt=1.1;
 for(let i=0;i<8;i++){const age=exitAt-.2-i*.05;enter[i].totalTime(Math.max(0,age),true);if(age>=.54){bounce[i].invalidate();glyphs[i].scale=1;bounce[i].totalTime(age-.54,true)}}
 const initial=glyphs.map(el=>[el.scale,Math.min(1,Math.max(0,el.opacity)),el.rotationX,el.rotationY,el.rotation,el.z]);
 box.exports.exitNoMovesText();const exiting=vm.runInContext('noMovesTimelinesRef',box);
 for(let i=0;i<8;i++){const angle=exiting[i].getChildren().at(-1).vars.rotation;styles.at(-1).letters[i].exitRotation=angle;styles.at(-1).letters[i].exitFrom=initial[i];for(let ms=0;ms<=1100;ms+=3){const t=ms/1000;exiting[i].totalTime(Math.max(0,t-i*.06),true);const el=glyphs[i];rows.push({seed,index:i,phase:'exit',seconds:t,pose:[el.scale,Math.min(1,Math.max(0,el.opacity)),el.rotationX,el.rotationY,el.rotation,el.z]})}}
 [...enter,...bounce,...exiting].forEach(t=>t.kill());
}
gsap.ticker.sleep();fs.writeFileSync(__dirname+'/no-moves-oracle.json',JSON.stringify({styles,rows}));console.log('PASS executed v9 NO MOVES',rows.length,'GSAP glyph poses');
