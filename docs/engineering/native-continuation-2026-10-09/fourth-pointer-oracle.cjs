const fs=require('fs'),vm=require('vm'),ts=require('/Users/user/cube-crash/node_modules/typescript'),{gsap}=require('/Users/user/cube-crash/node_modules/gsap');
const source=fs.readFileSync('/Users/user/cube-crash/src/modules/first-play-tutorial.ts','utf8');
const ast=ts.createSourceFile('tutorial.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const names=['startStepFourPointerHint','shuffleInPlace'];
const functions=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name?.text)).map(n=>n.getText(ast)).join('\n');
if(functions.length<1500)throw Error('original functions missing');
const cases=[];
for(const target of [{left:220,top:300,width:60,height:80},{left:5,top:160,width:90,height:52},{left:70,top:420,width:60,height:60},{left:70,top:10,width:60,height:60}]){
 const from={left:70,top:150,width:60,height:60},pointer={style:{},left:0,top:0,x:0,y:0,opacity:0,scale:.9,rotate:-8},image={opacity:0,scale:1,rotate:0},fingertip={x:18,y:24};let timeline;
 const bridge={...gsap,timeline:vars=>{timeline=gsap.timeline({...vars,paused:true});return timeline}};
 const context=vm.createContext({active:true,currentStep:4,stepFourPrepared:true,stepFourWildTile:{rect:from},targetTiles:[],stepFourPointerTimeline:null,stepFourPointerLoopTimer:null,
 getPointerShell:()=>pointer,getPointerImage:()=>image,stopStepFourPointerHint:()=>{},pointerFingertipOffset:()=>fingertip,tileRect:t=>t.rect,
 getFourthStepCandidateTiles:()=>[{rect:target}],scheduleTimeout:()=>1,gsap:bridge,Math});
 vm.runInContext(ts.transpileModule(functions,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);vm.runInContext('startStepFourPointerHint()',context);
 const samples=[0,.04,.08,.159,.16,.31,.47,.779,.78,.82,.86,.90,.94,1.02].map(time=>{timeline.totalTime(time,false);return {time,x:pointer.left+pointer.x,y:pointer.top+pointer.y,alpha:pointer.opacity,scale:pointer.scale,rotation:pointer.rotate}});
 cases.push({from,to:target,fingertip,duration:timeline.duration(),samples});timeline.kill();
}
fs.writeFileSync('/tmp/native-resume-20261009/fourth-pointer-oracle.json',JSON.stringify(cases));gsap.ticker.sleep();
