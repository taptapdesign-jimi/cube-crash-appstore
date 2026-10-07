import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),require=createRequire(root+'/package.json'),ts=require(root+'/node_modules/typescript');
const file=root+'/src/modules/board-frame-budget.ts',ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
const code=ts.transpileModule(ast.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText()).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const decode=x=>x==='nan'?NaN:x==='inf'?Infinity:x==='-inf'?-Infinity:x;
const run=(name,mobile,ops)=>{
 let now=0,callback=null,receipts=[],index=0,ordinal=0,window={};
 Object.defineProperty(window,'__ccLastBoardPerf',{set(value){receipts.push({index,ordinal,snapshot:JSON.parse(JSON.stringify(value))})}});
 const ticker={maxFPS:60,add(fn){if(callback)throw new Error('Duplicate source callback');callback=fn},remove(fn){if(callback!==fn)throw new Error('Wrong callback');callback=null}};
 const box={exports:{},window,performance:{now:()=>now},MOBILE_RUNTIME_PROFILE:{isMobileDevice:mobile}};vm.createContext(box);vm.runInContext(code,box);
 ops.forEach((op,i)=>{index=i;for(ordinal=0;ordinal<(op.count??1);ordinal++){
  if('fps'in op)ticker.maxFPS=decode(op.fps);
  if(op.kind==='start'){now+=op.delta??0;box.exports.startBoardFrameBudgetMonitor(ticker)}
  if(op.kind==='tick'){now+=op.delta;callback?.()}
  if(op.kind==='stop')box.exports.stopBoardFrameBudgetMonitor();
 }});
 return{name,mobile,ops,receipts,reduced:box.exports.isBoardFxReduced(),attached:callback!==null};
};
const start={kind:'start',fps:60},tick=(delta,count=1,fps)=>({kind:'tick',delta,count,...(fps===undefined?{}:{fps})});
const records=[
 run('single navigation hitch',true,[start,tick(1000/60,60),tick(250),tick(1000/60,150)]),
 run('seven accumulated misses and four recovery windows',true,[start,tick(1000/60,60),tick(30,7),tick(1000/60,190)]),
 run('average pressure then recovery',true,[start,tick(21,120),tick(16,210)]),
 run('30fps allowance then changed60 target',true,[{kind:'start',fps:30},tick(1000/30,150),tick(1000/60,200,60)]),
 run('15fps idle stays full effects',true,[{kind:'start',fps:15},tick(1000/15,3000)]),
 run('active three minute sustained reduction',true,[start,tick(1000/60,10860)]),
 run('target change preserves cumulative active load',true,[start,tick(1000/60,6000),tick(1000/30,300,30),tick(1000/60,5000,60)]),
 run('new board same ticker clears historical pressure',true,[start,tick(24,120),{kind:'start',delta:300},tick(16,120)]),
 run('new board target change ignores predecessor window',true,[start,tick(24,120),{kind:'start',fps:30},tick(1000/30,120)]),
 run('invalid mobile cap pauses samples not baseline',true,[start,tick(16,59),tick(200,15,'nan'),tick(200,15,'inf'),tick(16,100,60)]),
 run('uncapped invalid and low caps desktop',false,[{kind:'start',fps:'nan'},tick(16,120),tick(24,120,15),{kind:'stop'},{kind:'start',fps:'inf'},tick(16,120)]),
 run('native finite zero and negative caps use default',true,[{kind:'start',fps:0},tick(16,75),tick(16,75,-10),tick(16,75,120),{kind:'stop'}]),
 run('delta clamping and rolling window',true,[start,tick(0,15),tick(-5,15),tick(1000,15),tick(16,120)]),
];
const evaluationBox={exports:{},MOBILE_RUNTIME_PROFILE:{isMobileDevice:true}};vm.createContext(evaluationBox);vm.runInContext(code,evaluationBox);
const evaluations=[
 {samples:[],reduced:false,sustained:false,target:1000/60},
 {samples:[0,-1,'nan','inf',16,30],reduced:false,sustained:false,target:1000/60},
 {samples:Array(121).fill(16).map((v,i)=>i===0?250:v),reduced:true,sustained:false,target:1000/60},
 {samples:[...Array(113).fill(16),...Array(7).fill(29)],reduced:false,sustained:false,target:1000/60},
 {samples:Array(120).fill(18.2),reduced:true,sustained:false,target:1000/60},
 {samples:Array(120).fill(20.5),reduced:false,sustained:false,target:1000/60},
 {samples:Array(120).fill(1000/30),reduced:false,sustained:false,target:1000/30},
 {samples:Array(120).fill(16),reduced:false,sustained:true,target:1000/60}
].map(x=>({...x,snapshot:evaluationBox.exports.evaluateBoardFrameBudget(x.samples.map(decode),x.reduced,x.sustained,x.target)}));
const payload={records,evaluations},json=JSON.stringify(payload);
const swiftHeader="import Foundation\n@testable import Stack_to_Six\n\n/// Executed original src/modules/board-frame-budget.ts with its own ticker callback.\nenum NativeBoardFrameBudgetSourceOracle {\n    enum Scalar:Decodable {\n        case number(Double),special(String)\n        init(from decoder:Decoder)throws {let c=try decoder.singleValueContainer();if let v=try? c.decode(Double.self){self = .number(v)}else{self = .special(try c.decode(String.self))}}\n        var value:Double {switch self {case .number(let n):return n;case .special(let s):return s == \"nan\" ? .nan:s == \"inf\" ? .infinity:-.infinity}}\n    }\n    struct Operation:Decodable {let kind:String,count:Int?,delta:Double?,fps:Scalar?}\n    struct Receipt:Decodable {let index,ordinal:Int;let snapshot:NativeBoardFrameBudget.Snapshot}\n    struct Record:Decodable {let name:String,mobile:Bool,ops:[Operation],receipts:[Receipt],reduced,attached:Bool}\n    struct Evaluation:Decodable {let samples:[Scalar],reduced,sustained:Bool,target:Double,snapshot:NativeBoardFrameBudget.Snapshot}\n    struct Payload:Decodable {let records:[Record],evaluations:[Evaluation]}\n    static var payload:Payload {try! JSONDecoder().decode(Payload.self,from:Data(json.utf8))}\n";
fs.writeFileSync(fileURLToPath(new URL("./NativeBoardFrameBudgetSourceOracle.swift",import.meta.url)),swiftHeader+'    private static let json = #"""\n'+json+'\n"""#\n}\n');
console.log(JSON.stringify({scenarios:records.length,published:records.reduce((n,r)=>n+r.receipts.length,0),evaluations:evaluations.length}));
