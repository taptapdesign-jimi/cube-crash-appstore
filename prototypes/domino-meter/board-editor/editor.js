import {nativeBarCyclePose,nativeBarCycleDuration} from '../native-bar-cycle.js';
import {createTravelCycle} from '../travel-cycle.js';
import {cubeDefaults,cubePresets,cubeRanges,cubeEnums,normalizeCubeDesign} from '../cube-designs.js';
import {preparePreloadSnapshots,preloadSnapshot} from '../preload-snapshot.js';
const $=id=>document.getElementById(id),svg=$('board'),NS='http://www.w3.org/2000/svg';
const W=390,H=844,defaults={version:1,viewport:{width:W,height:H,safeTop:47,safeBottom:34},layers:Object.fromEntries(['hud','close','backpack','score','combo','meter','divider','grid','footer'].map(id=>[id,{x:0,y:0,scale:100}])),dividerWidth:95,dividerOpacity:55,dividerShadowOpacity:100,dividerStyle:'art',lineHeight:1,meterStyle:'cubes',meterPreviewChoice:'legacy',meterPreviewDesign:null,meterPreviewHeight:100,meterPreviewHeightPt:null,fill:42};
const archDepth=49*.288,navTop=47+H*.02-16,navHeight=(navTop+66)*.8,navRow=navTop+26-((navTop+66)-navHeight)/2+8;
const archDrop=x=>4*archDepth*(x/W)*(1-x/W);
const navAngle=(x,inward,side)=>Math.atan(4*archDepth*(1-2*(x+inward*side/2)/W)/W)*1.8*180/Math.PI;
Object.assign(defaults,{meterCount:24,meterGap:-2,meterWidth:342/W*100,archWidth:100,archOpacity:55,archShadowOpacity:100,navBackgroundOpacity:100,navBackgroundStyle:'original',archBend:100,archMasksPreloader:false,navigationArch:false,meterArchBend:0,meterSonicWave:null,meterLayer:'above'});
for(const layer of Object.values(defaults.layers))Object.assign(layer,{width:100,opacity:100,rotation:0,parked:false,slot:null});
Object.assign(defaults.layers,{
 navDivider:{x:0,y:0,scale:100,width:100,opacity:100,rotation:0,parked:true,slot:0},
 sonicWave:{x:0,y:0,scale:100,width:100,opacity:100,rotation:0,parked:true,slot:4,peakCount:2,peakWidth:150,waveHeight:16,archOpacity:55,archShadowOpacity:100},
 navDivider2:{x:0,y:0,scale:100,width:100,opacity:100,rotation:0,parked:true,slot:3,archWidth:100,archOpacity:55,archShadowOpacity:100,archBend:100,archMasksPreloader:false,navigationArch:false,navBackgroundOpacity:0,navBackgroundStyle:'original'},
 navDivider3:{x:0,y:0,scale:100,width:100,opacity:100,rotation:0,parked:true,slot:5,archWidth:100,archOpacity:55,archShadowOpacity:100,archBend:100,archMasksPreloader:false,navigationArch:false,navBackgroundOpacity:0,navBackgroundStyle:'original'},
 navClose:{x:0,y:0,scale:100,width:100,opacity:100,rotation:navAngle(44,1,44),parked:true,slot:1},
 navBackpack:{x:0,y:0,scale:100,width:100,opacity:100,rotation:navAngle(346,-1,40),parked:true,slot:2}
});
function normalize(value){const result={...structuredClone(defaults),...value,layers:{}};for(const[id,base]of Object.entries(defaults.layers))result.layers[id]={...base,...value?.layers?.[id]};
 // Preserve a previously linked draft's painted pose while retiring the link.
 if(value?.meterFollowArch&&value.meterArchBend===undefined){
  const t=result.layers.navDivider,ratio=value.meterArchWidthRatio??.8,depth=archDepth*result.archBend/100,a=t.rotation*Math.PI/180,dy=(depth-4)*t.scale/100;
  result.meterWidth=result.archWidth*ratio;result.meterArchBend=result.archBend*ratio*ratio;
  Object.assign(result.layers.meter,{x:t.x-Math.sin(a)*dy,y:navHeight+t.y+Math.cos(a)*dy-124,scale:t.scale,rotation:t.rotation});
 }
 if(!value?.layers?.navDivider2){const occupied=new Set(Object.entries(result.layers).filter(([id,p])=>id!=='navDivider2'&&p.parked).map(([,p])=>p.slot));let slot=0;while(occupied.has(slot))slot++;result.layers.navDivider2.slot=slot;}
 if(!value?.layers?.sonicWave){const occupied=new Set(Object.entries(result.layers).filter(([id,p])=>id!=='sonicWave'&&p.parked).map(([,p])=>p.slot));let slot=0;while(occupied.has(slot))slot++;result.layers.sonicWave.slot=slot;}
 if(!value?.layers?.navDivider3){const occupied=new Set(Object.entries(result.layers).filter(([id,p])=>id!=='navDivider3'&&p.parked).map(([,p])=>p.slot));let slot=0;while(occupied.has(slot))slot++;result.layers.navDivider3.slot=slot;}
 delete result.meterFollowArch;delete result.meterArchWidthRatio;applyNavigationArchMatches(result);return result;}
