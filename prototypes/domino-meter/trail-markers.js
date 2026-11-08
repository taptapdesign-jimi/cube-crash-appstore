const assets={};let preparation;
export function prepareTrailMarkers(){return preparation??=Promise.all([['flag','treasure-flag.svg'],['chest','treasure-chest-open-hq.png'],['x','../../board-editor/assets/close.png']].map(async([id,name])=>{const image=new Image();image.src=new URL('./cube-editor/assets/'+name,import.meta.url);await image.decode();assets[id]=image;}));}
export function drawTrailMarkers(ctx,width,height,state,curveAt){
 if(state.barStyle!=='trail'||!state.trailMarkers||!assets.flag||!assets.chest)return;
 for(const[id,side,ratio]of [['flag',-1,1.41],['chest',1,1.412]]){
  const h=height*1.65,w=height*ratio,x=side<0?-width/2+w/2:width/2-w/2,curve=curveAt?.(x+width/2)??{drop:0,slope:0};
  ctx.save();ctx.translate(x,curve.drop);ctx.rotate(Math.atan(curve.slope));if(id==='chest')ctx.drawImage(assets[id],216,124,890,1040,-w/2,height*.45-h,w,h);else ctx.drawImage(assets[id],-w/2,height*.45-h,w,h);ctx.restore();
 }
}

let travelXMaterial=null;
export function drawTravelEnd(ctx,x,y,size,angle=0,color='#d8cbbb',fill=0,fullColor='#e77b4b'){
 if(!assets.x)return;
 const key=color+fullColor;
 if(travelXMaterial?.key!==key){
  const tint=color=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');c.drawImage(assets.x,0,0,128,128);c.globalCompositeOperation='source-in';c.fillStyle=color;c.fillRect(0,0,128,128);return canvas;};
  travelXMaterial={key,empty:tint(color),full:tint(fullColor)};
 }
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.drawImage(travelXMaterial.empty,-size/2,-size/2,size,size);
 if(fill>0){ctx.save();ctx.beginPath();ctx.rect(-size/2,-size/2,size*Math.min(1,fill),size);ctx.clip();ctx.drawImage(travelXMaterial.full,-size/2,-size/2,size,size);ctx.restore();}ctx.restore();
}
