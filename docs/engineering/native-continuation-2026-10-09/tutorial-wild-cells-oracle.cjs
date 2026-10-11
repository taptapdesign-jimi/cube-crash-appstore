const fs=require('fs'),vm=require('vm'),crypto=require('crypto'),ts=require('/Users/user/cube-crash/node_modules/typescript');
const root='/Users/user/cube-crash';
const first=fs.readFileSync(root+'/src/modules/first-play-tutorial.ts','utf8'),app=fs.readFileSync(root+'/src/modules/app-core.ts','utf8');
const ast=ts.createSourceFile('first.ts',first,ts.ScriptTarget.Latest,true),core=ts.createSourceFile('app.ts',app,ts.ScriptTarget.Latest,true);
const names=['getFourthStepPreferredWildCell','isFourthStepWildCellAvailable','findFourthStepWildCell','findEmptyishCell'];
const funcs=names.map(name=>{const n=ast.statements.find(x=>ts.isFunctionDeclaration(x)&&x.name?.text===name);if(!n)throw Error(name);return n.getText(ast)}).join('\n');
function initializer(name){let result;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(core)===name)result=n.initializer.getText(core);ts.forEachChild(n,visit)}visit(core);if(!result)throw Error(name);return result}
const resolve=`const isTutorialWildSpawnCellAvailable=${initializer('isTutorialWildSpawnCellAvailable')};const findTutorialFallbackWildSpawnCell=${initializer('findTutorialFallbackWildSpawnCell')};globalThis.resolved=${initializer('forcedTutorialWildCell')};`;
const js=s=>ts.transpile(s,{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None});
const results=[];
for(let index=0;index<96;index++){
 const columns=[1,3,5,7][index%4],rows=[1,2,5,9][Math.floor(index/4)%4];
 const tiles=[];for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
  const q=(row*17+column*11+index*7)%23;
  const special=q===4||q===6?'wild':q===8?'wild-tnt':null;
  const value=q<4?0:special?6:1+q%5;
  tiles.push({id:`t:${column}:${row}`,column,row,value,locked:q===1||q===3||q===4,destroyed:q===7,special,cleared:false,residual:false});
 }
 const preferred=tiles.find(t=>t.column===Math.floor(columns/2)&&t.row===Math.min(rows-1,1));
 // Curated fallback and zero-special/residual cases force the rare predicates.
 if(index>=64){for(const t of tiles){t.locked=false;t.value=2;t.special=null;t.destroyed=false}
  if(index%8===0){preferred.value=0;preferred.special='wild';preferred.locked=false}
  if(index%8===1){const t=tiles.at(-1);t.value=0;t.special='wild-tnt'}
  if(index%8===2){preferred.value=0;preferred.cleared=true;preferred.residual=true}
  if(index%8===3){tiles[0].destroyed=true}
  if(index%8===4){tiles[0].value=4;tiles[0].locked=true}
  if(index%8===5){tiles.at(-1).value=0;tiles.at(-1).locked=true}
 }
 const emptyGridCells=index%6===0?[{column:preferred.column,row:preferred.row}]:[];
 const wild=index%9===0?tiles.find(t=>t.special==='wild'):undefined;
 const nativeCell=c=>c==null?null:{column:c.c,row:c.r};
 const grid=Array.from({length:rows},()=>Array(columns).fill(null));
 for(const t of tiles){if(emptyGridCells.some(c=>c.column===t.column&&c.row===t.row))continue;grid[t.row][t.column]={...t,gridX:t.column,gridY:t.row,special:t.cleared?null:t.special};}
 const sandbox={STATE:{grid},COLS:columns,ROWS:rows};vm.createContext(sandbox);vm.runInContext(js(funcs),sandbox);
 const wildObject=wild?grid[wild.row][wild.column]:null;
 const reserved=nativeCell(vm.runInContext(`findFourthStepWildCell(${wildObject?'STATE.grid['+wild.row+']['+wild.column+']':'null'})`,sandbox));
 // Revalidation is a separate live grid. Fill the original reserved cell;
 // retained original reservation must govern subsequent tie ordering.
 const laterTiles=tiles.map(t=>({...t}));
 if(index%3===0&&reserved){const t=laterTiles.find(t=>t.column===reserved.column&&t.row===reserved.row);if(t){t.value=4;t.special=null;t.locked=false;t.destroyed=false;t.cleared=false;t.residual=false}}
 const excluded=index%5===0?[{column:preferred.column,row:preferred.row}]:[];
 const raw=index%13===0?{column:2147483650,row:-1}:reserved;
 const grid2=Array.from({length:rows},()=>Array(columns).fill(null));
 for(const t of laterTiles)grid2[t.row][t.column]={...t,gridX:t.column,gridY:t.row,special:t.cleared?null:t.special};
 const env={grid:grid2,excludeCells:excluded.map(c=>({c:c.column,r:c.row})),COLS:columns,ROWS:rows,window:{__ccFirstPlayTutorialWildSpawnCell:{c:raw.column,r:raw.row}}};vm.createContext(env);vm.runInContext(js(resolve),env);
 results.push({index,columns,rows,tiles,wildID:wildObject?.id??null,emptyGridCells,reserved,laterTiles,excluded,rawResolvedFrom:raw,resolved:nativeCell(env.resolved),updatedWindowCell:nativeCell(env.window.__ccFirstPlayTutorialWildSpawnCell)});
}
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const output={authority:'literal original TS functions and original app-core IIFE executed in Node vm; no copied selection algorithm',firstSourceSHA256:sha(first),appSourceSHA256:sha(app),cases:results};
const path='/tmp/native-resume-20261009/source/native/gameplay-core/Tests/StackToSixGameplayTests/Resources/SourceTutorialWildCellsV9Oracle.json';fs.writeFileSync(path,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({cases:results.length,output:path,sha256:sha(fs.readFileSync(path))}));
