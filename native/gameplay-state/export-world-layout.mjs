// Build-time only: execute the exact authored DOM specification producer, never a gameplay runtime.
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
const root = process.cwd();
const read = file => fs.readFileSync(`${root}/${file}`,'utf8');
const source=read('src/modules/journey-boards-manager.ts');
const ast=ts.createSourceFile('owner.ts',source,ts.ScriptTarget.Latest,true);
const clazz=ast.statements.find(ts.isClassDeclaration);
const method=name=>clazz.members.find(n=>n.name?.getText(ast)===name).getText(ast).replace(/^private /,'').replace(/^public /,'');
const prelude=ast.statements.filter(n=>!ts.isImportDeclaration(n)&&!ts.isClassDeclaration(n)&&n.pos>=source.indexOf('const FRAME_HEIGHT')-1&&n.end<source.indexOf('// Card positions')).map(n=>n.getText(ast)).join('\n');
const lock=ast.statements.find(n=>n.getText(ast).startsWith('const LOCKED_BOARD_NUMBER_OFFSETS')).getText(ast);
const modules=['journey-forest-main-assets','journey-stage-balance','journey-world-definitions','journey-card-assets','journey-alien-beam-idle'];
const chunks=modules.map(name=>read(`src/modules/${name}.ts`).replace(/^import[\s\S]*?from [^;]+;\n/gm,'').replace(/\bexport /g,''));
const dom=new JSDOM('<!DOCTYPE html><body></body>',{url:'https://native.invalid/'});
const w=dom.window;
w.matchMedia=()=>({matches:true});
const context={exports:{},window:w,document:w.document,localStorage:w.localStorage,console,Math,getComputedStyle:w.getComputedStyle,
  JOURNEY_V700_UNIT_CARD_EXIT_DURATION:0.48,JOURNEY_V700_UNIT_CARD_EXIT_EASE:'back.in(1.25)',
  getJourneyCardOverlayReturnBoardId:()=>null,
  boardStatsService:{getBoardStats:()=>({highScore:0,longestCombo:0,cubesCracked:0})},
  hasResumableSavedStateForBoard:()=>false,
};
vm.createContext(context);
const code=`${chunks.join('\n')}\n${prelude}\n${lock}\nclass Projection {\n${method('renderForestMapAssets')}\n${method('readNativeForestSnapshot')}\ngetBoardCardAsset(id) {return resolveJourneyCardAsset(id,0)}\n}\nthis.Projection=Projection;`;
vm.runInContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,context);
const output={version:1,source:'src/modules/journey-boards-manager.ts:renderForestMapAssets/readNativeForestSnapshot',viewports:{}};
for(const width of [320,375,390,393,414,428,768,834,1024]) {
  Object.defineProperty(w,'innerWidth',{value:width,configurable:true});
  Object.defineProperty(w,'innerHeight',{value:844,configurable:true});
  const worlds=[];
  for(let world=1;world<=3;world++) {
    const owner=new context.Projection();
    owner.nativePresentationWorldID=world;
    owner.boards=Array.from({length:30},(_,i)=>({id:i+1,unlocked:true,interim:false}));
    owner.journeyMainCloudCompositeCache=new Map();
    owner.nativeWorldBeamSequences=new Map();
    let beamSeed=world;
    context.Math=Object.create(Math); context.Math.random=()=>{beamSeed=(beamSeed*1664525+1013904223)>>>0; return beamSeed/4294967296;};
    const snap=owner.readNativeForestSnapshot('authored-layout',1,0);
    worlds.push(snap);
  }
  output.viewports[String(width)]=worlds;
}
fs.writeFileSync('native/gameplay-state/Sources/StackToSixNativeState/Resources/NativeWorldLayouts.json',JSON.stringify(output));
console.log(`Exported ${Object.keys(output.viewports).length} widths × 3 authored World layouts.`);
