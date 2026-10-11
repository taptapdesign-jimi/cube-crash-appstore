const fs=require('fs'),root='/Users/user/cube-crash',ts=require(root+'/node_modules/typescript');
const ast=ts.createSourceFile('visibility.ts',fs.readFileSync(root+'/src/modules/special-dice-idle-visibility.ts','utf8'),ts.ScriptTarget.Latest,true);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='isSpecialDiceIdlePaintable');
const code=ts.transpileModule(fn.getText(ast).replace('export ',''),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
const STATE={app:{canvas:null}},document={hidden:false};
const run=new Function('STATE','document',code+';return isSpecialDiceIdlePaintable')(STATE,document);
const rows=[];
for(const name of ['visible','canvas-hidden','canvas-opacity-threshold','carrier-hidden','carrier-alpha-threshold','half-alpha','base-hidden']){
 const wrapper={style:{opacity:''}},canvas={style:{opacity:''},parentElement:wrapper};STATE.app.canvas=canvas;
 const parent={alpha:1,visible:true},host={alpha:1,visible:true,parent};const tile={alpha:1,visible:true,rotG:host,base:{visible:true,renderable:true}};
 if(name==='canvas-hidden')wrapper.hidden=true;
 if(name==='canvas-opacity-threshold')wrapper.style.opacity='0.001';
 if(name==='carrier-hidden')parent.visible=false;
 if(name==='carrier-alpha-threshold')parent.alpha=0.001;
 if(name==='half-alpha')parent.alpha=0.5;
 if(name==='base-hidden'){tile.base.visible=false;tile.base.renderable=false}
 rows.push({name,paintable:run(tile)});
}
fs.writeFileSync('/tmp/native-completion-20261010-evidence/wild-shimmer-visibility-oracle.json',JSON.stringify({authority:'actual original isSpecialDiceIdlePaintable; explicit DOM/container endpoints',rows},null,2));console.log(rows);
