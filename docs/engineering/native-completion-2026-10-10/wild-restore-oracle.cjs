const fs=require('fs'),path=require('path'),vm=require('vm');
const root='/Users/user/cube-crash',ts=require(root+'/node_modules/typescript');
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;
 const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const req=s=>{if(s.includes('tile-lifecycle-service'))return {removeTileFully(){throw Error('unexpected existing tile')}};let f=path.resolve(path.dirname(file),s);if(!f.endsWith('.ts'))f+='.ts';return load(f)};
 vm.runInThisContext('(function(require,module,exports){'+code+'\n})',{filename:file})(req,m,m.exports);return m.exports;}
const registry=load(root+'/src/modules/special-dice-registry.ts'),restore=load(root+'/src/modules/app-core-load-tiles.ts');
const variants=['bee','fish','kanta','laser-gun','spaceship','bottle','honey','flower','barell','mushroom','robo-cube','cubero','beach-ball'];
const rows=[];
for(const variant of [null,...variants]){
 const core=variant?registry.getCoreWildTypeForSpecialDiceVariant(registry.getSpecialDiceVariant(variant)):'wild';
 for(const legacyCore of variant===null?['wild','wild-juice','wild-magnet','wild-tnt']:variant==='beach-ball'?[core,'wild-juice','wild-magnet']:[core]){
 const grid=Array.from({length:9},()=>Array(5).fill(null));grid[3][2]={value:6,special:legacyCore,specialDiceVariant:variant,locked:false,open:true,isWild:true,gridX:2,gridY:3};grid[0][0]={value:0,locked:true,open:false,gridX:0,gridY:0};
 let tiles=[],calls=[];
 const out=restore.restoreTilesFromSave({gameState:{grid,score:123,moves:23,boardNumber:7,level:7,wildMeter:0.4},tiles,grid:[],ROWS:9,COLS:5,board:{},createEmptyGrid:()=>Array.from({length:9},()=>Array(5).fill(null)),makeBoard:{createTile(a){calls.push('ctor:'+a.r+','+a.c);const t={value:a.val,locked:a.locked,scale:{set(){}},ghostFrame:{}};tiles.push(t);return t},setValue(t,v){calls.push('face:'+t.gridY+','+t.gridX);t.value=v}},applyWildSkinLocal(t){calls.push('skin:'+t.gridY+','+t.gridX)},stopWildShimmer(){},stopMagnetIdleParticles(){},trackAppTimeout(){throw Error('unexpected timeout')},STATE:{drag:{bindToTile(){}}},devLog(){},devWarn(){},devError(){}});
 rows.push({variant,inputCore:legacyCore,outputCore:tiles[1].special,deferred:out.deferredWildIdleTiles.length,calls,tiles:tiles.map(t=>({value:t.value,locked:t.locked,special:t.special??null,variant:t._ccSpecialDiceVariant??null,alpha:t.alpha,visible:t.visible}))});
 }}
fs.writeFileSync('/tmp/native-completion-20261010-evidence/wild-restore-oracle.json',JSON.stringify(rows,null,2));console.log(rows.length+' actual Source restore cases');
