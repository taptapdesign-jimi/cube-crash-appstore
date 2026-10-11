const fs=require('node:fs'),cp=require('node:child_process'),vm=require('node:vm'),ts=require('../../../node_modules/typescript');
const {TextStyle}=require('../../../node_modules/pixi.js');
const source=cp.execFileSync('git',['show','production-benchmark-v9:src/modules/fx.ts'],{encoding:'utf8'}),ast=ts.createSourceFile('fx.ts',source,ts.ScriptTarget.Latest,true);
const owner=ast.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='showMultiplierTile');if(!owner)throw Error('missing v9 multiplier owner');
class Container{constructor(){this.children=[];this.scale={set(){}}}addChild(...children){this.children.push(...children)}}
class Graphics{circle(){return this}fill(){return this}stroke(){return this}}
const records=[];class Text{constructor(options){this.options=options;this.anchor={set(){}};records.push({caption:options.text,style:new TextStyle(options.style)})}}
const timeline={to(){return this}};
const box={exports:{},Container,Graphics,Text,centerInBoard:()=>({x:0,y:0}),autoAdd:(board,c)=>board.addChild(c),trackTimeline:()=>timeline};
vm.createContext(box);vm.runInContext(ts.transpileModule(owner.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,box);
for(const depth of [2,3,12,99])box.exports.showMultiplierTile(new Container(),{},depth,128,1);
const rows=records.map(({caption,style})=>({caption,fontFamily:style.fontFamily,fontWeight:style.fontWeight,fontSize:style.fontSize,fill:style.fill.color,stroke:{color:style.stroke.color,width:style.stroke.width}}));
for(const row of rows){if(row.fontFamily!=='Arial'||row.fontWeight!=='800'||row.fontSize!==33||row.stroke.width!==2)throw Error('changed immutable contract')}
fs.writeFileSync(__dirname+'/multiplier-oracle.json',JSON.stringify(rows,null,2)+'\n');console.log('PASS executed v9 multiplier owner/Pixi TextStyle',rows.length,'uncapped captions, Arial800/33px/stroke2px');
