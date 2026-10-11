const fs=require('fs'),vm=require('vm'),crypto=require('crypto');
let source=fs.readFileSync('/tmp/native-completion-20261010-evidence/wild-face-oracle.cjs','utf8').split('const cases=')[0];
source=source.replace("['\u005fsetValueVisuals','\u005fdrawStackInternal','applyFinalMergeResultHiddenVisual']","['_setValueVisuals','_drawStackInternal','applyFinalMergeResultHiddenVisual','setValue']");
source=source.replace('s.getText(tree)','s.getText(tree).replace(/^export /,\'\')');
source=source.replace('const environment={TILE:128','let frames=[];const environment={window:{requestAnimationFrame:true},requestAnimationFrame:callback=>frames.push(callback),TILE:128');
source=source.replace('return _setValueVisuals})','return {paint:_setValueVisuals,setValue}})');
source+=`
let rows=[];
const definitions=[['wild','bee'],['wild-juice','mushroom'],['wild-magnet','spaceship'],['wild-tnt','flower']];
for(const [core,variant] of definitions){for(const switchBeforeRAF of [true,false]){
 frames=[];let clearCount=0;const t={special:core,specialDiceVariant:null,value:0,locked:false,alpha:0,stackDepth:4,base:new Sprite(new Texture('./assets/tile.png')),pips:{visible:true,clear(){clearCount++}},shadow:{visible:true},stackG:{destroy(){}},rotG:{}};
 const before=t.base.texture.asset;paint.setValue(t,6,0);
 const synchronous={value:t.value,alpha:t.alpha,texture:t.base.texture.asset,queued:frames.length};
 if(switchBeforeRAF)t.specialDiceVariant=variant;
 frames.shift()();if(!switchBeforeRAF)t.specialDiceVariant=variant;
 const path=t.base._ccTextureAssetPath.replace(/^\\.\\//,'');
 if(synchronous.texture!==before||synchronous.queued!==1||synchronous.value!==6||synchronous.alpha!==1)throw Error('Source raw setValue no longer has captured one-shot boundary');
 rows.push({core,variant,switchBeforeRAF,synchronous,afterRAF:{value:t.value,path,width:t.base.width,height:t.base.height,anchorY:t.base.anchor.y,stackDepth:t.stackDepth,pipsVisible:t.pips.visible,shadowVisible:t.shadow.visible,clearCount}});
}}
frames=[];let t={special:'wild-juice',value:0,locked:false,alpha:0,destroyed:false};paint.setValue(t,6);t.destroyed=true;frames.shift()();
if(t.base!==undefined)throw Error('Destroyed Source node painted');
fs.writeFileSync('/tmp/native-completion-20261010-evidence/wild-open-face-raf-oracle.json',JSON.stringify({authority:'Actual board.setValue plus _setValueVisuals; exact original registry and PNG dimensions, explicit Sprite/Texture/RAF endpoints. Caller variant assignment simulated before/after genuine queued callback; not whole open/meter/asset composer proof.',sourceSHA256:require('crypto').createHash('sha256').update(original).digest('hex'),rows,destroyedCallback:'No paint',numbersDraws:0},null,2));
console.log('Actual Source raw face RAF:8 current-identity cases and destroyed callback PASS');
`;
vm.runInThisContext('(function(require){'+source+'\n})')(require);
