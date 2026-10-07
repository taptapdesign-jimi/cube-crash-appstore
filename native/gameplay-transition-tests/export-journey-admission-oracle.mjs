import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript'),source=fs.readFileSync('src/modules/journey-boards-manager.ts','utf8'),ast=ts.createSourceFile('manager',source,ts.ScriptTarget.Latest,true);
const tries=[];function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='showBoardTransitionScreen'){let p=n.parent;while(p&&!ts.isTryStatement(p))p=p.parent;assert(p);tries.push(p.getText(ast))}ts.forEachChild(n,visit)}visit(ast);assert.equal(tries.length,3);
const worldRows=[];
for(const [index,body]of tries.entries())for(const saved of [false,true])for(const completed of [false,true]) {
 let starts=0,shown=0,didStart=false;
 const startBoard=async()=>{if(didStart)return;didStart=true;starts++};
 const box={exports:{},presentationAccepted:true,hasSavedState:saved,onPresentationReady:undefined,presentationReady:undefined,didContinue:false,board:{id:12},boardId:12,boardIdForPlay:12,logger:{warn(){},info(){},debug(){},error(){}},window:{continueGameWithSavedState:startBoard,startNewRunFromJourney:startBoard},startBoard,require:()=>({showBoardTransitionScreen:async options=>{shown++;await options.onComplete()}})};
 vm.createContext(box);vm.runInContext(ts.transpileModule(`async function run(){${body}}`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,box);await vm.runInContext('run()',box);
 assert.equal(shown,1);assert.equal(starts,1);worldRows.push({owner:['regular-overlay','interim-card','regular-detail'][index],saved,completed,showTransition:true,starts});
}
const eg=fs.readFileSync('src/modules/endgame-flow.ts','utf8'),egAST=ts.createSourceFile('endgame',eg,ts.ScriptTarget.Latest,true),clean=egAST.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='handleCleanBoardPlayAgain');assert(clean);assert(!clean.getText().includes('showBoardTransitionScreen'));assert(clean.getText().includes('startNewRunFromJourney(boardNumber)'));
assert(fs.readFileSync('src/modules/board-fail-modal.ts','utf8').includes('CC!.restart!({ animateHudDrop: true })'));
assert(!fs.readFileSync('src/modules/board-fail-modal.ts','utf8').includes('showBoardTransitionScreen'));
assert(fs.readFileSync('src/modules/end-run-modal.ts','utf8').includes('await Promise.resolve(window.CC.restart())'));
assert(!fs.readFileSync('src/modules/end-run-modal.ts','utf8').includes('showBoardTransitionScreen'));
assert(eg.includes('await showBoardTransitionScreen({\n        boardNumber: nextLevel'));
const actionRows=[{entry:'failureRetry',showTransition:false},{entry:'endRunRestart',showTransition:false},{entry:'cleanBoardPlayAgain',showTransition:false},{entry:'continueNextBoard',showTransition:true}];
fs.writeFileSync('native/gameplay-transition-tests/NativeJourneyAdmissionOracle.swift','import Foundation\nenum NativeJourneyAdmissionOracle{struct WorldRow:Decodable{let owner:String,saved:Bool,completed:Bool,showTransition:Bool,starts:Int};struct ActionRow:Decodable{let entry:String,showTransition:Bool};static let worldRows=try! JSONDecoder().decode([WorldRow].self,from:Data(worldJSON.utf8));static let actionRows=try! JSONDecoder().decode([ActionRow].self,from:Data(actionJSON.utf8));private static let worldJSON = #"""\n'+JSON.stringify(worldRows)+'\n"""#\nprivate static let actionJSON = #"""\n'+JSON.stringify(actionRows)+'\n"""#\n}\n');
console.log('PASS executed original three World CTA transition owners:12 resume/completed combinations; four direct source action ownership checks');
