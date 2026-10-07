import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from '../../node_modules/typescript/lib/typescript.js';
const file = path.resolve(import.meta.dirname,'../../src/modules/tnt-bonus-target-selection.ts');
const exports = {};
const code = ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
vm.runInNewContext(code,{exports,Math},{filename:file});
const rows = [];
for (const width of [280,320,390,768]) for (const positions of [[0],[.5],[1],[.1,.2],[.1,.9],[.4,.6],[.1,.2,.3],[.1,.5,.9],[.1,.2,.3,.4],[.1,.9,.2,.8],[.49,.5,.51,.52]]) for (const roll of [0,.1,.5,.9,.999999]) {
 const targets=positions.map((x,i)=>({id:`die-${i}`,x:x*width})); let draws=0;
 const result=exports.planLaserGunCrossfireTargets(targets,t=>t.x,width,()=>{draws++;return roll;});
 rows.push({width,roll,positions:targets.map(t=>t.x),draws,shots:result.map(p=>({tileID:p.target.id,shooter:p.shooter}))});
}
fs.writeFileSync(path.resolve(import.meta.dirname,'Tests/StackToSixGameplayTests/NativeLaserOracle.swift'),'import Foundation\n// Actual exported TypeScript planner; regenerate with export-laser-oracle.mjs.\nenum NativeLaserOracle { static let data = Data(#"""\n'+JSON.stringify(rows)+'\n"""#.utf8) }\n');
console.log(`Laser crossfire source oracle: ${rows.length} cases`);
