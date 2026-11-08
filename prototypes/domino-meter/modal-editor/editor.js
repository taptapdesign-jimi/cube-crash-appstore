const $=id=>document.getElementById(id),svg=$('board'),NS='http://www.w3.org/2000/svg';
const labels={modal:'Cijeli modal',paper:'Paper BG',title:'Naslov',body:'Opis',primary:'Glavni button',secondary:'Drugi button',close:'Zatvori · X'};
const icons={modal:'▣',paper:'▱',title:'Aa',body:'≡',primary:'Restart',secondary:'Exit',close:'×'};
const papers={'native-cut':'Native · Cut · Stack to Six','native-worn':'Native · Worn · Stack to Six','native-cracked':'Native · Cracked · Stack to Six',balanced:'Pohabani · balanced',cuts:'Pohabani · cuts',fray:'Pohabani · soft fray',cracked:'Napuknuti papir'};
const base={x:195,y:422,width:200,height:60,scale:100,rotation:0,opacity:100,visible:true};
const defaults={version:1,nativePaperRevision:1,scene:{dim:40,dimColor:'#c99573',shadow:65,shadowY:14,shadowBlur:17},layers:{
 modal:{...base,width:342,height:420,rotation:-2},
 paper:{...base,width:342,height:420,color:'#fff9ef',material:'native-cut'},
 title:{...base,y:292,width:300,height:40,text:'Exit Stage?',fontSize:28,color:'#bf8059'},
 body:{...base,y:347,width:290,height:52,text:'Come back anytime.\nStage 1 progress saved.',fontSize:18,color:'#d59a79'},
 primary:{...base,y:430,width:205,height:74,text:'Restart',fontSize:28,color:'#f68558',shadowColor:'#ce704b',shadowCustom:false,textColor:'#fff8e9'},
 secondary:{...base,y:510,width:205,height:74,text:'Exit Stage',fontSize:28,color:'#ffffff',shadowColor:'#e0c5b2',shadowCustom:false,textColor:'#c99a80'},
 close:{...base,x:341,y:233,width:43,height:43,color:'#c99a80'}
}};
const measure=document.createElement('canvas').getContext('2d');
let state=structuredClone(defaults),selected='paper',history=[structuredClone(defaults)],cursor=0,drag=null,versions=[],ready=false;
const clone=v=>structuredClone(v),clamp=(v,min,max,fallback)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
const color=(v,f)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v:f;
function normalize(value){
 if(value?.version!==1||!value.layers)throw Error('Ovo nije Modal editor dizajn.');
 const out=clone(defaults);
 for(const [key,def] of Object.entries(defaults.scene)){const v=value.scene?.[key];out.scene[key]=typeof def==='string'?color(v,def):clamp(v,0,key==='shadowY'?60:key==='shadowBlur'?50:100,def);}
 for(const [id,def] of Object.entries(defaults.layers)){
  const from=value.layers[id]??{},to=out.layers[id];
  for(const [key,fallback] of Object.entries(def)){
   if(key==='visible'||key==='shadowCustom')to[key]=typeof from[key]==='boolean'?from[key]:fallback;
   else if(key==='material')to[key]=papers[from[key]]?from[key]:fallback;
   else if(key==='text')to[key]=typeof from[key]==='string'?from[key].slice(0,256):fallback;
   else if(typeof fallback==='string')to[key]=color(from[key],fallback);
   else {const range=key==='x'||key==='y'?[-500,1300]:key==='rotation'?[-180,180]:key==='opacity'?[0,100]:key==='scale'?[10,200]:key==='fontSize'?[8,70]:[12,700];to[key]=clamp(from[key],...range,fallback);}
  }
 }
 if(value.nativePaperRevision!==1&&out.layers.paper.material==='balanced')out.layers.paper.material='native-cut';
 return out;
}
function node(tag,attrs={},parent=svg){const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);parent.append(n);return n;}
function img(parent,path,x,y,width,height,extra={}){return node('image',{href:path,x,y,width,height,preserveAspectRatio:'none',...extra},parent);}
function transform(p){return `translate(${p.x} ${p.y}) rotate(${p.rotation}) scale(${p.scale/100})`;}
function matrix(p){return new DOMMatrix().translate(p.x,p.y).rotate(p.rotation).scale(p.scale/100);}
function modalMatrix(){return matrix(state.layers.modal).translate(-195,-422);}
function tint(defs,id,hex,baseline){
 const rgb=hex.match(/\w\w/g).map(v=>parseInt(v,16)/255),f=node('filter',{id,'color-interpolation-filters':'sRGB',x:'-5%',y:'-5%',width:'110%',height:'110%'},defs);
 // Preserve grayscale lighting, adding each target channel relative to the face's midtone.
 const values=rgb.flatMap(c=>[.2126,.7152,.0722,0,c-baseline]).concat([0,0,0,1,0]);
 node('feColorMatrix',{type:'matrix',values:values.join(' ')},f);
}
const nativeSources=new Map(),closeTextures=new Map();let fittedPaper=null;
const nativeReady=Promise.all(['native-cut','native-worn','native-cracked'].map(async name=>{const source=new Image();source.src=`assets/paper-${name}.png`;await source.decode();nativeSources.set(name,source);}));
function wash(ctx,width,height){ctx.globalCompositeOperation='source-atop';ctx.fillStyle='rgba(255,254.142857,252,0.7)';ctx.fillRect(0,0,width,height);ctx.globalCompositeOperation='source-over';}
function nativePaper(p){
 const source=nativeSources.get(p.material);if(!source)return `assets/paper-${p.material}.png`;
 const width=p.width,height=p.height,density=Math.min(devicePixelRatio||1,3),key=[p.material,width,height,density].join('|');if(fittedPaper?.key===key)return fittedPaper.url;
 const canvas=document.createElement('canvas');canvas.width=Math.ceil(width*density);canvas.height=Math.ceil(height*density);const ctx=canvas.getContext('2d');ctx.scale(density,density);
 const scale=width/(source.naturalWidth/3),sourceHeight=source.naturalHeight/source.naturalWidth*width,blend=Math.min(24*scale,height/6);
 const draw=offset=>ctx.drawImage(source,0,offset,width,sourceHeight);
 function continuePaper(seam,offset){
  const lo=Math.max(0,Math.floor((seam-blend/2)*3)/3),hi=Math.min(height,Math.ceil((seam+blend/2)*3)/3);
  ctx.save();ctx.beginPath();ctx.rect(0,hi,width,Math.max(0,height-hi));ctx.clip();ctx.clearRect(0,0,width,height);draw(offset);ctx.restore();if(hi<=lo)return;
  const layer=document.createElement('canvas');layer.width=canvas.width;layer.height=Math.max(1,Math.ceil((hi-lo)*density));const c=layer.getContext('2d');c.scale(density,density);c.drawImage(source,0,offset-lo,width,sourceHeight);c.globalCompositeOperation='destination-in';const ramp=c.createLinearGradient(0,0,0,hi-lo);ramp.addColorStop(0,'rgba(255,255,255,0)');ramp.addColorStop(1,'white');c.fillStyle=ramp;c.fillRect(0,0,width,hi-lo);ctx.drawImage(layer,0,lo,width,hi-lo);
 }
 draw(0);if(height>sourceHeight){const band=sourceHeight/2,step=sourceHeight/3;for(let seam=band;seam<height-band;seam+=step)continuePaper(seam,seam-sourceHeight/3);continuePaper(height-band,height-sourceHeight);}else if(Math.abs(height-sourceHeight)>.5)continuePaper(height/2,height-sourceHeight);
 wash(ctx,width,height);const url=canvas.toDataURL();fittedPaper={key,url};return url;
}
function nativeClose(p){const source=nativeSources.get(p.material);if(!source)return null;if(closeTextures.has(p.material))return closeTextures.get(p.material);const side=Math.min(source.naturalWidth,source.naturalHeight,96*3),c=document.createElement('canvas');c.width=c.height=side;const ctx=c.getContext('2d');ctx.drawImage(source,source.naturalWidth-side,(source.naturalHeight-side)/2,side,side,0,0,side,side);wash(ctx,side,side);const url=c.toDataURL();closeTextures.set(p.material,url);return url;}
function render(){
 svg.replaceChildren();const defs=node('defs');
 const shadow=node('filter',{id:'paper-shadow',x:'-45%',y:'-45%',width:'190%',height:'220%'},defs);
 node('feDropShadow',{dx:0,dy:state.scene.shadowY,stdDeviation:state.scene.shadowBlur,'flood-color':'#98684c','flood-opacity':state.scene.shadow/100},shadow);
 const backdrop=node('g',{'pointer-events':'none'});img(backdrop,'../board-editor/assets/paper.png',-100,0,590,844);node('rect',{width:390,height:844,fill:'#f6efe5',opacity:.5},backdrop);
 for(let r=0;r<9;r++)for(let c=0;c<5;c++){const occupied=(r*5+c)%11===0;img(backdrop,`../board-editor/assets/${occupied?'body1':'tile'}.png`,24+c*70.3,136+r*70.3,60.8,60.8,{opacity:occupied?.65:.25});}
 img(backdrop,'../board-editor/assets/combo.png',280,54,28,28);const combo=node('text',{x:312,y:75,fill:'#de8b61','font-family':'Baloo','font-size':18,'font-weight':700},backdrop);combo.textContent='×2';
 node('rect',{width:390,height:844,fill:state.scene.dimColor,opacity:state.scene.dim/100},backdrop);
 const modal=node('g',{'data-layer':'modal',transform:`${transform(state.layers.modal)} translate(-195 -422)`,opacity:state.layers.modal.opacity/100,display:state.layers.modal.visible?'inline':'none'});
 for(const id of ['paper','title','body','primary','secondary','close']){
  const p=state.layers[id],g=node('g',{'data-layer':id,transform:transform(p),opacity:p.opacity/100,display:p.visible?'inline':'none'},modal);
  if(id==='paper'){
   const filter=p.color===defaults.layers.paper.color?null:`url(#tint-${id})`;if(filter)tint(defs,`tint-${id}`,p.color,.965);
   const surface=node('g',{filter:'url(#paper-shadow)'},g);img(surface,p.material.startsWith('native-')?nativePaper(p):`assets/paper-${p.material}.png`,-p.width/2,-p.height/2,p.width,p.height,filter?{filter}:{});
  }else if(id==='primary'||id==='secondary'){
   const filter=p.color===defaults.layers[id].color?null:`url(#tint-${id})`;if(filter)tint(defs,`tint-${id}`,p.color,id==='primary'?.64:.98);
   img(g,`assets/${id}.png`,-p.width/2,-p.height/2,p.width,p.height,filter?{filter}:{});
   if(p.shadowCustom){
    tint(defs,`shadow-tint-${id}`,p.shadowColor,id==='primary'?.5:.76);
    // Full sculpted rim: top highlight, both sides and the deeper lower lip.
    // The inset face is excluded, so its independent color remains untouched.
    const soften=node('filter',{id:`rim-soften-${id}`},defs);node('feGaussianBlur',{stdDeviation:p.height*.012},soften);
    const mask=node('mask',{id:`shadow-mask-${id}`,maskUnits:'userSpaceOnUse',x:-p.width/2,y:-p.height/2,width:p.width,height:p.height},defs);
    node('rect',{x:-p.width/2,y:-p.height/2,width:p.width,height:p.height,fill:'white'},mask);
    node('rect',{x:-p.width*.466,y:-p.height*.417,width:p.width*.932,height:p.height*.724,rx:p.height*.22,fill:'black',filter:`url(#rim-soften-${id})`},mask);
    img(g,`assets/${id}.png`,-p.width/2,-p.height/2,p.width,p.height,{filter:`url(#shadow-tint-${id})`,mask:`url(#shadow-mask-${id})`});
   }
   drawText(g,p.text,p.fontSize,p.textColor,0,0,800,p.width-20);
  }else if(id==='close'){
   const paper=state.layers.paper,texture=nativeClose(paper);
   const clip=node('clipPath',{id:'close-paper-mask'},defs);node('rect',{x:-p.width/2,y:-p.height/2,width:p.width,height:p.height,rx:p.width*16/52},clip);
   const material=node('g',{'clip-path':'url(#close-paper-mask)'},g);
   if(texture){const filter=paper.color===defaults.layers.paper.color?null:'url(#close-paper-tint)';if(filter)tint(defs,'close-paper-tint',paper.color,.985);img(material,texture,-p.width/2,-p.height/2,p.width,p.height,filter?{filter}:{});}
   else {const viewport=node('svg',{x:-p.width/2,y:-p.height/2,width:p.width,height:p.height,viewBox:'774 590 288 288',preserveAspectRatio:'none'},material);img(viewport,`assets/paper-${paper.material}.png`,0,0,1062,1480);}
   const iconFilter=p.color===defaults.layers.close.color?null:'url(#tint-close)';if(iconFilter)tint(defs,'tint-close',p.color,.66);img(g,'../board-editor/assets/close.png',-p.width*.25,-p.height*.25,p.width*.5,p.height*.5,{opacity:.8,...(iconFilter?{filter:iconFilter}:{})});
  }else drawText(g,p.text,p.fontSize,p.color,0,0,id==='title'?800:700,p.width);
  // Stable geometry for direct picking, regardless of transparent PNG edges.
  node('rect',{x:-p.width/2,y:-p.height/2,width:p.width,height:p.height,fill:'transparent'},g);
 }
 if($('guides').checked){const g=node('g',{'pointer-events':'none',stroke:'#cb8858','stroke-width':.6,'stroke-dasharray':'4 4',opacity:.65});node('line',{x1:195,y1:0,x2:195,y2:844},g);node('line',{x1:0,y1:422,x2:390,y2:422},g);}
 if($('outline').checked){const p=state.layers[selected];const parent=selected==='modal'?svg:modal;const g=node('g',{transform:transform(p),'pointer-events':'none'},parent);node('rect',{x:-p.width/2-3,y:-p.height/2-3,width:p.width+6,height:p.height+6,fill:'none',stroke:'#d39165','stroke-width':.8,'stroke-dasharray':'4 3'},g);}
 $('undo').disabled=cursor===0;$('redo').disabled=cursor===history.length-1;
 document.querySelectorAll('.layer').forEach(b=>b.classList.toggle('active',b.dataset.id===selected));
}
function drawText(parent,value,size,fill,x,y,weight,maxWidth){
 measure.font=`${weight} ${size}px Baloo`;const lines=[];
 for(const paragraph of value.split('\n')){let line='';for(const word of paragraph.split(' ')){const next=line?line+' '+word:word;if(line&&measure.measureText(next).width>maxWidth){lines.push(line);line=word;}else line=next;}lines.push(line);}
 const n=node('text',{x,y,fill,'font-family':'Baloo','font-size':size,'font-weight':weight,'text-anchor':'middle','dominant-baseline':'central','pointer-events':'none'},parent);lines.forEach((line,i)=>{const span=node('tspan',{x,dy:i===0?-(lines.length-1)*size*.65:size*1.3},n);span.textContent=line;});
}
function message(value){$('status').textContent=value;}
// The editor owns one tiny IndexedDB and a serial write chain; no images/history in localStorage.
let writes=Promise.resolve();
function transaction(mode,work){return new Promise((resolve,reject)=>{const req=indexedDB.open('sts-modal-editor',1);let settled=false;req.onupgradeneeded=()=>{req.result.createObjectStore('data');};req.onerror=()=>reject(req.error);req.onblocked=()=>{settled=true;reject(Error('Spremište je zauzeto. Zatvori staru karticu editora.'));};req.onsuccess=()=>{const db=req.result;if(settled){db.close();return;}db.onversionchange=()=>db.close();const tx=db.transaction('data',mode),store=tx.objectStore('data');let result;try{result=work(store);}catch(e){tx.abort();db.close();reject(e);return;}tx.oncomplete=()=>{const value=result?.result;db.close();resolve(value);};tx.onabort=()=>{db.close();reject(tx.error??Error('Spremanje nije uspjelo.'));};};});}
function put(key,value){const snapshot=clone(value);const task=writes.catch(()=>{}).then(()=>transaction('readwrite',store=>store.put(snapshot,key)));writes=task;return task;}
function persist(){if(!ready)return;put('draft',{state,history,cursor}).catch(e=>message(`Promjene su u ovoj sesiji. ${e.message} Koristi JSON export.`));}
function commit(){if(JSON.stringify(state)!==JSON.stringify(history[cursor])){history=history.slice(0,cursor+1);history.push(clone(state));cursor++;}persist();render();}
function undo(delta){finishDrag();const next=cursor+delta;if(next<0||next>=history.length)return;cursor=next;state=clone(history[cursor]);render();inspector();persist();}
function select(id){finishDrag();setInspectorPanel('element');selected=id;render();inspector();svg.focus({preventScroll:true});}
for(const id of Object.keys(labels)){const b=document.createElement('button');b.className='layer';b.dataset.id=id;const icon=document.createElement('span');icon.className='layer-icon';icon.textContent=icons[id];const label=document.createElement('span');label.textContent=labels[id];b.append(icon,label);b.onclick=()=>select(id);$('layers').append(b);}
function inputField(parent,label,type,value,oninput,attrs={}){
 const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement(type==='textarea'?'textarea':type==='select'?'select':'input');if(!['textarea','select'].includes(type))input.type=type;
 for(const[k,v]of Object.entries(attrs)){if(k==='options'){for(const [value,text]of Object.entries(v)){const o=document.createElement('option');o.value=value;o.textContent=text;input.append(o);}}else input.setAttribute(k,v);}
 input.value=value;
 if(type==='range'){const row=document.createElement('div');row.className='range';const out=document.createElement('output');const show=()=>out.textContent=Number(Number(input.value).toFixed(1))+(attrs.unit??'');show();input.removeAttribute('unit');if(/opacity|sjene|zatamnjenje/i.test(label))input.classList.add('opacity');row.append(input,out);wrap.append(row);input.oninput=()=>{oninput(Number(input.value));show();render();};}
 else {wrap.append(input);input.oninput=()=>{oninput(type==='number'?Number(input.value):input.value);render();};}
 input.onchange=commit;parent.append(wrap);return input;
}
function colorField(parent,label,value,set){const wrap=document.createElement('label');wrap.textContent=label;const row=document.createElement('div');row.className='color';const picker=document.createElement('input'),hex=document.createElement('input');picker.type='color';picker.value=value;hex.type='text';hex.value=value;hex.maxLength=7;hex.setAttribute('aria-label',label+' HEX');picker.setAttribute('aria-label',label);picker.oninput=()=>{hex.value=picker.value;set(picker.value);render();};hex.oninput=()=>{if(/^#[0-9a-f]{6}$/i.test(hex.value)){picker.value=hex.value;set(hex.value);render();}};picker.onchange=commit;hex.onchange=()=>{if(!/^#[0-9a-f]{6}$/i.test(hex.value))hex.value=picker.value;commit();};row.append(picker,hex);wrap.append(row);parent.append(wrap);const palette=document.createElement('div');palette.className='palette';for(const c of ['#f68558','#ee7045','#fff9ef','#ffffff','#e8cfb6','#bad1b5','#aec7d7','#c99a80']){const b=document.createElement('button');b.className='swatch';b.style.setProperty('--swatch',c);b.setAttribute('aria-label',label+' '+c);b.onclick=()=>{set(c);picker.value=hex.value=c;commit();};palette.append(b);}parent.append(palette);}
function inspector(){const parent=$('inspector');parent.replaceChildren();$('selectedName').textContent=labels[selected];const p=state.layers[selected];const field=(label,key,type='range',attrs={})=>inputField(parent,label,type,p[key],v=>p[key]=v,attrs);
 const fields=document.createElement('div');fields.className='fields';parent.append(fields);for(const key of ['x','y'])inputField(fields,`Pomak ${key.toUpperCase()} · pt`,'number',p[key],v=>p[key]=clamp(v,-500,1300,p[key]),{step:1});
 if(selected==='paper')field('Papirni materijal','material','select',{options:papers});
 if('text'in p)field('Tekst','text',selected==='body'?'textarea':'text',{maxlength:256});
 if(selected!=='modal'){field('Širina · pt','width','range',{min:12,max:450,step:1,unit:' pt'});field('Visina · pt','height','range',{min:12,max:650,step:1,unit:' pt'});}
 if('fontSize'in p)field('Veličina teksta','fontSize','range',{min:8,max:70,step:1,unit:' pt'});
 if('color'in p)colorField(parent,selected==='paper'?'Boja papira':selected==='primary'||selected==='secondary'?'Boja buttona':'Boja',p.color,v=>p.color=v);
 if('shadowColor'in p){
  colorField(parent,'Boja obruba buttona',p.shadowColor,v=>{p.shadowColor=v;p.shadowCustom=true;});
  const reset=document.createElement('button');reset.textContent='↺ Izvorni obrub';reset.style.marginTop='10px';reset.onclick=()=>{p.shadowCustom=false;p.shadowColor=defaults.layers[selected].shadowColor;commit();inspector();};parent.append(reset);
 }
 if('textColor'in p)colorField(parent,'Boja teksta',p.textColor,v=>p.textColor=v);
 field('Skala','scale','range',{min:10,max:200,step:1,unit:'%'});field('Opacity','opacity','range',{min:0,max:100,step:1,unit:'%'});field('Rotacija','rotation','range',{min:-45,max:45,step:.5,unit:'°'});
 const visible=document.createElement('label');visible.className='check';const check=document.createElement('input');check.type='checkbox';check.checked=p.visible;check.onchange=()=>{p.visible=check.checked;commit();};visible.append(check,document.createTextNode('Prikaži element'));parent.append(visible);
}
function sceneControls(){const parent=$('sceneControls');parent.replaceChildren();colorField(parent,'Boja zatamnjenja',state.scene.dimColor,v=>state.scene.dimColor=v);for(const[key,label,max]of [['dim','Zatamnjenje pozadine',90],['shadow','Jačina sjene papira',100],['shadowY','Pomak sjene dolje',60],['shadowBlur','Mekoća sjene',50]])inputField(parent,label,'range',state.scene[key],v=>state.scene[key]=v,{min:0,max,step:1,unit:key==='dim'||key==='shadow'?'%':' pt'});}
function refresh(){render();inspector();sceneControls();}
function point(e){return new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());}
function localPoint(point,id){return id==='modal'?point:point.matrixTransform(modalMatrix().inverse());}
svg.onpointerdown=e=>{if(e.button!==0)return;const id=e.target.closest('[data-layer]')?.dataset.layer;if(!id)return;select(selected==='modal'?'modal':id);const start=localPoint(point(e),selected);drag={id:selected,start,x:state.layers[selected].x,y:state.layers[selected].y,axis:null};svg.setPointerCapture(e.pointerId);e.preventDefault();};
svg.onpointermove=e=>{if(!drag)return;const pt=localPoint(point(e),drag.id);let dx=pt.x-drag.start.x,dy=pt.y-drag.start.y;if(e.shiftKey){drag.axis??=Math.abs(dx)>=Math.abs(dy)?'x':'y';if(drag.axis==='x')dy=0;else dx=0;}else drag.axis=null;state.layers[drag.id].x=Number((drag.x+dx).toFixed(2));state.layers[drag.id].y=Number((drag.y+dy).toFixed(2));render();};
function finishDrag(){if(!drag)return;drag=null;commit();inspector();}
svg.onpointerup=e=>{finishDrag();if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);};svg.onpointercancel=()=>{if(!drag)return;state.layers[drag.id].x=drag.x;state.layers[drag.id].y=drag.y;drag=null;refresh();};
svg.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||e.metaKey||e.ctrlKey||e.altKey)return;e.preventDefault();const step=e.shiftKey?4:1,dx=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,dy=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;const inverse=selected==='modal'?new DOMMatrix():modalMatrix().inverse(),a=new DOMPoint(0,0).matrixTransform(inverse),b=new DOMPoint(dx,dy).matrixTransform(inverse);state.layers[selected].x+=b.x-a.x;state.layers[selected].y+=b.y-a.y;commit();inspector();};
$('center').onclick=()=>{finishDrag();const p=state.layers[selected],world=selected==='modal'?new DOMPoint(p.x,p.y):new DOMPoint(p.x,p.y).matrixTransform(modalMatrix()),delta=195-world.x;if(selected==='modal')p.x+=delta;else {const inverse=modalMatrix().inverse(),a=new DOMPoint(0,0).matrixTransform(inverse),b=new DOMPoint(delta,0).matrixTransform(inverse);p.x+=b.x-a.x;p.y+=b.y-a.y;}commit();inspector();svg.focus({preventScroll:true});};
$('undo').onclick=()=>{undo(-1);sceneControls();};$('redo').onclick=()=>{undo(1);sceneControls();};
window.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select'))return;if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo(e.shiftKey?1:-1);sceneControls();}});
$('reset').onclick=()=>{finishDrag();state=clone(defaults);commit();refresh();};$('guides').onchange=render;$('outline').onchange=render;
function exported(){return {schema:'stack-to-six-modal-layout/v1',viewport:{width:390,height:844},changes:clone(state)};}
$('export').onclick=()=>{finishDrag();const blob=new Blob([JSON.stringify(exported(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='six-lab-modal-design.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('JSON je spreman za prijenos u Native.');};
$('import').onclick=()=>$('file').click();$('file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2_000_000)throw Error('JSON je prevelik.');const value=JSON.parse(await file.text());if(value.schema!=='stack-to-six-modal-layout/v1')throw Error('Odaberi Modal editor JSON.');finishDrag();state=normalize(value.changes);commit();refresh();message('Dizajn učitan. Undo vraća prethodni raspored.');}catch(error){message(error.message);}finally{e.target.value='';}};
function renderVersions(){const parent=$('saved');parent.replaceChildren();for(const v of versions){const b=document.createElement('button');b.className='saved';// Draw each saved version using its own isolated render, then restore current state.
 const previous=state;state=clone(v.state);render();const thumb=svg.cloneNode(true);state=previous;render();thumb.removeAttribute('id');thumb.removeAttribute('tabindex');thumb.setAttribute('viewBox','15 195 360 460');thumb.querySelectorAll('[stroke-dasharray]').forEach(n=>n.remove());const prefix='saved-'+v.id+'-';for(const n of thumb.querySelectorAll('[id]')){const id=n.id;n.id=prefix+id;for(const ref of thumb.querySelectorAll('[filter],[mask],[fill],[clip-path]'))for(const attr of ['filter','mask','fill','clip-path'])if(ref.getAttribute(attr)===`url(#${id})`)ref.setAttribute(attr,`url(#${prefix+id})`);}const label=document.createElement('span');label.textContent=v.name;b.append(thumb,label);b.onclick=()=>{finishDrag();state=normalize(v.state);commit();refresh();message(`Učitan modal: ${v.name}`);};parent.append(b);}}
$('saveVersion').onclick=async()=>{finishDrag();const button=$('saveVersion');button.disabled=true;const version={id:crypto.randomUUID(),name:$('versionName').value.trim()||`Modal ${versions.length+1}`,state:clone(state)},next=[version,...versions];try{await put('versions',next);versions=next;renderVersions();$('versionName').value='';message('Verzija spremljena. Klik na karticu vraća dizajn.');}catch(e){message('Spremanje nije uspjelo: '+e.message);}finally{button.disabled=false;}};
async function start(){try{await nativeReady;const saved=await transaction('readonly',s=>s.get('draft'));if(saved){state=normalize(saved.state);if(Array.isArray(saved.history)&&saved.history.length){history=saved.history.map(normalize);cursor=Math.max(0,Math.min(history.length-1,saved.cursor??0));state=clone(history[cursor]);}else {history=[clone(state)];cursor=0;}}const stored=await transaction('readonly',s=>s.get('versions'));if(Array.isArray(stored))versions=stored.filter(v=>typeof v.name==='string'&&/^[\w-]+$/.test(v.id)).flatMap(v=>{try{return[{...v,state:normalize(v.state)}]}catch{return[]}});}catch(e){message('Spremište nije dostupno. JSON export ostaje dostupan.');}ready=true;refresh();renderVersions();}
document.querySelector('main').inert=true;document.querySelector('header').inert=true;refresh();start().finally(()=>{document.querySelector('main').inert=false;document.querySelector('header').inert=false;});

document.fonts.ready.then(()=>{render();if(ready)renderVersions();});

function setInspectorPanel(panel){
 const scene=panel==='scene';
 $('elementPanel').hidden=scene;$('scenePanel').hidden=!scene;
 $('elementChip').setAttribute('aria-pressed',String(!scene));$('sceneChip').setAttribute('aria-pressed',String(scene));
}
$('elementChip').onclick=()=>setInspectorPanel('element');
$('sceneChip').onclick=()=>setInspectorPanel('scene');
