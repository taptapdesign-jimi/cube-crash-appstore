import fs from 'node:fs';
import ts from 'typescript';
import { getJourneyWorldDefinition } from '../journey-world-definitions';
import { getJourneyEarnedStars } from '../journey-stage-balance';
import { JOURNEY_FOREST_MAIN_ASSET, JOURNEY_FOREST_MAIN_ASSET_2X } from '../journey-forest-main-assets';
import { JOURNEY_CARD_FLIP_BACK_ASSET } from '../journey-card-assets';
import { createNativeBeachBubbleProjection } from '../journey-beach-bubble-drift';
import { createNativeArea55ShipProjection } from '../journey-area55-ship-flybys';
import { createJourneyAlienBeamIdleSequence } from '../journey-alien-beam-idle';
import { createNativeForestBeeProjection } from '../journey-forest-bee-orbits';

// Execute production manager bodies/helpers, retaining real authored DOM specs,
// world definitions and star calculation without booting the game singleton.
const source = ts.createSourceFile('manager.ts',fs.readFileSync('src/modules/journey-boards-manager.ts','utf8'),ts.ScriptTarget.Latest,true);
const methods = new Map<string,ts.MethodDeclaration>();
function visit(node:ts.Node) { if(ts.isMethodDeclaration(node))methods.set(node.name.getText(source),node); ts.forEachChild(node,visit); }
visit(source);
const names = new Set(['BOARD_TRANSITION_ASSET_BASE','FOREST_WORLD_ASSET_BASE','FOREST_LEVEL_STARS_ASSET_BASE','JOURNEY_LEVEL_STAR_ASSETS','FOREST_MAP_DESIGN_WIDTH','FOREST_MAP_DESIGN_HEIGHT','JOURNEY_V700_WORLD_CLOUD_ASSETS','journeySeededUnit','JOURNEY_V700_FOREST_SCOPE_EXTRA_DOWN_PX','JOURNEY_BOARD_CARD_POSITION_OFFSETS_PX','LOCKED_BOARD_NUMBER_OFFSETS','BEACH_WORLD_ASSET_BASE','ROBO_WORLD_ASSET_BASE','JOURNEY_V700_BEACH_AREA55_SCOPE_LIFT_PX','JOURNEY_V700_WORLD_BOTTOM_ROOM_PX','JOURNEY_BOARD_UNIT_HORIZONTAL_OFFSETS_PX']);
const declarations = source.statements.filter(node=>ts.isVariableStatement(node) && node.declarationList.declarations.some(item=>names.has(item.name.getText(source)))).map(node=>node.getText(source)).join('\n');
const helpers = ['getJourneyBoardUnitHorizontalOffsetPx','getJourneyMainCloudRenderSpecs','getJourneyBoardCardPositionOffsetPx','getJourneyEarnedLevelStars'].map(name=>source.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name)!.getText(source)).join('\n');
function fixture(worldID: 1 | 2 | 3 = 1) {
  document.body.innerHTML='<section id="journey-screen"><div id="journey-boards-container"></div></section>';
  Object.defineProperty(document,'hidden',{configurable:true,value:false});
  Object.defineProperty(window,'innerWidth',{configurable:true,value:390}); Object.defineProperty(window,'innerHeight',{configurable:true,value:844});
  (window as any).__jimiNativeForestEnabled=true;
  (window as any).__jimiNativeWorldsEnabled=true;
  localStorage.removeItem('journey_viewed_boards');
  let zone='journey'; const saved=new Set([3,13,23]);
  const stats = new Map(Array.from({length:30},(_,i)=>[i+1,{highScore:1000*(i+1),longestCombo:i+2}]));
  const scope:any = {createNativeBeachBubbleProjection,createNativeArea55ShipProjection,createJourneyAlienBeamIdleSequence,createNativeForestBeeProjection,getJourneyWorldDefinition,getJourneyEarnedStars,JOURNEY_FOREST_MAIN_ASSET,JOURNEY_FOREST_MAIN_ASSET_2X,JOURNEY_CARD_FLIP_BACK_ASSET,
    getJourneyWorldContentTopPx:()=>138,getJourneyWorldCardStackTopPx:()=>196,
    boardStatsService:{getBoardStats:jest.fn((id:number)=>stats.get(id))},hasResumableSavedStateForBoard:jest.fn((id:number)=>saved.has(id)),
    appZoneManager:{getCurrentZone:()=>zone},getJourneyCardOverlayReturnBoardId:()=>null,
    markJourneyBoardViewed:jest.fn(),clearJourneyInterimOrigin:jest.fn(),cancelJourneyCardOverlayReturn:jest.fn()};
  const owner:any={nativePresentationWorldID:worldID,nativeForestBeeSessionID:0,boards:Array.from({length:30},(_,i)=>({id:i+1,unlocked:i%10<3,interim:i%10===1})),journeyMainCloudCompositeCache:new Map(),
    suspendForHomepage:jest.fn(),setJourneyV700View:jest.fn(),loadBoardsState:jest.fn(),
    getBoardCardAsset:jest.fn((id:number)=>({path1x:`./assets/card-${id}.png`,path2x:`./assets/card-${id}@2x.png`,rarity:'common'})),
    markBoardAsViewed:jest.fn(),rememberLastActiveJourneyWorld:jest.fn(),
    continueFromInterimBoard:jest.fn(async()=>{zone='board-journey';}),startJourneyBoardFromOverlay:jest.fn(async()=>{zone='board-journey';})};
  const prelude=ts.transpileModule(`${declarations}\n${helpers}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  for(const name of ['renderForestMapAssets','prepareNativeForest','readNativeForestSnapshot','readNextNativeWorldAmbientPlans','markNativeForestCardOpened','launchNativeForestBoard','retireNativeForest']) {
    const method=methods.get(name)!;const async=method.modifiers?.some(item=>item.kind===ts.SyntaxKind.AsyncKeyword)?'async ':'';
    const code=ts.transpileModule(`${async}function run(${method.parameters.map(item=>item.getText(source)).join(',')})${method.body!.getText(source)}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
    owner[name]=new Function('scope',`with(scope){${prelude}\n${code};return run;}`)(scope).bind(owner);
  }
  return {owner,scope,stats,saved,setZone:(value:string)=>{zone=value;}};
}
afterEach(()=>{jest.restoreAllMocks();document.body.replaceChildren();delete (window as any).__jimiNativeForestEnabled;delete (window as any).__jimiNativeWorldsEnabled;});

