const fs=require('fs');
(async()=>{
 const {getResolutionOfUrl}=await import('/Users/user/cube-crash/node_modules/pixi.js/lib/utils/network/getResolutionOfUrl.mjs');
 const paths=['assets/bee.png','assets/bee@2x.png','assets/bee@3x.png','assets/bee@0.5x.png','assets/bee@2.5x.png'];
 const rows=paths.map(path=>({path,resolution:getResolutionOfUrl(path)}));
 fs.writeFileSync('/tmp/native-completion-20261010-evidence/wild-shimmer-resolution-oracle.json',JSON.stringify({authority:'actual installed original getResolutionOfUrl; numeric URI resolution only',rows},null,2));console.log(rows);
})().catch(e=>{console.error(e);process.exitCode=1});
