import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const source=fs.readFileSync('src/modules/journey-card-overlay-modal.ts','utf8');
const tree=ts.createSourceFile('card.ts',source,ts.ScriptTarget.Latest,true);
const functions=tree.statements.filter(node=>ts.isFunctionDeclaration(node)&&['clamp01','smoothstep','getJourneyCardLegendaryDragShineState'].includes(node.name?.text)).map(node=>node.getText(tree));
const exports={};vm.runInNewContext(ts.transpileModule(functions.join('\n'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Math,Number});
const angles=[-720,-360,-90,-88,-87.99,-72,-28.8,-21.6,-18,-9,-1,0,1,9,18,21.6,28.8,72,87.99,88,90,180,270,331.2,360,720];
const fixtures=angles.map(angle=>{const state=exports.getJourneyCardLegendaryDragShineState(angle);return [angle,state.opacity,state.backgroundPositionPercent,state.rainbowBackgroundPositionPercent]});
fs.writeFileSync('native/gameplay-reward-tests/NativeRewardFoilOracle.swift',`// Executed canonical TS reflection owner; do not edit.\nenum NativeRewardFoilOracle { static let states:[[Double]]=${JSON.stringify(fixtures)} }\n`);
console.log(`${fixtures.length} exact source foil states`);
