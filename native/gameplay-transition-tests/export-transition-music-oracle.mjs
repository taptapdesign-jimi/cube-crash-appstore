import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
const ast=ts.createSourceFile('soundtrack',fs.readFileSync('src/modules/soundtrack-manager.ts','utf8'),ts.ScriptTarget.Latest,true);
const names=new Set(['beginGameplayTransitionFade','continueGameplayTransitionFade','completeGameplayTransitionFade','settleGameplaySoundtrackAfterTransition']);
const constants=new Set(['SOUNDTRACK_VOLUME','SOUNDTRACK_TRANSITION_VOLUME_RATIO','SOUNDTRACK_TRANSITION_VOLUME','SOUNDTRACK_GAMEPLAY_VOLUME_RATIO','SOUNDTRACK_GAMEPLAY_VOLUME','SOUNDTRACK_GAMEPLAY_FADE_TAIL_MS','SOUNDTRACK_GAMEPLAY_SETTLE_MS']);
const original=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.has(n.name?.text)||ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>constants.has(d.name.getText()))).map(n=>n.getText()).join('\n');
const rows=[];
for(const [theme,enter,hold,exit] of [['forest',1.35,.4,2.031],['beach',1.35,.4,1.581],['area55',2.35,.331,1.516]]) {
 const box={exports:{},console,logger:{info(){}},calls:[],callbacks:[],clearVictoryHookEnvelope(){},cancelIntroSequence(){},disarmAutoplayRetry(){},isSampleAccurateMainThemeVoice(){return false},cancelThemeFade(){},enterArcadeCalmSoundtrack(){},isArcadeHomeRunMode(){return false},isMusicEnabled(){return true},document:{hidden:false},playWithFadeIn(){throw Error('Unexpected cold path')}};
 vm.createContext(box);
 const setup=`let audio={volume:.578,paused:false},activeGameplayFade=null,gameplayFadeGeneration=0,playRequestToken=0,gameplayDuckActive=false,fadeInProgress=false,pausedForVisibility=false,victoryHookMuteActive=false;function linearFade(from,to,duration,onUpdate,onComplete){calls.push({from,to,duration});callbacks.push(()=>{onUpdate(to);onComplete()})}`;
 vm.runInContext(ts.transpileModule(setup+'\n'+original,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,box);
 vm.runInContext(`globalThis.g=exports.beginGameplayTransitionFade();exports.continueGameplayTransitionFade(g,.62,${enter*1000});`,box);box.callbacks.shift()();
 vm.runInContext(`exports.continueGameplayTransitionFade(g,.5,${hold*1000});`,box);box.callbacks.shift()();
 vm.runInContext(`exports.continueGameplayTransitionFade(g,.2,${exit*1000});exports.completeGameplayTransitionFade(g);`,box);
 assert.equal(box.calls.length,3,'Source complete must wait actual final fade callback');
 box.callbacks.shift()();assert.equal(box.calls.length,4,'Source actual tail completion starts gameplay lift');
 box.callbacks.shift()();assert.equal(vm.runInContext('activeGameplayFade',box),null);
 rows.push({theme,phases:box.calls.map(({to,duration})=>({gain:to,duration:duration/1000}))});
}
fs.writeFileSync('native/gameplay-transition-tests/NativeTransitionMusicOracle.swift','import Foundation\nenum NativeTransitionMusicOracle {struct Phase:Decodable {let gain,duration:Double};struct Row:Decodable{let theme:String,phases:[Phase]};static let rows=try! JSONDecoder().decode([Row].self,from:Data(json.utf8));private static let json = #"""\n'+JSON.stringify(rows)+'\n"""#\n}\n');
console.log('PASS original soundtrack owner: 3 themed phase sequences /12 gains /12 durations /actual callback order');
