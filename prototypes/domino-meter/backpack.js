const $=id=>document.getElementById(id),canvases=[$('scene'),$('mini')];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),out=t=>1-(1-clamp(t))**3;
const mix=(a,b,t)=>a+(b-a)*t,backOut=(t,s=1.7)=>{const u=clamp(t)-1;return 1+u*u*((s+1)*u+s)};
const tileWidth=.72*.60,tileHeight=tileWidth,slot=tileWidth*.98;
const jumpDuration=620;
const backpackClosed=new Image(),backpackOpen=new Image();
const openingFrames=[backpackClosed,new Image(),new Image(),new Image(),backpackOpen];
const rank=i=>Math.min(i,count-1-i),charge=(value,i)=>clamp(value*(count/2)-rank(i));
// One cube per position: retain the reference's shallow curve and depth.
// x moves inward; y is the cube bottom in tile heights; z orders occlusion.
const leftLayout=[
 [0,0,.65],[.09,.02,.75],[.18,.08,.8],[.27,.16,.85],
 [.36,.23,.95],[.45,.27,1],[.54,.25,.9],[.63,.17,.8],
 [.72,.06,.7],[.81,-.08,.6],[.90,-.25,.5],[.99,-.50,.4]];
const rightLayout=[
 [0,-.08,.45],[.09,-.03,.55],[.18,.04,.7],[.27,.11,.85],
 [.36,.17,1],[.45,.16,.9],[.54,.10,.8],[.63,.01,.7],
 [.72,-.10,.6],[.81,-.22,.5],[.90,-.36,.55],[.99,-.50,.4]];
