// Execute immutable v9 owner slices; fail closed if boundaries change.
const fs=require('node:fs'),vm=require('node:vm'),cp=require('node:child_process');
const ts=require('../../../node_modules/typescript');
const source=p=>cp.execFileSync('git',['show','production-benchmark-v9:'+p],{encoding:'utf8'});
const core=source('src/modules/app-core.ts'),hud=source('src/modules/hud-helpers.ts');
function slice(s,a,b,from=0){const x=s.indexOf(a,from),y=s.indexOf(b,x);if(x<0||y<0)throw Error(a);return s.slice(x,y)}
const pads=slice(core,'  const TOP_PAD   =','  // Scale board to fit screen width');
const hudStart=hud.indexOf('export function layout(');
const hudLayout=slice(hud,'  if (!HUD_ROOT) return;','  // labeli',hudStart);
const meter=slice(hud,'    wild.view.x = SIDE;','  }',hud.indexOf('  // labeli',hudStart));
const final=slice(core,'    const wildY = (wild?.view?.y ?? 0);','    devLog(\'🎯 Recentered board');
const js=ts.transpileModule(`function sample(){${pads}\nconst HUD_PADDING=24,IPAD_BOARD_PADDING=40;let s,boardX,boardY;const widthScale=(vw-(isIPad?80:48))/w;{const top=safeTop;${hudLayout}\nconst barW=Math.max(120,vw-2*SIDE);${meter}}\n${final}\nreturn {scale:s,left:boardX,top:boardY};}sample();`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const cases=[];
for(const [vw,vh]of [[320,568],[375,667],[390,844],[430,932],[844,390],[768,1024],[834,1194],[1024,768],[1512,982]])for(const SAT of [0,20,44,47,59])for(const SAB of [0,21,34])for(const [columns,rows]of [[5,9],[5,8],[6,6],[7,7],[1,1]]){
 const wild={view:{height:10},setWidth(){}};
 const box={vw,vh,adjustedSAT:SAT,SAB,w:columns*128+(columns-1)*20,h:rows*128+(rows-1)*20,isMobilePortrait:vw<768||vh>vw,HUD_H:60,__hudMetrics:{},devLog(){},HUD_ROOT:{},app:{renderer:{width:vw,height:vh}},boardText:{style:{fontSize:24}},scoreText:{style:{fontSize:18}},comboText:{style:{fontSize:18}},wild};
 vm.createContext(box);cases.push({width:vw,height:vh,safeTop:SAT,safeBottom:SAB,columns,rows,...vm.runInContext(js,box)});
}
fs.writeFileSync(__dirname+'/geometry-oracle.json',JSON.stringify(cases));console.log('PASS executed immutable v9 final geometry',cases.length,'cases');
