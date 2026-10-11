const fs=require('fs'),vm=require('vm'),ts=require('/Users/user/cube-crash/node_modules/typescript'),{gsap}=require('/Users/user/cube-crash/node_modules/gsap');
const source=fs.readFileSync('/Users/user/cube-crash/src/modules/first-play-tutorial.ts','utf8');
const functions=ts.transpileModule(source.slice(source.indexOf('function shuffleInPlace'),source.indexOf('function startStepThreePointerHint')),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
const recipe=source.slice(source.indexOf('  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.16 });'),source.indexOf('  stepThreePointerTimeline = tl;')).replace('gsap.timeline({ repeat: -1, repeatDelay: 0.16 })','gsap.timeline({ paused:true,repeat:-1,repeatDelay:0.16 })');
const cases=[];
for(let seed=0;seed<24;seed++) {
 let count=0;const rect=(c,r)=>({left:24+c*70,top:100+r*70,width:60,height:60});
 const candidates=seed<4?[]:Array.from({length:seed%6+2},(_,i)=>({id:String(i),gridX:i%3,gridY:Math.floor(i/3),value:2,locked:false,special:false,rect:rect(i%3,Math.floor(i/3))}));
 const math=Object.create(Math);math.random=()=>{count++;return ((count*37+seed*11)%97)/97};
 const context=vm.createContext({Math:math,COLS:5,ROWS:9,getActiveTiles:()=>candidates,tileRect:t=>t.rect,cellRect:rect});
 vm.runInContext(functions,context);const moves=vm.runInContext('buildStepThreePointerMoves()',context),draws=count;
 const pointer={left:0,top:0,x:0,y:0,opacity:0,scale:0.9,rotate:-8},fingertip={x:18,y:24};
 const tl=Function('gsap','pointer','moves','fingertip',recipe+'\nreturn tl;')(gsap,pointer,moves,fingertip);
 const duration=tl.duration(),cycle=duration+0.16;
 const times=[0,0.08,0.16,0.42,0.74,0.84,0.92,1,1.08,1.16,1.24,duration,duration+0.08,cycle,cycle+0.08,2*cycle+0.42];
 const samples=times.map(time=>{tl.totalTime(time,false);return {time,x:pointer.left+pointer.x,y:pointer.top+pointer.y,alpha:pointer.opacity,scale:pointer.scale,rotation:pointer.rotate}});tl.kill();
 cases.push({candidates:candidates.map(t=>({id:t.id,column:t.gridX,row:t.gridY,rect:t.rect})),moves,seed,draws,duration,cycle,samples});
}
fs.writeFileSync('/tmp/native-resume-20261009/free-hint-oracle.json',JSON.stringify(cases));
gsap.ticker.sleep();
