const fs=require('fs'),vm=require('vm');
const parser=require('/Users/user/cube-crash/node_modules/@babel/parser');
const ts=require('/Users/user/cube-crash/node_modules/typescript');
const source=fs.readFileSync('/Users/user/cube-crash/src/modules/app-core.ts','utf8');
const ast=parser.parse(source,{sourceType:'module',plugins:['typescript']});let found=[];
function visit(n){if(!n||typeof n!=='object')return;if(n.type==='VariableDeclarator'&&n.id?.name==='getWildStarOrbitCountForSpawn')found.push(n.init);for(const [k,v]of Object.entries(n)){if(k==='loc')continue;if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}}
visit(ast);if(found.length!==1)throw Error('ambiguous literal function');
const literal=source.slice(found[0].start,found[0].end);
const code=ts.transpileModule('const select='+literal+';select();',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
const results=[];const values=n=>[null,false,...Array.from({length:n},()=>({}))];
for(let positions=0;positions<=4;positions++)for(let saved=0;saved<=4;saved++)for(let live=0;live<=4;live++)results.push({positions,saved,live,expected:vm.runInNewContext(code,{savedStarPositionsEarly:values(positions),savedStarSystemEarly:{stars:values(saved)},wildStarTileForAnimation:{_wildStarSystem:{stars:values(live)}}})});
fs.writeFileSync('/tmp/native-resume-20261009/star-spawn-count-oracle.json',JSON.stringify({literal,results},null,2)+'\n');
process.stdout.write('Literal original spawn-count cases: '+results.length+'\n');
