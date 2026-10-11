const fs=require('fs'),vm=require('vm'),root='/Users/user/cube-crash';
const ts=require(root+'/node_modules/typescript'),{gsap}=require(root+'/node_modules/gsap/dist/gsap');
const source=fs.readFileSync(root+'/src/modules/fx.ts','utf8'),ast=ts.createSourceFile('fx.ts',source,ts.ScriptTarget.Latest,true);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='startWildShimmer');
const code=ts.transpileModule(fn.getText(ast).replace('export ',''),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
let timeline,delays=[],draws=0;const random=[0.25,0.75];
const context={Math:Object.assign(Object.create(Math),{random:()=>random[draws++]}),stopWildShimmer(){},createSpecialIdleAnimationVisibility:()=>({track:a=>a}),
createWildShimmer:t=>{t._wildShimmerSprite={x:0,y:0};return {alpha:0}},
trackDelayedCall:(delay,callback)=>{const item={delay,callback};delays.push(item);return item},
trackTimeline:()=>timeline=gsap.timeline({paused:true}),animationManager:{killExternalTimeline:t=>t.kill()},__globalDelayedCalls:new Set()};
vm.createContext(context);vm.runInContext(code+';this.run=startWildShimmer;',context);
const tile={base:{width:128,height:128}};context.run(tile);
if(delays.length!==1||delays[0].delay!==5||draws!==1)throw Error('initial schedule mismatch');
delays[0].callback();if(delays.length!==2||delays[1].delay!==7||draws!==2)throw Error('next schedule did not start with sweep');
const samples=[0,0.07,0.14,0.28,0.78,1.28,1.78,2.28,2.42,2.56].map(seconds=>{timeline.totalTime(seconds,false);return {seconds,alpha:timeline.getChildren()[0].targets()[0].alpha,x:tile._wildShimmerSprite.x,y:tile._wildShimmerSprite.y}});
fs.writeFileSync('/tmp/native-completion-20261010-evidence/wild-shimmer-oracle.json',JSON.stringify({authority:'actual original startWildShimmer and installed real GSAP timeline; explicit texture/visibility/delayed-call endpoints',delays:delays.map(d=>d.delay),draws,samples},null,2));
timeline.kill();gsap.ticker.sleep();console.log(samples);
