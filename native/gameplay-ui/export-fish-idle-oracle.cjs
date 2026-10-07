const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const text=execFileSync('git',['show','production-benchmark-v9:src/modules/fish-swim-artwork.ts'],{encoding:'utf8'}),ast=ts.createSourceFile('source.ts',text,ts.ScriptTarget.Latest,true);
function fn(name){const node=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);if(!node)throw Error(name);return node.getText(ast).replace(/^export /,'')}
let code=['shouldFlipFishForViewport','getPixiBranchAlpha','syncController','setFishStyle'].map(fn).join('\n');
code=`const DISPLAY_WIDTH=272*128/224,DISPLAY_HEIGHT=280*128/224,DISPLAY_ANCHOR_X=.5,DISPLAY_ANCHOR_Y=.5;let layerSuspended=false;`+code;
const context={Number,Math,setAnimatedSpecialArtworkPinnedForeground(){},suspendFishMedia(){},resumeFishMedia(){},releaseFrontBubbleSystem(){},disposeController(){throw Error('unexpected dispose')},isFishSwimTile(){return true},isSpecialDiceIdlePaintable(){return true},syncFrontBubbles(){}};
vm.createContext(context);vm.runInContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);
let rng=91831;const random=()=>((rng=(rng*1664525+1013904223)>>>0)/4294967296),cases=[];
for(let i=0;i<64;i++){
 const W=[390,430,1024][i%3],H=[844,932,1366][i%3],angle=(random()-.5)*.4,sx=.3+random()*.7,sy=.3+random()*.7;
 const matrix={a:Math.cos(angle)*sx,b:Math.sin(angle)*sx,c:-Math.sin(angle)*sy,d:Math.cos(angle)*sy,tx:W*random(),ty:H*random()};
 const alpha=.2+random()*.8,base={alpha,parent:{alpha:.7,parent:{alpha:.8,parent:null}},visible:true,destroyed:false};
 const controller={disposed:false,tile:{zIndex:12001},base,host:{worldTransform:matrix},wrapper:{style:{},parentElement:{}},dragging:false,ready:true,presentationValid:false,presentation:{},video:null};
 context.syncController(controller,{canvasRect:{left:0,top:0,width:W,height:H},rootRect:{left:0,top:0},screenWidth:W,screenHeight:H,canvasOpacity:1});
 const actual=controller.wrapper.style.transform.match(/matrix\((.*)\)/)[1].split(',').map(Number);
 cases.push({width:W,height:H,matrix,alpha,css:actual,opacity:Number(controller.wrapper.style.opacity),facing:context.shouldFlipFishForViewport(matrix.tx,W)});
}
const json=JSON.stringify(cases);fs.writeFileSync('native/standalone/Stack to SixTests/NativeFishIdleSourceOracle.swift','import Foundation\n// Executed immutable production-benchmark-v9 syncController/getPixiBranchAlpha/facing.\nenum NativeFishIdleSourceOracle { static let json = #\"'+json+'\"# }\n');console.log('Original v9 Fish syncController/getPixiBranchAlpha/facing:64 source cases');
