const fs=require('fs'),vm=require('vm'),crypto=require('crypto'),ts=require('/Users/user/cube-crash/node_modules/typescript');
const root='/Users/user/cube-crash';
const paths={tutorial:root+'/src/modules/first-play-tutorial.ts',save:root+'/src/modules/app-core-save-tiles.ts',registry:root+'/src/modules/special-dice-registry.ts'};
const sources=Object.fromEntries(Object.entries(paths).map(([k,p])=>[k,fs.readFileSync(p,'utf8')]));
function withoutImports(source){const ast=ts.createSourceFile('x.ts',source,ts.ScriptTarget.Latest,true);return ast.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(ast)).join('\n')}
function compile(source){return ts.transpile(source,{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS})}
const registry={exports:{}};vm.createContext(registry);vm.runInContext(compile(withoutImports(sources.registry)),registry);
const save={exports:{},getCompatibleSpecialDiceVariant:registry.exports.getCompatibleSpecialDiceVariant};vm.createContext(save);vm.runInContext(compile(withoutImports(sources.save)),save);
const ast=ts.createSourceFile('tutorial.ts',sources.tutorial,ts.ScriptTarget.Latest,true);
const names=['clearGridReference','placeTile','getFourthStepPreferredWildCell','isFourthStepWildCellAvailable','findFourthStepWildCell','findEmptyishCell'];
const funcs=names.map(name=>{const n=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);if(!n)throw Error(name);return n.getText(ast)}).join('\n');
const cases=[];
for(const mode of ['locked-zero','locked-positive','empty','current-top','destroyed-placeholder','unlocked-zero']){
 const tiles=[];const grid=Array.from({length:9},()=>Array(5).fill(null));
 for(let r=0;r<9;r++)for(let c=0;c<5;c++){const t={id:`${c}:${r}`,gridX:c,gridY:r,value:2,locked:false,special:null,visible:true,alpha:1,eventMode:'static'};grid[r][c]=t;tiles.push(t)}
 const wild=grid[mode==='current-top'?0:4][2];wild.special='wild';wild.value=6;wild.isWild=true;
 const displaced=grid[1][2];
 if(mode==='locked-zero'){displaced.value=0;displaced.locked=true}
 if(mode==='locked-positive'){displaced.value=4;displaced.locked=true}
 if(mode==='empty'){grid[1][2]=null;tiles.splice(tiles.indexOf(displaced),1)}
 if(mode==='destroyed-placeholder'){displaced.destroyed=true;displaced.locked=true;displaced.value=0}
 if(mode==='unlocked-zero'){displaced.value=0;displaced.locked=false}
 const ctx={STATE:{tiles,grid},COLS:5,ROWS:9,TILE:128,GAP:0};vm.createContext(ctx);vm.runInContext(compile(funcs),ctx);ctx.wild=wild;
 vm.runInContext('const selected=findFourthStepWildCell(wild);placeTile(wild,selected.c,selected.r);globalThis.selected=selected;',ctx);
 let codes=[],savedCount=null;
 try{savedCount=save.exports.buildGridSnapshot({ROWS:9,COLS:5,tiles,grid,devLog(){},devWarn(){}}).savedTilesCount}catch(e){if(!Array.isArray(e.issues))throw e;codes=e.issues.map(i=>i.code)}
 const hasLiveOrphan=tiles.some(t=>!t.destroyed&&!grid.some(row=>row.includes(t)));
 cases.push({mode,selected:ctx.selected,wildOwnsGrid:grid[wild.gridY][wild.gridX]===wild,displacedRetained:tiles.includes(displaced),displacedDestroyed:displaced.destroyed===true,hasLiveOrphan,saveIssueCodes:codes,savedCount});
 if(hasLiveOrphan&&!codes.includes('orphan-live-tile'))throw Error('Original save unexpectedly accepts orphan');
 if(['locked-zero','locked-positive','unlocked-zero'].includes(mode)&&(!tiles.includes(displaced)||displaced.destroyed))throw Error('Original placement destroyed displaced object');
}
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');const output={authority:'Literal original tutorial placement and original save validator with literal registry functions; no rewritten selection or save algorithm',sourceSHA256:Object.fromEntries(Object.entries(sources).map(([k,s])=>[k,sha(s)])),cases};
const dest='/tmp/native-resume-20261009/tutorial-fourth-grid-save-oracle.json';fs.writeFileSync(dest,JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({cases:cases.length,casesSummary:cases.map(c=>({mode:c.mode,orphan:c.hasLiveOrphan,codes:c.saveIssueCodes})),sha256:sha(fs.readFileSync(dest))}));
