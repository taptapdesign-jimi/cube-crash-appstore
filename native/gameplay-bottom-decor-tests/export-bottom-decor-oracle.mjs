import fs from 'node:fs';import vm from 'node:vm';import {createRequire}from'node:module';import{fileURLToPath}from'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=fileURLToPath(new URL('./',import.meta.url)),require=createRequire(import.meta.url),ts=require(root+'/node_modules/typescript'),gsap=require(root+'/node_modules/gsap/dist/gsap').gsap;
const parse=file=>ts.createSourceFile(file,fs.readFileSync(root+'/'+file,'utf8'),ts.ScriptTarget.Latest,true);
const assetAST=parse('src/utils/board-asset-warmup.ts'),assetFunctions=['getBeachHudAsset','getArea55HudAsset','getJourneyBottomDecorIndexForBoard','getJourneyBottomDecorAssetForBoard','applyJourneyBottomDecorSource','warmJourneyBottomDecor'];
const names=['JOURNEY_BOTTOM_DECOR_COUNT','journeyBottomDecorByBoard','BEACH_FIRST_BOARD','BEACH_LAST_BOARD','AREA55_FIRST_BOARD','AREA55_LAST_BOARD','BEACH_HUD_HIGH_RES_FILE_BY_UNIT','pendingDecorWarmups'];
const assetSource=assetAST.statements.filter(n=>ts.isFunctionDeclaration(n)?assetFunctions.includes(n.name?.text):ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>names.includes(d.name.getText()))).map(n=>n.getText()).join('\n');
const transpile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
let assets=[];for(const originalSeed of [1,7,99991]) {
 let seed=originalSeed,draws=0,images=[];const math=Object.create(Math);math.random=()=>{draws++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 class Image{constructor(){images.push(this)}set src(value){this.source=value;queueMicrotask(()=>this.onload?.())}get src(){return this.source}decode(){return Promise.resolve()}}
 const box={exports:{},Math:math,Image,queueMicrotask,setTimeout:()=>1,clearTimeout(){}};vm.createContext(box);vm.runInContext(transpile(assetSource),box);
 const records=[];for(const board of [...Array.from({length:30},(_,i)=>i+1),...Array.from({length:30},(_,i)=>30-i)]) {
  const asset=box.exports.getJourneyBottomDecorAssetForBoard(board);await box.exports.warmJourneyBottomDecor(board);
  const pixels=[];for(const density of [1,2,3]){const path=density>1?(asset.twoX??asset.oneX):asset.oneX;const png=fs.readFileSync(root+'/'+path.slice(2));pixels.push([density,png.readUInt32BE(16),png.readUInt32BE(20)])}
  const warm=images.at(-1);records.push({board,...asset,pixels,warmSource:warm.src,warmSrcset:warm.srcset});
 }
 assets.push({seed:originalSeed,draws,records});
}
const motionBox={exports:{}};vm.createContext(motionBox);vm.runInContext(transpile(fs.readFileSync(root+'/src/modules/journey-bottom-decor-motion.ts','utf8')),motionBox);
const ast=parse('src/modules/app-core.ts'),owners=['ensureJourneyGameBottomDecor','waitForJourneyGameBottomDecorReady','killJourneyGameBottomDecorTween','primeJourneyGameBottomDecor','setJourneyGameBottomDecorVisible'];
const source=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&owners.includes(n.name?.text)).map(n=>n.getText()).join('\n');
const classList=()=>{const keys=new Set();return{add:(...names)=>names.forEach(n=>keys.add(n)),remove:(...names)=>names.forEach(n=>keys.delete(n)),contains:n=>keys.has(n),toggle(n,v){if(v)keys.add(n);else keys.delete(n)}}};
function make(){
 const image={force3D:false,transformOrigin:"50% 100%",x:0,y:0,scaleX:1,scaleY:1,opacity:0,hidden:true,complete:true,naturalWidth:300,decode:()=>Promise.resolve(),classList:classList(),setAttribute(){},removeAttribute(){},addEventListener(){},removeEventListener(){}},host={classList:classList(),querySelector:()=>image,appendChild(){}};
 let timelines=[];const gsapWrapper={...gsap,set(target,vars){if(vars.clearProps){target.x=0;target.y=0;target.scaleX=1;target.scaleY=1;target.opacity=target.classList.contains('is-visible')?1:0;return}return gsap.set(target,vars)}};
 const box={exports:{},console,gsap:gsapWrapper,JOURNEY_BOTTOM_DECOR_MOTION:motionBox.exports.JOURNEY_BOTTOM_DECOR_MOTION,updateJourneyGameBottomDecorSource(){},trackTimeline:(options={})=>{const t=gsap.timeline(options).pause();timelines.push(t);return t},trackTween:(target,vars)=>{const t=gsap.to(target,vars).pause();timelines.push(t);return t},document:{getElementById:()=>host,body:{classList:classList()},createElement:()=>image},window:{setTimeout:()=>1,clearTimeout(){}},journeyGameBottomDecorLifecycleToken:0,journeyGameBottomDecorTween:null};
 vm.createContext(box);vm.runInContext(transpile(source.replace('function setJourneyGameBottomDecorVisible','export function setJourneyGameBottomDecorVisible')),box);
 return{box,image,timelines};
}
let motions=[];for(const capture of [0,0.17,0.4,0.62,1]){
 const{box,image,timelines}=make();box.exports.setJourneyGameBottomDecorVisible(true);for(let i=0;i<10;i++)await Promise.resolve();if(!timelines.length)throw Error('Original prepared-image callback did not admit enter');const enter=timelines[0],enterSamples=[];
 for(const seconds of [0,.017,.075,.14,.249,.479,.48,.515,.619,.62,.9]){enter.totalTime(seconds,false);enterSamples.push([seconds,image.x,image.y,image.scaleX,image.scaleY,image.opacity])}
 enter.totalTime(capture,false);image.x=-2;image.y+=3;
 const initial=[image.x,image.y,image.scaleX,image.scaleY,image.opacity];box.exports.setJourneyGameBottomDecorVisible(false);const exit=timelines.at(-1),exitSamples=[];
 for(const seconds of [0,.017,.075,.14,.249,.399,.439]){exit.totalTime(seconds,false);exitSamples.push([seconds,image.x,image.y,image.scaleX,image.scaleY,image.opacity])}
 exit.totalTime(.44,false);motions.push({capture,initial,enter:enterSamples,exit:exitSamples,hidden:image.hidden});timelines.forEach(t=>t.kill());
}
const payload={assets,motions};fs.writeFileSync(out+'bottom-decor-oracle.json',JSON.stringify(payload));gsap.ticker.sleep();console.log('Original asset map + real warmup',assets.length,'seeds ×60 visits; actual original GSAP',motions.length,'captured exits');
