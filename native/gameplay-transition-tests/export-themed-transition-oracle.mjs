// Authoring-time only. Original TS geometry and motions remain the oracle.
import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
import {createRequire} from 'node:module';
const gsap=createRequire(import.meta.url)('gsap/dist/gsap').gsap;
const screen=fs.readFileSync('src/modules/board-transition-screen.ts','utf8');
const tree=ts.createSourceFile('screen',screen,ts.ScriptTarget.Latest,true);
const names=new Set(['TRANSITION_SCENE_LAYERS','TRANSITION_SCENE_ENTER_ORDER']);
const sceneConstants=tree.statements.filter(ts.isVariableStatement).filter(s=>s.declarationList.declarations.some(d=>names.has(d.name.getText()))).map(s=>s.getText()).join('\n');
const themeTree=ts.createSourceFile('themes',fs.readFileSync('src/modules/board-transition-themes.ts','utf8'),ts.ScriptTarget.Latest,true);
const themeNames=new Set(['islandStyle','BEACH_BOARD_TRANSITION_PROFILE','AREA55_BOARD_TRANSITION_PROFILE']);
const themeConstants=themeTree.statements.filter(ts.isVariableStatement).filter(s=>s.declarationList.declarations.some(d=>themeNames.has(d.name.getText()))).map(s=>s.getText()).join('\n');
const context={exports:{}};vm.createContext(context);
vm.runInContext(ts.transpileModule(`const BEACH_FLOAT_LEFT_EDGE_RATIO=.06,BEACH_FLOAT_RIGHT_EDGE_RATIO=.94;${sceneConstants}\n${themeConstants}\nfunction profiles(){return {forest:{layers:TRANSITION_SCENE_LAYERS,order:TRANSITION_SCENE_ENTER_ORDER},beach:BEACH_BOARD_TRANSITION_PROFILE,area55:AREA55_BOARD_TRANSITION_PROFILE}}`,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const profiles=vm.runInContext('profiles()',context);
function linear(text){text=text.replace(/^calc\(/,'').replace(/\)$/,'');const matches=[...text.matchAll(/([+-]?\s*\d+(?:\.\d+)?)\s*(%|px|vh)/g)];let ratio=0,constant=0,viewportRatio=0;for(const [,n,unit]of matches){const v=Number(n.replace(/\s/g,''));if(unit==='%')ratio+=v/100;else if(unit==='vh')viewportRatio+=v/100;else constant+=v;}return [ratio,constant,viewportRatio];}
const literals=[];
for(const [theme,profile] of Object.entries(profiles)) {
 const values=profile.layers.map(layer=>{
  const styles=Object.fromEntries(layer.style.map(rule=>{const i=rule.indexOf(':');return [rule.slice(0,i).trim(),rule.slice(i+1).trim()]}));
  const path=layer.src.replace(/^\.\//,''),png=fs.readFileSync(path),nw=png.readUInt32BE(16),nh=png.readUInt32BE(20);
  let maxWidth,widthRatio;if(styles.width==='auto'){maxWidth=390;widthRatio=0;}else if(styles.width.startsWith('min')){const m=styles.width.match(/min\(([\d.]+)vw,\s*([\d.]+)px\)/);widthRatio=Number(m[1])/100;maxWidth=Number(m[2]);}else {widthRatio=0;maxWidth=parseFloat(styles.width);}
  const [leftRatio,leftOffset]=linear(styles.left),[bottomRatio,bottomOffset,bottomViewportRatio]=linear(styles.bottom);
  const heightRatio=layer.key==='mountain'?328/390:layer.key==='hill1'?197/390:layer.key==='hill2'?122/390:nh/nw;
  return `.init(key:${JSON.stringify(layer.key)},asset:${JSON.stringify(layer.src)},leftRatio:${leftRatio},leftOffset:${leftOffset},bottomRatio:${bottomRatio},bottomOffset:${bottomOffset},bottomViewportRatio:${bottomViewportRatio},widthRatio:${widthRatio},maximumWidth:${maxWidth},heightRatio:${heightRatio},depth:${Number(styles['z-index'])},motion:${JSON.stringify(layer.motionRole??'')})`;
 });literals.push(`case .${theme}:return [\n${values.join(',\n')}\n]`);
}
fs.writeFileSync('native/gameplay-transitions/NativeTransitionThemeLayers.swift',`// Generated from immutable original authored profiles and PNG dimensions.\nimport Foundation\nenum NativeTransitionThemeLayers {\nstruct Layer {let key:String,asset:String;let leftRatio:Double,leftOffset:Double,bottomRatio:Double,bottomOffset:Double,bottomViewportRatio:Double,widthRatio:Double,maximumWidth:Double,heightRatio:Double;let depth:Int,motion:String}\nstatic func layers(_ theme:NativeBoardTransitionPlan.Theme)->[Layer] {switch theme {\n${literals.join('\n')}\n}}\nstatic func enterOrder(_ theme:NativeBoardTransitionPlan.Theme)->[String] {switch theme {\n${Object.entries(profiles).map(([t,p])=>`case .${t}:return ${JSON.stringify(p.order??p.enterOrder)}`).join('\n')}\n}}\n}\n`);
console.log('Exported exact Forest/Beach/Area55 geometry descriptors from original profiles and PNG dimensions.');
const cloudConstants=tree.statements.filter(ts.isVariableStatement).filter(s=>s.declarationList.declarations.some(d=>['TRANSITION_CLOUD_IMAGES','BEACH_CLOUD_SPAWN_SLOTS'].includes(d.name.getText()))).map(s=>s.getText()).join('\n');
const start=screen.indexOf('    const cloudImages = TRANSITION_CLOUD_IMAGES;'),end=screen.indexOf('      const cloudWrapper = document.createElement',start);
const pre=screen.slice(start,end);
const cloudFunction=`function clouds(resolvedTheme,width){let options={},window={innerWidth:width},result=[];${pre}\nresult.push([i%4,resolvedTheme==='beach'?1:isBehindHillCloud?2:isLowerCloud?415:i%3===1?5:1,cloudSizePx,cloudHeightPx,spawnLeft,spawnTop,baseSize,rotation,bounceAmount,bounceSpeed,windDuration,driftDistancePx,initialYOffset,enterDelay]);}return result;}`;
let rngState,draws;const math=Object.create(Math);math.random=()=>{draws++;rngState=(Math.imul(rngState,1664525)+1013904223)>>>0;return rngState/4294967296;};
const box={exports:{},Math:math};vm.createContext(box);vm.runInContext(ts.transpileModule(`const BEACH_BOARD_TRANSITION_CLOUD_COUNT=6;${cloudConstants}\n${cloudFunction}`,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,box);
const cloudFixtures=[];
for(const seed of [1,7,1337,99991])for(const width of [320,390,834])for(const theme of ['forest','beach','area55']) {
 rngState=seed;draws=0;box.theme=theme;box.width=width;const plans=vm.runInContext('clouds(theme,width)',box);
 const samples=plans.flatMap((p,index)=>[.12,.37,.61,1.25].map(t=>{
  const age=t-p[13],target={scale:.12,opacity:0},enter=gsap.timeline({paused:true});
  // Execute the two original source keyframes through the actual GSAP engine.
  enter.to(target,{opacity:1,scale:p[6]*1.22,duration:.34,ease:'back.out(2.2)'}).to(target,{scale:p[6],duration:.14,ease:'power2.out'});
  enter.totalTime(Math.max(0,age),true);if(age<0){target.scale=.12;target.opacity=0}const result=[index,t,target.scale,Math.min(1,Math.max(0,target.opacity))];enter.kill();return result;
 }));cloudFixtures.push({seed,width,theme,draws,plans,samples});
}
fs.writeFileSync('native/gameplay-transition-tests/NativeThemedCloudOracle.swift',`// Generated from original source cloud planner and actual GSAP keyframes.\nimport Foundation\nenum NativeThemedCloudOracle {\nstruct Record:Decodable {let seed:UInt32,width:Double,theme:String,draws:Int,plans:[[Double]],samples:[[Double]]}\nstatic let records:[Record]=try! JSONDecoder().decode([Record].self,from:Data(json.utf8))\nprivate static let json = #"""\n${JSON.stringify(cloudFixtures)}\n"""#\n}\n`);
gsap.ticker.sleep();console.log(`Exported ${cloudFixtures.length} cloud scene plans with independent RNG counts and GSAP entry samples.`);
