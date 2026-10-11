/* Immutable v9 screenShake, actual GSAP CSSPlugin, finite direct graph oracle. */
const fs=require('node:fs'),cp=require('node:child_process'),vm=require('node:vm'),crypto=require('node:crypto');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<body><canvas></canvas><div id="hud-board-indicator"></div><div id="journey-game-bottom-decor"></div><div id="overlay"></div></body>',{pretendToBeVisual:true});
global.window=dom.window;global.document=dom.window.document;global.getComputedStyle=dom.window.getComputedStyle;
const {gsap}=require('gsap');gsap.ticker.sleep();
const source=cp.execFileSync('git',['show','production-benchmark-v9:src/modules/fx.ts'],{encoding:'utf8'});
const body=source.slice(source.indexOf('export function screenShake('),source.indexOf('/* ---------- Wild idle FX:',source.indexOf('export function screenShake('))).replace('export function','function').replaceAll('(el: any)','(el)');
const configurations=[['star',25,.52,32,'sine.inOut',1,false],['star-final',20,.52,32,'sine.inOut',1,false],['magnet',20,.26,16,'sine.inOut',1,false],['magnet-final',16,.26,16,'sine.inOut',1,false],['tnt',32,.26,16,'sine.inOut',1,true],['tnt-targets',40,.26,16,'sine.inOut',1,true],['magnet-pull',28,.36,28,'sine.inOut',1,false],['laser-third',9,.18,10,'power2.out',.72,true],['laser-fourth',12,.22,12,'power2.out',.72,true]];
const traces=[];
for(const[name,strength,duration,steps,ease,yScale,overlay]of configurations){
 gsap.globalTimeline.clear();let timeline,draws=0,seed=127;
 const math=Object.create(Math);math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;draws++;return seed/4294967296;};
 const context={gsap,document,Math:math,isVerboseGameplayLogsEnabled:()=>false,trackTimeline:opts=>(timeline=gsap.timeline({...opts,paused:true}))};vm.createContext(context);vm.runInContext(body,context);
 const targets=['canvas','#hud-board-indicator','#journey-game-bottom-decor','#overlay'].map(q=>document.querySelector(q));
 [[8,-6],[4,-2],[2,3],[0,0]].forEach(([x,y],i)=>gsap.set(targets[i],{x,y}));
 context.screenShake({canvas:targets[0]},{strength,duration,steps,ease,yScale,alsoShake:overlay?[targets[3]]:[]});
 const rows=[];for(const seconds of [0,.008125,.0166667,.0333333,.05,.0833333,.1,.15,.2,.26,.3,.36,.4,.52,.64,.8]){
  timeline.totalTime(seconds,false);
  const pose=targets.map(el=>['x','y'].map(p=>Number(gsap.getProperty(el,p))));
  rows.push({seconds,canvas:pose[0],indicator:pose[1],decor:pose[2],overlay:overlay?pose[3]:null});
 }
 traces.push({name,strength,duration,steps,ease,yScale,overlay,draws,rows});timeline.kill();
}
const packet={sourceSHA256:crypto.createHash('sha256').update(body).digest('hex'),gsapVersion:gsap.version,reference:'production-benchmark-v9:src/modules/fx.ts screenShake',traces};
fs.writeFileSync('native/standalone/Stack to SixTests/wild-screen-shake-source-oracle.json',JSON.stringify(packet,null,2)+'\n');gsap.ticker.sleep();dom.window.close();