let preloadReady=false;
const preloadOptions=new Map(cubePresets.map(([name,,changes],i)=>['preset:'+i,{name,design:normalizeCubeDesign({...cubeDefaults,...changes})}]));
let state=structuredClone(defaults),selected='divider',drag=null;
const LABELS={sonicWave:'Sonic Wave',navDivider:'Divider · arch',navDivider2:'Divider · arch 2',navDivider3:'Divider · arch 3',navClose:'X · arch',navBackpack:'Ruksak · arch',divider:'Divider',meter:'Preloader / male kockice',hud:'Cijeli HUD',close:'Close',backpack:'Ruksak',score:'Trophy + score',combo:'Combo',grid:'Ploča',footer:'Donja ilustracija'};
try{const saved=JSON.parse(localStorage.getItem('sts-native-board-design-v1'));if(saved?.version===1&&saved.layers)state=normalize(saved)}catch{}
let history=[structuredClone(defaults)],historyIndex=0;
try{
 const saved=JSON.parse(localStorage.getItem('sts-native-board-history-v1'));
 if(Array.isArray(saved?.entries)&&saved.entries.length&&saved.entries.every(s=>s?.version===1&&s.layers)){
 history=saved.entries.map(normalize);historyIndex=Math.max(0,Math.min(history.length-1,Number.isInteger(saved.index)?saved.index:history.length-1));state=structuredClone(history[historyIndex]);
 }else if(JSON.stringify(state)!==JSON.stringify(defaults)){history.push(structuredClone(state));historyIndex=1;}
}catch{if(JSON.stringify(state)!==JSON.stringify(defaults)){history.push(structuredClone(state));historyIndex=1;}}
if(state.meterPreviewDesign)selected='meter';
function historyButtons(){$('undo').disabled=historyIndex===0;$('redo').disabled=historyIndex>=history.length-1;$('undo').title=`Undo · ${historyIndex} koraka do početka · Cmd/Ctrl+Z`;}
function persistHistory(){try{localStorage.setItem('sts-native-board-history-v1',JSON.stringify({entries:history,index:historyIndex}));}catch{$('status').textContent='Undo radi u ovoj sesiji;preglednik nema prostora za spremanje cijele povijesti.'}historyButtons();}
function commit(){applyNavigationArchMatches(state);if(JSON.stringify(state)!==JSON.stringify(history[historyIndex])){history=history.slice(0,historyIndex+1);history.push(structuredClone(state));historyIndex=history.length-1;}persistHistory();}
function finishDrag(event){finishItemDrag(event);}
function stepHistory(delta){finishDrag();const next=historyIndex+delta;if(next<0||next>=history.length)return;historyIndex=next;state=structuredClone(history[historyIndex]);sync();render();persistHistory();$('status').textContent=historyIndex===0?'Početni Native raspored.':`Korak ${historyIndex} od ${history.length-1}.`;}
const m=document.createElement('canvas').getContext('2d');let geo;
function computeGeometry(){
 // Literal phone branches from NativeGameplayChromePlan / NativeBoardGeometry.
 const safeTop=47,safeBottom=34,top=Math.max(44,safeTop)+48-Math.round(H*.047)-8;
 const row=top+20,meterTop=top+20+24+Math.round(H*.02)-8,meterBottom=meterTop+10;
 const dynamicHudBottom=meterBottom+24,available=H-dynamicHudBottom-24-safeBottom;
 const scale=Math.min((W-48)/(5*128+4*20),available/(9*128+8*20));
 const boardWidth=(5*128+4*20)*scale;
 const actualHeight=(9*128+8*20)*scale;
 const boardX=Math.min(Math.max(Math.round((W-boardWidth)/2),24),W-24-boardWidth);
 const boardY=Math.round(dynamicHudBottom+(available-actualHeight)/2-12);
 const meterUnit=(W-48)/(23*.432*.98+.432),cubeSide=.432*meterUnit;
 const floorY=meterBottom+5+5+4;
 m.font='700 16px Baloo';const closeX=24+m.measureText('Stage').width/2;
 m.font='700 18px Baloo';const numberWidth=m.measureText('0').width;
 m.font='700 14px Baloo';const xWidth=m.measureText('x').width;
 const comboWidth=28+4+xWidth+numberWidth,comboX=W-12-24-comboWidth/2-Math.round(W*.05);
 return {row,meterTop,meterBottom,cubeSide,meterUnit,floorY,dividerY:floorY+4,boardX,boardY,tile:128*scale,stride:148*scale,boardWidth,boardHeight:actualHeight,scale,closeX,scoreX:W-24-62-92-Math.round(W*.05),comboX};
}
function node(tag,attrs={},parent=svg){const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);parent.append(n);return n}
function image(parent,name,x,y,w,h,extra={}){return node('image',{href:`assets/${name}`,x,y,width:w,height:h,preserveAspectRatio:'none',...extra},parent)}
function isArchLayer(id){return ['navDivider','navDivider2','navDivider3'].includes(id);}
function archSettings(id='navDivider'){return id==='navDivider2'||id==='navDivider3'?state.layers[id]:state;}
// Native header dividerDrop uses depth49*.288 over full390pt width.
function applyNavigationArchMatches(layout){
 for(const id of ['navDivider','navDivider2','navDivider3']){const profile=id==='navDivider'?layout:layout.layers[id];if(profile.navigationArch)profile.archBend=100*Math.pow(profile.archWidth/100,2)*layout.layers[id].scale/100;}
}
function curveDrop(x,width,bend=state.archBend){const u=Math.max(0,Math.min(1,x/width));return 4*archDepth*bend/100*u*(1-u);}
function meterGeometry(){const width=W*state.meterWidth/100,side=width/(state.meterCount+(state.meterCount-1)*state.meterGap/100);return {width,side,pitch:side*(1+state.meterGap/100),left:(W-width)/2,floor:geo.floorY,depth:archDepth*state.meterArchBend/100};}
function meterCurve(x,g){
 const wave=state.meterSonicWave;
 if(wave){const u=(x-W/2)/wave.width+.5,a=2*Math.PI*wave.peakCount*u;return {drop:wave.height*(1-Math.cos(a))/2-wave.height,slope:wave.height*Math.PI*wave.peakCount*Math.sin(a)/wave.width};}
 const u=(x-g.left)/g.width;return {drop:4*g.depth*u*(1-u)-g.depth,slope:4*g.depth*(1-2*u)/g.width};
}
function meterCenterFloor(){const t=state.layers.meter;return {x:W/2+t.x,y:geo.floorY+t.y};}
function group(id,cx,cy,parent=svg){const t=state.layers[id],s=t.scale/100,width=['meter','divider','navDivider','navDivider2','navDivider3','sonicWave'].includes(id)?1:t.width/100;return node('g',{'data-layer':id,'data-anchor-x':cx,'data-anchor-y':cy,opacity:state.layers[id].opacity/100,display:state.layers[id].parked?'none':'inline',transform:`translate(${t.x} ${t.y}) translate(${cx} ${cy}) rotate(${t.rotation}) scale(${s*width} ${s}) translate(${-cx} ${-cy})`},parent)}
function text(parent,value,x,y,size,color='#be7c59'){const n=node('text',{x,y,'font-family':'Baloo','font-size':size,'font-weight':700,fill:color,'dominant-baseline':'central'},parent);n.textContent=value;return n}
const holes=new Set(['1:1','2:0','4:2','5:0','6:0','7:4','8:2']);
const values={'1:4':3,'3:0':1,'3:1':4,'4:0':2,'5:4':5,'8:0':2,'8:3':1};
const pipMaps={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
function render(){
 geo=computeGeometry();svg.replaceChildren();
 const defs=node('defs');const grad=node('linearGradient',{id:'paperGradient',x1:0,y1:0,x2:0,y2:1},defs);for(const[offset,color]of [[0,'#f3eee8'],[.6,'#fcecdf'],[1,'#fcecdf']])node('stop',{offset,'stop-color':color},grad);
 const lowerBevel=node('linearGradient',{id:'meter-lower-bevel',x1:0,y1:0,x2:0,y2:1},defs);
 for(const[offset,alpha]of [[0,0],[.65,0],[.88,.025],[1,.075]])node('stop',{offset,'stop-color':'#d7a179','stop-opacity':alpha},lowerBevel);
 node('rect',{width:W,height:H,fill:'url(#paperGradient)'});
 const ph=H+24,pw=ph*1815/2532;image(svg,'paper.png',(W-pw)/2,0,pw,ph);node('rect',{width:W,height:H,fill:'#f3eee8',opacity:.4});
 renderArchedDivider('navDivider',defs);renderArchedDivider('navDivider2',defs);renderArchedDivider('navDivider3',defs);renderArchedDivider('sonicWave',defs);
 const grid=group('grid',W/2,geo.boardY+geo.boardHeight/2);
 for(let row=0;row<9;row++)for(let col=0;col<5;col++){
 const key=`${row}:${col}`,x=geo.boardX+col*geo.stride,y=geo.boardY+row*geo.stride,v=values[key];
 if(holes.has(key)){image(grid,'ghost.png',x,y,geo.tile,geo.tile);continue}
 const body=node('g',{},grid);
 image(body,v?`body${(row*5+col)%4+1}.png`:'tile.png',x,y,geo.tile,geo.tile,{opacity:v?1:.25});
 if(v){for(const i of pipMaps[v]){const px=x+geo.tile/2+(i%3-1)*25.6*geo.scale,py=y+geo.tile/2+(Math.floor(i/3)-1)*25.6*geo.scale;node('rect',{x:px-7.5*geo.scale,y:py-7.5*geo.scale,width:15*geo.scale,height:15*geo.scale,rx:6*geo.scale,fill:'#815a42',opacity:.9},body)}}
 }
 const foot=group('footer',W/2,H+1);const footerHeight=W*168/850;image(foot,'footer.png',0,H+1-footerHeight,W,footerHeight);
 const divider=group('divider',W/2,geo.dividerY);const dw=W*state.dividerWidth/100;
 if(state.dividerStyle==='art')dividerArtwork(divider,(W-dw)/2,geo.dividerY,dw,state.dividerOpacity/100,state.dividerShadowOpacity/100);
 else if(state.dividerStyle==='line')node('rect',{x:(W-dw)/2,y:geo.dividerY,width:dw,height:state.lineHeight,rx:state.lineHeight/2,fill:'#bda58e',opacity:state.dividerOpacity/100},divider);
 // Invisible hit band makes the thin divider directly selectable and draggable.
 node('rect',{x:(W-dw)/2,y:geo.dividerY-3,width:dw,height:Math.max(12,state.dividerStyle==='art'?20:state.lineHeight+6),fill:'transparent'},divider);
 const mg=meterGeometry(),meter=group('meter',W/2,geo.floorY),meterWidth=mg.width,meterLeft=mg.left;
 if(state.meterPreviewDesign&&preloadReady){
 const profile=normalizeCubeDesign(state.meterPreviewDesign),key=JSON.stringify([profile,state.fill,mg,state.meterSonicWave,state.meterPreviewHeight,state.meterPreviewHeightPt,preloadPreviewTime()]);
 const preview=preloadSnapshot(profile,{width:mg.width,side:mg.side,tileHeight:state.meterPreviewHeightPt??mg.side*state.meterPreviewHeight/100,count:state.meterCount,pitch:mg.pitch,fill:state.fill/100,curveAt:x=>meterCurve(x+mg.left,mg),key,time:preloadPreviewTime(),tiltOffset:profile.randomFrontAngle?profile.randomAngleRange*(.65*Math.sin(preloadPreviewTime()*1.1)+.35*Math.sin(preloadPreviewTime()*.57+1)):0});
 node('image',{href:preview.url,x:mg.left-preview.pad,y:mg.floor-preview.base,width:preview.width,height:preview.height,preserveAspectRatio:'none','data-preload-preview':'true'},meter);
 }else if(state.meterStyle==='bar'){
 node('rect',{x:meterLeft,y:geo.meterTop,width:meterWidth,height:10,rx:5,fill:'#eadfd6'},meter);node('rect',{x:meterLeft,y:geo.meterTop,width:meterWidth*state.fill/100,height:10,rx:5,fill:'#e7744a'},meter);
 }else{
 const count=state.meterCount,{side,pitch}=mg;
 for(let i=0;i<count;i++){
 const amount=Math.max(0,Math.min(1,state.fill/100*count-i)),stops=[0,.3,.6,1];let index=0;while(index<3&&amount>stops[index+1])index++;
 const blend=index===3?0:(amount-stops[index])/(stops[index+1]-stops[index]),x=meterLeft+i*pitch,cx=x+side/2,curve=meterCurve(cx,mg),bottom=mg.floor+curve.drop,y=bottom-side,angle=Math.atan(curve.slope)*180/Math.PI;
 const cube=node('g',{'data-cube':i,transform:`rotate(${angle} ${cx} ${bottom})`},meter);
 function face(frame,opacity){const viewport=node('svg',{x,y,width:side,height:side,viewBox:frame===0?'0 0 128 128':`${frame*128} 0 128 128`,overflow:'hidden',opacity},cube);if(frame===0)image(viewport,'tile.png',0,0,128,128,{opacity:.25});else image(viewport,'meter.png',0,0,512,128)}
 face(index,1);if(blend>0)face(index+1,blend);
 node('rect',{x,y,width:side,height:side,rx:side*.24,fill:'url(#meter-lower-bevel)',opacity:1-amount,'pointer-events':'none'},cube);
 }
 }

 if(state.meterLayer==='below')svg.insertBefore(meter,svg.querySelector('[data-layer="navDivider"]'));
 if(state.meterLayer==='below'){
  const masks=['navDivider','navDivider2','navDivider3'].filter(id=>!state.layers[id].parked&&archSettings(id).archMasksPreloader);
  if(masks.length){
   const mask=node('mask',{id:'preloader-divider-mask',maskUnits:'userSpaceOnUse',maskContentUnits:'userSpaceOnUse',x:-W*4,y:-H*4,width:W*9,height:H*9},defs);
   node('rect',{x:-W*4,y:-H*4,width:W*9,height:H*9,fill:'white'},mask);
   for(const id of masks){const settings=archSettings(id),width=W*settings.archWidth/100,left=(W-width)/2,depth=archDepth*settings.archBend/100,divider=svg.querySelector(`[data-layer="${id}"]`),plane=node('g',{transform:divider.getAttribute('transform')},mask);
    node('path',{d:`M ${left} ${-H*4} H ${left+width} V ${navHeight} Q ${W/2} ${navHeight+2*depth} ${left} ${navHeight} Z`,fill:'black'},plane);
   }
   const masked=node('g',{mask:'url(#preloader-divider-mask)'});svg.insertBefore(masked,meter);masked.append(meter);
  }
 }


 const hud=group('hud',W/2,geo.row),close=group('close',geo.closeX,geo.row,hud);
 node('rect',{x:geo.closeX-22,y:geo.row-22,width:44,height:44,rx:44*16/52,fill:'none',stroke:'#e8d4c7','stroke-width':2,'stroke-dasharray':'6 6'},close);image(close,'close.png',geo.closeX-12,geo.row-12,24,24,{opacity:.8});
 const bag=group('backpack',118,geo.row,hud);image(bag,'backpack.png',101,geo.row-17,34,34);
 const score=group('score',geo.scoreX,geo.row,hud);image(score,'trophy.png',geo.scoreX-14,geo.row-14,28,28);text(score,'3.064',geo.scoreX+20,geo.row,18);
 const combo=group('combo',geo.comboX,geo.row,hud);image(combo,'combo.png',geo.comboX-14,geo.row-14,28,28);text(combo,'x',geo.comboX+18,geo.row,14,'#e77449');m.font='700 14px Baloo';text(combo,'0',geo.comboX+18+m.measureText('x').width,geo.row,18,'#e77449');
 const navX=44,navY=navRow+archDrop(navX)-archDepth;
 const archedClose=group('navClose',navX,navY);image(archedClose,'close.png',navX-12,navY-12,24,24);
 const bagX=346,bagY=navRow+archDrop(bagX)-archDepth;
 const archedBag=group('navBackpack',bagX,bagY);image(archedBag,'backpack.png',bagX-20,bagY-20,40,40);
 if($('guides').checked){const guides=node('g',{'data-guides':'true','pointer-events':'none',stroke:'#d06649','stroke-width':.5,'stroke-dasharray':'3 3',opacity:.7});for(const y of [geo.row,geo.floorY,geo.dividerY,geo.boardY])node('line',{x1:0,y1:y,x2:W,y2:y},guides);for(const x of [24,118,W/2,W-24])node('line',{x1:x,y1:0,x2:x,y2:H},guides)}
 renderItems();renderLayerPicker();renderSavedVersions();updateExport();save();
}
function dividerArtwork(parent,x,y,width,opacity,shadow){
 const group=node('g',{opacity},parent),edge=2;
 // The original sharp top band stays unchanged;only the lower fade is adjustable.
 for(const[top,height,alpha]of [[0,edge,1],[edge,49-edge,shadow]]){
  if(alpha<=0)continue;
  const crop=node('svg',{x,y:y+top,width,height,viewBox:`0 ${top} ${width} ${height}`,overflow:'hidden',opacity:alpha},group);
  image(crop,'divider.png',0,0,width,49);
 }
}
function renderArchedDivider(id,defs){
 const sonic=id==='sonicWave',settings=sonic?state.layers.sonicWave:archSettings(id),curved=group(id,W/2,navHeight),width=sonic?settings.peakCount*settings.peakWidth:W*settings.archWidth/100,left=(W-width)/2,depth=sonic?settings.waveHeight:archDepth*settings.archBend/100,clipID=`${id}-background-arch`;
 if(!sonic){
 const backgroundClip=node('clipPath',{id:clipID,clipPathUnits:'userSpaceOnUse'},defs);
 node('path',{d:`M ${left} 0 H ${left+width} V ${navHeight} Q ${W/2} ${navHeight+2*depth} ${left} ${navHeight} Z`},backgroundClip);
 const background=node('g',{'clip-path':`url(#${clipID})`,opacity:settings.navBackgroundOpacity/100,'pointer-events':'none'},curved);
 image(background,navigationBackgroundAsset(settings),left,0,width,navHeight+depth);
 }
 const slices=sonic?settings.peakCount*48:32,drop=x=>sonic?depth*(1-Math.cos(2*Math.PI*settings.peakCount*x/width))/2:curveDrop(x,width,settings.archBend);
 for(let i=0;i<slices;i++){
  const x0=width*i/slices,x1=width*(i+1)/slices,y0=drop(x0),y1=drop(x1),slope=(y1-y0)/(x1-x0);
  const clip=node('svg',{x:left+x0,y:navHeight,width:x1-x0,height:49+depth,viewBox:`${x0} 0 ${x1-x0} ${49+depth}`,overflow:'hidden',opacity:settings.archOpacity/100},curved);
  const strip=node('g',{transform:`matrix(1 ${slope} 0 1 0 ${y0-slope*x0})`},clip);dividerArtwork(strip,sonic?0:width*.1,0,sonic?width:width*.8,1,settings.archShadowOpacity/100);
 }
 node('rect',{x:left,y:navHeight,width,height:22+depth,fill:'transparent'},curved);
}
function navigationBackgroundAsset(settings=state){return ({original:'nav-bg.png',worn:'nav-bg-worn-v1.png','worn-white':'nav-bg-worn-white-v2.png',wood:'nav-bg-bleached-wood-v1.png','wood-split':'nav-bg-worn-solid-wood-v3.png'})[settings.navBackgroundStyle]??'nav-bg.png';}
function save(){try{localStorage.setItem('sts-native-board-design-v1',JSON.stringify(state))}catch{}}
function design(){return {schema:'stack-to-six-native-board-layout/v1',viewport:state.viewport,baseline:{hudY:geo.row,meterTop:geo.meterTop,cubeFloor:geo.floorY,dividerTop:geo.dividerY,gridX:geo.boardX,gridY:geo.boardY,tileSize:geo.tile,stride:geo.stride},changes:structuredClone(state),nativeMapping:{sonicWave:{peakCount:state.layers.sonicWave.peakCount,peakWidth:state.layers.sonicWave.peakWidth,height:state.layers.sonicWave.waveHeight,totalWidth:state.layers.sonicWave.peakCount*state.layers.sonicWave.peakWidth},archedDividers:Object.fromEntries(['navDivider','navDivider2','navDivider3'].map(id=>{const a=archSettings(id);return [id,{widthFactor:a.archWidth/100,alpha:a.archOpacity/100,shadowAlpha:a.archShadowOpacity/100,depth:archDepth*a.archBend/100,backgroundAlpha:a.navBackgroundOpacity/100,backgroundAsset:navigationBackgroundAsset(a)}]})),items:Object.fromEntries(Object.entries(state.layers).map(([id,p])=>[id,{...p,nativeOffsetY:-p.y}])),meterCount:state.meterCount,meterWidthFactor:meterGeometry().width/W,meterGapFraction:state.meterGap/100,meterSonicWave:structuredClone(state.meterSonicWave),meterArchDepth:archDepth*state.meterArchBend/100,meterTransformLayer:'meter',meterDividerLayer:state.meterLayer,archedDividerDepth:archDepth*state.archBend/100,archedDividerWidthFactor:state.archWidth/100,archedDividerAlpha:state.archOpacity/100,navigationBackgroundAlpha:state.navBackgroundOpacity/100,navigationBackgroundAsset:navigationBackgroundAsset(),htmlDownIsNativeNegativeY:true,dividerWidthFactor:state.dividerWidth/100,dividerAlpha:state.dividerOpacity/100,dividerShadowAlpha:state.dividerShadowOpacity/100,dividerCenterX:W/2+state.layers.divider.x,dividerY:geo.dividerY+state.layers.divider.y,cubeFloorY:meterCenterFloor().y,meterCenterFloor:meterCenterFloor(),boardOriginHTML:{x:geo.boardX+state.layers.grid.x,y:geo.boardY+state.layers.grid.y}},sourceManifest:'native-source-manifest.json'}}
function updateExport(){const d=design();$('facts').textContent=`HUD center: ${geo.row.toFixed(1)} pt\nKockice · donji rub: ${meterCenterFloor().y.toFixed(1)} pt · sredina reda\nDivider · gornji rub: ${(geo.dividerY+state.layers.divider.y).toFixed(1)} pt\nPrvi red ploče: ${(geo.boardY+state.layers.grid.y).toFixed(1)} pt\nVeličina kocke / stride: ${geo.tile.toFixed(2)} / ${geo.stride.toFixed(2)} pt`;$('nativeValues').textContent=JSON.stringify(d.nativeMapping,null,2)}
function widthValue(){return selected==='sonicWave'?state.layers.sonicWave.peakCount*state.layers.sonicWave.peakWidth/W*100:selected==='divider'?state.dividerWidth:isArchLayer(selected)?archSettings(selected).archWidth:selected==='meter'?state.meterWidth:state.layers[selected].width;}
function opacityValue(){return selected==='sonicWave'?state.layers.sonicWave.archOpacity:selected==='divider'?state.dividerOpacity:isArchLayer(selected)?archSettings(selected).archOpacity:state.layers[selected].opacity;}
function sync(){const l=state.layers[selected],arch=archSettings(selected);$('layer').value=selected;$('dx').value=Number(l.x.toFixed(4));$('dy').value=Number(l.y.toFixed(4));$('size').value=l.scale;$('sizeValue').textContent=l.scale+'%';
 $('dividerWidth').max=Math.max(150,Math.ceil(widthValue()));$('dividerWidth').value=widthValue();$('dividerWidthValue').textContent=Number(widthValue().toFixed(1))+'%';$('dividerOpacity').value=opacityValue();$('dividerOpacityValue').textContent=opacityValue()+'%';
 $('sonicControls').hidden=selected!=='sonicWave';for(const key of ['peakCount','peakWidth','waveHeight']){$(key).value=state.layers.sonicWave[key];$(key+'Value').textContent=Number(state.layers.sonicWave[key].toFixed(1))+(key==='peakCount'?'':' pt');}
 $('dividerShadowControls').hidden=selected!=='sonicWave'&&selected!=='divider'&&!isArchLayer(selected);const shadow=selected==='sonicWave'?l.archShadowOpacity:isArchLayer(selected)?arch.archShadowOpacity:state.dividerShadowOpacity;$('dividerShadow').value=shadow;$('dividerShadowValue').textContent=shadow+'%';
 $('widthLabel').textContent=['divider','navDivider','navDivider2','navDivider3','sonicWave','meter'].includes(selected)?'Širina · % ekrana':'Širina · % izvornika';
 $('rotation').min=Math.min(-45,Math.floor(l.rotation));$('rotation').max=Math.max(45,Math.ceil(l.rotation));$('rotation').value=l.rotation;$('iconArchControls').hidden=!['close','backpack','score','combo','navClose','navBackpack'].includes(selected);$('rotationValue').textContent=Number(l.rotation.toFixed(1))+'°';
 for(const k of ['lineHeight','dividerStyle','meterStyle','fill','meterCount','meterGap'])$(k).value=state[k];
 for(const mode of ['above','below'])$('meterLayer'+mode).setAttribute('aria-pressed',String(state.meterLayer===mode));
 $('fillValue').textContent=state.fill+'%';$('meterCountValue').textContent=state.meterCount;$('meterGapValue').textContent=state.meterGap+'%';
 $('meterArchBend').max=Math.max(600,Math.ceil(state.meterArchBend));$('meterArchBend').value=state.meterArchBend;$('meterArchBendValue').textContent=Number(state.meterArchBend.toFixed(1))+'%';$('navBackgroundStyle').value=arch.navBackgroundStyle;$('navBackgroundOpacity').value=arch.navBackgroundOpacity;$('navBackgroundOpacityValue').textContent=arch.navBackgroundOpacity+'%';$('archBend').max=Math.max(300,Math.ceil(arch.archBend));$('archBend').value=arch.archBend;$('archBendValue').textContent=Number(arch.archBend.toFixed(1))+'%';$('archControls').hidden=!isArchLayer(selected);$('archSyncControls').hidden=!isArchLayer(selected);$('syncDividerArchOnly').textContent=selected==='navDivider'?'↻ Sync samo arch sa dividerom 2':'↻ Sync samo arch sa dividerom 1';$('syncDividers').textContent=selected==='navDivider'?'↻ Sync sa dividerom 2':'↻ Sync sa dividerom 1';
 $('dividerControls').hidden=selected!=='divider';$('meterControls').hidden=selected!=='meter';$('meterSizingControls').hidden=selected!=='meter';
 $('preloaderChoice').value=state.meterPreviewChoice??'legacy';
 if($('dividerMaskControls')){$('dividerMaskControls').hidden=!isArchLayer(selected);$('dividerMask').checked=!!archSettings(selected).archMasksPreloader;$('navigationArch').checked=!!archSettings(selected).navigationArch;}
 buildInspectorSections.update?.();
 syncPreloadEditing();
 if(geo)renderLayerPicker();
 $('centerHorizontal').disabled=state.layers[selected].parked;
 $('parkItem').textContent=state.layers[selected].parked?'↩ Vrati na board':'↓ Odloži u item area';
}
function focusSelectedElement(){svg.focus({preventScroll:true});}
$('layer').onchange=e=>{finishDrag();selected=e.target.value;sync();focusSelectedElement()};
for(const id of ['dx','dy','size'])$(id).oninput=e=>{state.layers[selected][{dx:'x',dy:'y',size:'scale'}[id]]=Number(e.target.value);commit();sync();render()};
$('dividerWidth').oninput=e=>{const v=Number(e.target.value);if(selected==='sonicWave')state.layers.sonicWave.peakWidth=W*v/100/state.layers.sonicWave.peakCount;else if(selected==='divider')state.dividerWidth=v;else if(isArchLayer(selected))archSettings(selected).archWidth=v;else if(selected==='meter'){state.meterArchBend*=Math.pow(v/state.meterWidth,2);state.meterWidth=v;}else state.layers[selected].width=v;commit();sync();render()};
$('dividerOpacity').oninput=e=>{const v=Number(e.target.value);if(selected==='sonicWave')state.layers.sonicWave.archOpacity=v;else if(selected==='divider')state.dividerOpacity=v;else if(isArchLayer(selected))archSettings(selected).archOpacity=v;else state.layers[selected].opacity=v;commit();sync();render()};
$('rotation').oninput=e=>{state.layers[selected].rotation=Number(e.target.value);commit();sync();render()};
for(const id of ['lineHeight','fill','dividerStyle','meterStyle','meterCount','meterGap'])$(id).oninput=e=>{state[id]=['dividerStyle','meterStyle'].includes(id)?e.target.value:Number(e.target.value);if(id==='meterStyle'){state.meterPreviewChoice='legacy';state.meterPreviewDesign=null;}commit();sync();render()};$('guides').onchange=render;
for(const mode of ['above','below'])$('meterLayer'+mode).onclick=()=>{finishDrag();state.meterLayer=mode;commit();sync();render();focusSelectedElement()};
$('meterArchBend').oninput=e=>{state.meterSonicWave=null;state.meterArchBend=Number(e.target.value);commit();sync();render()};
$('syncMeterArch').onclick=()=>{
 finishDrag();const meter=state.layers.meter,divider=state.layers.navDivider;
 // Match curvature over the row's own rendered span,without copying its pose.
 state.meterSonicWave=null;state.meterArchBend=state.archBend*Math.pow(state.meterWidth/state.archWidth,2)*meter.scale/divider.scale;
 state.meterStyle='cubes';commit();sync();render();$('status').textContent='Arch dividera kopiran. Kockice ostaju neovisne.';
};
$('syncMeterSonic').onclick=()=>{
 finishDrag();const wave=state.layers.sonicWave,ratio=wave.scale/state.layers.meter.scale;
 state.meterSonicWave={peakCount:wave.peakCount,width:wave.peakCount*wave.peakWidth*ratio,height:wave.waveHeight*ratio};
 state.meterStyle='cubes';commit();sync();render();focusSelectedElement();$('status').textContent='Sonic Wave kopiran na kockice. Položaj i širina ostaju neovisni.';
};
function matrixToBoard(element){
 let matrix=new DOMMatrix();for(let current=element;current&&current!==svg;current=current.parentNode){const local=current.transform?.baseVal?.consolidate()?.matrix;if(local)matrix=new DOMMatrix([local.a,local.b,local.c,local.d,local.e,local.f]).multiply(matrix)}return matrix;
}
$('centerHorizontal').onclick=()=>{
 finishDrag();if(state.layers[selected].parked)return;
 const element=svg.querySelector(`[data-layer="${selected}"]`);if(!element)return;
 const corners=[];
 function addBox(box,matrix){for(const[x,y]of [[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height],[box.x+box.width,box.y+box.height]])corners.push(new DOMPoint(x,y).matrixTransform(matrix));}
 if(selected==='meter'&&state.meterStyle==='cubes'&&!state.meterPreviewDesign){
  // getBBox includes the full four-frame image beyond each SVG crop. Measure
  // each visible viewport in its cube parent,including its tangent rotation.
  for(const cube of element.querySelectorAll('[data-cube]')){const face=cube.querySelector('svg');if(face)addBox({x:face.x.baseVal.value,y:face.y.baseVal.value,width:face.width.baseVal.value,height:face.height.baseVal.value},matrixToBoard(cube));}
 }else addBox((isArchLayer(selected)||selected==='sonicWave')?{...boundsFor(selected),width:boundsFor(selected).w,height:boundsFor(selected).h}:element.getBBox(),matrixToBoard(element));
 if(!corners.length)return;
 const dx=W/2-(Math.min(...corners.map(p=>p.x))+Math.max(...corners.map(p=>p.x)))/2;
 if(Math.abs(dx)<0.0001){$('status').textContent='Element je već centriran vodoravno.';return;}
 // Translate only in board-space X,even inside a rotated/scaled HUD parent.
 const inverse=matrixToBoard(element.parentNode).inverse();state.layers[selected].x+=inverse.a*dx;state.layers[selected].y+=inverse.b*dx;
 commit();sync();render();$('status').textContent='Element je centriran vodoravno; visina je zadržana.';
};
$('syncIconArch').onclick=()=>{
 finishDrag();const element=svg.querySelector(`[data-layer="${selected}"]`),divider=svg.querySelector('[data-layer="navDivider"]');if(!element||!divider)return;
 const anchor=new DOMPoint(Number(element.dataset.anchorX),Number(element.dataset.anchorY)).matrixTransform(matrixToBoard(element));
 const dividerMatrix=matrixToBoard(divider),local=anchor.matrixTransform(dividerMatrix.inverse()),width=W*state.archWidth/100,u=Math.max(0,Math.min(1,(local.x-(W-width)/2)/width));
 const slope=4*archDepth*state.archBend/100*(1-2*u)/width;
 // Map the exact divider tangent through its pose,then undo the HUD parent.
 const vx=dividerMatrix.a+dividerMatrix.c*slope,vy=dividerMatrix.b+dividerMatrix.d*slope,parentInverse=matrixToBoard(element.parentNode).inverse();
 const dx=parentInverse.a*vx+parentInverse.c*vy,dy=parentInverse.b*vx+parentInverse.d*vy;
 state.layers[selected].rotation=Math.atan2(dy,dx)*180/Math.PI;
 commit();sync();render();$('status').textContent='Nagib kopiran s archa na poziciji elementa. Položaj ostaje isti.';
};
$('syncDividerArchOnly').onclick=()=>{
 finishDrag();if(!isArchLayer(selected))return;
 const sourceID=selected==='navDivider'?'navDivider2':'navDivider',from=archSettings(sourceID),to=archSettings(selected);
 // Equal painted curvature: depth / (width² * scale), preserving each divider's pose.
 to.navigationArch=false;to.archBend=from.archBend*Math.pow(to.archWidth/from.archWidth,2)*state.layers[selected].scale/state.layers[sourceID].scale;
 commit();sync();render();focusSelectedElement();$('status').textContent='Preuzeta samo zakrivljenost. Širina, položaj i stil ostaju isti.';
};
$('syncDividers').onclick=()=>{
 finishDrag();if(!isArchLayer(selected))return;
 const sourceID=selected==='navDivider'?'navDivider2':'navDivider',source=state.layers[sourceID],destination=state.layers[selected],from=archSettings(sourceID),to=archSettings(selected);
 to.navigationArch=false;for(const key of ['x','y','scale','rotation','opacity'])destination[key]=source[key];
 for(const key of ['archWidth','archBend','archOpacity','archShadowOpacity'])to[key]=from[key];
 commit();sync();render();$('status').textContent=`Preuzet arch, položaj, širina i jačina sjene dividera ${sourceID==='navDivider'?'1':'2'}.`;
};
function setDividerShadow(value){finishDrag();if(selected==='sonicWave')state.layers.sonicWave.archShadowOpacity=value;else if(isArchLayer(selected))archSettings(selected).archShadowOpacity=value;else if(selected==='divider')state.dividerShadowOpacity=value;else return;commit();sync();render();}
$('dividerShadow').oninput=e=>setDividerShadow(Number(e.target.value));
$('dividerNoShadow').onclick=()=>{setDividerShadow(0);focusSelectedElement()};
$('navBackgroundStyle').onchange=e=>{archSettings(selected).navBackgroundStyle=e.target.value;commit();sync();render()};
$('navBackgroundOpacity').oninput=e=>{archSettings(selected).navBackgroundOpacity=Number(e.target.value);commit();sync();render()};
$('archBend').oninput=e=>{archSettings(selected).navigationArch=false;archSettings(selected).archBend=Number(e.target.value);commit();sync();render()};
$('parkItem').onclick=()=>{finishDrag();if(state.layers[selected].parked)restoreItem(selected);else parkItem(selected);commit();sync();render()};

function point(e){return new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse())}
svg.tabIndex=0;
svg.addEventListener('pointerdown',e=>{
 if(e.button!==0)return;
 const current=svg.querySelector(`[data-layer="${selected}"]`),el=current&&!state.layers[selected].parked&&current.contains(e.target)?current:e.target.closest('[data-layer]');if(!el)return;
 selected=el.dataset.layer;const p=point(e);drag={id:e.pointerId,source:'board',layer:selected,start:p,parentInverse:matrixToBoard(el.parentNode).inverse(),axis:null,base:{...state.layers[selected]},clientX:e.clientX,clientY:e.clientY,moved:false};sync();focusSelectedElement();e.preventDefault();
});
window.addEventListener('pointermove',moveItemDrag);window.addEventListener('pointerup',finishItemDrag);window.addEventListener('pointercancel',cancelItemDrag);window.addEventListener('blur',cancelItemDrag);
svg.addEventListener('keydown',e=>{if(e.metaKey||e.ctrlKey||e.altKey||state.layers[selected].parked||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const delta=(e.shiftKey?4:1)*(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1),horizontal=e.key==='ArrowLeft'||e.key==='ArrowRight',element=svg.querySelector(`[data-layer="${selected}"]`),inverse=element?matrixToBoard(element.parentNode).inverse():new DOMMatrix(),dx=horizontal?delta:0,dy=horizontal?0:delta;state.layers[selected].x+=inverse.a*dx+inverse.c*dy;state.layers[selected].y+=inverse.b*dx+inverse.d*dy;commit();sync();render()});
$('reset').onclick=()=>{finishDrag();state=structuredClone(defaults);commit();sync();render();$('status').textContent='Vraćen izvorni Native raspored.'};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(design(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='six-lab-board-design.json';a.click();URL.revokeObjectURL(url);$('status').textContent='Spremljene konkretne Native vrijednosti.'};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(design(),null,2));$('status').textContent='Vrijednosti kopirane.'}catch{$('status').textContent='Koristi Spremi dizajn · JSON.'}};
for(const key of ['peakCount','peakWidth','waveHeight'])$(key).oninput=e=>{state.layers.sonicWave[key]=Number(e.target.value);commit();sync();render();};
function boundsFor(id){
 if(id==='sonicWave'){const a=state.layers.sonicWave,w=a.peakCount*a.peakWidth;return{x:(W-w)/2,y:navHeight,w,h:49+a.waveHeight};}
 if(id==='hud')return {x:24,y:geo.row-24,w:342,h:48};
 if(id==='close')return {x:geo.closeX-24,y:geo.row-24,w:48,h:48};
 if(id==='backpack')return {x:99,y:geo.row-19,w:38,h:38};
 if(id==='score')return {x:geo.scoreX-16,y:geo.row-20,w:95,h:40};
 if(id==='combo')return {x:geo.comboX-16,y:geo.row-20,w:70,h:40};
 if(id==='meter'&&state.meterPreviewDesign){const image=svg.querySelector('[data-preload-preview]');if(image)return{x:+image.getAttribute('x'),y:+image.getAttribute('y'),w:+image.getAttribute('width'),h:+image.getAttribute('height')};}
 if(id==='meter'){const g=meterGeometry();if(state.meterSonicWave)g.depth=state.meterSonicWave.height;return {x:g.left,y:g.floor-g.side-Math.max(0,g.depth),w:g.width,h:Math.max(16,g.side)+Math.abs(g.depth)}}
 if(id==='divider'){const w=W*state.dividerWidth/100;return{x:(W-w)/2,y:geo.dividerY,w,h:49}}
 if(id==='grid')return{x:geo.boardX,y:geo.boardY,w:geo.boardWidth,h:geo.boardHeight};
 if(id==='footer')return{x:0,y:H+1-W*168/850,w:W,h:W*168/850};
 if(isArchLayer(id)){const a=archSettings(id),w=W*a.archWidth/100,top=a.navBackgroundOpacity>0?0:navHeight;return{x:(W-w)/2,y:top,w,h:navHeight-top+49+archDepth*a.archBend/100}}
 const x=id==='navClose'?44:346,y=navRow+archDrop(x)-archDepth,side=id==='navClose'?34:48;return{x:x-side/2,y:y-side/2,w:side,h:side};
}
function thumbnail(id){const b=boundsFor(id),preview=document.createElementNS(NS,'svg');preview.setAttribute('viewBox',`${b.x-4} ${b.y-4} ${b.w+8} ${b.h+8}`);preview.setAttribute('aria-hidden','true');
 const original=svg.querySelector(`[data-layer="${id}"]`);if(original){const clone=original.cloneNode(true);clone.removeAttribute('display');clone.removeAttribute('transform');clone.removeAttribute('opacity');if(state.layers[id].rotation)clone.setAttribute('transform',`rotate(${state.layers[id].rotation} ${b.x+b.w/2} ${b.y+b.h/2})`);clone.removeAttribute('data-layer');preview.append(clone)}return preview;
}
function renderLayerPicker(){
 const host=$('layerPicker'),open=host.querySelector('details')?.open??false;
 host.replaceChildren();const title=document.createElement('p');title.className='layer-picker-title';title.textContent='Odabrani sloj';host.append(title);
 const details=document.createElement('details');details.open=open;const summary=document.createElement('summary');
 summary.append(thumbnail(selected));const name=document.createElement('span');name.className='layer-picker-name';name.textContent=LABELS[selected];
 const hint=document.createElement('small');hint.textContent=state.layers[selected].parked?'U item area':'Na boardu';name.append(hint);summary.append(name);const arrow=document.createElement('span');arrow.className='layer-picker-arrow';arrow.textContent='⌄';summary.append(arrow);details.append(summary);
 const choices=document.createElement('div');choices.className='layer-choices';choices.setAttribute('aria-label','Vizualni odabir sloja');
 for(const id of Object.keys(LABELS)){
  const button=document.createElement('button');button.type='button';button.className='layer-choice'+(id===selected?' active':'');button.setAttribute('aria-pressed',String(id===selected));button.setAttribute('aria-label',LABELS[id]);button.title=LABELS[id];button.append(thumbnail(id));
  const label=document.createElement('span');label.textContent=LABELS[id];button.append(label);
  if(state.layers[id].parked){const badge=document.createElement('small');badge.textContent='Odloženo';button.append(badge)}
  button.onclick=()=>{finishDrag();selected=id;details.open=false;sync();focusSelectedElement();};choices.append(button);
 }
 details.append(choices);host.append(details);
}
function renderItems(){
 const area=$('itemArea');area.replaceChildren();for(let slot=0;slot<16;slot++){
 const entry=Object.entries(state.layers).find(([,p])=>p.parked&&p.slot===slot),button=document.createElement('button');button.type='button';button.className='item-slot'+(entry?' occupied':'')+(entry?.[0]===selected?' selected':'');button.dataset.slot=slot;
 if(entry){const[id]=entry;button.dataset.item=id;button.append(thumbnail(id));const label=document.createElement('span');label.textContent=LABELS[id];button.append(label);button.title=`${LABELS[id]} · povuci na board ili dvoklik za povratak`;
 button.addEventListener('pointerdown',e=>{if(e.button!==0)return;selected=id;drag={id:e.pointerId,source:'inventory',layer:id,base:{...state.layers[id]},clientX:e.clientX,clientY:e.clientY,moved:false};sync();focusSelectedElement();e.preventDefault()});
 button.ondblclick=()=>{cancelItemDrag();selected=id;restoreItem(id);commit();sync();render();focusSelectedElement()};button.onkeydown=e=>{if(e.key==='Enter'){selected=id;restoreItem(id);commit();sync();render();focusSelectedElement()}};
 }else{button.innerHTML='<span class="empty-slot">+</span>';button.title='Povuci element ovdje'}
 area.append(button);
 }
}
function freeSlot(){for(let n=0;n<16;n++)if(!Object.values(state.layers).some(p=>p.parked&&p.slot===n))return n;return null;}
function parkItem(id,slot=freeSlot()){
 if(slot===null)return;const old=state.layers[id].slot,other=Object.entries(state.layers).find(([key,p])=>key!==id&&p.parked&&p.slot===slot);
 if(other)other[1].slot=old??freeSlot();state.layers[id].parked=true;state.layers[id].slot=slot;
}
function restoreItem(id){state.layers[id].parked=false;state.layers[id].slot=null;}
let proxy=null;
function showProxy(e){if(!proxy){proxy=document.createElement('div');proxy.className='item-drag-proxy';proxy.append(thumbnail(drag.layer));document.body.append(proxy)}proxy.style.left=`${e.clientX+14}px`;proxy.style.top=`${e.clientY+14}px`;}
function removeProxy(){proxy?.remove();proxy=null;$('itemArea').classList.remove('drop-ready');document.querySelectorAll('.item-slot.drop-hover').forEach(e=>e.classList.remove('drop-hover'));}
function moveItemDrag(e){if(!drag||e.pointerId!==drag.id)return;drag.moved ||= Math.hypot(e.clientX-drag.clientX,e.clientY-drag.clientY)>4;if(!drag.moved)return;
 const rect=svg.getBoundingClientRect(),inside=e.clientX>=rect.left&&e.clientX<=rect.right&&e.clientY>=rect.top&&e.clientY<=rect.bottom;
 if(drag.source==='board'&&inside){const p=point(e);let dx=p.x-drag.start.x,dy=p.y-drag.start.y;
  if(e.shiftKey){drag.axis??=Math.abs(dx)>=Math.abs(dy)?'x':'y';if(drag.axis==='x')dy=0;else dx=0;}else drag.axis=null;
  const inverse=drag.parentInverse;state.layers[drag.layer].x=drag.base.x+inverse.a*dx+inverse.c*dy;state.layers[drag.layer].y=drag.base.y+inverse.b*dx+inverse.d*dy;removeProxy();sync();render()}
 else{showProxy(e);const over=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-slot]');document.querySelectorAll('.item-slot.drop-hover').forEach(el=>el.classList.remove('drop-hover'));over?.classList.add('drop-hover');$('itemArea').classList.toggle('drop-ready',Boolean(over));}
}
function finishItemDrag(e){if(!drag)return;if(e?.pointerId!==undefined&&e.pointerId!==drag.id)return;const d=drag;drag=null;removeProxy();
 if(!e||!d.moved){if(d.source==='board')commit();return}
 const slot=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-slot]'),rect=svg.getBoundingClientRect(),inside=e.clientX>=rect.left&&e.clientX<=rect.right&&e.clientY>=rect.top&&e.clientY<=rect.bottom;
 if(slot){state.layers[d.layer]={...d.base};parkItem(d.layer,Number(slot.dataset.slot));$('status').textContent='Predmet je spremljen u slot.';}
 else if(inside&&d.source==='inventory'){
 const p=point(e),b=boundsFor(d.layer),cx=b.x+b.w/2,cy=b.y+b.h/2,snap=Math.hypot(p.x-(cx+d.base.x),p.y-(cy+d.base.y))<18;restoreItem(d.layer);state.layers[d.layer].x=snap?d.base.x:Math.round((p.x-cx)*10)/10;state.layers[d.layer].y=snap?d.base.y:Math.round((p.y-cy)*10)/10;$('status').textContent=snap?'Predmet je poravnat na zadnje mjesto.':'Predmet je vraćen na board.';
 }else if(!inside)state.layers[d.layer]={...d.base};
 selected=d.layer;commit();sync();render();focusSelectedElement();
}
function cancelItemDrag(){if(!drag)return;const d=drag;drag=null;state.layers[d.layer]={...d.base};removeProxy();sync();render();}

