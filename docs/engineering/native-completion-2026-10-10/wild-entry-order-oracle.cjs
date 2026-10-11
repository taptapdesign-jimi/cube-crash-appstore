const fs=require('fs'),path=require('path'),vm=require('vm');
const root='/Users/user/cube-crash',ts=require(root+'/node_modules/typescript');
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;
 const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const req=s=>{if(s.includes('tile-lifecycle-service'))return {removeTileFully(){throw Error('unexpected existing tile')}};let f=path.resolve(path.dirname(file),s);if(!f.endsWith('.ts'))f+='.ts';return load(f)};
 vm.runInThisContext('(function(require,module,exports){'+code+'\n})',{filename:file})(req,m,m.exports);return m.exports;}
const registry=load(root+'/src/modules/special-dice-registry.ts'),restore=load(root+'/src/modules/app-core-load-tiles.ts');
const tiles=[{id:'bee-0',special:'wild',_ccDeferWildIdleFx:true},{id:'bee-4',special:'wild',_ccDeferWildIdleFx:true},{id:'bee-8',special:'wild',_ccDeferWildIdleFx:true}];
let calls=[];restore.resumeDeferredWildIdleEffects(tiles,t=>{if(t._ccDeferWildIdleFx!==undefined)throw Error('deferral not cleared');calls.push(t.id)});
if(calls.join(',')!=='bee-0,bee-4,bee-8')throw Error('order mismatch');
fs.writeFileSync('/tmp/native-completion-20261010-evidence/wild-entry-order-oracle.json',JSON.stringify({authority:'actual original resumeDeferredWildIdleEffects',calls},null,2));console.log(calls);
