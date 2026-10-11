const fs=require('fs'),vm=require('vm'),ts=require('/Users/user/cube-crash/node_modules/typescript'),crypto=require('crypto');
const {gsap}=require('/Users/user/cube-crash/node_modules/gsap/dist/gsap.js');gsap.ticker.sleep();
const source=fs.readFileSync('/Users/user/cube-crash/src/modules/wild-stars.ts','utf8'),ast=ts.createSourceFile('wild.ts',source,ts.ScriptTarget.Latest,true);
const names=['getRandomBabyStarCount','clampDelta','computeHostMetrics','createStarSprite','setupStars','tickSystem'];
const funcs=names.map(name=>{const n=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);if(!n)throw Error(name);return n.getText(ast)}).join('\n');
const constants=['MIN_BABY_STAR_COUNT','MAX_BABY_STAR_COUNT','BASE_RADIUS_FACTOR','STAR_TARGET_SIZE','ORBIT_SPEED','DELTA_MIN','DELTA_MAX'];
const defs=constants.map(name=>{let found;for(const n of ast.statements)if(ts.isVariableStatement(n))for(const d of n.declarationList.declarations)if(d.name.getText(ast)===name)found=d.initializer.getText(ast);if(!found)throw Error(name);return `const ${name}=${found};`}).join('\n');
class Sprite{constructor(texture){this.texture=texture;this.scale={x:1,y:1,set(x,y=x){this.x=x;this.y=y}};this.anchor={set(){}};this.x=0;this.y=0;this.rotation=0;this.alpha=1;this.visible=true}}
const cases=[];
for(let index=0;index<8;index++){
 let now=0,paintable=true,draw=0;const rolls=Array.from({length:40},(_,i)=>index===0?0:index===1?0.999999:(index*19+i*13)%100/100);
 const math=Object.create(Math);math.random=()=>{if(draw>=rolls.length)throw Error('RNG exhausted');return rolls[draw++]};
 const roots=[],system={disposed:false,tile:{base:{width:128+index*7,height:140-index*2}},host:{parent:{}},container:{removeChildren(){},addChild(){},visible:true,alpha:1},stars:[],lastUpdateTime:-1000/30,updateIntervalMs:1000/30,introBounce:index%2===0,visibility:{track(t){roots.push({t,at:now});gsap.ticker.sleep();return t}},foreground:{sync(){}}};
 const ctx={Math:math,Sprite,performance:{now:()=>now},debugLog(){},isSpecialDiceIdlePaintable:()=>paintable,getSpecialDiceVariantForTile:()=>null,createWildStarOrbitForeground:()=>system.foreground,detachWildStarHalo(){throw Error('unexpected retire')},gsap,system,texture:{width:80+index*8}};vm.createContext(ctx);vm.runInContext(ts.transpile(defs+'\n'+funcs,{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}),ctx);
 const count=vm.runInContext('getRandomBabyStarCount()',ctx),countDraws=draw;ctx.count=count;vm.runInContext('setupStars(system,texture,count)',ctx);const setupDraws=draw;
 const frames=[];
 for(const t of [0,16,34,90,180,260,340,480,510,620,760,990,1030,1140,1320,1600]){
  now=t;paintable=t!==620&&t!==760;
  for(const r of roots)r.t.totalTime(Math.max(0,(now-r.at)/1000),false);
  vm.runInContext('tickSystem(system)',ctx);
  frames.push({now,paintable,lastUpdate:system.lastUpdateTime,poses:system.stars.map(s=>({x:s.sprite.x,y:s.sprite.y,rotation:s.sprite.rotation,scale:s.sprite.scale.x,alpha:s.sprite.alpha,angle:s.angle,revealed:s.revealed,introAnimating:s.introAnimating}))});
 }
 for(const r of roots)r.t.kill();gsap.ticker.sleep();
 cases.push({index,rolls,count,countDraws,setupDraws,width:system.tile.base.width,height:system.tile.base.height,textureWidth:ctx.texture.width,introBounce:system.introBounce,frames});
}
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');const result={authority:'Literal wild-stars.ts setup/tick functions and actual GSAP intro timelines; Sprite probe only, no renderer or physical claim',sourceSHA256:sha(source),cases};fs.writeFileSync('/tmp/native-resume-20261009/tutorial-star-halo-oracle.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({cases:cases.length,frames:cases.reduce((n,c)=>n+c.frames.length,0),draws:cases.map(c=>[c.countDraws,c.setupDraws])}));
