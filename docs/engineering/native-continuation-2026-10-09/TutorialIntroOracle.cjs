const fs=require('fs'),crypto=require('crypto'),cp=require('child_process');
const {gsap}=require('/Users/user/cube-crash/node_modules/gsap/dist/gsap');
const source=cp.execFileSync('git',['show','production-benchmark-v9:src/modules/first-play-tutorial.ts'],{cwd:'/Users/user/cube-crash',encoding:'utf8'});
for(const literal of ["duration: 0.42, ease: 'back.out(1.25)'","scale: 1.14, rotate: 2, duration: 0.22, ease: 'back.out(2.2)'","scale: 0.94, rotate: -2, duration: 0.11, ease: 'power2.out'","scale: 1, rotate: 0, duration: 0.16, ease: 'back.out(1.7)'","repeatDelay: 0.12"]){if(!source.includes(literal))throw Error('Original recipe drift: '+literal)}
const image={opacity:0,scale:0,rotate:-8},sheet={y:100},shell={x:0,scale:1,rotate:-8};
const pop=gsap.timeline({paused:true}).to(image,{opacity:1,duration:.08,ease:'sine.out'},0).to(image,{scale:1.14,rotate:2,duration:.22,ease:'back.out(2.2)'},0).to(image,{scale:.94,rotate:-2,duration:.11,ease:'power2.out'}).to(image,{scale:1,rotate:0,duration:.16,ease:'back.out(1.7)'});
const sheetTween=gsap.to(sheet,{paused:true,y:0,duration:.42,ease:'back.out(1.25)'});
const hint=gsap.to(shell,{paused:true,x:1,scale:.94,rotate:-1,duration:1.18,ease:'power1.inOut',repeat:-1,yoyo:true,repeatDelay:.12});
const popSamples=Array.from({length:101},(_,i)=>i*.005).map(seconds=>{pop.totalTime(seconds,false);return{seconds,alpha:image.opacity,scale:image.scale,rotation:image.rotate}});
const sheetSamples=Array.from({length:85},(_,i)=>i*.005).map(seconds=>{sheetTween.totalTime(seconds,false);return{seconds,progress:sheet.y/100}});
const hintSamples=Array.from({length:651},(_,i)=>i*.016).map(seconds=>{hint.totalTime(seconds,false);return{seconds,progress:shell.x}});
const data={reference:'production-benchmark-v9:src/modules/first-play-tutorial.ts',sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'),gsap:gsap.version,scope:'Original numeric GSAP recipes; not DOM raster or physical acceptance',popSamples,sheetSamples,hintSamples};
fs.writeFileSync('/tmp/native-resume-20261009/source/native/standalone/Stack to SixTests/SourceTutorialIntroV9Oracle.json',JSON.stringify(data,null,2)+'\n');gsap.ticker.sleep();