function slotLayout(i){
 const points=i<count/2?leftLayout:rightLayout,t=rank(i)/(count/2-1)*(points.length-1),a=Math.floor(t),b=Math.min(a+1,points.length-1),u=t-a;
 return points[a].map((v,j)=>mix(v,points[b][j],u));
}
let count=24,fill=0,target=0,queue=0,phase='gone',phaseAt=0,clock=0,last=null,raf=0,auto=false,nextAuto=0;
let started=Array(count).fill(-10000),shards=[],cycle=0,speed=200,burstDuration=200,bounce=12;
let turns=Array(count).fill(1),burstPlans=[],burstEnd=0,shardsEpoch=0,shardsUntil=0;
function pickTurns(){return {turns:Math.random()<.5?0:1,direction:Math.random()<.5?-1:1,lift:Math.random()<.5?1.45:1.45*.60,shape:.85+Math.random()*.30}}
function pickAccent(at,color='#E3D1BE'){
 const count=1+Math.floor(Math.random()*3),tilt=(Math.random()-.5)*.64;
 return {at,count,color,angles:Array.from({length:count},(_,i)=>(i-(count-1)/2)*.58+tilt+(Math.random()-.5)*.24)};
}
let accents=Array.from({length:count},()=>pickAccent(-10000));
let smoke=[],landings=[];
function advanceSmoke(){
 smoke=smoke.filter(p=>clock-p.at<460);
 for(const event of landings){if(event.at>clock)continue;
 // Adjacent landings overlap into a wider dust cloud, naturally matching
 // the number of cubes. Two cached puffs per landing, no separate ticker.
 for(const side of [-1,1])smoke.push({x:event.index*slot,at:event.at,side});
 }
 landings=landings.filter(event=>event.at>clock);
}
const accentDuration=780;
let artReady=false;const sprites=[],canvasSizes=new Map();
let boardPlans=[],boardEnd=0,boardEntryMode='drop',entryIsBoard=true;
const boardGravity=48,contactDuration=26; // tile-heights / second²
const labels={entering:'DOLAZAK PLOČE · RANDOM DROP',leaving:'KRAJ IGRE · SKOK I SKUPLJANJE',gone:'PLOČA ZATVORENA',fill:'NAPUNI I SKOČI',burst:'RUKSAK · BOUNCE, SKUPLJANJE I ENTER',};
function wake(){if(artReady&&!raf&&!document.hidden)raf=requestAnimationFrame(frame)}
// One sleeping timeout admits a finite idle phrase; the existing RAF paints it.
let idleTimer=0,idlePhrases=[];
function activeIdleSlots(){return new Set(idlePhrases.flatMap(p=>p.partner>=0?[p.index,p.partner]:[p.index]))}
// smoothstep(.636742509)=.70: handoff follows distance,not elapsed time.
const exchangeHandoff=60+380*.636742509;
function cancelIdle(){clearTimeout(idleTimer);idleTimer=0;idlePhrases=[]}
function scheduleIdle(){
 if(idleTimer||idlePhrases.length>=2||document.hidden||phase!=='fill')return;
 idleTimer=setTimeout(()=>{
 idleTimer=0;if(document.hidden||phase!=='fill')return;
 const occupied=activeIdleSlots(),capacity=2-idlePhrases.length;if(capacity<=0)return;
 const settled=Array.from({length:count},(_,i)=>i).filter(i=>!occupied.has(i)&&clock-started[i]>=jumpDuration);
 if(!settled.length)return;
 const index=settled[Math.floor(Math.random()*settled.length)],color=charge(fill,index);
 const maxTravelSlots=2;
 const candidates=settled.filter(j=>j!==index&&(j<count/2)===(index<count/2)&&Math.abs(slotLayout(j)[1]-slotLayout(index)[1])<.35&&Math.abs(j-index)<=maxTravelSlots&&(color===0||color===1)&&charge(fill,j)===color&&charge(target,j)===color&&charge(target,index)===color);
 const partner=candidates.length&&Math.random()<.65?candidates[Math.floor(Math.random()*candidates.length)]:-1;
 idlePhrases.push({at:clock,index,partner,strength:.30+Math.random()*.20,firstHop:{...pickTurns(),turns:1},secondHop:{...pickTurns(),turns:1},duration:jumpDuration+(partner>=0?exchangeHandoff:0)});wake();
 },1500);
}
function gain(amount){if(phase==='gone'||phase==='leaving')return;const next=clamp(target+amount);idlePhrases=idlePhrases.filter(p=>![p.index,p.partner].filter(i=>i>=0).some(i=>charge(fill,i)===0&&next*(count/2)>rank(i)));if(phase!=='fill')queue=clamp(queue+amount);else target=next;wake()}
function reset(){stopAuto();clearBoardEffects();fill=target=queue=0;entryIsBoard=true;started=Array(count).fill(-10000);turns=Array(count).fill(1);prepareEntry('reverse')}
function stopAuto(){auto=false;$('auto').setAttribute('aria-pressed','false');$('auto').textContent='▷ Auto ciklus'}
function clearBoardEffects(){cancelIdle();shards=[];smoke=[];landings=[];accents=Array.from({length:count},()=>pickAccent(-10000))}
function enterBoard(){
 stopAuto();clearBoardEffects();fill=target=queue=0;entryIsBoard=true;
 started=Array(count).fill(-10000);turns=Array(count).fill(1);
 prepareEntry('drop');
}
function beginRefill(mode){
 cancelIdle();landings=[];accents=Array.from({length:count},()=>pickAccent(-10000));
 fill=target=0;entryIsBoard=false;started=Array(count).fill(-10000);turns=Array(count).fill(1);
 // Debris keeps its existing epoch and falls over the incoming new row.
 prepareEntry(mode==='drop'||mode==='reverse'?mode:(Math.random()<.5?'drop':'reverse'));
}
function captureRebounds(impactVelocity){
 let velocity=impactVelocity*(.30+Math.random()*.06);
 const bounces=[],count=1+Math.floor(Math.random()*2);
 for(let i=0;i<count;i++){
 bounces.push({duration:contactDuration+2*velocity/boardGravity*1000,velocity});velocity*=.30+Math.random()*.08;
 }
 return bounces;
}
function reboundDuration(bounces){return bounces.reduce((total,b)=>total+b.duration,0)+80}
function boardDropHeight(){
 const width=canvasSizes.get($('mini'))?.width||$('mini').clientWidth||354;
 const side=(width-18)/((count-1)*slot+tileWidth)*tileHeight;
 return Math.max(.02,(48-2-side)/side);
}
function prepareEntry(mode){
 boardEntryMode=mode;
 labels.entering=(entryIsBoard?'DOLAZAK PLOČE':'NOVI RED')+(mode==='drop'?' · DROP ODOZGO':' · IZ NIČEGA PREMA GORE');
 const order=Array.from({length:count},(_,i)=>i);
 for(let i=count-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}
 boardPlans=Array(count);boardEnd=0;
 const rotating=new Set();
 for(let i=0,remaining=Math.round(count*.14);i<count&&remaining>0;i++)if(Math.random()<remaining/(count-i)){rotating.add(i);remaining--}
 order.forEach((index,rank)=>{
 if(boardEntryMode==='reverse'){
 const delay=rank*18+Math.random()*85,flight=360+Math.random()*150,total=flight+160;
 const profile={turns:rotating.has(index)?1:0,direction:Math.random()<.5?-1:1,lift:.65+Math.random()*1.15,shape:.85+Math.random()*.3};
 const bounces=captureRebounds(Math.sqrt(2*boardGravity*(2.1*.80*1.4*.30*profile.lift)));
 boardPlans[index]={sx:1,sy:1,angle:0,y:-tileHeight/2,delay,flight,duration:total,bounces,profile};
 boardEnd=Math.max(boardEnd,delay+total+reboundDuration(bounces));
 accents[index]=pickAccent(clock+delay+total+60);
 landings.push({index,at:clock+delay+total});return;
 }

 const delay=rank*22+Math.random()*45,height=boardDropHeight(),velocity=Math.random()*1.2;
 const fallSeconds=(Math.sqrt(velocity*velocity+2*boardGravity*height)-velocity)/boardGravity,duration=fallSeconds*1000;
 const bounces=captureRebounds(velocity+boardGravity*fallSeconds);
 boardPlans[index]={delay,duration,bounces,height,velocity,angle:(Math.random()<.5?-1:1)*Math.PI*2*(Math.random()<.75?1:2)};
 boardEnd=Math.max(boardEnd,delay+duration+reboundDuration(bounces));
 accents[index]=pickAccent(clock+delay+duration+60);
 landings.push({index,at:clock+delay+duration});
 });
 phase='entering';phaseAt=clock;wake();
}
function exitBoard(){
 if(phase==='gone'||phase==='leaving')return;
 const poses=rowPoses();stopAuto();target=fill;queue=0;clearBoardEffects();
 const order=Array.from({length:count},(_,i)=>i);
 for(let i=count-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}
 const rotating=new Set();
 for(let i=0,remaining=Math.round(count*.14);i<count&&remaining>0;i++)if(Math.random()<remaining/(count-i)){rotating.add(i);remaining--}
 boardPlans=Array(count);boardEnd=0;
 order.forEach((index,rank)=>{
 const delay=rank*18+Math.random()*85,flight=360+Math.random()*150;
 boardPlans[index]={...poses[index],delay,flight,profile:{turns:rotating.has(index)?1:0,direction:Math.random()<.5?-1:1,lift:.65+Math.random()*1.15,shape:.85+Math.random()*.3}};
 boardEnd=Math.max(boardEnd,delay+flight+160);
 });
 phase='leaving';phaseAt=clock;wake();
}
function boardPose(index){
 const elapsed=clock-phaseAt,plan=boardPlans[index];
 if(phase==='entering'){
 const age=elapsed-plan.delay;
 if(age<0)return {sx:0,sy:0,angle:0,y:0,destroyed:true};
 if(boardEntryMode==='reverse'&&age<plan.duration)return exitTilePose(plan,Math.max(0,plan.duration-age));
 if(age<plan.duration){
 const t=clamp(age/plan.duration),seconds=age/1000,angle=plan.angle*(1-t),sx=1-.035*Math.sin(t*Math.PI),sy=1+.05*Math.sin(t*Math.PI);
 const radius=(Math.abs(Math.sin(angle))*tileWidth*sx+Math.abs(Math.cos(angle))*tileHeight*sy)/2;
 return {sx,sy,angle,y:-radius-Math.max(0,plan.height-plan.velocity*seconds-.5*boardGravity*seconds*seconds)*tileHeight};
 }
 let reboundAge=age-plan.duration;
 for(const bounce of plan.bounces){
 if(reboundAge<bounce.duration){
 if(reboundAge<contactDuration){const contact=Math.sin(clamp(reboundAge/contactDuration)*Math.PI),strength=Math.min(1,bounce.velocity/8),sx=1+.25*contact*strength,sy=1-.23*contact*strength;return {sx,sy,angle:0,y:-tileHeight*sy/2}}
 const seconds=(reboundAge-contactDuration)/1000,t=clamp((reboundAge-contactDuration)/(bounce.duration-contactDuration)),stretch=Math.sin(t*Math.PI),sx=1-.045*stretch,sy=1+.07*stretch;
 const lift=Math.max(0,bounce.velocity*seconds-.5*boardGravity*seconds*seconds)*tileHeight;
 return {sx,sy,angle:0,y:-tileHeight*sy/2-lift};
 }
 reboundAge-=bounce.duration;
 }
 const settle=Math.sin(clamp(reboundAge/80)*Math.PI),sx=1+.05*settle,sy=1-.05*settle;
 return {sx,sy,angle:0,y:-tileHeight*sy/2};
 }
 return exitTilePose(plan,elapsed-plan.delay);
}
function exitTilePose(plan,age){
 if(plan.destroyed)return {sx:0,sy:0,angle:0,y:0,destroyed:true};
 if(age<0)return {sx:plan.sx,sy:plan.sy,angle:plan.angle,y:plan.y};
 if(age<plan.flight){
 const hop=jumpPose(age/plan.flight*440,false,plan.profile),t=out(age/100);
 const pose={sx:mix(plan.sx,hop.sx,t),sy:mix(plan.sy,hop.sy,t),angle:mix(plan.angle,hop.angle,t),y:mix(plan.y,hop.y,t)};
 const radius=(Math.abs(Math.sin(pose.angle))*tileWidth*pose.sx+Math.abs(Math.cos(pose.angle))*tileHeight*pose.sy)/2;
 pose.y=Math.min(pose.y,-radius);return pose;
 }
 // At floor contact shrink into the bottom anchor;no travel below ground.
 const t=clamp((age-plan.flight)/160),scale=1-out(t),sx=scale*(1+.30*Math.sin(t*Math.PI)),sy=scale*(1-t*.65);
 return {sx,sy,angle:0,y:-tileHeight*sy/2,destroyed:t>=1};
}
function setText(id,value){const node=$(id);if(node.textContent!==value)node.textContent=value}
// Ball Special's authored shape accents:1.26/.70 contact squash,
// .84/1.18 release stretch,then back.out(1.7) to the neutral shape.
// Adapted to one fixed-slot hop + captured1–3 complete turns + a small landing rebound.
function jumpPose(age,final=false,turnCount=1){
 const variation=typeof turnCount==='object'?turnCount:{turns:turnCount,direction:1,lift:1,shape:1};
 const strength=clamp(bounce/4,0,1.4);let sx=1,sy=1,angle=0,lift=0;
 if(age>=0&&age<60){const p=out(age/60);sx=mix(1,1.26,p);sy=mix(1,.70,p)}
 else if(age>=60&&age<115){const p=out((age-60)/55);sx=mix(1.26,.84,p);sy=mix(.70,1.18,p)}
 else if(age>=115&&age<205){const p=backOut((age-115)/90);sx=mix(.84,1,p);sy=mix(1.18,1,p)}
 if(age>=60&&age<440){const u=clamp((age-60)/380);lift=4*u*(1-u)*(final?2.8*.20:2.1*.80)*tileHeight;angle=(variation.turns?Math.PI*2*variation.turns*u*u*(3-2*u):0)*variation.direction}
 else if(age>=440&&age<490){const p=out((age-440)/50);sx=mix(1,1.22,p);sy=mix(1,.76,p)}
 else if(age>=490&&age<620){const u=clamp((age-490)/130);sx=mix(1.22,1,out(u));sy=mix(.76,1,out(u));lift=4*u*(1-u)*tileHeight*.28*(final?.20:.80);angle=variation.turns?Math.sin(u*Math.PI)*.10*variation.direction:0}

 sx=1+(sx-1)*strength*variation.shape;sy=1+(sy-1)*strength*variation.shape;angle*=Math.min(1,strength);lift*=strength*.30*variation.lift;
 // Centre rotation in flight, bottom anchoring on the ground. The rotated
 // rectangle's lowest corner can never pass the virtual floor.
 const radiusY=(Math.abs(Math.sin(angle))*tileWidth*sx+Math.abs(Math.cos(angle))*tileHeight*sy)/2;
 const y=Math.min(-radiusY,-tileHeight*sy/2-lift);
 return {sx,sy,angle,y};
}
function rowPoses(){return Array.from({length:count},(_,i)=>{
 let pose={sx:1,sy:1,angle:0,y:-tileHeight/2},alpha=1,amount=charge(fill,i),destroyed=false;
 if(phase==='entering'||phase==='leaving'){
 pose=boardPose(i);destroyed=!!pose.destroyed;amount=phase==='entering'?0:boardPlans[i].amount;
 }else if(phase==='gone'){destroyed=true;
 }else if(phase==='burst'){
 pose=burstPlans[i];amount=1;

 }else{
 const age=clock-started[i];pose=jumpPose(age,false,turns[i]);
 // Color develops during takeoff/flight,instead of finishing before the hop.
 amount*=out((age-60)/180);
 }
 let x=phase==='leaving'?mix(boardPlans[i].x,i*slot,out((clock-phaseAt-boardPlans[i].delay)/boardPlans[i].flight)):i*slot;
 if(phase==='fill')for(const p of idlePhrases){
 const age=clock-p.at;
 if(p.partner>=0){
 if(i===p.index||i===p.partner){
 const first=i===p.index,localAge=age-(first?0:exchangeHandoff),flight=clamp((localAge-60)/380),travel=flight*flight*(3-2*flight),direction=p.partner-p.index;
 // Both exchanges reuse the exact charging-hop squash/stretch,rotation,
 // low lift and landing rebound. Second takeoff overlaps at70percent flight.
 pose=jumpPose(localAge,false,first?p.firstHop:p.secondHop);
 x+=(first?1:-1)*direction*slot*travel;
 }
 }else{
 const u=clamp(age/jumpDuration),breath=Math.sin(u*Math.PI)**2;
 const swell=p.strength*breath*(1+.14*Math.sin(u*Math.PI*4)),extraWidth=tileWidth*swell*.48;
 if(i===p.index){pose.sx*=1+swell*.48;pose.sy*=1+swell;pose.y-=tileHeight*swell/2}
 else x+=(i<p.index?-1:1)*extraWidth/2;
 }
 const radius=(Math.abs(Math.sin(pose.angle))*tileWidth*pose.sx+Math.abs(Math.cos(pose.angle))*tileHeight*pose.sy)/2;
 pose.y=Math.min(pose.y,-radius);
 }
 return {...pose,x,alpha,amount,destroyed};
})}
function burst(){
 cancelIdle();landings=[];smoke=[];shards=[];
 burstDuration=300+(count/2-1)*42+520+speed;burstEnd=burstDuration+850;
 // Capture current poses before the paired color front hands off to the bag.
 burstPlans=Array.from({length:count},(_,i)=>({...jumpPose(clock-started[i],false,turns[i]),x:i*slot,color:1}));
}