test('logical prepare owns no live World render/decode and fails closed outside current visible Journey',()=>{
  const f=fixture(), decode=jest.spyOn(HTMLImageElement.prototype,'src','set');
  expect(f.owner.prepareNativeForest()).toBe(true);expect(f.owner.suspendForHomepage).toHaveBeenCalledTimes(1);
  expect(f.owner.setJourneyV700View).toHaveBeenCalledWith('world',1);expect(f.owner.loadBoardsState).toHaveBeenCalledTimes(1);
  expect(document.querySelectorAll('img')).toHaveLength(0);expect(decode).not.toHaveBeenCalled();
  f.setZone('settings');expect(f.owner.prepareNativeForest()).toBe(false);
  f.setZone('journey');Object.defineProperty(document,'hidden',{configurable:true,value:true});expect(f.owner.prepareNativeForest()).toBe(false);
});

test('real original Forest art specification never assigns image src/srcset or mounts detached art',()=>{
  const f=fixture(), src=jest.spyOn(HTMLImageElement.prototype,'src','set'),srcset=jest.spyOn(HTMLImageElement.prototype,'srcset','set');
  const bg=document.createElement('div'),decor=document.createElement('div');
  const result=f.owner.renderForestMapAssets(bg,decor,1,{specificationOnly:true});
  expect(result.boardTargets.size).toBe(10);expect(result.mainTargets[0].dataset.nativeAsset).toBe(JOURNEY_FOREST_MAIN_ASSET);
  expect(bg.querySelectorAll('img').length).toBeGreaterThan(20);expect(document.querySelectorAll('img')).toHaveLength(0);
  expect(src).not.toHaveBeenCalled();expect(srcset).not.toHaveBeenCalled();
  for(const image of [...bg.querySelectorAll('img'),...decor.querySelectorAll('img')])expect(image.dataset.nativeAsset).toMatch(/^\.\/assets\//);
});

test('all ten snapshots reuse original Units with canonical stats/saved actions and cached unchanged geometry',()=>{
  const f=fixture();f.owner.prepareNativeForest();const render=jest.spyOn(f.owner,'renderForestMapAssets');
  const first=f.owner.readNativeForestSnapshot('1',1,1);expect(first.units).toHaveLength(10);
  expect(first.units[0].allowedActions).toEqual(['openCard','play']);
  expect(first.units[1]).toMatchObject({interim:true,locked:false,cardArt:'./assets/colelctibles/interim.png',allowedActions:['continue','continue']});
  expect(first.units[2].allowedActions).toEqual(['openCard','continue']);
  expect(first.units[3]).toMatchObject({locked:true,allowedActions:[]});expect(first.units[3].parts.some((part:any)=>part.role==='card')).toBe(false);
  expect(first.units[0].stats).toEqual([{label:'High Score',value:(1000).toLocaleString()},{label:'Longest Combo',value:'2'}]);
  expect(first.units[0].stars).toBe(getJourneyEarnedStars(1000,1));
  const definition=getJourneyWorldDefinition(1)!;
  expect(first.units[0].frame.width).toBe(definition.stages[0].widthPx);
  expect(first.units[0].parts.find((part:any)=>part.role==='card')).toMatchObject({x:0,y:0,width:first.units[0].frame.width,rotation:definition.stages[0].rotationDeg});
  const island=first.units[0].parts.find((part:any)=>part.role==='island');expect(island.asset).toContain('/forest1.png');
  expect(island.x+first.units[0].frame.x).toBeCloseTo(4);expect(island.y+first.units[0].frame.y).toBeCloseTo(284+138+16);
  const second=f.owner.readNativeForestSnapshot('2',2,7);expect(render).toHaveBeenCalledTimes(1);expect(second.units).toBe(first.units);expect(second.requestID).toBe('2');
  f.stats.get(1)!.highScore=2000;expect(f.owner.readNativeForestSnapshot('3',2,8).units[0].stats[0].value).toBe((2000).toLocaleString());expect(render).toHaveBeenCalledTimes(2);
});

test('native viewed marker delegates canonical helper only for current regular unlocked card',()=>{
  const f=fixture();f.owner.prepareNativeForest();f.owner.markNativeForestCardOpened(1);
  expect(f.scope.markJourneyBoardViewed).toHaveBeenCalledWith('1');expect(f.owner.markBoardAsViewed).toHaveBeenCalledWith(1);
  f.owner.markNativeForestCardOpened(2);f.owner.markNativeForestCardOpened(4);f.owner.markNativeForestCardOpened(11);
  expect(f.scope.markJourneyBoardViewed).toHaveBeenCalledTimes(1);
  f.owner.retireNativeForest();f.owner.markNativeForestCardOpened(1);expect(f.scope.markJourneyBoardViewed).toHaveBeenCalledTimes(1);
});

test('gameplay parking and changed stats retain bee session while logical World retirement creates a new one',()=>{
  const f=fixture();f.owner.prepareNativeForest();
  const first=f.owner.readNativeForestSnapshot('first',1,1);
  expect(first.beeSessionID).toBe(1);expect(first.beePlans).toHaveLength(5);
  f.setZone('board-journey');f.setZone('journey');
  f.stats.get(1)!.highScore+=1;
  const returned=f.owner.readNativeForestSnapshot('return',2,2);
  expect(returned.beeSessionID).toBe(first.beeSessionID);expect(returned.beePlans).toBe(first.beePlans);
  f.owner.retireNativeForest();expect(f.owner.nativeForestBeeProjection).toBeNull();
  f.owner.prepareNativeForest();
  const reopened=f.owner.readNativeForestSnapshot('reopen',3,1);
  expect(reopened.beeSessionID).toBe(2);expect(reopened.beePlans).not.toBe(first.beePlans);
});

test.each([390,430])('legal scroll extent includes complete original Unit10 island and clouds at width%i',width=>{
  const f=fixture();Object.defineProperty(window,'innerWidth',{configurable:true,value:width});
  const snapshot=f.owner.readNativeForestSnapshot('extent',1,1),unit=snapshot.units[9],scale=width/390;
  const island=unit.parts.find((p:any)=>p.role==='island');
  // The original forest10 bitmap is exactly200x200, authored at1262.
  const expectedIslandBottom=1262+138/scale+16+200;
  expect(unit.frame.y+island.y+island.width).toBeCloseTo(expectedIslandBottom);
  expect(snapshot.contentHeight).toBeGreaterThanOrEqual(expectedIslandBottom+40/scale);
  const cloud=unit.parts.find((p:any)=>p.asset.endsWith('oblak veliki ljevo dole.png'));
  expect(snapshot.contentHeight).toBeCloseTo(unit.frame.y+cloud.y+284*384/561+40/scale,8);
});

test.each([[1,'play','startJourneyBoardFromOverlay'],[2,'continue','continueFromInterimBoard'],[3,'continue','startJourneyBoardFromOverlay']] as const)('native board %i %s delegates one canonical owner with completed native exit',async(id,action,method)=>{
  const f=fixture();const presentation=jest.fn(async()=>true);f.owner.prepareNativeForest();expect(await f.owner.launchNativeForestBoard(id,action,presentation)).toBe(true);
  expect(f.owner[method]).toHaveBeenCalledTimes(1);const [board,exit,ready]=f.owner[method].mock.calls[0];expect(board.id).toBe(id);await expect(exit).resolves.toBeUndefined();expect(ready).toBe(presentation);
  expect(f.owner[method==='continueFromInterimBoard'?'startJourneyBoardFromOverlay':'continueFromInterimBoard']).not.toHaveBeenCalled();
});

test('illegal locked/wrong-action/background/foreign-zone gameplay requests never reach canonical launch',async()=>{
  const f=fixture();f.owner.prepareNativeForest();
  expect(await f.owner.launchNativeForestBoard(4,'play')).toBe(false);expect(await f.owner.launchNativeForestBoard(1,'continue')).toBe(false);
  expect(await f.owner.launchNativeForestBoard(11,'play')).toBe(false);
  f.setZone('settings');expect(await f.owner.launchNativeForestBoard(1,'play')).toBe(false);
  f.setZone('journey');Object.defineProperty(document,'hidden',{configurable:true,value:true});expect(await f.owner.launchNativeForestBoard(1,'play')).toBe(false);
  expect(f.owner.startJourneyBoardFromOverlay).not.toHaveBeenCalled();expect(f.owner.continueFromInterimBoard).not.toHaveBeenCalled();
});

test('native card viewport geometry matches actual canonical DOM positioning and parent padding',()=>{
  const f=fixture();f.owner.prepareNativeForest();
  const definition=getJourneyWorldDefinition(1)!;
  // Execute the original renderer through its geometry assignments, before
  // mounting artwork or interactive owners. This compares two real producers.
  const body=methods.get('createBoardCardFixed')!.body!.getText(source);
  const geometry=body.slice(1,body.indexOf('    // 🔥 FIX: Ensure wrapper has no border'))+'\nreturn cardWrapper;\n}';
  const scope={...f.scope,CARD_POSITIONS:definition.stages.map(stage=>({x:stage.xPx/390*100,top:stage.topPx/760*100,width:stage.widthPx,height:stage.heightPx,rotation:stage.rotationDeg})),
    BASE_VIEWPORT_WIDTH:390,FOREST_MAP_DESIGN_WIDTH:390,FOREST_MAP_DESIGN_HEIGHT:760,STANDARD_CARD_WIDTH:90,STANDARD_CARD_HEIGHT:133,
    getJourneyBoardCardPositionOffsetPx:(id:number)=>id===1?{x:-12,y:0}:{x:0,y:0},getJourneyBoardUnitHorizontalOffsetPx:()=>0,setJourneyBoardCardBaseTransform:()=>{}};
  const code=ts.transpileModule(`function run(board,index){${geometry}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const render=new Function('scope',`with(scope){${code};return run;}`)(scope);
  for(const width of [390,430]) {
    Object.defineProperty(window,'innerWidth',{configurable:true,value:width});
    const snapshot=f.owner.readNativeForestSnapshot('geometry',1,1), scale=width/390;
    expect(snapshot.units[0].frame.x*scale).toBeCloseTo(28*scale-12+24);
    for(let index=0;index<10;index++) {
      const card=render(f.owner.boards[index],index), frame=snapshot.units[index].frame;
      expect(frame.x*scale).toBeCloseTo(parseFloat(card.style.left)+24);
      expect(frame.y*scale-196-16).toBeCloseTo(parseFloat(card.style.top));
      expect(frame.width*scale).toBe(parseFloat(card.style.width));
      expect(frame.height*scale).toBe(parseFloat(card.style.height));
    }
  }
  const scrollable=document.createElement('div');scrollable.className='collectibles-scrollable';scrollable.style.paddingLeft='34px';document.getElementById('journey-screen')!.append(scrollable);
  const safeAreaSnapshot=f.owner.readNativeForestSnapshot('safe-area',1,1);
  expect(safeAreaSnapshot.units[0].frame.x*(430/390)).toBeCloseTo(28*(430/390)-12+34);
  const island=safeAreaSnapshot.units[0].parts.find((part:any)=>part.role==='island');
  expect(island.x+safeAreaSnapshot.units[0].frame.x).toBeCloseTo(4);
});


test.each([2,3] as const)('native World %i projects original ten Units without hidden web decode or animation work',worldID=>{
  const f=fixture(worldID), first=(worldID-1)*10+1;
  const src=jest.spyOn(HTMLImageElement.prototype,'src','set'),srcset=jest.spyOn(HTMLImageElement.prototype,'srcset','set');
  // Existing web compositing caches must not suppress the native specification.
  f.owner.journeyMainCloudCompositeCache.set(worldID,{});
  expect(f.owner.prepareNativeForest(worldID)).toBe(true);
  const snapshot=f.owner.readNativeForestSnapshot('new-world',1,1);
  expect(snapshot.worldID).toBe(worldID);expect(snapshot.title).toBe(worldID===2?'Beach':'Area 55');
  expect(snapshot.units.map((u:any)=>u.boardID)).toEqual(Array.from({length:10},(_,i)=>first+i));
  expect(snapshot.units.map((u:any)=>u.number)).toEqual(Array.from({length:10},(_,i)=>String(i+1).padStart(2,'0')));
  expect(snapshot.units[0].allowedActions).toEqual(['openCard','play']);
  expect(snapshot.units[1].allowedActions).toEqual(['continue','continue']);
  expect(snapshot.units[2].allowedActions).toEqual(['openCard','continue']);
  expect(snapshot.units[3].allowedActions).toEqual([]);
  expect(snapshot.mainParts.filter((p:any)=>p.role==='cloud').length).toBeGreaterThan(0);
  const main=snapshot.mainParts.find((p:any)=>p.role==='island');expect(main.y).toBeCloseTo(138-16);
  expect(snapshot.ambientPlans).toHaveLength(worldID===2?8:2);expect(snapshot.ambientSessionID).toBe(1);
  expect(snapshot.beePlans).toBeUndefined();expect(snapshot.beeSessionID).toBeUndefined();
  expect(src).not.toHaveBeenCalled();expect(srcset).not.toHaveBeenCalled();
  expect(document.querySelectorAll('img,style')).toHaveLength(0);
  for(const u of snapshot.units){
    const island=u.parts.find((p:any)=>p.role==='island');expect(island.asset).toContain(worldID===2?'/beach-':'/robo');
    expect(u.frame.y+island.y).toBeCloseTo((worldID===2?1820+(u.boardID-first)*124:[3532,3646,3770,3904,4028,4152,4276,4400,4524,4648][u.boardID-first])-getJourneyWorldDefinition(worldID)!.mainOffsetPx+138-16,6);
    expect(snapshot.contentHeight).toBeGreaterThan(u.frame.y+island.y+island.width);
    if(worldID===3){const beam=u.parts.find((p:any)=>p.role==='beam');expect(beam.asset).toContain('alien beam.png');expect(beam.beamIdle.points).toHaveLength(41);}
    else expect(u.parts.some((p:any)=>p.role==='beam')).toBe(false);
  }
});

test.each([2,3] as const)('World %i revalidates actions and preserves its canonical gameplay/return owner',async worldID=>{
  const f=fixture(worldID),first=(worldID-1)*10+1;f.owner.prepareNativeForest(worldID);
  f.owner.markNativeForestCardOpened(1);expect(f.scope.markJourneyBoardViewed).not.toHaveBeenCalled();
  f.owner.markNativeForestCardOpened(first);expect(f.scope.markJourneyBoardViewed).toHaveBeenCalledWith(String(first));
  expect(await f.owner.launchNativeForestBoard(1,'play')).toBe(false);
  expect(await f.owner.launchNativeForestBoard(first+3,'play')).toBe(false);
  expect(await f.owner.launchNativeForestBoard(first,'continue')).toBe(false);
  const ready=jest.fn(async()=>true);expect(await f.owner.launchNativeForestBoard(first,'play',ready)).toBe(true);
  expect(f.owner.startJourneyBoardFromOverlay.mock.calls[0][0].id).toBe(first);
  expect(f.owner.startJourneyBoardFromOverlay.mock.calls[0][2]).toBe(ready);
  f.setZone('journey');f.stats.get(first)!.highScore=9876;
  expect(f.owner.readNativeForestSnapshot('return',1,2).units[0].stats[0].value).toBe((9876).toLocaleString());
  f.owner.retireNativeForest();expect(await f.owner.launchNativeForestBoard(first,'play')).toBe(false);
});


test('Area55 changed progression retains all unchanged beam recipes through gameplay parking',()=>{
  const f=fixture(3);f.owner.prepareNativeForest(3);
  const first=f.owner.readNativeForestSnapshot('first',1,1);
  const recipes=first.units.map((u:any)=>u.parts.find((p:any)=>p.role==='beam').beamIdle);
  f.stats.get(21)!.highScore+=1;
  const refreshed=f.owner.readNativeForestSnapshot('refresh',1,2);
  refreshed.units.forEach((u:any,i:number)=>expect(u.parts.find((p:any)=>p.role==='beam').beamIdle).toBe(recipes[i]));
  expect(refreshed.units[1].parts).toEqual(first.units[1].parts);
  f.owner.retireNativeForest();expect(f.owner.nativeWorldBeamSequences.size).toBe(0);
  f.owner.prepareNativeForest(3);
  expect(f.owner.readNativeForestSnapshot('reopen',2,1).units[0].parts.find((p:any)=>p.role==='beam').beamIdle).not.toBe(recipes[0]);
});


test.each([2,3] as const)('World %i ambient projection keeps its session through state refresh and fails closed on hidden/foreign route',worldID=>{
  const f=fixture(worldID);f.owner.prepareNativeForest(worldID);const first=f.owner.readNativeForestSnapshot('first',1,1);
  f.stats.get((worldID-1)*10+1)!.highScore+=1;const refreshed=f.owner.readNativeForestSnapshot('changed',1,2);
  expect(refreshed.ambientSessionID).toBe(first.ambientSessionID);expect(refreshed.ambientPlans).toBe(first.ambientPlans);
  expect(f.owner.readNextNativeWorldAmbientPlans({top:0,bottom:844},[0])).toHaveLength(1);
  f.setZone('board-journey');expect(f.owner.readNextNativeWorldAmbientPlans({top:0,bottom:844},[0])).toBeNull();
  f.setZone('journey');Object.defineProperty(document,'hidden',{configurable:true,value:true});expect(f.owner.readNextNativeWorldAmbientPlans({top:0,bottom:844},[0])).toBeNull();
  Object.defineProperty(document,'hidden',{configurable:true,value:false});f.owner.retireNativeForest();expect(f.owner.nativeWorldAmbientProjection).toBeNull();expect(f.owner.nativeWorldAmbientPlans).toBeUndefined();
});
