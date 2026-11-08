// One bounded plan per completed row; sampled by the editors' existing RAF.
export function createTravelCycle(count,at){
 const order=Array.from({length:count},(_,i)=>i);
 for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 const delays=Array(count);order.forEach((i,rank)=>delays[i]=.58+rank*.018+Math.random()*.045);
 return {at,count,delays,spin:Math.random()<.5?-1:1,duration:Math.max(.7,...delays.map(d=>d+.24))};
}
const clamp=v=>Math.max(0,Math.min(1,v));
export function travelCyclePose(plan,index,time,size){
 const age=time-plan.at;
 if(index===plan.count){
  if(age<.46){const u=clamp(age/.46),jump=4*u*(1-u);return {sx:1-.13*jump,sy:1+.2*jump,y:-size*.65*jump,angle:plan.spin*Math.PI*2*u*u*(3-2*u)};}
 }
 const start=index===plan.count?.46:plan.delays[index],u=clamp((age-start)/.24),e=u*u*(3-2*u);
 return {sx:(1-e)*(1+.2*Math.sin(u*Math.PI)),sy:Math.max(0,1-e),y:size*e*.5,angle:0};
}