function step(dt){clock+=dt;
 if(auto&&clock>=nextAuto){gain(.04+Math.random()*.085);nextAuto=clock+420+Math.random()*260}
 if(phase==='entering'&&clock-phaseAt>=boardEnd){phase='fill';fill=0;target=queue;queue=0}
 else if(phase==='leaving'&&clock-phaseAt>=boardEnd){phase='gone';started=Array(count).fill(-10000)}
 else if(phase==='fill'){
 const before=fill;fill=Math.min(target,fill+dt/900);
 for(let i=0;i<count;i++)if(started[i]<0&&before<=rank(i)/(count/2)&&fill>rank(i)/(count/2)){started[i]=clock;turns[i]=pickTurns();
 accents[i]=pickAccent(clock+100,'#E77449');landings.push({index:i,at:clock+440})}
 if(fill>=1){burst();phase='burst';phaseAt=clock;cycle++}
 }else if(phase==='burst'&&clock-phaseAt>=burstEnd){beginRefill()}
 advanceSmoke();
 setText('phase',labels[phase]);setText('progress',Math.round((['entering','gone'].includes(phase)?0:fill)*100)+'% NAPUNJENO'+(cycle?' · CIKLUS '+cycle:''));
}
function drawTile(ctx,width,height,amount){
 const stops=[0,.3,.6,1];let index=0;while(index<3&&amount>stops[index+1])index++;
 const blend=index===3?0:clamp((amount-stops[index])/(stops[index+1]-stops[index]));
 ctx.drawImage(sprites[index],-width/2,-height/2,width,height);
 if(blend>0){const alpha=ctx.globalAlpha;ctx.globalAlpha=alpha*blend;ctx.drawImage(sprites[index+1],-width/2,-height/2,width,height);ctx.globalAlpha=alpha}
}
const shadowSprite=document.createElement('canvas');shadowSprite.width=96;shadowSprite.height=32;
const shadowContext=shadowSprite.getContext('2d');shadowContext.scale(1,1/3);
const shadowGradient=shadowContext.createRadialGradient(48,48,0,48,48,48);
shadowGradient.addColorStop(0,'rgba(104,62,32,.48)');shadowGradient.addColorStop(.4,'rgba(112,66,34,.28)');shadowGradient.addColorStop(1,'rgba(112,77,46,0)');shadowContext.fillStyle=shadowGradient;shadowContext.fillRect(0,0,96,96);
// Prepaint a soft three-lobed cream dust puff once. Runtime only transforms it.
const smokeSprite=document.createElement('canvas');smokeSprite.width=96;smokeSprite.height=64;
const smokeContext=smokeSprite.getContext('2d');
for(const [x,y,r] of [[25,39,22],[48,27,26],[70,40,21]]){
 const g=smokeContext.createRadialGradient(x,y,r*.25,x,y,r);
 g.addColorStop(0,'rgba(249,231,210,.85)');g.addColorStop(.65,'rgba(238,210,178,.55)');g.addColorStop(1,'rgba(238,210,178,0)');
 smokeContext.fillStyle=g;smokeContext.fillRect(x-r,y-r,r*2,r*2);
}
function bagPose(){
 const age=clock-phaseAt;
 if(phase==='gone')return {scale:0,y:0};
 if(phase==='entering'&&entryIsBoard)return {scale:backOut(age/480,1.8),y:0};
 if(phase==='leaving')return {scale:1-out(age/400),y:-Math.sin(clamp(age/400)*Math.PI)*.2};
 if(phase!=='burst')return {scale:1,y:0};
 const t=age-burstDuration;
 if(t<0)return {scale:1,y:0};
 if(t<220){const u=t/220;return {scale:1+.20*Math.sin(u*Math.PI),y:-.30*Math.sin(u*Math.PI)}}
 if(t<400)return {scale:1-out((t-220)/180),y:0};
 if(t<470)return {scale:0,y:0};
 return {scale:backOut((t-470)/380,2),y:0};
}
function draw(canvas,poses){
 const size=canvasSizes.get(canvas);if(!size)return;
 const ctx=canvas.getContext('2d'),dpr=Math.min(devicePixelRatio||1,2),W=size.width,H=size.height;
 if(canvas.width!==Math.round(W*dpr)||canvas.height!==Math.round(H*dpr)){canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr)}
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
 const small=canvas.id==='mini',half=count/2,bagSize=W*.105,gap=bagSize*.72,base=small?H*.65:H*.68;
 const span=W*.45-gap,pitch=span/(half-1),side=pitch*1.06,unit=side/tileWidth,age=clock-phaseAt;
 const bag=bagPose(),bagBottom=base+side*.15+bag.y*bagSize;
 // The open image's cavity is above the foreground rim at y=.62.
 const bagOpen=phase==='burst'&&age<burstDuration+180;
 const openingIndex=bagOpen?Math.min(4,Math.floor((age<burstDuration?age:Math.max(0,260-(age-burstDuration)*1.45))/65)):0;
 const art=openingFrames[openingIndex],bagH=bagSize*art.naturalHeight/art.naturalWidth;
 const mouthX=W/2-bagSize*.035,mouthY=bagBottom-bagH*.31;
 const items=poses.map((p,i)=>{
 if(phase==='burst'){
 const settle=out(age/240);
 p={...p,sx:mix(p.sx,1,settle),sy:mix(p.sy,1,settle),angle:mix(p.angle,0,settle),y:mix(p.y,-tileHeight/2,settle)};
 }
 const left=i<half,r=rank(i),[along,depthY,z]=slotLayout(i),travel=clamp((p.x-i*slot)/slot,-2,2);
 let x=left?W*.05+side/2+along*span+travel*pitch:W*.95-side/2-along*span+travel*pitch;
 const perspective=.84+z*.26,ground=base+depthY*side;
 let scale=1,y=ground+p.y*unit*perspective,angle=p.angle,flying=false,done=false,shadow=1;
 if(phase==='burst'){
 const delay=300+(half-1-r)*42,flight=520+speed,t=clamp((age-delay)/flight);
 flying=age>=delay;done=t>=1;
 if(flying){
 // Both sides take matching airborne arcs,then fall into the upper cavity.
 const u=t*t*(3-2*t),lift=side*1.7+Math.abs(x-mouthX)*.22;
 x=mix(x,mouthX,u);y=mix(y,mouthY,t)-Math.sin(t*Math.PI)*lift;
 scale=1-.22*t-.60*clamp((t-.80)/.20);shadow=1-clamp(t*3);
 angle=p.angle*(1-t)+Math.sin(t*Math.PI)*(left?.35:-.35);
 }
 }
 return {p,i,z,x,y,ground,scale,perspective,angle,flying,done,shadow};
 }).filter(v=>!v.p.destroyed&&!v.done).sort((a,b)=>a.z-b.z);
 for(const {p,x,ground,scale,perspective,shadow} of items){
 const airborne=Math.max(0,-p.y-tileHeight/2)/tileHeight;
 ctx.save();ctx.globalAlpha=.72*shadow*scale*Math.min(1,Math.max(p.sx,p.sy))/(1+airborne*.5);const w=side*1.18*perspective,h=side*.22;
 ctx.drawImage(shadowSprite,x-w/2,ground-h*.35,w,h);ctx.restore();
 }
 function paintCube(item){const {p,i,x,y,scale,perspective,angle}=item;
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(p.sx*scale*perspective,p.sy*scale*perspective);drawTile(ctx,side,side,p.amount);ctx.restore();
 const accent=accents[i],at=clock-accent.at;
 if(at>=0&&at<accentDuration&&phase!=='burst')for(let j=0;j<accent.count;j++){
 const t=clamp((at-j*65)/450);if(!t||t>=1)continue;
 ctx.save();ctx.translate(x,y-side*.72);ctx.rotate(accent.angles[j]);ctx.scale(Math.sin(t*Math.PI),Math.sin(t*Math.PI));ctx.strokeStyle=accent.color;ctx.lineWidth=Math.max(1.2,side*.07);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,-side*.08);ctx.lineTo(0,-side*.28);ctx.stroke();ctx.restore();
 }
 }
 items.filter(v=>!v.flying).forEach(paintCube);
 // Back/cavity first. Incoming cubes can cross the open top,not the front panel.
 if(bag.scale>0){
 ctx.save();ctx.translate(W/2,bagBottom);ctx.scale(bag.scale,bag.scale);
 ctx.globalAlpha=.4;ctx.drawImage(shadowSprite,-bagSize*.63,-bagSize*.05,bagSize*1.26,bagSize*.22);ctx.globalAlpha=1;
 ctx.drawImage(art,-bagSize/2,-bagH,bagSize,bagH);ctx.restore();
 }
 items.filter(v=>v.flying).forEach(paintCube);
 if(bagOpen&&openingIndex===4&&bag.scale>0){
 // Repaint only the authored foreground lip/body over entering cubes.
 // Their trajectory ends below this lip,so they disappear INSIDE the bag.
 const rim=.615;
 ctx.save();ctx.translate(W/2,bagBottom);ctx.scale(bag.scale,bag.scale);
 ctx.drawImage(art,0,art.naturalHeight*rim,art.naturalWidth,art.naturalHeight*(1-rim),-bagSize/2,-bagH*(1-rim),bagSize,bagH*(1-rim));ctx.restore();
 }
}

