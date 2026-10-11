// Read-only policy oracle executing immutable Source configuration and methods.
const cp=require('node:child_process'),vm=require('node:vm'),ts=require('typescript');
const code=cp.execFileSync('git',['show','production-benchmark-v9:src/modules/board-specific-rules.ts'],{encoding:'utf8'});
const moduleValue={exports:{}};
vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:moduleValue,exports:moduleValue.exports,require:name=>name.includes('logger')?{logger:{info(){},error(){}}}:{},console});
const source=moduleValue.exports;
const rows=Array.from({length:60},(_,i)=>({board:i+1,meter:source.isWildMeterEnabled(i+1),spawn:source.isWildSpawnEnabled(i+1)}));
process.stdout.write(JSON.stringify(rows));
