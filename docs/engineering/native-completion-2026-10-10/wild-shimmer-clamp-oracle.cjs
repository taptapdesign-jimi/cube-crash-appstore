const fs=require('fs');
(async()=>{
 const root='/Users/user/cube-crash/node_modules/pixi.js/lib';
 const {TextureMatrix}=await import(root+'/rendering/renderers/shared/texture/TextureMatrix.mjs');
 const {Texture}=await import(root+'/rendering/renderers/shared/texture/Texture.mjs');
 const {TextureSource}=await import(root+'/rendering/renderers/shared/texture/sources/TextureSource.mjs');
 const rows=[];
 for(const [w,h,resolution] of [[1,1,1],[8,8,2],[128,128,1],[256,256,2],[512,512,2],[171,128,1]]){
  const source=new TextureSource({width:w,height:h,resolution}),texture=new Texture({source});
  const matrix=new TextureMatrix(texture);matrix.update();
  rows.push({pixelWidth:source.pixelWidth,pixelHeight:source.pixelHeight,resolution,logicalWidth:texture.width,clampMargin:matrix.clampMargin,clamp:[...matrix.uClampFrame]});texture.destroy(true);
 }
 fs.writeFileSync('/tmp/native-completion-20261010-evidence/wild-shimmer-clamp-oracle.json',JSON.stringify({authority:'actual installed Pixi Texture/TextureSource/TextureMatrix; numeric resource-only oracle, not GPU',rows},null,2));console.log(rows);
})().catch(e=>{console.error(e);process.exitCode=1});