function frame(time){raf=0;idlePhrases=idlePhrases.filter(p=>clock-p.at<p.duration);if(document.hidden){last=null;return}const dt=last===null?0:Math.min(50,time-last);last=time;step(dt);scheduleIdle();
 const hud=$('mini').previousElementSibling,elapsed=clock-phaseAt;
 hud.style.transform=phase==='entering'&&entryIsBoard?`translateY(${-60*(1-out(elapsed/420))}px)`:phase==='leaving'?`translateY(${-60*out(elapsed/420)}px)`:phase==='gone'?'translateY(-60px)':'none';
 hud.style.opacity=phase==='entering'&&entryIsBoard?String(out(elapsed/220)):phase==='leaving'?String(1-out(elapsed/300)):phase==='gone'?'0':'1';
 for(const id of ['add','addSix','finish','auto'])$(id).disabled=phase==='gone'||phase==='leaving';
 const poses=rowPoses();canvases.forEach(canvas=>draw(canvas,poses));
 if(idlePhrases.length||auto||shards.length||smoke.length||landings.length||['burst','entering','leaving'].includes(phase)||fill<target||accents.some(a=>clock-a.at<accentDuration)||started.some(t=>t>=0&&clock-t<jumpDuration))wake();else{last=null;scheduleIdle()}
}
$('enterBoard').onclick=()=>enterBoard();$('forceDrop').onclick=()=>beginRefill('drop');$('forceReverse').onclick=()=>beginRefill('reverse');$('exitBoard').onclick=exitBoard;
$('add').onclick=()=>gain(2/count);$('addSix').onclick=()=>gain(6/count);$('finish').onclick=()=>gain(1);$('reset').onclick=reset;
$('auto').onclick=()=>{auto=!auto;$('auto').setAttribute('aria-pressed',String(auto));$('auto').textContent=auto?'Ⅱ Zaustavi auto':'▷ Auto ciklus';nextAuto=clock+100;wake()};
$('speed').oninput=e=>{speed=+e.target.value;setText('speedValue',speed+' ms');wake()};
$('bounce').oninput=e=>{bounce=+e.target.value;setText('bounceValue',bounce===0?'Bez skoka':bounce<5?'Ball bounce':bounce<9?'Razigran':'Jak');wake()};
$('count').oninput=e=>{count=+e.target.value;setText('countValue',String(count));reset()};
window.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','BUTTON'].includes(document.activeElement.tagName)){e.preventDefault();gain(2/count)}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelIdle();cancelAnimationFrame(raf);raf=0;last=null}else wake()});
window.addEventListener('pagehide',()=>{cancelIdle();cancelAnimationFrame(raf);raf=0;last=null});window.addEventListener('pageshow',wake);
const resizeObserver=new ResizeObserver(entries=>{for(const entry of entries)canvasSizes.set(entry.target,{width:entry.contentRect.width,height:entry.contentRect.height});wake()});canvases.forEach(canvas=>resizeObserver.observe(canvas));
async function loadArt(){try{
 const sheet=new Image();sheet.src='./assets/selected-round-fill-states.png';backpackClosed.src='./assets/backpack-closed.png';backpackOpen.src='./assets/backpack-open.png';for(let i=1;i<4;i++)openingFrames[i].src=`./assets/backpack-opening-${[3,5,7][i-1]}.png`;await Promise.all([sheet.decode(),...openingFrames.map(image=>image.decode())]);
 for(let i=0;i<4;i++){const sprite=document.createElement('canvas');sprite.width=128;sprite.height=128;sprite.getContext('2d').drawImage(sheet,i*128,0,128,128,0,0,128,128);sprites.push(sprite)}
 artReady=true;wake();
}catch(error){setText('phase','PNG NIJE UČITAN — OSVJEŽI STRANICU');console.error('PNG loading failed',error)}}
enterBoard();loadArt();
