// Run from repository root. Uses actual original TS exports; no runtime JS shipped.
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const root=process.cwd(),ts=createRequire(root+'/package.json')('typescript');
function stripped(name) {const file=root+'/src/modules/'+name+'.ts',text=fs.readFileSync(file,'utf8'),parsed=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);return parsed.statements.filter(s=>!ts.isImportDeclaration(s)).map(s=>s.getText()).join('\n');}
const code=ts.transpileModule(['bee-leaf-particle-motion','bottle-bubble-presentation','confetti-system','clean-board-area55-ship-flybys'].map(stripped).join('\n'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const box={exports:{},Math,console};vm.createContext(box);vm.runInContext(code,box);
const rows=[];
for(const [width,height] of [[320,667],[390,844],[768,1024]])for(const depth of ['behind','front'])for(const seed of [7,1337,4294967295,0,1,2]) {
 let state=seed,draws=0,roll=seed<3?[0,.5,.999999][seed]:null;
 const random=()=>{draws++;if(roll!==null)return roll;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const p=box.exports.createCleanBoardArea55ShipFlightPlan({depth,viewportWidth:width,viewportHeight:height,random});
 const samples=p.keyframes.map(k=>{const nums=[...k.transform.matchAll(/[-+]?\d+(?:\.\d+)?/g)].map(m=>Number(m[0]));return [k.offset,nums[1],nums[2],nums[4],nums[5],k.opacity];});
 rows.push({width,height,depth,seed,roll,draws,startEdge:p.startEdge,endEdge:p.endEdge,samples});
}
fs.writeFileSync('native/gameplay-result-tests/NativeResultArea55FlybysOracle.swift','import Foundation\n// Actual original TypeScript planner; no Swift model or runtime effect invocation.\nenum NativeResultArea55FlybysOracle { static let data=Data(#"""\n'+JSON.stringify(rows)+'\n"""#.utf8) }\n');
console.log(`${rows.length} authored plans / ${rows.reduce((n,r)=>n+r.samples.length,0)} original poses`);
