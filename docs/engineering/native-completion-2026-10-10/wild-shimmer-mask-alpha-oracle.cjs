const fs=require('fs');
(async()=>{
 const {MaskFilter}=await import('/Users/user/cube-crash/node_modules/pixi.js/lib/filters/mask/MaskFilter.mjs');
 const rows=[];
 for(const worldAlpha of [1,0.5,0.1,0.001,0]){
  const filter=Object.create(MaskFilter.prototype);
  filter.sprite={texture:{source:'original-artwork-source'},alpha:worldAlpha,worldAlpha};
  filter._textureMatrix={mapCoord:{}};
  filter.resources={filterUniforms:{uniforms:{uAlpha:1,uFilterMatrix:{prepend(){}}}}};
  filter.apply({calculateSpriteMatrix(matrix){return matrix},applyFilter(f){rows.push({worldAlpha,uAlpha:f.resources.filterUniforms.uniforms.uAlpha,source:f.resources.uMaskTexture})}},null,null,true);
 }
 if(rows.some(x=>x.uAlpha!==1))throw Error('unexpected mask alpha mutation');
 fs.writeFileSync('/tmp/native-completion-20261010-evidence/wild-shimmer-mask-alpha-oracle.json',JSON.stringify({authority:'actual installed MaskFilter.prototype.apply, explicit renderer matrix/filter endpoints; not original GPU render',rows},null,2));console.log(rows);
})().catch(e=>{console.error(e);process.exitCode=1});
