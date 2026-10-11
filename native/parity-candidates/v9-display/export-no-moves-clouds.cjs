const fs=require('node:fs'),vm=require('node:vm'),cp=require('node:child_process'),ts=require('../../../node_modules/typescript'),{gsap}=require('../../../node_modules/gsap/dist/gsap');
const original=cp.execFileSync('git',['show','production-benchmark-v9:src/modules/text-clouds.ts'],{encoding:'utf8'});
const source=original.slice(original.indexOf('const CLOUD_IMAGES'));
class Element{constructor(){this.style={};this.children=[];this.x=0;this.y=0;this.scale=.12;this.opacity=0;this.rotation=0;this.xPercent=0;this.yPercent=0}appendChild(x){this.children.push(x)}remove(){}}
const cases=[];
for(const [width,height]of [[320,568],[390,844],[834,1194]])for(const seed of [7,19,91]){
 let state=seed;const math=Object.create(Math);math.random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
 const delayed=[],timelines=[],overlay=new Element();
 const box={exports:{},Math:math,console,window:{innerWidth:width,innerHeight:height,devicePixelRatio:3},document:{createElement:()=>new Element()},domElementPool:{acquire:()=>new Element(),release(){}},gsap,animationManager:{trackExternalTimeline:t=>{t.pause();timelines.push(t);return t},trackExternalTween:t=>t},trackTimeline:options=>{const t=gsap.timeline({...options,paused:true});timelines.push(t);return t}};
 // Retain the original attach function; replace only its scheduler boundary.
 let program=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 program=program.replace('const trackDelayedCall = (...args) => animationManager.trackExternalTween(gsap.delayedCall(...args));','const trackDelayedCall = (...args) => captureDelay(...args);');
 box.captureDelay=(delay,cb)=>{const d={delay,cb,kill(){}};delayed.push(d);return d};
 vm.createContext(box);vm.runInContext(program,box);box.exports.attachPuffyClouds(overlay,{count:5,timingScale:.38,floatBounce:false,autoExit:true});
 const images=overlay.children[0].children;
 for(let i=0;i<5;i++){
  const img=images[i],enter=timelines[i],exitAt=delayed[i].delay,rows=[];
  for(let ms=0;ms<=Math.floor(exitAt*1000);ms+=3){const t=ms/1000;enter.totalTime(Math.max(0,t-enter.delay()),true);rows.push([t,img.x,img.y,img.scale,Math.min(1,Math.max(0,img.opacity))])}
  enter.totalTime(exitAt-enter.delay(),true);delayed[i].cb();const exit=timelines.at(-1);
  for(let ms=0;ms<=183;ms+=3){exit.totalTime(ms/1000,true);rows.push([exitAt+ms/1000,img.x,img.y,img.scale,Math.min(1,Math.max(0,img.opacity))])}
  cases.push({width,height,seed,index:i,src:img.src,style:img.style.cssText,rotation:img.rotation,exitAt,rows});
 }
 timelines.forEach(t=>t.kill());
}
gsap.ticker.sleep();fs.writeFileSync(__dirname+'/no-moves-cloud-oracle.json',JSON.stringify(cases));console.log('PASS v9 actual cloud GSAP',cases.length,'plans',cases.reduce((sum,c)=>sum+c.rows.length,0),'poses');
