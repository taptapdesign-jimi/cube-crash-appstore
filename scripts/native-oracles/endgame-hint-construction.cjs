// Read-only numeric/markup oracle. Executes immutable v9 module bodies with
// captured DOM/tween construction, not a browser/rendered-animation claim.
const cp=require('node:child_process'),vm=require('node:vm'),ts=require('typescript');
const source=(name)=>cp.execFileSync('git',['show',`production-benchmark-v9:src/modules/${name}.ts`],{encoding:'utf8'});
const rows=[];
for(const seed of [1,42,1337])for(const index of [0,3,14]){
 let state=seed>>>0,draws=0;const math=Object.create(Math);
 math.random=()=>{draws++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const nodes=[];function element(){const e={style:{cssText:''},children:[],isConnected:false,textContent:'',className:'',pose:{},tweens:[],appendChild(child){this.children.push(child);child.isConnected=true;child.parentNode=this;},remove(){},get innerHTML(){return''},set innerHTML(_){this.children=[];}};nodes.push(e);return e;}
 const document={createElement:element,head:element(),body:element(),getElementById:()=>null};
 const gsap={set(target,values){Object.assign(target.pose,values);},timeline(options={}){return{to(target,values,position){target.tweens.push({values,position,options});return this;},add(){return this;},kill(){}};},delayedCall(){return{kill(){}};},getProperty(target,name){return target.pose[name]||0;}};
 function load(code,require){const module={exports:{}};vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports,require,Math:math,window:{innerWidth:390,innerHeight:844,devicePixelRatio:2},document,console});return module.exports;}
 const cloud=load(source('text-clouds'),name=>name==='gsap'?{gsap}:name.includes('animation-manager')?{__esModule:true,default:{trackExternalTimeline:t=>t,trackExternalTween:t=>t}}:{domElementPool:{acquire:element,release(){}}});
 const hint=load(source('endgame-hint')+`\nexport function probe(index){messageIndex=index;ensureElement();updateMessage();return {message:HINT_MESSAGES[index],letters:letterEls.map(el=>({character:el.textContent==='\\u00a0'?' ':el.textContent,size:Number(el.style.cssText.match(/font-size: ([0-9.]+)px/)[1])})),tilt:Number(hintEl.style.transform.match(/rotate\\(([-0-9.e]+)deg\\)/)[1])};}`,name=>name==='gsap'?{gsap}:name.includes('text-clouds')?cloud:name.includes('logger')?{logger:{debug(){}}}:{isEndgameHintSurfaceAllowed:()=>true});
 const result=hint.probe(index);
 const clouds=nodes.filter(n=>n.className==='cc-text-cloud').map((n,i)=>{
  const get=key=>Number(n.style.cssText.match(new RegExp(`${key}: ([0-9.]+)px`))[1]);
  const scale=n.tweens.find(t=>t.values.scale!==undefined).values.scale/1.22,x=n.tweens.find(t=>t.values.x!==undefined).values,y=n.tweens.find(t=>t.values.y!==undefined&&t.values.ease==='sine.inOut').values;
  return {asset:i%4,width:get('width'),height:get('height'),x:get('left'),y:get('top'),rotation:n.pose.rotation,scale,delay:i*.06,windDuration:x.duration,drift:x.x,windY:Number(y.y.slice(2,-2))};
 });
 rows.push({seed,index,draws,state,...result,clouds});
}
process.stdout.write(JSON.stringify(rows));
