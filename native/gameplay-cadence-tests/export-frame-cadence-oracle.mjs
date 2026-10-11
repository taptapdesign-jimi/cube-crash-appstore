import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url)),require=createRequire(root+'/package.json'),ts=require(root+'/node_modules/typescript');
const read=(ref,file)=>ref==='current'?fs.readFileSync(root+'/'+file,'utf8'):execFileSync('git',['show',ref+':'+file],{cwd:root,encoding:'utf8'});
const transpile=source=>{const ast=ts.createSourceFile('source.ts',source,ts.ScriptTarget.Latest,true);return ts.transpileModule(ast.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText()).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText};
const op=(kind,at=0,fields={})=>({kind,at,...fields});
const scenarios=[
 {name:'pending entry and settled leases survive first attach',mobile:true,ops:[op('acquire',0,{key:'entry',tail:100}),op('settled',0,{key:'idle'}),op('mark',5),op('start',10,{ticker:1}),op('start',20,{ticker:1}),op('release',30,{key:'entry'}),op('tick',129.999),op('tick',130),op('release',140,{key:'idle'}),op('tick',150)]},
 {name:'overlapping activity completion and generic tails',mobile:true,ops:[op('start',0,{ticker:1}),op('acquire',0,{key:'entry',tail:100}),op('acquire',10,{key:'spawn',tail:100}),op('release',20,{key:'entry'}),op('mark',25),op('acquire',40,{key:'six'}),op('release',70,{key:'spawn'}),op('release',200,{key:'six'}),op('release',300,{key:'six'}),op('tick',379.999),op('tick',380),op('mark',500,{duration:40}),op('mark',510,{duration:5}),op('tick',540)]},
 {name:'pointer touch duplicates and cancel release250',mobile:true,ops:[op('start',0,{ticker:1}),op('pointerdown',10),op('touchstart',11),op('pointerup',40),op('touchend',100),op('tick',289.999),op('tick',290),op('pointerdown',300),op('pointercancel',350),op('touchcancel',400),op('tick',600),op('pointerdown',700),op('blur',710),op('tick',960)]},
 {name:'settled leases are30 without spending activity',mobile:true,ops:[op('start',0,{ticker:1}),op('settled',10,{key:'bee'}),op('settled',20,{key:'fish'}),op('tick',180_000),op('release',180_001,{key:'bee'}),op('release',180_010,{key:'fish'}),op('release',180_020,{key:'fish'}),op('tick',180_030)]},
 {name:'diagnostic cap only exact30 changes active target',mobile:true,ops:[op('start',0,{ticker:1}),op('acquire',0,{key:'active'}),op('diagnostic',10,{cap:30}),op('tick',11),op('diagnostic',12,{cap:45}),op('tick',13),op('diagnostic',14,{cap:null}),op('release',20,{key:'active'}),op('diagnostic',21,{cap:30}),op('tick',22),op('tick',200),op('settled',201,{key:'idle'}),op('tick',202)]},
 {name:'replacement retires tokens and stale activity cannot extend tail',mobile:true,ops:[op('start',0,{ticker:1}),op('acquire',10,{key:'old'}),op('settled',10,{key:'oldIdle'}),op('pointerdown',12),op('start',20,{ticker:2}),op('acquire',21,{key:'new'}),op('diagnostic',22,{cap:30}),op('release',30,{key:'old'}),op('release',31,{key:'oldIdle'}),op('release',32,{key:'oldIdle'}),op('release',40,{key:'new'}),op('tick',220)]},
 {name:'stop and mount new pending leases ignores old completions',mobile:true,ops:[op('acquire',0,{key:'old'}),op('start',10,{ticker:1}),op('stop',20),op('mark',21),op('acquire',30,{key:'next',tail:100}),op('release',31,{key:'old'}),op('start',40,{ticker:2}),op('start',41,{ticker:null}),op('release',50,{key:'next'}),op('tick',150),op('stop',151),op('stop',152)]},
 {name:'visibility releases direct while real finite owner persists',mobile:true,ops:[op('start',0,{ticker:1}),op('pointerdown',10),op('acquire',12,{key:'finale'}),op('hidden',20),op('pagehide',21),op('tick',300),op('visible',301),op('release',310,{key:'finale'}),op('tick',489.999),op('tick',490)]},
 {name:'desktop owns no mobile ticker or listener',mobile:false,ops:[op('mark',0),op('acquire',10,{key:'active'}),op('settled',20,{key:'idle'}),op('start',30,{ticker:1}),op('pointerdown',40),op('release',50,{key:'active'}),op('mark',60),op('release',70,{key:'idle'}),op('stop',80)]},
 {name:'negative tail clamps and exact expiration boundary',mobile:true,ops:[op('start',0,{ticker:1}),op('acquire',1,{key:'zero',tail:-5}),op('release',10,{key:'zero'}),op('mark',20,{duration:-1}),op('mark',30,{duration:300}),op('mark',40,{duration:0}),op('tick',329.999),op('tick',330)]}
];
function run(ref,scenario){
 let now=0,hidden=false,leases=new Map(),tickers=new Map(),listeners=new Map(),documentListeners=new Map();
 const eventTarget=map=>({addEventListener(key,fn){if(!map.has(key))map.set(key,new Set());map.get(key).add(fn)},removeEventListener(key,fn){map.get(key)?.delete(fn)},dispatch(key){map.get(key)?.forEach(fn=>fn())}});
 const window=eventTarget(listeners),document={...eventTarget(documentListeners),get hidden(){return hidden}};
 const env=scenario.mobile?{userAgent:'iPhone',platform:'iPhone',maxTouchPoints:1}:{userAgent:'Mac',platform:'MacIntel',maxTouchPoints:0};
 const profileBox={exports:{},navigator:env};vm.createContext(profileBox);vm.runInContext(transpile(read(ref,'src/modules/mobile-runtime-profile.ts')),profileBox);
 const box={exports:{},window,document,performance:{now:()=>now},MOBILE_RUNTIME_PROFILE:profileBox.exports.MOBILE_RUNTIME_PROFILE};vm.createContext(box);vm.runInContext(transpile(read(ref,'src/modules/pixi-mobile-frame-controller.ts')),box);
 const ticker=id=>{if(!tickers.has(id)){const callbacks=new Set();tickers.set(id,{maxFPS:60,add(fn){assert.equal(callbacks.size,0);callbacks.add(fn)},remove(fn){assert.ok(callbacks.delete(fn))},tick(){callbacks.forEach(fn=>fn())},callbacks})}return tickers.get(id)};
 const states=[];
 for(const operation of scenario.ops){
  now=operation.at;
  switch(operation.kind){
   case'start':box.exports.startPixiMobileFrameController(operation.ticker===null?null:ticker(operation.ticker));break;
   case'stop':box.exports.stopPixiMobileFrameController();break;
   case'tick':tickers.forEach(t=>t.tick());break;
   case'acquire':leases.set(operation.key,operation.tail===undefined?box.exports.acquirePixiMobileActivityLease(operation.key):box.exports.acquirePixiMobileActivityLease(operation.key,operation.tail));break;
   case'settled':leases.set(operation.key,box.exports.acquirePixiSettledMotionLease(operation.key));break;
   case'release':leases.get(operation.key)();break;
   case'mark':operation.duration===undefined?box.exports.markPixiMobileActivity():box.exports.markPixiMobileActivity(operation.duration);break;
   case'diagnostic':window.__ccThermalPixiActiveFpsCap=operation.cap;break;
   case'hidden':hidden=true;document.dispatch('visibilitychange');break;
   case'visible':hidden=false;document.dispatch('visibilitychange');break;
   default:window.dispatch(operation.kind);
  }
  const state=box.exports.getPixiMobileFrameControllerSnapshot();assert.ok([...tickers.values()].filter(t=>t.callbacks.size>0).length<=1);
  states.push(JSON.parse(JSON.stringify(state)));
 }
 return{...scenario,states};
}
const references=['current','native-benchmark-v1','production-benchmark-v9'];const records=references.map(ref=>scenarios.map(s=>run(ref,s)));
assert.deepEqual(records[0],records[1]);assert.deepEqual(records[0],records[2]);
const hashes=references.map(ref=>({ref,sha256:createHash('sha256').update(read(ref,'src/modules/pixi-mobile-frame-controller.ts')).digest('hex')}));
// Original monitor is installed first, just as app-core.startLevel7446-7447.
let coupledNow=0,lastPublished=null;
const coupledTicker={maxFPS:60,callbacks:[],add(fn){this.callbacks.push(fn)},remove(fn){this.callbacks=this.callbacks.filter(v=>v!==fn)},tick(){this.callbacks.forEach(fn=>fn())}};
const coupledWindow={addEventListener(){},removeEventListener(){}};
Object.defineProperty(coupledWindow,'__ccLastBoardPerf',{set(value){lastPublished=JSON.parse(JSON.stringify(value))}});
const coupledBox={exports:{},window:coupledWindow,document:{hidden:false,addEventListener(){},removeEventListener(){}},performance:{now:()=>coupledNow},MOBILE_RUNTIME_PROFILE:{isMobileDevice:true,settledIdleMaxFramesPerSecond:30,staticBoardMaxFramesPerSecond:15}};
vm.createContext(coupledBox);vm.runInContext(transpile(read('current','src/modules/board-frame-budget.ts')),coupledBox);vm.runInContext(transpile(read('current','src/modules/pixi-mobile-frame-controller.ts')),coupledBox);
coupledBox.exports.startBoardFrameBudgetMonitor(coupledTicker);coupledBox.exports.startPixiMobileFrameController(coupledTicker);
const finishPressure=coupledBox.exports.acquirePixiMobileActivityLease('controlled-pressure');
const coupled=[];
function capture(){coupled.push({at:coupledNow,cadence:JSON.parse(JSON.stringify(coupledBox.exports.getPixiMobileFrameControllerSnapshot())),budget:lastPublished,reduced:coupledBox.exports.isBoardFxReduced()})}
capture();for(let i=0;i<120;i++){coupledNow+=24;coupledTicker.tick();capture()}
finishPressure();capture();for(let i=0;i<140;i++){coupledNow+=1000/coupledTicker.maxFPS;coupledTicker.tick();capture()}
assert.equal(coupled[120].reduced,true);assert.equal(coupled.at(-1).reduced,false);
const payload={hashes,records:records[0],coupled};
console.log(JSON.stringify({scenarios:scenarios.length,states:records[0].reduce((n,r)=>n+r.states.length,0),references:3,coupledFrames:coupled.length,hashes}));

const swiftHeader="import Foundation\n@testable import Stack_to_Six\n\n/// Executed original controller at v9, Native benchmark v1 and current source.\nenum NativeBoardFrameCadenceSourceOracle {\n    struct Hash:Decodable {let ref,sha256:String}\n    struct Operation:Decodable {let kind:String,at:Double,key:String?,tail:Double?,duration:Double?,ticker:UInt64?,cap:Int?}\n    struct Record:Decodable {let name:String,mobile:Bool,ops:[Operation],states:[NativeBoardFrameCadence.Snapshot]}\n    struct Coupled:Decodable {let at:Double,cadence:NativeBoardFrameCadence.Snapshot,budget:NativeBoardFrameBudget.Snapshot,reduced:Bool}\n    struct Payload:Decodable {let hashes:[Hash],records:[Record],coupled:[Coupled]}\n    static var payload:Payload {try! JSONDecoder().decode(Payload.self,from:Data(json.utf8))}\n";
fs.writeFileSync(fileURLToPath(new URL("./NativeBoardFrameCadenceSourceOracle.swift",import.meta.url)),swiftHeader+'    private static let json = #"""\n'+JSON.stringify(payload)+'\n"""#\n}\n');
