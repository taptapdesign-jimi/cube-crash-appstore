import {shardPatterns} from './shard-patterns.js';
const $=id=>document.getElementById(id),canvases=[$('scene'),$('mini')];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),out=t=>1-(1-clamp(t))**3;
const mix=(a,b,t)=>a+(b-a)*t,backOut=(t,s=1.7)=>{const u=clamp(t)-1;return 1+u*u*((s+1)*u+s)};
const tileWidth=.72*.60,tileHeight=tileWidth,slot=tileWidth*.98;
const jumpDuration=620,reverseBreakAt=150;
const hudBackpack=new Image(),hudBackpackOpen=new Image();
const hudBagFrames=[hudBackpack,new Image(),new Image(),new Image(),hudBackpackOpen];
let lastMagnetArrival=-10000;
let count=24,fill=0,target=0,queue=0,phase='gone',phaseAt=0,clock=0,last=null,raf=0,auto=false,nextAuto=0;
let started=Array(count).fill(-10000),shards=[],patternIndex=0,cycle=0,speed=200,burstDuration=200,bounce=12;
let turns=Array(count).fill(1),burstPlans=[],burstEnd=0,shardsEpoch=0,shardsUntil=0;
function pickTurns(){return {turns:Math.random()<.5?0:1,direction:Math.random()<.5?-1:1,lift:(Math.random()<.5?1.45:1.45*.60)*(.92+Math.random()*.16),shape:.85+Math.random()*.30}}
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
let boardPlans=[],boardEnd=0,entryIsBoard=true;
const boardGravity=48,contactDuration=26; // tile-heights / second²
const labels={entering:'DOLAZAK PLOČE · RANDOM DROP',leaving:'KRAJ IGRE · SKOK I SKUPLJANJE',gone:'PLOČA ZATVORENA',fill:'NAPUNI I SKOČI',burst:'POP → SLIJEVA NADESNO!',};
function wake(){if(artReady&&!raf&&!document.hidden)raf=requestAnimationFrame(frame)}
// One sleeping timeout admits a finite idle phrase; the existing RAF paints it.
let idleTimer=0,idlePhrases=[];
function activeIdleSlots(){return new Set(idlePhrases.flatMap(p=>p.partner>=0?[p.index,p.partner]:[p.index]))}
// smoothstep(.636742509)=.70: handoff follows distance,not elapsed time.
const flightScale=p=>Math.sqrt(1.4*(typeof p==='object'?p.lift:1));
const landingAge=p=>60+380*flightScale(p),hopDuration=p=>landingAge(p)+180;
const exchangeHandoff=p=>60+380*flightScale(p)*.636742509;
function cancelIdle(){clearTimeout(idleTimer);idleTimer=0;idlePhrases=[]}
function scheduleIdle(){
 if(idleTimer||idlePhrases.length>=2||document.hidden||phase!=='fill')return;
 idleTimer=setTimeout(()=>{
 idleTimer=0;if(document.hidden||phase!=='fill')return;
 const occupied=activeIdleSlots(),capacity=2-idlePhrases.length;if(capacity<=0)return;
 const settled=Array.from({length:count},(_,i)=>i).filter(i=>!occupied.has(i)&&clock-started[i]>=hopDuration(turns[i]));
 if(!settled.length)return;
 const index=settled[Math.floor(Math.random()*settled.length)],color=clamp(fill*count-index);
 const maxTravelSlots=2;
 const candidates=settled.filter(j=>j!==index&&Math.abs(j-index)<=maxTravelSlots&&(color===0||color===1)&&clamp(fill*count-j)===color&&clamp(target*count-j)===color&&clamp(target*count-index)===color);
 const partner=candidates.length&&Math.random()<.65?candidates[Math.floor(Math.random()*candidates.length)]:-1;
 const firstHop={...pickTurns(),turns:1},secondHop={...pickTurns(),turns:1};idlePhrases.push({at:clock,index,partner,strength:.30+Math.random()*.20,firstHop,secondHop,duration:partner>=0?Math.max(hopDuration(firstHop),exchangeHandoff(firstHop)+hopDuration(secondHop)):jumpDuration});wake();
 },1500);
}
function gain(amount){if(phase==='gone'||phase==='leaving')return;const next=clamp(target+amount);idlePhrases=idlePhrases.filter(p=>![p.index,p.partner].filter(i=>i>=0).some(i=>clamp(fill*count-i)===0&&next*count>i));if(phase!=='fill')queue=clamp(queue+amount);else target=next;wake()}
function reset(){stopAuto();clearBoardEffects();fill=target=queue=0;entryIsBoard=true;started=Array(count).fill(-10000);turns=Array(count).fill(1);prepareEntry('reverse')}
function stopAuto(){auto=false;$('auto').setAttribute('aria-pressed','false');$('auto').textContent='▷ Auto ciklus'}
function clearBoardEffects(){lastMagnetArrival=-10000;for(const size of canvasSizes.values())size.bagOpen=0;cancelIdle();shards=[];smoke=[];landings=[];accents=Array.from({length:count},()=>pickAccent(-10000))}
function enterBoard(){
 stopAuto();clearBoardEffects();fill=target=queue=0;entryIsBoard=true;
 started=Array(count).fill(-10000);turns=Array(count).fill(1);
 prepareEntry('reverse');
}
function beginRefill(mode){
 cancelIdle();landings=[];accents=Array.from({length:count},()=>pickAccent(-10000));
 fill=target=0;entryIsBoard=false;started=Array(count).fill(-10000);turns=Array(count).fill(1);
 // Debris keeps its existing epoch and falls over the incoming new row.
 prepareEntry('reverse');
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
function prepareEntry(mode){
 labels.entering=(entryIsBoard?'DOLAZAK PLOČE':'NOVI RED')+' · IZ NIČEGA PREMA GORE';
 const order=Array.from({length:count},(_,i)=>i);
 for(let i=count-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}
 boardPlans=Array(count);boardEnd=0;
 const rotating=new Set();
 for(let i=0,remaining=Math.round(count*.14);i<count&&remaining>0;i++)if(Math.random()<remaining/(count-i)){rotating.add(i);remaining--}
 order.forEach((index,rank)=>{
 const delay=rank*18+Math.random()*85;
 const profile={turns:rotating.has(index)?1:0,direction:Math.random()<.5?-1:1,lift:(.65+Math.random()*1.15)*(entryIsBoard?1:.5),shape:.85+Math.random()*.3};
 const peak=2.1*.80*1.4*.30*1.4*profile.lift,flight=60+2*Math.sqrt(2*peak/boardGravity)*1000,total=flight+160;
 const bounces=captureRebounds(Math.sqrt(2*boardGravity*peak));
 boardPlans[index]={sx:1,sy:1,angle:0,y:-tileHeight/2,delay,flight,duration:total,bounces,profile};
 boardEnd=Math.max(boardEnd,delay+total+reboundDuration(bounces));
 accents[index]=pickAccent(clock+delay+total+60);
 landings.push({index,at:clock+delay+total});
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
 if(age<plan.duration)return exitTilePose(plan,Math.max(0,plan.duration-age));
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
 const hop=jumpPose(age/plan.flight*landingAge(plan.profile),false,plan.profile),t=out(age/100);
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
 const stretch=flightScale(variation),extra=380*(stretch-1);if(age>=60)age=age<60+380*stretch?60+(age-60)/stretch:age-extra;
 const strength=clamp(bounce/4,0,1.4);let sx=1,sy=1,angle=0,lift=0;
 if(age>=0&&age<60){const p=out(age/60);sx=mix(1,1.26,p);sy=mix(1,.70,p)}
 else if(age>=60&&age<115){const p=out((age-60)/55);sx=mix(1.26,.84,p);sy=mix(.70,1.18,p)}
 else if(age>=115&&age<205){const p=backOut((age-115)/90);sx=mix(.84,1,p);sy=mix(1.18,1,p)}
 if(age>=60&&age<440){const u=clamp((age-60)/380);lift=4*u*(1-u)*(final?2.8*.20:2.1*.80)*tileHeight;angle=(variation.turns?Math.PI*2*variation.turns*u*u*(3-2*u):0)*variation.direction}
 else if(age>=440&&age<490){const p=out((age-440)/50);sx=mix(1,1.22,p);sy=mix(1,.76,p)}
 else if(age>=490&&age<620){const u=clamp((age-490)/130);sx=mix(1.22,1,out(u));sy=mix(.76,1,out(u));lift=4*u*(1-u)*tileHeight*.28*(final?.20:.80);angle=variation.turns?Math.sin(u*Math.PI)*.10*variation.direction:0}

 sx=1+(sx-1)*strength*variation.shape;sy=1+(sy-1)*strength*variation.shape;angle*=Math.min(1,strength);lift*=strength*.30*variation.lift*1.4;
 // Centre rotation in flight, bottom anchoring on the ground. The rotated
 // rectangle's lowest corner can never pass the virtual floor.
 const radiusY=(Math.abs(Math.sin(angle))*tileWidth*sx+Math.abs(Math.cos(angle))*tileHeight*sy)/2;
 const y=Math.min(-radiusY,-tileHeight*sy/2-lift);
 return {sx,sy,angle,y};
}
function rowPoses(){return Array.from({length:count},(_,i)=>{
 let pose={sx:1,sy:1,angle:0,y:-tileHeight/2},alpha=1,amount=clamp(fill*count-i),destroyed=false;
 if(phase==='entering'||phase==='leaving'){
 pose=boardPose(i);destroyed=!!pose.destroyed;amount=phase==='entering'?0:boardPlans[i].amount;
 }else if(phase==='gone'){destroyed=true;
 }else if(phase==='burst'){
 const elapsed=clock-phaseAt,plan=burstPlans[i];pose=endingPose(plan,elapsed);destroyed=elapsed>=plan.breakDelay;
 amount=mix(plan.color,1,out(elapsed/Math.max(16,burstPlans[count-1].breakDelay)));

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
 const first=i===p.index,localAge=age-(first?0:exchangeHandoff(p.firstHop)),flight=clamp((localAge-60)/(380*flightScale(first?p.firstHop:p.secondHop))),travel=flight*flight*(3-2*flight),direction=p.partner-p.index;
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
// The last tile continues its current charging hop: no landing/reset first.
// Waiting tiles retain their current pose; reverse takeoffs blend continuously
// into the much lower final hop rather than snapping back to the floor.
function endingPose(plan,elapsed){
 if(plan.last&&!plan.fresh)return jumpPose(plan.carryAge+elapsed,false,plan.carryTurns);
 if(elapsed<plan.delay)return jumpPose(plan.carryAge+elapsed,false,plan.carryTurns);
 const age=elapsed-plan.delay,p=jumpPose(age,true,plan.turns),t=out(age/120),from=plan.from;
 const pose={sx:mix(from.sx,p.sx,t),sy:mix(from.sy,p.sy,t),angle:from.angle+p.angle*t,y:mix(from.y,p.y,t)};
 const radius=(Math.abs(Math.sin(pose.angle))*tileWidth*pose.sx+Math.abs(Math.cos(pose.angle))*tileHeight*pose.sy)/2;
 pose.y=Math.min(pose.y,-radius);return pose;
}
function burst(){
 cancelIdle();burstDuration=speed;shardsEpoch=clock;landings=[];
 // Capture one forward wave. Every cube keeps its current pose until its
 // low final hop starts; destruction follows the same left-to-right order.
 burstPlans=Array.from({length:count},(_,i)=>{
 const carryAge=clock-started[i],delay=i*burstDuration/Math.max(1,count-1);
 return {last:false,fresh:true,carryAge,carryTurns:turns[i],turns:pickTurns(),delay,breakDelay:delay+reverseBreakAt,from:jumpPose(carryAge+delay,false,turns[i]),color:out((carryAge-60)/180)};
 });
 shards=Array.from({length:count},(_,tileIndex)=>{
 const pattern=shardPatterns[patternIndex++%shardPatterns.length],plan=burstPlans[tileIndex],peak=endingPose(plan,plan.breakDelay);
 const pool=pattern.filter((_,i)=>i%3!==2),keep=Math.floor((tileIndex+1)*pool.length*.60)-Math.floor(tileIndex*pool.length*.60);
 return Array.from({length:keep},(_,i)=>pool[Math.floor((i+.5)*pool.length/keep)]).map(d=>{
 const width=(8+Math.random()*10)*d.size*2.4*1.18,height=width*(.8+Math.random()*1.4),n=4+Math.floor(Math.random()*4),points=[];
 for(let j=0;j<n;j++){const a=j/n*Math.PI*2+(Math.random()-.5)*.8,r=(.3+Math.random()*.7)*Math.min(width,height)/2;points.push([Math.cos(a)*r,Math.sin(a)*r])}
 const angle=d.angle*Math.PI/180+(Math.random()-.5)*1.1,orange=['#E77449','#EE8656','#DA6439','#F39362'];
 return {originX:tileIndex*slot,originY:peak.y,startDelay:plan.breakDelay,points,radius:Math.max(...points.map(([x,y])=>Math.hypot(x,y))),rotation:Math.random()*Math.PI,spin:(Math.random()-.5)*18,
 color:Math.random()<.85?orange[Math.floor(Math.random()*orange.length)]:'#D4A584',alpha:d.alpha,
 vx:Math.cos(angle)*(140+Math.random()*200)+(Math.random()-.5)*120,vy:-(160+Math.random()*220),x:0,y:0,age:0,life:0,scatter:.065+Math.random()*.075,flight:.23+Math.random()*.20,curve:(Math.random()-.5)*2,arrived:false};
 });}).flat();
 // Each shard scatters briefly,then accelerates on its captured magnetic arc.
 for(const shard of shards)shard.life=shard.scatter+shard.flight;
 shardsUntil=shardsEpoch+Math.max(...shards.map(s=>s.startDelay+s.life*1000));
 // New cubes still enter from below while the last few shards are collected.
 burstEnd=Math.max(...burstPlans.map(p=>p.breakDelay),shardsUntil-shardsEpoch-90);
}
function advanceShards(){
 const elapsed=clock-shardsEpoch;
 for(const s of shards){
 s.age=Math.max(0,(elapsed-s.startDelay)/1000);
 if(!s.arrived&&s.age>=s.life){s.arrived=true;lastMagnetArrival=clock;}
 s.paintRotation=s.rotation+s.spin*Math.min(s.age,s.life);
 }
 if(clock>=shardsUntil)shards=[];
}

function step(dt){clock+=dt;
 if(auto&&clock>=nextAuto){gain(.04+Math.random()*.085);nextAuto=clock+420+Math.random()*260}
 if(phase==='entering'&&clock-phaseAt>=boardEnd){phase='fill';fill=0;target=queue;queue=0}
 else if(phase==='leaving'&&clock-phaseAt>=boardEnd){phase='gone';started=Array(count).fill(-10000)}
 else if(phase==='fill'){
 const before=fill;fill=Math.min(target,fill+dt/900);
 for(let i=0;i<count;i++)if(started[i]<0&&before<=i/count&&fill>i/count){started[i]=clock;turns[i]=pickTurns();
 accents[i]=pickAccent(clock+240,'#E77449');landings.push({index:i,at:clock+landingAge(turns[i])})}
 if(fill>=1){burst();phase='burst';phaseAt=clock;cycle++}
 }else if(phase==='burst'&&clock-phaseAt>=burstEnd){beginRefill()}
 if(shards.length)advanceShards();advanceSmoke();
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
function draw(canvas,poses,dt){const size=canvasSizes.get(canvas);if(!size)return;const ctx=canvas.getContext('2d'),dpr=Math.min(devicePixelRatio||1,2),W=size.width,H=size.height;
 if(canvas.width!==Math.round(W*dpr)||canvas.height!==Math.round(H*dpr)){canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr)}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
 const small=canvas.id==='mini',available=W-(small?18:W*.14),unit=available/((count-1)*slot+tileWidth),width=unit*tileWidth,height=unit*tileHeight,baseline=small?88:H*.70,padding=W/2-(count-1)*slot*unit/2;
 for(const pose of poses){if(pose.destroyed)continue;const airborne=Math.max(0,-pose.y-tileHeight/2)/tileHeight,shadowW=width*(.88*1.40)/(1+airborne*.18),shadowH=Math.max(2,height*.22);
 ctx.save();ctx.globalAlpha=pose.alpha*Math.min(1,Math.max(pose.sx,pose.sy))*.95/(1+airborne*.5);ctx.drawImage(shadowSprite,padding+pose.x*unit-shadowW/2,baseline-shadowH*.25-2,shadowW,shadowH);ctx.restore()}
 for(const puff of smoke){const t=clamp((clock-puff.at)/460),spread=out(t),w=width*(.5+spread*.95),h=height*(.26+spread*.35);
 ctx.save();ctx.globalAlpha=.70*(1-t)*(1-t);ctx.drawImage(smokeSprite,padding+puff.x*unit+puff.side*width*(.22+spread*.48)-w/2,baseline-h-height*.12*spread,w,h);ctx.restore()}
 ctx.save();ctx.beginPath();ctx.rect(0,0,W,baseline);ctx.clip();
 for(const pose of poses){if(pose.destroyed)continue;ctx.save();ctx.translate(padding+pose.x*unit,baseline+pose.y*unit);ctx.rotate(pose.angle);ctx.scale(pose.sx,pose.sy);ctx.globalAlpha=pose.alpha;drawTile(ctx,width,height,pose.amount);ctx.restore()}
 ctx.restore();
 // Only fully orange cubes show the charging celebration. Empty/partial cubes stay quiet.
 for(let index=0;index<count;index++){
 const accent=accents[index],accentAge=clock-accent.at,pose=poses[index];
 if(accentAge<0||accentAge>=accentDuration||pose.destroyed||pose.amount<.999)continue;
 const radius=(Math.abs(Math.sin(pose.angle))*width*pose.sx+Math.abs(Math.cos(pose.angle))*height*pose.sy)/2;
 const x=padding+pose.x*unit,y=baseline+pose.y*unit-radius-height*.20;
 for(let i=0;i<accent.count;i++){
 const age=accentAge-i*65;if(age<0)continue;
 const scale=Math.max(0,backOut(age/240,2.8)),fade=1-out((age-470)/180),angle=accent.angles[i];
 ctx.save();ctx.globalAlpha=fade;ctx.translate(x+Math.sin(angle)*width*.35,y-Math.cos(angle)*height*.12);ctx.rotate(angle);ctx.scale(scale*(1+.12*Math.sin(clamp(age/300)*Math.PI)),scale);
 ctx.lineCap='round';ctx.lineWidth=Math.max(1.4,width*.105);ctx.strokeStyle=accent.color;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-height*(Math.abs(angle)<.1?.32:.24));ctx.stroke();ctx.restore();
 }
 }
 // Same target geometry is cached with resize;no layout reads in the frame loop.
 const target=size.backpackTarget ?? {x:W*.275,y:small?17:H*.17};
 const pulseAge=clock-lastMagnetArrival,pulse=pulseAge>=0&&pulseAge<260?Math.sin(pulseAge/260*Math.PI)*.16:0;
 let nearBackpack=false;
 for(const s of shards){
 if(clock-shardsEpoch<s.startDelay||s.age>=s.life)continue;
 const scale=height/100,scatterTime=Math.min(s.age,s.scatter);
 const fromX=padding+s.originX*unit,fromY=baseline+s.originY*unit;
 const scatterX=s.vx*(1-Math.exp(-2.4*scatterTime))/2.4*scale;
 const scatterY=(s.vy*scatterTime+.5*1050*scatterTime*scatterTime)*scale;
 let x=fromX+scatterX,y=fromY+scatterY,shrink=1;
 if(s.age>s.scatter){
 const t=clamp((s.age-s.scatter)/s.flight),u=t*t,one=1-u;
 const startX=fromX+scatterX,startY=fromY+scatterY;
 const dx=target.x-startX,dy=target.y-startY;
 const c1x=startX+s.vx*scale*.16+s.curve*width*1.8,c1y=startY-Math.abs(s.vy)*scale*.13;
 const c2x=target.x+s.curve*width*2.2-dx*.10,c2y=target.y+Math.abs(dy)*.30;
 x=one**3*startX+3*one*one*u*c1x+3*one*u*u*c2x+u**3*target.x;
 y=one**3*startY+3*one*one*u*c1y+3*one*u*u*c2y+u**3*target.y;
 shrink=1-.86*clamp((t-.65)/.35);
 }
 if(s.age>s.scatter&&Math.hypot(x-target.x,y-target.y)<18)nearBackpack=true;
 ctx.save();ctx.globalAlpha=s.alpha;ctx.translate(x,y);ctx.rotate(s.paintRotation);ctx.scale(scale*shrink,scale*shrink);ctx.fillStyle=s.color;ctx.beginPath();s.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();ctx.restore();
 }
 size.bagOpen=clamp((size.bagOpen??0)+(nearBackpack?dt/45:-dt/60));
 if(!small){const bag=hudBagFrames[Math.round(size.bagOpen*4)],w=36;
 ctx.save();ctx.translate(target.x,target.y+4);ctx.scale(1+pulse,1-pulse*.5);ctx.drawImage(bag,-w/2,-w/2,w,w);ctx.restore();}

}
function frame(time){raf=0;idlePhrases=idlePhrases.filter(p=>clock-p.at<p.duration);if(document.hidden){last=null;return}const dt=last===null?0:Math.min(50,time-last);last=time;step(dt);scheduleIdle();
 const hud=$('mini').previousElementSibling,elapsed=clock-phaseAt;
 hud.style.transform=phase==='entering'&&entryIsBoard?`translateY(${-60*(1-out(elapsed/420))}px)`:phase==='leaving'?`translateY(${-60*out(elapsed/420)}px)`:phase==='gone'?'translateY(-60px)':'none';
 hud.style.opacity=phase==='entering'&&entryIsBoard?String(out(elapsed/220)):phase==='leaving'?String(1-out(elapsed/300)):phase==='gone'?'0':'1';
 for(const id of ['add','addSix','finish','auto'])$(id).disabled=phase==='gone'||phase==='leaving';
 const poses=rowPoses();canvases.forEach(canvas=>draw(canvas,poses,dt));
 const icon=$('backpackTarget'),bagFrame=Math.round((canvasSizes.get($('mini'))?.bagOpen??0)*4);
 if(icon.dataset.frame!==String(bagFrame)){icon.src=hudBagFrames[bagFrame].src;icon.dataset.frame=String(bagFrame);}
 const impactAge=clock-lastMagnetArrival,impact=impactAge>=0&&impactAge<260?Math.sin(impactAge/260*Math.PI)*.16:0;
 icon.style.transform=`scale(${1+impact},${1-impact*.5})`;
 if(canvases.some(c=>(canvasSizes.get(c)?.bagOpen??0)>0)||clock-lastMagnetArrival<260||idlePhrases.length||auto||shards.length||smoke.length||landings.length||['burst','entering','leaving'].includes(phase)||fill<target||accents.some(a=>clock-a.at<accentDuration)||started.some((t,i)=>t>=0&&clock-t<hopDuration(turns[i])))wake();else{last=null;scheduleIdle()}
}
$('enterBoard').onclick=()=>enterBoard();$('forceReverse').onclick=()=>beginRefill('reverse');$('exitBoard').onclick=exitBoard;
$('add').onclick=()=>gain(1/count);$('addSix').onclick=()=>gain(6/count);$('finish').onclick=()=>gain(1);$('reset').onclick=reset;
$('auto').onclick=()=>{auto=!auto;$('auto').setAttribute('aria-pressed',String(auto));$('auto').textContent=auto?'Ⅱ Zaustavi auto':'▷ Auto ciklus';nextAuto=clock+100;wake()};
$('speed').oninput=e=>{speed=+e.target.value;setText('speedValue',speed+' ms');wake()};
$('bounce').oninput=e=>{bounce=+e.target.value;setText('bounceValue',bounce===0?'Bez skoka':bounce<5?'Ball bounce':bounce<9?'Razigran':'Jak');wake()};
$('count').oninput=e=>{count=+e.target.value;setText('countValue',String(count));reset()};
window.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','BUTTON'].includes(document.activeElement.tagName)){e.preventDefault();gain(1/count)}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelIdle();cancelAnimationFrame(raf);raf=0;last=null}else wake()});
window.addEventListener('pagehide',()=>{cancelIdle();cancelAnimationFrame(raf);raf=0;last=null});window.addEventListener('pageshow',wake);
const resizeObserver=new ResizeObserver(entries=>{
 for(const entry of entries){
 const size={width:entry.contentRect.width,height:entry.contentRect.height};
 if(entry.target.id==='mini'){
 const canvas=entry.target,icon=$('backpackTarget'),hud=canvas.previousElementSibling;
 const iconRect=icon.getBoundingClientRect(),hudRect=hud.getBoundingClientRect();
 size.backpackTarget={x:iconRect.left-hudRect.left+iconRect.width/2,y:hud.offsetTop-canvas.offsetTop+iconRect.top-hudRect.top+iconRect.height/2-4};
 }
 canvasSizes.set(entry.target,size);
 }wake();
});canvases.forEach(canvas=>resizeObserver.observe(canvas));
$('previewMagnet').onclick=()=>{
 if(!artReady)return;stopAuto();clearBoardEffects();fill=target=1;queue=0;started=Array(count).fill(clock-1000);turns=Array(count).fill(0);
 burst();phase='burst';phaseAt=clock;cycle++;wake();
};

async function loadArt(){try{
 const sheet=new Image();sheet.src='./assets/selected-round-fill-states.png';hudBackpack.src='./assets/native-reference/backpack.png';hudBackpackOpen.src='./assets/backpack-open.png';for(let i=1;i<4;i++)hudBagFrames[i].src=`./assets/backpack-opening-${[3,5,7][i-1]}.png`;await Promise.all([sheet.decode(),...hudBagFrames.map(image=>image.decode())]);
 for(let i=0;i<4;i++){
 const sprite=document.createElement('canvas');sprite.width=128;sprite.height=128;
 const context=sprite.getContext('2d');context.drawImage(sheet,i*128,0,128,128,0,0,128,128);
 // Repaint both materials once: flat bodies with positive reflections only.
 const emptyBottom=[128,86,52,0][i];
 const pixels=context.getImageData(0,0,128,128),data=pixels.data;
 for(let p=0;p<data.length;p+=4){if(!data[p+3])continue;
 const luminance=.2126*data[p]+.7152*data[p+1]+.0722*data[p+2];
 const empty=Math.floor(p/4/128)<emptyBottom;
 const highlight=Math.max(0,luminance-(empty?228:159.1434))*.65;
 data[p]=clamp((empty?231:244)+highlight,0,255);
 data[p+1]=clamp((empty?223:141)+highlight,0,255);
 data[p+2]=clamp((empty?215:89)+highlight,0,255);
 }context.putImageData(pixels,0,0);
 sprites.push(sprite);
 }
 artReady=true;wake();
}catch(error){setText('phase','PNG NIJE UČITAN — OSVJEŽI STRANICU');console.error('PNG loading failed',error)}}
enterBoard();loadArt();
