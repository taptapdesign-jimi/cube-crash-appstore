// Mirrors NativeWildMeterConsumptionPlan (maximum normalized to 1).
// Clock supplied by each editor's existing RAF; no timer or retained renderer.
export const nativeBarCycleDuration=.83;
const clamp=v=>Math.max(0,Math.min(1,v));
export function nativeBarCyclePose(age,pendingRatio=0){
 const drainStart=.11,refillStart=.49;
 if(age<drainStart)return {left:0,right:1};
 if(age<refillStart){const p=clamp((age-drainStart)/.38),e=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;return {left:e,right:1};}
 const p=clamp((age-refillStart)/.34),q=p-1,e=1+2.35*q*q*q+1.35*q*q;
 return {left:0,right:Math.max(0,pendingRatio*e)};
}
