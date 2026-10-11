const cp=require('child_process'),ts=require(process.cwd()+'/node_modules/typescript'),vm=require('vm'),fs=require('fs');
const tag='production-benchmark-v9',read=p=>cp.execFileSync('git',['show',`${tag}:${p}`],{encoding:'utf8'});
const fx=read('src/modules/fx.ts'),registry=read('src/modules/special-dice-registry.ts'),wood=read('src/modules/templates/wooden-template.js');
const file=ts.createSourceFile('fx.ts',fx,ts.ScriptTarget.Latest,true);
const fn=file.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='magicSparklesAtTile').getText(file).replace(/^export /,'');
const defaults=vm.runInNewContext('('+wood.match(/export const woodenDragParticleColors = (\{[\s\S]*?\n\});/)[1]+')');
const variants={}; for(const match of registry.matchAll(/id: '([^']+)',\s*archetype: '([^']+)'/g)) {const tail=registry.slice(match.index,registry.indexOf("\n  },",match.index));const colors=tail.match(/trailColors:\s*(\[[^\]]+\])/);variants[match[1]]={core:match[2],colors:colors?vm.runInNewContext(colors[1]):null};}
const coreKey={'wild-star':'wild','wild-juice':'wildJuice','wild-magnet':'wildMagnet','wild-tnt':'wildTnt'};
const cases=[...Object.entries(variants).map(([id,v])=>({id,...v})),...Object.keys(coreKey).map(core=>({id:core,core,colors:null}))];
const fixtures=[];
for(const c of cases) for(const seed of [1,42,123456]) {
 let rng=seed,draws=0,captured,shape;
 const random=()=>{draws++;rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
 const shard={clear(){},rect(x,y,width,height){shape={round:false,width,height};return this},circle(x,y,r){shape={round:true,width:2*r,height:2*r};return this},fill({color,alpha}){shape.color=color;shape.fill=alpha;return this}};
 const math=Object.create(Math);math.random=random;
 const context={Math:math,console,graphicsPool:{acquire:()=>shard},__globalGraphicsObjects:new Set(),getSpecialDiceTrailColors:()=>c.colors,getDragParticleColors:()=>defaults[coreKey[c.core]],trackTween:(p,t)=>{captured={...shape,x:p.x,y:p.y,rotation:p.rotation,endX:t.x,endY:t.y,endRotation:t.rotation,life:t.duration,draws}},boardSortChildrenSafe(){}};
 vm.createContext(context);vm.runInContext(fn+';this.run=magicSparklesAtTile',context);
 context.run({addChild(){},sortChildren(){}},{special:c.core==='wild-star'?'wild':c.core,zIndex:18000},{customPosition:{x:0,y:0},particleCount:1,sizeMultiplier:1.04,distanceScale:.9,fillAlpha:.92,forceCircleParticles:['fish','bottle','beach-ball'].includes(c.id)||c.id==='wild-juice',forceRectParticles:!(['fish','bottle','beach-ball'].includes(c.id)||c.id==='wild-juice'),deferSort:true});
 fixtures.push({id:c.id,core:c.core,seed,colors:[...(c.colors||defaults[coreKey[c.core]]),...(c.core==='wild-tnt'?[0xFFD966,0xFFE699]:[])],...captured});
}
const target='native/standalone/Stack to SixTests/NativeIdleBubbleTests.swift';
const swift=fs.readFileSync(target,'utf8');
const embedded=JSON.parse(swift.match(/private static let trailOracleJSON = #"""\n([\s\S]*?)\n"""#/)[1]);
if(JSON.stringify(fixtures)!==JSON.stringify(embedded))throw new Error('Swift fixture drift from immutable v9 output');
console.log('PASS: 51 unmodified v9 particle captures, all 17 trail families, exactly match embedded Swift oracle');
