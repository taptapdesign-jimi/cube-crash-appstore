const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const ts=require('typescript');
const {execFileSync}=require('node:child_process');
const source=path=>execFileSync('git',['show',`production-benchmark-v9:${path}`],{encoding:'utf8'});
const request=source('src/modules/first-play-tutorial-request.ts');
const manager=source('src/modules/ui-manager.ts');
const expression=manager.match(/const shouldResumeArcade = ([^;]+);/)?.[1];
if(!expression)throw new Error('Original Homepage Arcade entry expression absent');
const compiled=ts.transpileModule(request,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const rows=[];
for(const done of [null,'false','true'])for(const force of [null,'false','true'])for(const saved of [false,true]) {
 const storage=new Map();if(done!==null)storage.set('cc_first_play_tutorial_done',done);if(force!==null)storage.set('cc_first_play_tutorial_force_next',force);
 const exports={},context={exports,module:{exports},window:{},document:{},localStorage:{getItem:key=>storage.get(key)??null},require:name=>{if(!name.includes('first-play-tutorial-dev-reset'))throw new Error(name);return {clearFirstPlayTutorialResumeBlockers:()=>{throw new Error('Reset is outside read-only launch oracle')}}}};
 vm.createContext(context);vm.runInContext(compiled,context);
 let savedQueries=0;context.isFirstPlayTutorialForced=context.exports.isFirstPlayTutorialForced;context.hasArcadeSavedState=()=>{savedQueries++;return saved};
 const resume=vm.runInContext(expression,context);
 rows.push({done,force,saved,forced:context.isFirstPlayTutorialForced(),resume,savedQueries});
}
const budget=source('src/modules/app-core.ts').match(/const MOVES_MAX = ([^;]+);/)?.[1];
if(!budget)throw new Error('Original move budget absent');
const result={freshMoveBudget:vm.runInNewContext(budget),reference:'production-benchmark-v9',requestSHA256:crypto.createHash('sha256').update(request).digest('hex'),entryExpression:expression,rows};
fs.writeFileSync('native/standalone/Stack to SixTests/NativeFirstPlayLaunchSourceOracle.json',JSON.stringify(result,null,2)+'\n');
console.log(`PASS executed immutable-v9 launch policy ${rows.length} cases; forced entries never query saved Arcade state`);
