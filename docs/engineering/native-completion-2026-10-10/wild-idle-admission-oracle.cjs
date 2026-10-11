const fs=require('fs'),path=require('path'),vm=require('vm');
const root='/Users/user/cube-crash',ts=require(root+'/node_modules/typescript');
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;
 const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const req=s=>{
 if(s.includes('special-dice-idle.ts'))return {startSpecialDiceIdleMotion:t=>t.trace.push('register-special-idle')};
 if(s.includes('wild-star-bouncy-artwork'))return {isPlainWildStarBouncyTile:plainStar};
 if(s.includes('gameplay-texture-filtering'))return {applyGameplayTextureFiltering(){}};
 if(s.includes('pixi-image-texture-health'))return {isUsablePixiImageTexture:t=>!!t,pinPixiImageTexture(){},reloadPixiImageTexture:()=>Promise.reject(Error('unexpected reload'))};
 if(s.includes('visual-asset-broker'))return {};
if(s.includes('tile-lifecycle-service'))return {removeTileFully(){throw Error('unexpected existing tile')}};let f=path.resolve(path.dirname(file),s);if(!f.endsWith('.ts'))f+='.ts';return load(f)};
 vm.runInThisContext('(function(require,module,exports){'+code+'\n})',{filename:file})(req,m,m.exports);return m.exports;}
const registry=load(root+'/src/modules/special-dice-registry.ts'),restore=load(root+'/src/modules/app-core-load-tiles.ts');
const ast=ts.createSourceFile('predicate.ts',fs.readFileSync(root+'/src/modules/wild-star-bouncy-artwork.ts','utf8'),ts.ScriptTarget.Latest,true);
const predicate=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='isPlainWildStarBouncyTile');
const predicateJS=ts.transpileModule(predicate.getText(ast).replace('export ',''),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
const plainStar=new Function('getSpecialDiceVariantForTile',predicateJS+';return isPlainWildStarBouncyTile')(registry.getSpecialDiceVariantForTile);
const skin=load(root+'/src/modules/app-core-wild-skin.ts');
const roster=JSON.parse(fs.readFileSync(root+'/docs/engineering/native-completion-2026-10-10/wild-restore-oracle.json','utf8'));
(async()=>{let cases=[];
 for(const row of roster){
  const t={special:row.outputCore,_ccSpecialDiceVariant:row.variant,trace:[],base:{anchor:{set(){}},scale:{set(){}},texture:{}},children:[],pips:{clear(){}},shadow:{}};
  const frames=[];
  const deps={Texture:class{},Rectangle:class{},TILE:128,ASSET_WILD:'assets/wild.png',ASSET_WILD_JUICE:'assets/wild-juice.png',ASSET_WILD_MAGNET:'assets/wild-magnet.png',ASSET_WILD_TNT:'assets/shop/explosion pack/tnt.png',
  acquireVisualAssetTexture:async assetPath=>({texture:{orig:{width:128,height:128}},assetPath,rendererGeneration:1}),getVisualAssetRendererGeneration:()=>1,isVisualAssetTextureHandleCurrent:()=>true,devWarn(){throw Error('unexpected warning')},trackAppAnimationFrame:f=>{t.trace.push('queue-magnet-frame');frames.push(f)}};
  for(const name of ['startWildShimmer','startWildJuiceBubbles','startWildStars','startMagnetIdleParticles','startTntIdleParticles','startTntIdleShake','stopTntIdleParticles','stopTntIdleShake'])deps[name]=()=>t.trace.push(name);
  t._ccDeferWildIdleFx=true;
  if(!await skin.applyWildSkinLocalCore(t,deps))throw Error('static admission failed');
  if(t.trace.length)throw Error('deferred effects started');
  restore.resumeDeferredWildIdleEffects([t],tile=>skin.applyWildSkinLocalCore(tile,deps));
  const sync=[...t.trace];frames.forEach(f=>f());
  cases.push({variant:row.variant,inputCore:row.inputCore,core:t.special,synchronous:sync,afterFrame:[...t.trace]});
 }
 fs.writeFileSync('/tmp/native-completion-20261010-evidence/wild-idle-admission-oracle.json',JSON.stringify({boundary:'Actual Source skin and resume/predicate/registry; explicit effect/texture/frame endpoints, not complete idle composers or renderer',cases},null,2));console.log(cases.length+' original deferred idle admissions executed');
})().catch(e=>{console.error(e);process.exitCode=1});
