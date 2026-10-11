const fs=require('fs'),root='/Users/user/cube-crash',ts=require(root+'/node_modules/typescript'),esbuild=require(root+'/node_modules/esbuild');
const src=fs.readFileSync(root+'/src/modules/fx.ts','utf8'),ast=ts.createSourceFile('fx.ts',src,ts.ScriptTarget.Latest,true);
const names=['makeLinearGradientTexture','isWildShimmerTextureUsable','pruneWildShimmerTextureCache','acquireWildShimmerTexture','createWildShimmer'];
let code="import {Container,Sprite,Texture,Graphics,ImageSource,autoDetectRenderer,Rectangle,RendererType} from 'pixi.js';\nconst MAX_WILD_SHIMMER_TEXTURE_CACHE_ENTRIES=4,wildShimmerTextureCache=new Map();\nfunction destroyRuntimeTexture(t){t.destroy(true)}\n";
for(const name of names){const n=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);if(!n)throw Error(name);code+=ts.transpileModule(n.getText(ast).replace('export ',''),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText+'\n'}
code+=`window.renderOriginalWildShimmer=async function(p){
 const image=new Image();image.src='data:image/png;base64,'+p.png;await image.decode();
 const texture=new Texture({source:new ImageSource({resource:image,resolution:p.resolution})});
 const renderer=await autoDetectRenderer({width:p.canvas,height:p.canvas,resolution:1,backgroundAlpha:0,preference:'webgl',antialias:false});
 if(renderer.type!==RendererType.WEBGL)throw Error("Original reference requires real WebGL");
 const stage=new Container(),host=new Container();host.position.set(p.canvas/2);host.scale.set(p.density);stage.addChild(host);
 const base=new Sprite(texture);base.anchor.set(.5,p.anchorY);base.width=p.width;base.height=p.height;base.position.set(p.x,p.y);base.rotation=p.rotation;
 const tile={rotG:host,base};const shimmer=createWildShimmer(tile);shimmer.alpha=.3;tile._wildShimmerSprite.position.set(0,0);
 renderer.render(stage);const result=renderer.extract.pixels({target:stage,frame:new Rectangle(0,0,p.canvas,p.canvas),resolution:1});
 const alpha=Array.from(result.pixels).filter((_,i)=>i%4===3);
 tile._wildShimmerTextureRelease();stage.destroy({children:true});texture.destroy(true);renderer.destroy();return alpha;
};`;
const result=esbuild.buildSync({stdin:{contents:code,resolveDir:root,sourcefile:'actual-fx-shimmer-gpu-reference.js'},bundle:true,write:false,format:'iife',platform:'browser',minify:true});
const dest='/tmp/native-completion-20261010-source/native/standalone/Stack to SixTests/SourceWildShimmerGPUReference.js';fs.writeFileSync(dest,result.outputFiles[0].contents);
fs.writeFileSync('/tmp/native-completion-20261010-evidence/wild-shimmer-gpu-reference-build.json',JSON.stringify({authority:'Exact five original fx.ts functions and installed real Pixi WebGL renderer; PNG decode and actual artwork sprite mask, no mocked mask/gradient renderer',functions:names,sourceSHA256:require('crypto').createHash('sha256').update(src).digest('hex'),bundleSHA256:require('crypto').createHash('sha256').update(result.outputFiles[0].contents).digest('hex'),pixiVersion:require(root+'/node_modules/pixi.js/package.json').version},null,2));
console.log('Built test-only original Pixi GPU reference',result.outputFiles[0].contents.length);