const versionsKey='sts-native-board-saved-versions-v1';let savedVersions=[],savedListRendered=false;
function validVersion(v){return v&&typeof v.id==='string'&&typeof v.name==='string'&&v.design?.version===1&&v.design.layers&&typeof v.preview==='string'&&typeof v.createdAt==='string';}
function versionStore(mode,values){return new Promise((resolve,reject)=>{
 const request=indexedDB.open('sts-native-board-editor',1);let abandoned=false;
 request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('versions'))request.result.createObjectStore('versions',{keyPath:'id'});};
 request.onerror=()=>reject(request.error);request.onblocked=()=>{abandoned=true;reject(new Error('Spremište je zauzeto u drugom prozoru.'))};
 request.onsuccess=()=>{const db=request.result;if(abandoned){db.close();return}db.onversionchange=()=>db.close();let result;
  try{const transaction=db.transaction('versions',mode),store=transaction.objectStore('versions');
   transaction.oncomplete=()=>{db.close();resolve(result)};transaction.onabort=()=>{db.close();reject(transaction.error??new Error('Spremanje je prekinuto.'))};transaction.onerror=()=>{};
   if(mode==='readwrite'){for(const value of values)store.put(value)}else{const read=store.getAll();read.onsuccess=()=>{result=read.result}}
  }catch(error){db.close();reject(error)}
 };
});}
async function loadSavedVersions(){
 let legacy=[];try{const stored=JSON.parse(localStorage.getItem(versionsKey));if(Array.isArray(stored))legacy=stored.filter(validVersion)}catch{}
 let available=legacy;try{const stored=(await versionStore('readonly')).filter(validVersion),ids=new Set(stored.map(v=>v.id)),missing=legacy.filter(v=>!ids.has(v.id));
  available=[...stored,...missing];if(missing.length)await versionStore('readwrite',missing);
  savedVersions=available.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 }catch{savedVersions=available;$('versionStatus').textContent='Spremište nije dostupno; prethodne verzije ostaju sačuvane.';}
 savedListRendered=false;if(geo)renderSavedVersions();
}
const savedVersionsReady=loadSavedVersions();
function versionPreview(markup,key){
 const parsed=new DOMParser().parseFromString(markup,'image/svg+xml'),tags=new Set(['svg','g','defs','path','rect','line','linearGradient','stop','image','text','clipPath','mask']);
 const attrs=new Set(['id','viewBox','xmlns','width','height','x','y','x1','y1','x2','y2','d','rx','fill','opacity','stroke','stroke-width','stroke-dasharray','stop-color','stop-opacity','offset','mask','maskUnits','maskContentUnits','clipPathUnits','clip-path','transform','overflow','preserveAspectRatio','font-family','font-size','font-weight','dominant-baseline','href']);
 const prefix='saved-'+key.replace(/[^a-zA-Z0-9_-]/g,'')+'-';
 function copy(source){if(!tags.has(source.localName))return null;const target=document.createElementNS(NS,source.localName);
  for(const a of source.attributes){if(!attrs.has(a.name))continue;let value=a.value;if(a.name==='href'&&!/^assets\/[a-zA-Z0-9._-]+$/.test(value)&&!(value.length<3000000&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value)))continue;if(a.name==='id')value=prefix+value;value=value.replace(/url\(#([^)]+)\)/g,(_,id)=>`url(#${prefix}${id})`);target.setAttribute(a.name,value)}
  for(const child of source.childNodes){if(child.nodeType===3)target.append(document.createTextNode(child.textContent));else if(child.nodeType===1){const item=copy(child);if(item)target.append(item)}}return target;
 }
 const preview=copy(parsed.documentElement);if(preview){preview.setAttribute('aria-hidden','true');preview.removeAttribute('width');preview.removeAttribute('height')}return preview;
}
function renderSavedVersions(){
 const host=$('savedVersions');if(!savedListRendered){host.replaceChildren();
  if(!savedVersions.length){const empty=document.createElement('p');empty.className='saved-empty';empty.textContent='Spremi prvi raspored koji ti se sviđa.';host.append(empty)}
  for(const version of savedVersions){const card=document.createElement('button');card.type='button';card.className='saved-card';card.dataset.version=version.id;card.title='Učitaj: '+version.name;card.setAttribute('aria-label','Učitaj '+version.name);
   const frame=document.createElement('div');frame.className='saved-preview';const preview=versionPreview(version.preview,version.id);if(preview)frame.append(preview);card.append(frame);
   const name=document.createElement('strong');name.textContent=version.name;card.append(name);const date=document.createElement('small');date.textContent=new Date(version.createdAt).toLocaleDateString('hr-HR');card.append(date);
   card.onclick=()=>{finishDrag();state=normalize(version.design);commit();sync();render();$('versionStatus').textContent='Učitano: '+version.name+'. Undo vraća prethodni raspored.';};host.append(card);
  }savedListRendered=true;
 }
 const current=JSON.stringify(state);for(const card of host.querySelectorAll('[data-version]')){const v=savedVersions.find(v=>v.id===card.dataset.version);card.classList.toggle('active',JSON.stringify(normalize(v.design))===current)}
}
$('saveVersion').onclick=async()=>{
 finishDrag();const clone=svg.cloneNode(true);clone.removeAttribute('tabindex');clone.querySelectorAll('[data-guides]').forEach(n=>n.remove());
 const captured=structuredClone(state),enteredName=$('versionName').value.trim();$('saveVersion').disabled=true;$('versionStatus').textContent='Spremam raspored…';
 try{await savedVersionsReady;
  const version={id:crypto.randomUUID(),name:enteredName||`Verzija ${savedVersions.length+1}`,createdAt:new Date().toISOString(),design:captured,preview:new XMLSerializer().serializeToString(clone)};
  await versionStore('readwrite',[version]);savedVersions=[version,...savedVersions];savedListRendered=false;renderSavedVersions();$('versionName').value='';$('versionStatus').textContent='Spremljeno: '+version.name+'. Klikni kućicu za učitavanje.';
 }catch(error){$('versionStatus').textContent=error?.name==='QuotaExceededError'?'Spremište verzija je puno. Izvezi raspored putem Spremi dizajn · JSON.':'Spremanje nije uspjelo. Prethodne verzije ostaju sačuvane; pokušaj ponovno.';}
 finally{$('saveVersion').disabled=false;}
};

$('undo').onclick=()=>stepHistory(-1);$('redo').onclick=()=>stepHistory(1);
window.addEventListener('keydown',e=>{if(!(e.metaKey||e.ctrlKey)||e.altKey)return;const key=e.key.toLowerCase();if(key==='z'){e.preventDefault();stepHistory(e.shiftKey?1:-1)}else if(key==='y'&&e.ctrlKey){e.preventDefault();stepHistory(1)}});
await document.fonts.ready;sync();render();persistHistory();

function preloadChoices(){
 const select=$('preloaderChoice');select.replaceChildren();const legacy=document.createElement('option');legacy.value='legacy';legacy.textContent='Postojeći metar · moj raspored';select.append(legacy);
 for(const[key,value]of preloadOptions){const option=document.createElement('option');option.value=key;option.textContent=value.name;select.append(option);}
 if(state.meterPreviewDesign&&!preloadOptions.has(state.meterPreviewChoice)){const option=document.createElement('option');option.value=state.meterPreviewChoice;option.textContent='Moj spremljeni preload dizajn';select.append(option);}select.value=state.meterPreviewChoice??'legacy';
}
$('preloaderChoice').onchange=e=>{
 if(preloadPlayback.active)stopPreloadPlayback(false);
 finishDrag();const key=e.target.value,choice=preloadOptions.get(key);selected='meter';state.meterPreviewChoice=key;state.meterPreviewDesign=choice?structuredClone(choice.design):null;
 commit();sync();render();$('status').textContent='Promijenjen samo izgled preloadera. Arch, položaj, širina, skala, broj i razmak ostaju isti.';
};
async function loadCubePreloadVersions(){
 try{const versions=await new Promise((resolve,reject)=>{const request=indexedDB.open('sts-cube-editor',1);let blocked=false;request.onupgradeneeded=()=>request.result.createObjectStore('data');request.onerror=()=>reject(request.error);request.onblocked=()=>{blocked=true;reject(Error('Spremište zauzeto'));};request.onsuccess=()=>{const db=request.result;if(blocked){db.close();return;}db.onversionchange=()=>db.close();const tx=db.transaction('data','readonly'),read=tx.objectStore('data').get('versions');tx.oncomplete=()=>{db.close();resolve(read.result);};tx.onabort=()=>{db.close();reject(tx.error);};};});
  for(const v of Array.isArray(versions)?versions:[]){if(typeof v.id!=='string'||typeof v.name!=='string')continue;try{preloadOptions.set('saved:'+v.id,{name:'Spremljeno · '+v.name,design:normalizeCubeDesign(v.state)});}catch{}}
  preloadChoices();
 }catch{preloadChoices();}
}
$('refreshPreloaders').onclick=()=>loadCubePreloadVersions();
preloadChoices();loadCubePreloadVersions();preparePreloadSnapshots().then(()=>{preloadReady=true;render();}).catch(()=>{$('status').textContent='Preload PNG nije učitan. Osvježi editor.';});

$('navigationArch').onchange=e=>{if(!isArchLayer(selected))return;archSettings(selected).navigationArch=e.target.checked;commit();sync();render();};
$('dividerMask').onchange=e=>{if(!isArchLayer(selected))return;archSettings(selected).archMasksPreloader=e.target.checked;commit();sync();render();$('status').textContent='Maska djeluje na preloader kada je postavljen na Below.';};

// Inspector navigation changes presentation only; original controls/handlers stay mounted.
function buildInspectorSections(){
 const aside=document.querySelector('aside'),header=document.createElement('div');header.className='inspector-header';
 for(const element of [...aside.children].slice(0,5))header.append(element);
 const transport=document.createElement('div');transport.id='preloadTransport';transport.className='preload-transport';transport.setAttribute('aria-label','Preloader preview kontrole');header.insertBefore(transport,header.querySelector('.lead'));
 const nav=document.createElement('nav');nav.className='inspector-chips';nav.setAttribute('aria-label','Sekcije editora');const editMeter=document.createElement('button');editMeter.type='button';editMeter.className='edit-preloader-action';editMeter.textContent='✎ Uredi preloader';editMeter.onclick=()=>{selected='meter';sync();render();};header.append(editMeter,nav);
 const scroll=document.createElement('div');scroll.className='inspector-scroll';scroll.setAttribute('aria-label','Kontrole odabrane sekcije');scroll.tabIndex=0;
 const panels=new Map(),buttons=new Map();
 const section=(id,label)=>{const panel=document.createElement('section');panel.id='inspector-'+id;panel.hidden=id!=='position';panel.className='inspector-section';const heading=document.createElement('h2');heading.textContent=label;panel.append(heading);panels.set(id,panel);scroll.append(panel);const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-controls',panel.id);button.setAttribute('aria-pressed',String(id==='position'));button.onclick=()=>{for(const[key,p]of panels)p.hidden=key!==id;for(const[key,b]of buttons)b.setAttribute('aria-pressed',String(key===id));scroll.scrollTop=0;if(id==='preloader'){selected='meter';sync();render();}};buttons.set(id,button);nav.append(button);return panel;};
 const position=section('position','Položaj'),appearance=section('appearance','Izgled'),preloader=section('preloader','Preloader'),arch=section('arch','Arch & sync'),exportPanel=section('export','Export');
 const move=(parent,id,label=false)=>{const element=$(id);parent.append(label?element.closest('label'):element);};
 position.append($('dx').closest('.fields'));for(const id of ['size','dividerWidth','rotation'])move(position,id,true);position.append(document.querySelector('.meter-layer-buttons'));move(position,'parkItem');
 move(appearance,'dividerOpacity',true);move(appearance,'navBackgroundStyle',true);move(appearance,'navBackgroundOpacity',true);move(appearance,'dividerShadowControls');move(appearance,'dividerControls');
 move(preloader,'preloaderChoice',true);move(preloader,'refreshPreloaders');const hint=document.createElement('p');hint.className='hold-hint';hint.textContent='Izbor mijenja samo izgled. Arch, položaj, širina, skala, broj i razmak ostaju tvoji.';preloader.append(hint);move(preloader,'meterStyle',true);move(preloader,'meterSizingControls');move(preloader,'fill',true);const editing=document.createElement('div');editing.id='preloadEditing';preloader.append(editing);buildPreloadEditing(editing);
 for(const id of ['meterControls','archControls','dividerMaskControls','sonicControls','archSyncControls','iconArchControls'])move(arch,id);
 const emptyArch=document.createElement('p');emptyArch.id='emptyArchHint';emptyArch.className='hold-hint';emptyArch.textContent='Odaberi preloader, divider ili HUD ikonu za kontrole archa i synca.';arch.append(emptyArch);
 move(exportPanel,'facts');exportPanel.append(aside.querySelector('.actions'));exportPanel.append(aside.querySelector('details'));
 const footer=document.createElement('div');footer.className='inspector-footer';footer.append($('status'));
 aside.replaceChildren(header,scroll,footer);
 // Keep moved standalone groups scoped to the selected layer, as before.
 const update=()=>{document.querySelector('.meter-layer-buttons').hidden=selected!=='meter';$('navBackgroundStyle').closest('label').hidden=!isArchLayer(selected);$('navBackgroundOpacity').closest('label').hidden=!isArchLayer(selected);emptyArch.hidden=selected==='meter'||isArchLayer(selected)||selected==='sonicWave'||['close','backpack','score','combo','navClose','navBackpack'].includes(selected);};
 buildInspectorSections.update=update;update();
}
buildInspectorSections();

function editPreloadValue(key,value){
 selected='meter';
 if(!state.meterPreviewDesign){state.meterPreviewDesign=normalizeCubeDesign({...cubeDefaults,mode:state.meterStyle==='bar'?'bar':'tiles'});state.meterPreviewChoice='custom:legacy';}
 if(key==='heightPt')state.meterPreviewHeightPt=Number(value);
 else state.meterPreviewDesign=normalizeCubeDesign({...state.meterPreviewDesign,[key]:value});
 commit();sync();render();
}
function buildPreloadEditing(parent){
 const heading=document.createElement('h3');heading.textContent='Uredi odabrani preloader';parent.append(heading);
 const add=(key,label,type,options={})=>{const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement(type==='select'?'select':'input');if(type!=='select')input.type=type;input.dataset.preloadKey=key;
 if(type==='select')for(const[value,name]of Object.entries(cubeEnums[key])){const o=document.createElement('option');o.value=value;o.textContent=name;input.append(o);}
 if(type==='range'){const bounds=key==='heightPt'?[3,100]:cubeRanges[key];input.min=bounds[0];input.max=bounds[1];input.step=key==='heightPt'?.5:1;const row=document.createElement('div');row.className='range-row';const output=document.createElement('output');output.dataset.preloadOutput=key;row.append(input,output);wrap.append(row);}else wrap.append(input);
 if(type==='color'){const hex=document.createElement('input');hex.type='text';hex.maxLength=7;hex.placeholder='#e7dfd7';hex.dataset.preloadHex=key;hex.setAttribute('aria-label',label+' HEX');hex.oninput=()=>{if(/^#[0-9a-f]{6}$/i.test(hex.value))editPreloadValue(key,hex.value);};hex.onchange=()=>{hex.value=state.meterPreviewDesign?.[key]??cubeDefaults[key];};wrap.append(hex);if(key==='holder'){const note=document.createElement('small');note.className='hold-hint';note.textContent='Samo pozadina praznog dijela; boja punjenja ostaje zasebna.';wrap.append(note);}}
 input.oninput=()=>editPreloadValue(key,type==='checkbox'?input.checked:type==='range'?Number(input.value):input.value);parent.append(wrap);};
 add('holder','Boja praznog holdera','color');
 add('heightPt','Debljina / visina preloadera · pt','range');
 add('barStyle','Izgled holdera / puta','select');add('trailMarkers','Zastavica i škrinja na putu','checkbox');add('trailThickness','Debljina crtica · %','range');add('trailSpacing','Razmak crtica · %','range');
 add('taperEnds','Tanki krajevi · iz crte u crtu','checkbox');
 add('taperStart','Sužavanje početka · %','range');add('taperEnd','Sužavanje kraja · %','range');add('taperTip','Debljina vrhova · %','range');
 for(const[key,label]of [['mode','Vrsta preloadera'],['shape','Oblik'],['direction','Smjer punjenja'],['distribution','Redoslijed'],['fillStyle','Stil punjenja'],['gradient','Vrsta gradienta']])add(key,label,'select');
 for(const[key,label]of [['start','Početna boja'],['end','Završna boja'],['empty','Prazna kockica / zvjezdica']])add(key,label,'color');
 for(const[key,label]of [['angle','Kut gradienta · °'],['frontAngle','Kut vrha punjenja · °'],['wave','Jačina vala · %'],['bubbles','Mjehurići / maglica · %'],['highlight','Odsjaj · %'],['volume','Volumen · %'],['grain','Tekstura · %']])add(key,label,'range');
 for(const[key,label]of [['bounce','Squash & stretch · %'],['lift','Visina skoka · %'],['rotation','Šansa rotacije · %'],['shadow','Podna sjena · %'],['duration','Trajanje Auto ciklusa · s'],['flowSpeed','Brzina površine · %'],['randomAngleRange','Raspon random kuta · °']])add(key,label,'range');
 add('randomFrontAngle','Organski random kut punjenja','checkbox');
 const note=document.createElement('p');note.className='hold-hint';note.textContent='Promjene vidiš odmah. Skok i rotaciju isprobaj pomoću Auto / +1 / +6 gore.';parent.append(note);
}
function syncPreloadEditing(){
 const parent=$('preloadEditing');if(!parent)return;parent.hidden=false;
 const p=normalizeCubeDesign(state.meterPreviewDesign??{...cubeDefaults,mode:state.meterStyle==='bar'?'bar':'tiles'});
 for(const hex of parent.querySelectorAll('[data-preload-hex]'))if(document.activeElement!==hex)hex.value=p[hex.dataset.preloadHex];
 for(const input of parent.querySelectorAll('[data-preload-key]')){const key=input.dataset.preloadKey,value=key==='heightPt'?(state.meterPreviewHeightPt??meterGeometry().side*state.meterPreviewHeight/100):p[key];if(input.type==='checkbox')input.checked=value;else if(document.activeElement!==input)input.value=value;const output=parent.querySelector(`[data-preload-output="${key}"]`);if(output)output.textContent=Number(Number(value).toFixed(1))+(key==='heightPt'?' pt':'');input.closest('label').hidden=(['shape','bounce','lift','rotation','empty'].includes(key)&&p.mode==='bar')||(['flowSpeed','randomAngleRange','randomFrontAngle','frontAngle','wave','bubbles'].includes(key)&&p.mode!=='bar'&&p.fillStyle==='classic')||(['holder','barStyle','trailMarkers','trailThickness','trailSpacing','taperEnds','taperStart','taperEnd','taperTip'].includes(key)&&p.mode!=='bar');}
}
syncPreloadEditing();

// A single demand-owned preview loop paints only the preloader canvas, not the board.
const preloadPlayback={auto:false,active:false,raf:0,last:null,time:0,target:state.fill/100,settledAt:0,hops:[],travelCycle:null,barCycleAt:null};
function preloadTransport(){
 const host=$('preloadTransport');
 for(const[id,title,label,action]of [
  ['preloadAuto','Auto punjenje i gibanje','▷ Auto',()=>{if(preloadPlayback.auto)stopPreloadPlayback(true);else{preloadPlayback.auto=true;startPreloadPlayback(state.fill>=100?0:state.fill/100);}}],
  ['preloadOne','Dodaj jednu kockicu / korak','+1',()=>addPreloadProgress(1)],
  ['preloadSix','Dodaj šest kockica / koraka','+6',()=>addPreloadProgress(6)],
  ['preloadFull','Napuni do kraja','100%',()=>{preloadPlayback.auto=false;startPreloadPlayback(1);}],
  ['preloadReset','Isprazni preloader','↺',()=>{stopPreloadPlayback(false);state.fill=0;commit();sync();render();}]
 ]){const b=document.createElement('button');b.id=id;b.type='button';b.title=title;b.setAttribute('aria-label',title);b.textContent=label;b.onclick=action;host.append(b);}
}
function playbackButtons(){const button=$('preloadAuto');if(button){button.textContent=preloadPlayback.auto?'Ⅱ Auto':'▷ Auto';button.setAttribute('aria-pressed',String(preloadPlayback.auto));}}
function addPreloadProgress(n){const value=preloadPlayback.auto?state.fill/100:preloadPlayback.active?preloadPlayback.target:state.fill/100;preloadPlayback.auto=false;startPreloadPlayback(Math.min(1,value+n/(state.meterCount+(state.meterPreviewDesign?.shape==='travel'?1:0))));}
function startPreloadPlayback(target){if(!preloadReady){$('status').textContent='Preloader se još učitava.';return;}preloadPlayback.active=true;preloadPlayback.target=target;preloadPlayback.settledAt=0;preloadPlayback.last=null;playbackButtons();wakePreloadPlayback();}
function wakePreloadPlayback(){if(preloadPlayback.active&&!preloadPlayback.raf&&!document.hidden)preloadPlayback.raf=requestAnimationFrame(preloadPlaybackFrame);}
function stopPreloadPlayback(persist){cancelAnimationFrame(preloadPlayback.raf);preloadPlayback.raf=0;preloadPlayback.active=false;preloadPlayback.auto=false;preloadPlayback.last=null;preloadPlayback.hops=[];preloadPlayback.travelCycle=null;preloadPlayback.barCycleAt=null;state.fill=Number(state.fill.toFixed(1));if(persist)commit();sync();render();playbackButtons();}
function preloadPreviewTime(){return preloadPreviewTime.current??0;}
function preloadPlaybackFrame(now){
 preloadPlayback.raf=0;if(!preloadPlayback.active)return;
 const dt=preloadPlayback.last===null?0:Math.min(.05,(now-preloadPlayback.last)/1000);preloadPlayback.last=now;preloadPlayback.time+=dt;preloadPreviewTime.current=preloadPlayback.time;
 const beforeFill=state.fill;
 const p=state.meterPreviewDesign?normalizeCubeDesign(state.meterPreviewDesign):normalizeCubeDesign({...cubeDefaults,mode:state.meterStyle==='bar'?'bar':'tiles'});
 if(preloadPlayback.barCycleAt!==null){
  if(preloadPlayback.time-preloadPlayback.barCycleAt>=nativeBarCycleDuration){preloadPlayback.barCycleAt=null;state.fill=0;preloadPlayback.target=0;preloadPlayback.settledAt=0;if(!preloadPlayback.auto){stopPreloadPlayback(true);return;}}
 }else if(preloadPlayback.travelCycle){
  if(preloadPlayback.time-preloadPlayback.travelCycle.at>=preloadPlayback.travelCycle.duration){preloadPlayback.travelCycle=null;preloadPlayback.hops=[];state.fill=0;preloadPlayback.target=0;preloadPlayback.settledAt=0;if(!preloadPlayback.auto){stopPreloadPlayback(true);return;}}
 }else if(preloadPlayback.auto){state.fill=Math.min(100,state.fill+dt/p.duration*100);if(state.fill>=100){if(!preloadPlayback.settledAt)preloadPlayback.settledAt=preloadPlayback.time;if(preloadPlayback.time-preloadPlayback.settledAt>(p.mode==='tiles'?.85:.4)){state.fill=0;preloadPlayback.settledAt=0;}}}
 else {const goal=preloadPlayback.target*100;state.fill+=(goal-state.fill)*Math.min(1,dt*12);if(Math.abs(goal-state.fill)<.02){state.fill=goal;if(!preloadPlayback.settledAt)preloadPlayback.settledAt=preloadPlayback.time;if((p.shape!=='travel'||goal<100)&&!(p.mode==='bar'&&goal===100)&&preloadPlayback.time-preloadPlayback.settledAt>.8){stopPreloadPlayback(true);return;}}}
 if(p.mode==='tiles'){
  if(state.fill<beforeFill)preloadPlayback.hops=[];
  const steps=state.meterCount+(p.shape==='travel'?1:0);
  for(let i=0;i<state.meterCount;i++){
   const threshold=p.distribution==='together'?.001:(p.shape==='cube'||p.shape==='travel'?i+1:i+.001);
   if(beforeFill/100*steps<threshold&&state.fill/100*steps>=threshold)preloadPlayback.hops[i]={at:preloadPlayback.time,spin:Math.random()*100<p.rotation?(Math.random()<.5?-1:1):0,lift:Math.random()<.5?1:.6};
  }
 }
 if(p.mode==='bar'&&state.fill>=100&&preloadPlayback.barCycleAt===null)preloadPlayback.barCycleAt=preloadPlayback.time;
 if(p.shape==='travel'&&state.fill>=100&&!preloadPlayback.travelCycle){preloadPlayback.travelCycle=createTravelCycle(state.meterCount,preloadPlayback.time);preloadPlayback.hops=[];}
 $('fill').value=state.fill;$('fillValue').textContent=state.fill.toFixed(0)+'%';paintLivePreloader(p);wakePreloadPlayback();
}
function paintLivePreloader(profile){
 const meter=svg.querySelector('[data-layer="meter"]');if(!meter||state.layers.meter.parked)return;const g=meterGeometry(),t=preloadPlayback.time,tilt=profile.randomFrontAngle?profile.randomAngleRange*(.65*Math.sin(t*1.1)+.35*Math.sin(t*.57+1)):0;
 const preview=preloadSnapshot(profile,{width:g.width,side:g.side,tileHeight:state.meterPreviewHeightPt??g.side*state.meterPreviewHeight/100,count:state.meterCount,pitch:g.pitch,fill:state.fill/100,curveAt:x=>meterCurve(x+g.left,g),key:JSON.stringify([profile,state.fill,g,state.meterSonicWave,state.meterPreviewHeightPt,t]),time:t,tiltOffset:tilt,live:true,hops:preloadPlayback.hops,travelCycle:preloadPlayback.travelCycle,barWindow:preloadPlayback.barCycleAt===null?null:nativeBarCyclePose(t-preloadPlayback.barCycleAt)});
 let surface=meter.querySelector('[data-preload-live]');if(!surface){for(const child of meter.children)child.setAttribute('visibility','hidden');surface=node('foreignObject',{'data-preload-live':'true'},meter);}
 for(const[k,v]of Object.entries({x:g.left-preview.pad,y:g.floor-preview.base,width:preview.width,height:preview.height}))surface.setAttribute(k,v);
 if(preview.canvas.parentNode!==surface)surface.replaceChildren(preview.canvas);preview.canvas.style.width='100%';preview.canvas.style.height='100%';preview.canvas.style.display='block';
}
preloadTransport();
document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(preloadPlayback.raf);preloadPlayback.raf=0;preloadPlayback.last=null;if(!document.hidden)wakePreloadPlayback();});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(preloadPlayback.raf);preloadPlayback.raf=0;preloadPlayback.last=null;});window.addEventListener('pageshow',wakePreloadPlayback);
// Persist/export only a static PNG surface; live foreignObject canvases never enter saved markup.
for(const id of ['undo','redo','reset','export','saveVersion','copy']){const element=$(id),handler=element.onclick;if(handler)element.onclick=function(event){if(preloadPlayback.active)stopPreloadPlayback(false);return handler.call(this,event);};}

const manualFillHandler=$('fill').oninput;
$('fill').oninput=function(event){const value=this.value;if(preloadPlayback.active)stopPreloadPlayback(false);this.value=value;return manualFillHandler.call(this,event);};
window.addEventListener('keydown',event=>{if(preloadPlayback.active&&(event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z')stopPreloadPlayback(false);},true);
