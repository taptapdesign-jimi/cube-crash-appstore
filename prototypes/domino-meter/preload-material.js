const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),rgb=hex=>hex.match(/\w\w/g).map(c=>parseInt(c,16));
export function buildPreloadMaterial(full,state,art){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');if(state.shape==='travel'){ctx.save();ctx.beginPath();ctx.roundRect(0,45,128,38,19);ctx.clip();ctx.fillStyle=full?preloadGradient(ctx,128,128,state):state.empty;ctx.fillRect(0,0,128,128);const gloss=ctx.createLinearGradient(0,45,0,83);gloss.addColorStop(0,`rgba(255,255,255,${state.highlight/300})`);gloss.addColorStop(.5,'rgba(255,255,255,0)');gloss.addColorStop(1,`rgba(98,49,29,${state.volume/600})`);ctx.fillStyle=gloss;ctx.fillRect(0,45,128,38);ctx.restore();return c;}if(full&&state.shape==='star-original'){const source=ctx.createImageData(128,128);source.data.set(art);ctx.putImageData(source,0,0);return c;}const pixels=ctx.createImageData(128,128),a=rgb(full?state.start:state.empty),b=rgb(full?state.end:state.empty),angle=state.angle*Math.PI/180,dx=Math.cos(angle),dy=Math.sin(angle),span=Math.abs(dx)+Math.abs(dy);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){const i=(y*128+x)*4,alpha=art[i+3];if(!alpha)continue;let t=state.gradient==='radial'?clamp(Math.hypot(x-45,y-35)/112):clamp(.5+((x/127-.5)*dx+(y/127-.5)*dy)/span);if(!full||state.gradient==='solid')t=0;
 const lum=.2126*art[i]+.7152*art[i+1]+.0722*art[i+2],light=(Math.max(0,lum-225)*state.highlight/65+Math.min(0,lum-225)*state.volume/100)*.75,grain=(((x*73856093^y*19349663)>>>0)%101/100-.5)*state.grain*.20;
 for(let k=0;k<3;k++)pixels.data[i+k]=clamp(a[k]+(b[k]-a[k])*t+light+grain,0,255);pixels.data[i+3]=alpha;
 }ctx.putImageData(pixels,0,0);return c;}
export function clipPreloadFill(ctx,w,h,a,state,time=0,tiltOffset=0){
 ctx.beginPath();if(a<=0){ctx.rect(0,0,0,0);ctx.clip();return;}if(a>=1){ctx.rect(-w/2,-h/2,w,h);ctx.clip();return;}
 const horizontal=['right','left'].includes(state.direction),length=horizontal?w:h,cross=horizontal?h:w;
 const point=(u,v)=>state.direction==='right'?[-w/2+u,-h/2+v]:state.direction==='left'?[w/2-u,-h/2+v]:state.direction==='up'?[-w/2+v,h/2-u]:[-w/2+v,-h/2+u];
 const move=(u,v)=>ctx.moveTo(...point(u,v)),line=(u,v)=>ctx.lineTo(...point(u,v));move(0,0);
 const strength=state.wave/100,amplitude=Math.min(cross,length*.8),phase=time*state.flowSpeed/100;
 for(let i=0;i<=32;i++){const t=i/32,v=t*cross;let wobble=0;
 if(state.fillStyle==='liquid')wobble=Math.sin(t*Math.PI*3+phase*3)*amplitude*.15*strength;
 if(state.fillStyle==='sludge')wobble=(Math.sin(t*8+phase*1.2)+.45*Math.sin(t*17-phase*.7))*amplitude*.20*strength;
 if(state.fillStyle==='jelly')wobble=Math.sin(t*Math.PI*2+phase*4)*amplitude*.25*strength*Math.cos(phase*.8);
 if(state.fillStyle==='gas')wobble=(Math.sin(t*13+phase*1.5)+Math.sin(t*21-phase))*amplitude*.13*strength;
 const tilt=Math.tan(clamp(state.frontAngle+(state.randomFrontAngle?tiltOffset:0),-70,70)*Math.PI/180)*(v-cross/2);
 line(clamp(length*a+wobble+tilt,0,length),v);
 }line(0,cross);ctx.closePath();ctx.clip();
}
export function preloadGradient(ctx,w,h,state){if(state.gradient==='solid')return state.start;const angle=state.angle*Math.PI/180,dx=Math.cos(angle)*w/2,dy=Math.sin(angle)*h/2;const g=state.gradient==='radial'?ctx.createRadialGradient(-w*.25,-h*.25,0,0,0,w*.65):ctx.createLinearGradient(-dx,-dy,dx,dy);g.addColorStop(0,state.start);g.addColorStop(1,state.end);return g;}

// Shared silhouette for holder, fill clipping and glow in both editors.
export function tracePreloadHolder(ctx,width,height,state){
 ctx.beginPath();
 if(state.barStyle==='trail'){traceTreasureTrail(ctx,width,height,state);return;}
 if(!state.taperEnds){ctx.roundRect(-width/2,-height/2,width,height,height/2);return;}
 const tip=state.taperTip/100,start=state.taperStart/100,end=state.taperEnd/100;
 const smooth=t=>{const u=clamp(t);return u*u*(3-2*u);};
 const half=u=>height/2*(tip+(1-tip)*Math.min(smooth(u/start),smooth((1-u)/end)));
 for(let i=0;i<=128;i++){const u=i/128,x=-width/2+u*width,y=-half(u);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
 for(let i=128;i>=0;i--){const u=i/128;ctx.lineTo(-width/2+u*width,half(u));}
 ctx.closePath();
}

function traceTreasureTrail(ctx,width,height,state){
 const startInset=state.trailMarkers?height*1.4:0,endInset=state.trailMarkers?height*1.8:0;
 const thickness=height*state.trailThickness/100,mark=Math.min(height*1.08,width*.09),right=width/2-mark*.75,dash=Math.max(height*.72,5),gap=dash*state.trailSpacing/100,length=Math.max(0,width-startInset-(state.trailMarkers?endInset:mark*1.9)),count=Math.max(1,Math.floor((length+gap)/(dash+gap))),pitch=length/count;
 // A gentle hand-drawn trail, sampled once from geometry (no jitter or extra clock).
 for(let i=0;i<count;i++){const u=(i+.5)/count,x=-width/2+startInset+(i+.5)*pitch,y=Math.sin(u*Math.PI*2)*height*.09,angle=Math.atan(Math.cos(u*Math.PI*2)*height*.09*Math.PI*2/Math.max(1,length));
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);const w=Math.min(dash,pitch*.85);ctx.roundRect(-w/2,-thickness/2,w,thickness,thickness/2);ctx.restore();
 }
 if(state.trailMarkers)return;
 const line=Math.max(thickness*.65,height*.12);
 for(const angle of [Math.PI/4,-Math.PI/4]){ctx.save();ctx.translate(right,0);ctx.rotate(angle-.10);ctx.roundRect(-mark/2,-line/2,mark,line,line/2);ctx.restore();}
}
