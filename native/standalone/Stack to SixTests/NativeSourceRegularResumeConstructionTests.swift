import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six
@MainActor final class NativeSourceRegularResumeConstructionTests:XCTestCase {
 @MainActor private final class Counter {var count=0;var onDraw:(()->Void)?;func next()->Double {count+=1;onDraw?();return Double((count*37)%97)/97}}
 private func saved()->NativeBoardState {.init(tiles:[.init(id:"five",cell:.init(column:4,row:8),value:5,stackDepth:4,visible:false,alpha:0.7),.init(id:"zero",cell:.init(column:0,row:0),value:0,locked:true,visible:false,alpha:0.7),.init(id:"three-locked",cell:.init(column:2,row:3),value:3,stackDepth:3,locked:true,visible:false,alpha:0.7)],mode:.journey,board:7,stage:7,generation:9,revision:4,moves:23,score:123,wildMeter:0.4,rngState:777)}
 @MainActor private final class Fixture {
  let counter=Counter(),service:NativeSourceAnimationClockService,construction:NativeSourceInitialBoardConstruction,scene:NativeBoardScene
  var repairContext:NativeGameplaySourceContext?
  var repairScope:NativeGameplaySourceContext.Scope?
  init(_ state:NativeBoardState,sourceOuterForRepair:Bool=false,wildRestore:Bool=false,sourceTasks:NativeSourceMicrotaskAdapters?=nil,sourceWallMillisecondsNow:@escaping()->Double={0})throws {
   service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:sourceWallMillisecondsNow,sourceFrameTransportEnabled:true)
   service.sourceMicrotaskTasks=sourceTasks
   construction=try XCTUnwrap(wildRestore ? NativeSourceInitialBoardConstruction.makeRestored(root:NativeTestResources.root,service:service,saved:state,random:{[counter] in counter.next()}):NativeSourceInitialBoardConstruction.makeRestoredRegular(root:NativeTestResources.root,service:service,saved:state,random:{[counter] in counter.next()}))
   let engine=NativeGameplayEngine(state:try XCTUnwrap(construction.recipe?.state))
   scene=NativeBoardScene(engine:engine,resourceRoot:NativeTestResources.root,size:CGSize(width:390,height:844),sourceInitialConstruction:construction)
   scene.synchronize()
   if sourceOuterForRepair {
    let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{[counter] in counter.next()},sourceMicrotaskTasks:sourceTasks)
    let captured=scene
    let scope=try XCTUnwrap(context.beginScene(engine:scene.engine,retire:{[weak captured] in captured?.retireSourceAnimationBindings()}))
    repairContext=context;repairScope=scope;scene.sourceOuterTimelineDriver=scope.timeline;scene.sourceDragTweenDriver=scope.tween
    if let sourceTasks {XCTAssertTrue(scene.configureSourceMicrotaskBoundaries(scope:scope,fifo:sourceTasks.fifo))}
    scene.synchronize()
    XCTAssertTrue(construction.nodes.values.allSatisfy{$0.sourcePhysicalMarkersCovered})
   }
  }
  func dispose(){counter.onDraw=nil;scene.dispose();repairContext?.dispose();construction.dispose();service.dispose()}
 }
 func testOpenedWildRawFrameReadsLiveVariantAndLateAssignmentRetainsCoreFace()throws {
  for (core,variant) in [("wild","bee"),("wild-juice","mushroom"),("wild-magnet","spaceship"),("wild-tnt","flower")] {
   for variantBeforeFrame in [true,false] {
    let state=saved()
    let f=try Fixture(state);defer{f.dispose()}
    f.service.deliver(wallMilliseconds:16)
    let node=try XCTUnwrap(f.construction.nodes["zero"]),old=node.sourcePaintedNumbersTexture
    let before=f.scene.engine.state,draws=f.counter.count
    node.setSourceIdleDeferred(true)
    XCTAssertTrue(node.openSourceWildCore(core,selectedVariant:variant,service:f.service,current:{true},onCancelled:{}))
    XCTAssertEqual(node.value,6);XCTAssertEqual(node.alpha,1)
    XCTAssertTrue(node.sourcePaintedNumbersTexture === old);XCTAssertTrue(node.sourceOpenedWildFacePending)
    if variantBeforeFrame {XCTAssertTrue(node.applySourceOpenedWildVariant(variant))}
    f.service.deliver(wallMilliseconds:32)
    let definition=try XCTUnwrap(NativeDiceArtwork.sourceWildSkinDefinition(kind:core,variant:variantBeforeFrame ? variant:nil))
    XCTAssertTrue(node.sourcePaintedNumbersTexture === f.construction.textures.sourceCachedTexture(candidates:[definition.path]))
    XCTAssertTrue(node.sourceOpenedWildFaceCurrent);XCTAssertFalse(node.sourceOpenedWildFacePending)
    let painted=node.sourcePaintedNumbersTexture
    if !variantBeforeFrame {XCTAssertTrue(node.applySourceOpenedWildVariant(variant));XCTAssertTrue(node.sourcePaintedNumbersTexture === painted)}
    XCTAssertEqual(node.variant,variant);XCTAssertEqual(f.counter.count,draws);XCTAssertEqual(f.scene.engine.state,before)
   }
  }
 }
 func testOpenedWildFromMagnetReservedPlaceholderNeverInheritsDimInnerArtwork()throws {
  let choices:[(String,String?)]=NativeWildArchetype.allCases.map{($0.rawValue,nil)}+NativeSpecialDiceRegistry.variants.keys.sorted().map{(NativeSpecialDiceRegistry.variants[$0]!.archetype.rawValue,Optional($0))}
  for (core,variant) in choices {
   let f=try Fixture(saved());defer{f.dispose()};f.service.deliver(wallMilliseconds:16)
   let node=try XCTUnwrap(f.construction.nodes["zero"])
   XCTAssertTrue(node.prepareSourceMagnetReservedHolder(rotation:0,generation:f.scene.engine.state.generation,cell:.init(column:0,row:0)))
   let visual=try XCTUnwrap(node.childNode(withName:"die-visual"))
   XCTAssertEqual(visual.alpha,0.2,accuracy:1e-6)
   node.setSourceIdleDeferred(true)
   XCTAssertTrue(node.openSourceWildCore(core,selectedVariant:variant,service:f.service,current:{true},onCancelled:{}))
   XCTAssertTrue(node.applySourceOpenedWildVariant(variant))
   f.service.deliver(wallMilliseconds:32)
   XCTAssertEqual(node.alpha,1,accuracy:1e-6)
   XCTAssertEqual(visual.alpha,1,accuracy:1e-6,"Reused placeholder opacity must not dim \(variant ?? core)")
   XCTAssertTrue(node.sourceOpenedWildFaceCurrent)
  }
 }
 func testOpenedWildDisposeCancelsCapturedRawFrameImmediately()throws {
  let state=saved()
  let f=try Fixture(state);defer{f.dispose()};f.service.deliver(wallMilliseconds:16)
  let node=try XCTUnwrap(f.construction.nodes["zero"]);node.setSourceIdleDeferred(true)
  var cancellations=0
  XCTAssertTrue(node.openSourceWildCore("wild",selectedVariant:"bee",service:f.service,current:{true},onCancelled:{cancellations+=1}))
  XCTAssertTrue(node.sourceOpenedWildFacePending)
  node.dispose();XCTAssertFalse(node.sourceOpenedWildFacePending);XCTAssertFalse(node.sourceOpenedWildConstructorCurrent)
  XCTAssertEqual(cancellations,1);XCTAssertEqual(f.service.pendingSourceAnimationFrameCount,0)
  f.service.deliver(wallMilliseconds:32);XCTAssertEqual(cancellations,1)
 }
 func testRepeatedEntrySynchronizationRetainsInFlightEntryInsteadOfRecapturingZeroAlpha()throws {
  let state=NativeBoardState(tiles:[.init(id:"entry",cell:.init(column:0,row:0),value:3)],mode:.arcade,board:1,stage:1,generation:9)
  let f=try Fixture(state);defer{f.dispose()}
  let canonicalBefore=f.scene.engine.state
  f.scene.synchronize(animateEntry:true)
  let node=try XCTUnwrap(f.scene.sourceNativeTileNode("entry")),entry=try XCTUnwrap(node.action(forKey:"entry"))
  XCTAssertEqual(node.alpha,0)
  f.scene.synchronize(animateEntry:true)
  XCTAssertTrue(node.action(forKey:"entry") === entry)
  XCTAssertEqual(node.alpha,0)
  XCTAssertFalse(f.scene.isBoardEntryComplete)
  XCTAssertEqual(f.scene.engine.state,canonicalBefore)
 }
 func testGenuineSparseSavedCellsReuseOnlyTheirSameCapturedObjectsWithoutFreshShuffle()throws {
  let state=saved(),f=try Fixture(state);defer{f.dispose()}
  XCTAssertTrue(f.scene.sourceInitialStartupReady);XCTAssertEqual(f.counter.count,3)
  XCTAssertEqual(f.service.pendingSourceAnimationFrameCount,4);XCTAssertEqual(f.construction.nodes.count,3)
  XCTAssertEqual(f.scene.engine.state.tiles.map(\.id),["zero","three-locked","five"])
  XCTAssertEqual(f.scene.engine.state.revision,4);XCTAssertEqual(f.scene.engine.state.score,123);XCTAssertEqual(f.scene.engine.state.moves,23)
  for holder in try XCTUnwrap(f.construction.recipe).holders {
   let node=try XCTUnwrap(f.scene.sourceNativeTileNode(holder.tileID))
   XCTAssertTrue(node === f.construction.nodes[holder.tileID]);XCTAssertTrue(node.isHidden)
   XCTAssertEqual(node.depth,1);XCTAssertEqual(Double(node.dragInnerTilt),holder.rotation,accuracy:2e-5)
   XCTAssertTrue(node.sourcePaintedNumbersTexture === f.construction.textures.texture("assets/tile.png",densityAware:false))
  }
  XCTAssertEqual(state.tiles[0].stackDepth,4);XCTAssertEqual(state.tiles[0].alpha,0.7)
 }
 func testActualZeroRawFaceDoesNotChooseSkinAndLockedPositiveFaceDoesWithoutPips()throws {
  let f=try Fixture(saved());defer{f.dispose()};let before=f.scene.engine.state
  var sawBatchBeforeSkin=false
  f.counter.onDraw={ [weak construction=f.construction,weak counter=f.counter] in
   guard counter?.count==4,let construction else{return};sawBatchBeforeSkin=true
   XCTAssertEqual(construction.nodes["five"]?.sourcePipNodes.count,5)
   XCTAssertTrue(construction.nodes["zero"]?.sourcePipNodes.isEmpty==true)
   XCTAssertTrue(construction.nodes["three-locked"]?.sourcePipNodes.isEmpty==true)
  }
  f.service.deliver(wallMilliseconds:16)
  XCTAssertTrue(sawBatchBeforeSkin);XCTAssertEqual(f.counter.count,5);XCTAssertEqual(f.construction.pendingFaceCount,0)
  XCTAssertEqual(f.service.pendingSourceAnimationFrameCount,0);XCTAssertEqual(f.scene.engine.state,before)
  let zero=try XCTUnwrap(f.construction.nodes["zero"]),locked=try XCTUnwrap(f.construction.nodes["three-locked"]),five=try XCTUnwrap(f.construction.nodes["five"])
  XCTAssertTrue(zero.sourcePaintedNumbersTexture === f.construction.textures.texture("assets/tile.png",densityAware:false))
  XCTAssertEqual(locked.sourceCurrentRegularSkin,.second);XCTAssertEqual(five.sourceCurrentRegularSkin,.fourth)
  XCTAssertTrue(locked.sourcePipNodes.isEmpty);XCTAssertEqual(five.sourcePipNodes.count,5)
  XCTAssertEqual(zero.sourceEventMode,"none");XCTAssertEqual(locked.sourceEventMode,"none");XCTAssertEqual(five.sourceEventMode,"static")
  XCTAssertEqual(Double(zero.alpha),0.25,accuracy:1e-6);XCTAssertEqual(Double(locked.alpha),1,accuracy:1e-6)
 }
 func testGlobalPauseDoesNotPauseRawRestoreWhileActualBackgroundRetainsExactQueuedFaces()throws {
  let f=try Fixture(saved());defer{f.dispose()};let before=f.scene.engine.state
  f.scene.setSuspended(true);f.service.setSourceGlobalPaused(true);f.service.setSourceForeground(false)
  f.service.deliver(wallMilliseconds:1000);XCTAssertEqual(f.counter.count,3);XCTAssertEqual(f.construction.pendingFaceCount,3)
  f.service.setSourceForeground(true);f.service.deliver(wallMilliseconds:1016)
  XCTAssertEqual(f.counter.count,5);XCTAssertEqual(f.construction.pendingFaceCount,0);XCTAssertEqual(f.scene.engine.state,before)
 }
 func testRouteMissingAdoptionCannotDeliverFaceRNGOrRecreateObjects()throws {
  let c=Counter(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
  defer{service.dispose()}
  let construction=try XCTUnwrap(NativeSourceInitialBoardConstruction.makeRestoredRegular(root:NativeTestResources.root,service:service,saved:saved(),random:{c.next()}))
  service.deliver(wallMilliseconds:16)
  XCTAssertEqual(c.count,3);XCTAssertFalse(construction.readyToAdopt);XCTAssertTrue(construction.nodes.isEmpty);XCTAssertEqual(service.pendingSourceAnimationFrameCount,0)
  service.deliver(wallMilliseconds:32);XCTAssertEqual(c.count,3)
 }
 func testGenerationRetirementCancelsCapturedEmptyAndPositiveFacesWithoutChangingNewBoard()throws {
  let f=try Fixture(saved());defer{f.dispose()}
  let zero=try XCTUnwrap(f.construction.nodes["zero"]),texture=zero.sourcePaintedNumbersTexture
  f.scene.retireSourceAnimationBindings()
  f.scene.engine.restart(state:.init(tiles:[.init(id:"replacement",cell:.init(column:0,row:0),value:2)]))
  let state=f.scene.engine.state;f.service.deliver(wallMilliseconds:16)
  XCTAssertEqual(f.counter.count,3);XCTAssertEqual(f.scene.engine.state,state)
  XCTAssertTrue(zero.sourcePaintedNumbersTexture === texture);XCTAssertTrue(zero.sourceContactNodeAlive)
 }
 func testUnmappedSpecialTutorialAndMissingTransportRefuseBeforeAnyConstructorDraw() {
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceFrameTransportEnabled:true)
  defer{service.dispose()};var draws=0
  var special=saved();special.tiles[0].archetype = .star;special.tiles[0].value=6
  XCTAssertNil(NativeSourceInitialBoardConstruction.makeRestoredRegular(root:NativeTestResources.root,service:service,saved:special,random:{draws+=1;return 0.5}))
  var tutorial=saved();tutorial.tutorial=NativeTutorialState()
  XCTAssertNil(NativeSourceInitialBoardConstruction.makeRestoredRegular(root:NativeTestResources.root,service:service,saved:tutorial,random:{draws+=1;return 0.5}))
  let unavailable=NativeSourceAnimationClockService(wallOriginMilliseconds:0);defer{unavailable.dispose()}
  XCTAssertNil(NativeSourceInitialBoardConstruction.makeRestoredRegular(root:NativeTestResources.root,service:unavailable,saved:saved(),random:{draws+=1;return 0.5}))
  XCTAssertEqual(draws,0)
 }
 func testActualRegularVisualRepairRestoresLocalPoseAndFaceWithoutChangingCanonicalStateOrSkin()throws {
  let f=try Fixture(saved(),sourceOuterForRepair:true);defer{f.dispose()};f.service.deliver(wallMilliseconds:16)
  let node=try XCTUnwrap(f.construction.nodes["five"]),before=f.scene.engine.state,draws=f.counter.count
  let skin=node.sourceCurrentRegularSkin,texture=node.sourcePaintedNumbersTexture
  node.isHidden=false;node.paintSourceOuterScale(.init(x:3,y:2));node.paintSourceIdleRotation(0.5)
  node.visual.setScale(1.4);node.visual.zRotation=0.3;node.alpha=0.04
  XCTAssertTrue(node.repairSourceRegularBoardVisuals(outerTransformOwned:false,activeDrag:false,innerImpactOwned:false,wildDropping:false,retireUnownedInnerTransform:{XCTAssertFalse(node.visual.hasActions());return true},current:{f.repairScope?.current==true}))
  XCTAssertEqual(node.sourceLocalScale.x,1,accuracy:1e-6);XCTAssertEqual(node.sourceLocalScale.y,1,accuracy:1e-6)
  XCTAssertEqual(node.sourceRotation,0,accuracy:1e-6);XCTAssertEqual(node.visual.xScale,1)
  XCTAssertEqual(node.sourceStarOrbitMetrics.width,128,accuracy:1e-5);XCTAssertEqual(node.sourceStarOrbitMetrics.height,128,accuracy:1e-5)
  XCTAssertEqual(node.alpha,1);XCTAssertEqual(node.sourceCurrentRegularSkin,skin);XCTAssertTrue(node.sourcePaintedNumbersTexture === texture)
  XCTAssertTrue(node.repairSourceRegularBoardVisuals(outerTransformOwned:false,activeDrag:false,innerImpactOwned:false,wildDropping:false,retireUnownedInnerTransform:{true},current:{f.repairScope?.current==true}))
  XCTAssertEqual(node.sourceStarOrbitMetrics.width,128,accuracy:1e-5,"repeat repair must not inflate authored face")
  XCTAssertEqual(f.counter.count,draws);XCTAssertEqual(f.scene.engine.state,before)
 }
 func testActualRegularRepairPreservesOwnedOuterAndInnerPoseAndLockedOpacityRule()throws {
  let f=try Fixture(saved(),sourceOuterForRepair:true);defer{f.dispose()};f.service.deliver(wallMilliseconds:16)
  let node=try XCTUnwrap(f.construction.nodes["five"]),zero=try XCTUnwrap(f.construction.nodes["zero"])
  node.isHidden=false;node.paintSourceOuterScale(.init(x:1.12,y:0.94));node.visual.setScale(1.4)
  XCTAssertTrue(node.repairSourceRegularBoardVisuals(outerTransformOwned:true,activeDrag:true,innerImpactOwned:true,wildDropping:false,retireUnownedInnerTransform:{XCTFail("owned transform must not retire");return false},current:{f.repairScope?.current==true}))
  XCTAssertEqual(node.sourceLocalScale.x,1.12,accuracy:1e-6);XCTAssertEqual(node.sourceLocalScale.y,0.94,accuracy:1e-6);XCTAssertEqual(node.visual.xScale,1.4,accuracy:1e-6)
  zero.isHidden=false;zero.alpha=0.01;XCTAssertTrue(zero.repairSourceRegularSpawnOpacity(wildDropping:true));XCTAssertEqual(zero.alpha,0.01,accuracy:1e-6)
  XCTAssertTrue(zero.repairSourceRegularSpawnOpacity(wildDropping:false));XCTAssertEqual(zero.alpha,0.2,accuracy:1e-6)
  node.isHidden=true;node.alpha=0.01;XCTAssertTrue(node.repairSourceRegularSpawnOpacity(wildDropping:false));XCTAssertEqual(node.alpha,1)
 }
 func testLockedBonusSevenPercentOpacityRemainsStableAcrossSafetyAndOwnerRepairs()throws {
  let f=try Fixture(saved(),sourceOuterForRepair:true);defer{f.dispose()};f.service.deliver(wallMilliseconds:16)
  let zero=try XCTUnwrap(f.construction.nodes["zero"]),node=try XCTUnwrap(f.construction.nodes["five"])
  let before=f.scene.engine.state,draws=f.counter.count
  zero.isHidden=false;zero.prepareSourceLockedBonus(alpha:0.07)
  for _ in 0..<20 {
   XCTAssertTrue(zero.repairSourceRegularSpawnOpacity(wildDropping:false,lockedAlpha:0.07))
   XCTAssertEqual(zero.alpha,0.07,accuracy:1e-6)
   zero.repairSourceLockedBonus(alpha:0.07)
   XCTAssertEqual(zero.alpha,0.07,accuracy:1e-6)
  }
  zero.alpha=0
  XCTAssertTrue(zero.repairSourceRegularSpawnOpacity(wildDropping:false,lockedAlpha:0.07))
  XCTAssertEqual(zero.alpha,0.07,accuracy:1e-6,"stranded bonus restores its own opacity")
  zero.alpha=0.01
  XCTAssertTrue(zero.repairSourceRegularSpawnOpacity(wildDropping:false,lockedAlpha:1))
  XCTAssertEqual(zero.alpha,0.2,accuracy:1e-6,"ordinary empty-holder safety remains")
  node.isHidden=false;node.alpha=0.07
  XCTAssertTrue(node.repairSourceRegularSpawnOpacity(wildDropping:false,lockedAlpha:0.07))
  XCTAssertEqual(node.alpha,1,"positive-value dice still recover full opacity")
  XCTAssertEqual(f.scene.engine.state,before);XCTAssertEqual(f.counter.count,draws)
 }
 func testActualInnerRepairMissingRetirementAuthorityRefusesInsteadOfPaintingOverOrphan()throws {
  let f=try Fixture(saved(),sourceOuterForRepair:true);defer{f.dispose()};f.service.deliver(wallMilliseconds:16)
  let node=try XCTUnwrap(f.construction.nodes["five"]);node.isHidden=false;node.visual.setScale(1.4)
  XCTAssertFalse(node.repairSourceRegularBoardVisuals(outerTransformOwned:true,activeDrag:false,innerImpactOwned:false,wildDropping:false,retireUnownedInnerTransform:{false},current:{f.repairScope?.current==true}))
  XCTAssertEqual(node.visual.xScale,1.4,accuracy:1e-6)
 }

 func testActualPickupOwnerProtectsScaleEvenWhenExternalFlagsAreFalse()throws {
  let f=try Fixture(saved(),sourceOuterForRepair:true);defer{f.dispose()};f.service.deliver(wallMilliseconds:16)
  let node=try XCTUnwrap(f.construction.nodes["five"]);node.isHidden=false
  XCTAssertTrue(node.beginSourcePickup());f.service.deliver(wallMilliseconds:40)
  XCTAssertTrue(node.sourceOuterOwners.pickupScale)
  let scale=node.sourceLocalScale
  XCTAssertTrue(node.repairSourceRegularBoardVisuals(outerTransformOwned:false,activeDrag:false,innerImpactOwned:false,wildDropping:false,retireUnownedInnerTransform:{true},current:{f.repairScope?.current==true}))
  XCTAssertEqual(node.sourceLocalScale.x,scale.x,accuracy:1e-6);XCTAssertEqual(node.sourceLocalScale.y,scale.y,accuracy:1e-6)
  XCTAssertTrue(node.sourceOuterOwners.pickupScale)
 }

 func testActualSceneRepairSweepsSameSourceRosterAndRefusesMissingOwnerBeforePainting()throws {
  let f=try Fixture(saved(),sourceOuterForRepair:true);defer{f.dispose()};f.service.deliver(wallMilliseconds:16)
  let scope=try XCTUnwrap(f.repairScope),node=try XCTUnwrap(f.construction.nodes["five"]),zero=try XCTUnwrap(f.construction.nodes["zero"])
  let before=f.scene.engine.state,draws=f.counter.count
  node.isHidden=false;node.paintSourceOuterScale(.init(x:3,y:3));node.alpha=0.01
  XCTAssertFalse(f.scene.repairSourceSpawnVisuals(scope:scope,pass:.board,captureTransformOwners:{_ in nil},repairSpecialVisuals:{_,_,_ in XCTFail("regular fixture");return false}))
  XCTAssertEqual(node.sourceLocalScale.x,3,accuracy:1e-6);XCTAssertEqual(node.alpha,0.01,accuracy:1e-6)
  let owners:(NativeDiceNode)->NativeBoardScene.SourceSpawnVisualRepairOwners? = {n in
   // Explicit regular-only fixture owns no extra APP impact/transport fields;
   // no global production coverage is published by this test endpoint.
   .init(node:n,generation:n.sourceGeneration,outerTransformOwned:false,innerImpactOwned:false,wildDropping:false,retireUnownedInnerTransform:{XCTAssertFalse(n.visual.hasActions());return true},current:{f.repairScope?.current==true && n.sourceGeneration==f.scene.engine.state.generation})
  }
  XCTAssertTrue(f.scene.repairSourceSpawnVisuals(scope:scope,pass:.board,captureTransformOwners:owners,repairSpecialVisuals:{_,_,_ in XCTFail("regular fixture");return false}))
  XCTAssertEqual(node.sourceLocalScale.x,1,accuracy:1e-6);XCTAssertEqual(node.sourceStarOrbitMetrics.width,128,accuracy:1e-5)
  zero.isHidden=false;zero.alpha=0.01
  XCTAssertTrue(f.scene.repairSourceSpawnVisuals(scope:scope,pass:.opacity,captureTransformOwners:owners,repairSpecialVisuals:{_,_,_ in XCTFail("regular fixture");return false}))
  XCTAssertEqual(zero.alpha,0.2,accuracy:1e-6);XCTAssertEqual(f.scene.engine.state,before);XCTAssertEqual(f.counter.count,draws)
 }
 func testActualSceneRepairOwnerCaptureRestartCannotPaintReplacementGeneration()throws {
  let f=try Fixture(saved(),sourceOuterForRepair:true);defer{f.dispose()};f.service.deliver(wallMilliseconds:16)
  let scope=try XCTUnwrap(f.repairScope),node=try XCTUnwrap(f.construction.nodes["five"])
  node.isHidden=false;node.paintSourceOuterScale(.init(x:3,y:3));var calls=0
  XCTAssertFalse(f.scene.repairSourceSpawnVisuals(scope:scope,pass:.board,captureTransformOwners:{n in
   calls+=1;f.scene.engine.restart(state:.init(tiles:[.init(id:"new",cell:.init(column:0,row:0),value:2)]))
   return .init(node:n,generation:n.sourceGeneration,outerTransformOwned:false,innerImpactOwned:false,wildDropping:false,retireUnownedInnerTransform:{XCTFail("stale retirement");return false},current:{f.repairScope?.current==true && n.sourceGeneration==f.scene.engine.state.generation})
  },repairSpecialVisuals:{_,_,_ in XCTFail("stale special repair");return false}))
  XCTAssertEqual(calls,1);XCTAssertEqual(node.sourceLocalScale.x,3,accuracy:1e-6);XCTAssertEqual(f.scene.engine.state.tiles.map(\.id),["new"])
 }

 func testActualSceneRepairSameGenerationOwnerReplacementInvalidatesEarlierCaptureBeforeAnyPaint()throws {
  let f=try Fixture(saved(),sourceOuterForRepair:true);defer{f.dispose()};f.service.deliver(wallMilliseconds:16)
  let scope=try XCTUnwrap(f.repairScope),node=try XCTUnwrap(f.construction.nodes["five"])
  node.isHidden=false;node.paintSourceOuterScale(.init(x:3,y:3));var epoch=0
  XCTAssertFalse(f.scene.repairSourceSpawnVisuals(scope:scope,pass:.board,captureTransformOwners:{n in
   if n.tileID=="five" {epoch+=1};let captured=epoch
   return .init(node:n,generation:n.sourceGeneration,outerTransformOwned:false,innerImpactOwned:false,wildDropping:false,retireUnownedInnerTransform:{XCTFail("stale capture");return false},current:{epoch==captured && f.repairScope?.current==true})
  },repairSpecialVisuals:{_,_,_ in XCTFail("regular-only fixture");return false}))
  XCTAssertEqual(node.sourceLocalScale.x,3,accuracy:1e-6);XCTAssertEqual(epoch,1)
 }
 func testActualSceneInnerRetirementOwnerReplacementCannotResetNewOwnersPaint()throws {
  let f=try Fixture(saved(),sourceOuterForRepair:true);defer{f.dispose()};f.service.deliver(wallMilliseconds:16)
  let scope=try XCTUnwrap(f.repairScope),node=try XCTUnwrap(f.construction.nodes["five"])
  node.isHidden=false;node.visual.setScale(1.4);var epoch=0
  XCTAssertFalse(f.scene.repairSourceSpawnVisuals(scope:scope,pass:.board,captureTransformOwners:{n in
   let captured=epoch
   return .init(node:n,generation:n.sourceGeneration,outerTransformOwned:false,innerImpactOwned:false,wildDropping:false,retireUnownedInnerTransform:{epoch+=1;return true},current:{epoch==captured && f.repairScope?.current==true})
  },repairSpecialVisuals:{_,_,_ in XCTFail("regular-only fixture");return false}))
  XCTAssertEqual(node.visual.xScale,1.4,accuracy:1e-6);XCTAssertEqual(epoch,1)
 }

 func testSourceWildRestoreProjectionMatchesExecutedOriginalRosterAndLegacyPairs()throws {
  // Expected cores/order generated by executing actual app-core-load-tiles.ts,
  // save-schema and registry. Original owner defers exactly one Wild per case.
  let sourceCases:[(String,String,String)]=[("","wild","wild"),("","wild-juice","wild-juice"),("","wild-magnet","wild-magnet"),("","wild-tnt","wild-tnt"),("bee","wild","wild"),("fish","wild","wild"),("kanta","wild","wild"),("laser-gun","wild-tnt","wild-tnt"),("spaceship","wild-magnet","wild-magnet"),("bottle","wild-magnet","wild-magnet"),("honey","wild-magnet","wild-magnet"),("flower","wild-tnt","wild-tnt"),("barell","wild-tnt","wild-tnt"),("mushroom","wild-juice","wild-juice"),("robo-cube","wild-juice","wild-juice"),("cubero","wild","wild"),("beach-ball","wild-tnt","wild-tnt"),("beach-ball","wild-juice","wild-tnt"),("beach-ball","wild-magnet","wild-tnt")]
  for mode in [NativeRunMode.journey,.arcade] {
   for (variant,inputCore,outputCore) in sourceCases {
    var state=saved()
    state.mode=mode;state.wildSpawnCount=7;state.earnedComboBonus=250;state.cubesCracked=13
    state.tiles=[.init(id:"wild",cell:.init(column:2,row:3),value:6,stackDepth:4,archetype:try XCTUnwrap(NativeWildArchetype(rawValue:inputCore)),variant:variant.isEmpty ? nil:variant,visible:false,alpha:0.3),.init(id:"zero",cell:.init(column:0,row:0),value:0,locked:true)]
    let original=state;var draws=0,events:[String]=[]
    let recipe=try XCTUnwrap(NativeSourceInitialBoardRecipe.captureRestored(state,random:{draws+=1;return Double(draws)/10},construct:{h,t in events.append("ctor:\(h.cell.row),\(h.cell.column)");return true},restoreFace:{t in events.append("face:\(t.cell.row),\(t.cell.column)");return true}))
    XCTAssertEqual(events,["ctor:0,0","face:0,0","ctor:3,2","face:3,2"])
    XCTAssertEqual(draws,2);XCTAssertEqual(recipe.holders[0].rotation,-0.048,accuracy:1e-12);XCTAssertEqual(recipe.holders[1].rotation,-0.036,accuracy:1e-12)
    XCTAssertEqual(recipe.state.tiles.map(\.id),["zero","wild"])
    XCTAssertEqual(recipe.state.tiles[1].archetype?.rawValue,outputCore)
    XCTAssertEqual(recipe.state.tiles[1].variant,variant.isEmpty ? nil:variant)
    XCTAssertEqual(recipe.state.tiles[1].stackDepth,1);XCTAssertTrue(recipe.state.tiles[1].visible)
    XCTAssertEqual(recipe.state.tiles[1].alpha,1);XCTAssertEqual(recipe.state.tiles[0].alpha,0.25)
    var restoredAccounting=recipe.state;restoredAccounting.tiles=original.tiles
    XCTAssertEqual(restoredAccounting,original,"restore projection cannot reset accounting/progression")
    XCTAssertEqual(state,original);XCTAssertFalse(NativeSourceInitialBoardRecipe.canRestoreRegular(state))
   }
  }
 }
 func testWildRestoreRejectsInvalidIdentityAndTransientOwnershipBeforeAnyDrawOrCaller() {
  var valid=saved();valid.tiles=[.init(id:"bee",cell:.init(column:0,row:0),value:6,archetype:.star,variant:"bee")]
  var cases:[NativeBoardState]=[]
  func changed(_ edit:(inout NativeTile)->Void){var s=valid;edit(&s.tiles[0]);cases.append(s)}
  changed{$0.archetype=nil};changed{$0.archetype = .magnet};changed{$0.variant="missing"};changed{$0.value=5}
  changed{$0.pendingRemoval=true};changed{$0.transientSpawn=true};changed{$0.magnetOwned=true};changed{$0.resolutionOwned=true}
  changed{$0.merge6CleanupOwned=true};changed{$0.nonFinalMerge6=true};changed{$0.sourceWildStateCleared=true};changed{$0.sourceResidualWildPresence=true}
  changed{$0.cell.column=5}
  var duplicate=valid;duplicate.tiles.append(duplicate.tiles[0]);cases.append(duplicate)
  var detached=valid;detached.sourceDetachedGridTileIDs=["bee"];cases.append(detached)
  var draws=0,callers=0
  for state in cases {XCTAssertNil(NativeSourceInitialBoardRecipe.captureRestored(state,random:{draws+=1;return 0.5},construct:{_,_ in callers+=1;return true},restoreFace:{_ in callers+=1;return true}))}
  XCTAssertEqual(draws,0);XCTAssertEqual(callers,0)
 }
 func testWildRestoreStopsAtActualConstructorOrFaceRefusalWithoutDrawingNextCell() {
  var state=saved();state.tiles=[.init(id:"bee",cell:.init(column:0,row:0),value:6,archetype:.star,variant:"bee"),.init(id:"regular",cell:.init(column:1,row:0),value:3)]
  for refuseConstructor in [true,false] {
   var draws=0,constructors=0,faces=0
   XCTAssertNil(NativeSourceInitialBoardRecipe.captureRestored(state,random:{draws+=1;return 0.5},construct:{_,_ in constructors+=1;return !refuseConstructor},restoreFace:{_ in faces+=1;return false}))
   XCTAssertEqual(draws,1);XCTAssertEqual(constructors,1);XCTAssertEqual(faces,refuseConstructor ? 0:1)
  }
 }

 private func wildRoster()->[NativeTile] {
  let cores=NativeWildArchetype.allCases.map{NativeTile(id:$0.rawValue,cell:.init(column:0,row:0),value:6,archetype:$0)}
  let variants=NativeSpecialDiceRegistry.variants.values.sorted{$0.id<$1.id}.map{NativeTile(id:$0.id,cell:.init(column:0,row:0),value:6,archetype:$0.archetype,variant:$0.id)}
  return cores+variants+[NativeTile(id:"legacy-juice-ball",cell:.init(column:0,row:0),value:6,archetype:.juice,variant:"beach-ball"),NativeTile(id:"legacy-magnet-ball",cell:.init(column:0,row:0),value:6,archetype:.magnet,variant:"beach-ball")]
 }
 // Exercise the real restore constructor, face receipt, entry and registry for
 // the live roster. Adding a registry identity automatically extends this test.
 func testEveryRestoredSpecialStartsAfterEntryInJourneyAndArcadeAndRetainsItsOwners()async throws {
  for mode in [NativeRunMode.journey,.arcade] {
   for tile in wildRoster() {
    let label="\(mode) / \(tile.id)"
    let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
    var state=saved();state.mode=mode
    var sibling=tile;sibling.id=tile.id+"-sibling";sibling.cell = .init(column:1,row:0)
    state.tiles=[tile,sibling]
    var wall=0.0
    let f=try Fixture(state,sourceOuterForRepair:true,wildRestore:true,sourceTasks:tasks,sourceWallMillisecondsNow:{wall})
    let view=SKView(frame:.init(x:0,y:0,width:390,height:844)),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844)),controller=UIViewController()
    defer{view.presentScene(nil);window.isHidden=true;window.rootViewController=nil;f.dispose();fifo.dispose()}
    let scope=try XCTUnwrap(f.repairScope),nodes=[try XCTUnwrap(f.construction.nodes[tile.id]),try XCTUnwrap(f.construction.nodes[sibling.id])]
    f.scene.sourceBoardEntryEnabled=true
    var completed:[NativeSourceBoardEntryOwner.Completion]=[],failures:[String]=[]
    f.scene.onSourcePresentationFailure={reason,_ in failures.append(reason)}
    XCTAssertTrue(f.scene.configureSourceBoardEntry(scope:scope,sound:{_,_,_ in {}},completed:{completed.append($0)}),label)
    controller.view=view;window.rootViewController=controller;window.makeKeyAndVisible();view.presentScene(f.scene)
    XCTAssertTrue(tasks.layoutTask{
     f.scene.layout(size:view.bounds.size,insets:.zero,animateEntry:true)
     XCTAssertTrue(f.scene.configureSourceRestoredWildSkins(scope:scope),label)
     XCTAssertTrue(f.scene.configureSourceRestoredPlainStarHalos(scope:scope,waitForSharedIdle:true),label)
     XCTAssertTrue(f.scene.configureSourceSpecialIdle(scope:scope),label)
    })
    let before=f.scene.engine.state
    XCTAssertTrue(nodes.allSatisfy{$0.sourceIdleDeferred},label)
    XCTAssertEqual(scope.specialIdle.snapshot.registered,0,label)
    let pendingRelease=mode == .arcade ? f.scene.acquireSourceSpecialIdle(reason:"restore-entry-held"):nil
    wall=16;f.service.deliver(wallMilliseconds:wall)
    XCTAssertTrue(nodes.allSatisfy{!$0.sourceRestoreWildFacePending && $0.sourceIdleDeferred},label)
    while completed.isEmpty && wall<1800 {
     wall+=16;f.service.deliver(wallMilliseconds:wall)
     f.scene.update(wall/1000);f.scene.didFinishUpdate()
    }
    XCTAssertEqual(completed.map(\.outcome),[.normal],label)
    guard !completed.isEmpty else{continue}
    if let pendingRelease {
     XCTAssertTrue(nodes.allSatisfy{$0.sourceIdleDeferred},label)
     XCTAssertEqual(scope.specialIdle.snapshot.registered,0,label)
     XCTAssertTrue(tasks.inputTask{pendingRelease()})
    }
    XCTAssertTrue(nodes.allSatisfy{!$0.sourceIdleDeferred && !$0.authoredArtworkReceipt.pending},label)
    func artworkReady(_ node:NativeDiceNode)->Bool {
     if node.kind=="wild",node.variant==nil {return node.sourcePlainStarArtworkSprite?.isHidden==false}
     if node.variant=="flower" || NativeDiceArtwork.definition(kind:node.kind,variant:node.variant).idleSheet != nil {return node.authoredArtworkReceipt.running}
     return node.variant != "bee" || node.hasAnimatedArtwork
    }
    for _ in 0..<600 {
     // Phase staggering follows its existing wall clock, independently of
     // synthetic delta samples. Pump readiness at zero delta before comparing.
     f.scene.didFinishUpdate()
     for node in nodes {node.tick(0,suspended:false,viewportCenter:195);node.tickSourcePlainStarSheet(deltaMilliseconds:0,suspended:false)}
     if nodes.allSatisfy({$0.sourceWildSkinReceiptCurrent &&
      artworkReady($0) && ($0.variant != "honey" || $0.sourceHoneyCohortCommitted)}) {break}
     try await Task.sleep(for:.milliseconds(10))
    }
    XCTAssertTrue(nodes.allSatisfy{$0.sourceWildSkinReceiptCurrent},label)
    XCTAssertTrue(nodes.allSatisfy{artworkReady($0)},label)
    XCTAssertEqual(scope.specialIdle.snapshot.running,2,label)
    for node in nodes {
     if NativeDiceArtwork.definition(kind:node.kind,variant:node.variant).idleSheet != nil || node.variant=="spaceship" || node.variant=="bee" {
      XCTAssertTrue(node.hasAnimatedArtwork,label)
     }
     if node.variant=="kanta" {
      let face=try XCTUnwrap(node.sourceStarOrbitHost.children.compactMap{$0 as? SKSpriteNode}.first{$0.texture === node.sourcePaintedNumbersTexture})
      XCTAssertTrue(face.isHidden,"Late skin receipt must not expose a duplicate base: \(label)")
     }
    }
    let owners=nodes.map(\.sourceIdleOwnerCount)
    // Real Scene delivery must visibly advance the authored node subtree.
    func paint(_ node:SKNode)->[String] {
     let texture=(node as? SKSpriteNode)?.texture.map{String(describing:ObjectIdentifier($0))} ?? "none"
     return ["\(ObjectIdentifier(node))|\(node.position)|\(node.xScale)|\(node.yScale)|\(node.zRotation)|\(node.alpha)|\(node.isHidden)|\(texture)"]+node.children.flatMap{paint($0)}
    }
    func tilePaint(_ node:NativeDiceNode)->[String] {
     // Plain Star projects its sprite into the shared above-HUD layer.
     paint(node)+(node.sourcePlainStarArtworkSprite.map{paint($0)} ?? [])
    }
    f.scene.update(1)
    let initial=nodes.map{tilePaint($0)}
    for frame in 1...24 {wall+=40;f.service.deliver(wallMilliseconds:wall);f.scene.update(1+Double(frame)*0.04)}
    for (index,node) in nodes.enumerated() where node.hasAnimatedArtwork || node.sourceIdleOwnerCount>0 {
     XCTAssertNotEqual(tilePaint(node),initial[index],label)
    }
    // Foreground modal pause freezes the actual subtree and resumes the same
    // owners. Nested release and repeated layout cannot duplicate playback.
    nodes.forEach{$0.preservesPausedSpecialVisuals=true}
    let release=try XCTUnwrap(f.scene.acquireSourceSpecialIdle(reason:"restore-regression-modal"))
    XCTAssertTrue(f.service.setSourceGlobalPaused(true));f.scene.setSuspended(true)
    let held=nodes.map{tilePaint($0)}
    wall+=400;f.service.deliver(wallMilliseconds:wall);f.scene.update(4)
    XCTAssertEqual(nodes.map{tilePaint($0)},held,label)
    release();release();XCTAssertTrue(f.service.setSourceGlobalPaused(false));f.scene.setSuspended(false)
    nodes.forEach{$0.preservesPausedSpecialVisuals=false}
    XCTAssertTrue(tasks.layoutTask{f.scene.layout(size:view.bounds.size,insets:.zero,animateEntry:false)})
    XCTAssertEqual(scope.specialIdle.snapshot.running,2,label)
    XCTAssertEqual(nodes.map(\.sourceIdleOwnerCount),owners,label)
    f.service.setSourceForeground(false);f.scene.setSuspended(true)
    let background=nodes.map{paint($0)}
    wall+=400;f.service.deliver(wallMilliseconds:wall);f.scene.update(4.4)
    XCTAssertEqual(nodes.map{paint($0)},background,label)
    f.service.setSourceForeground(true);f.scene.setSuspended(false)
    XCTAssertEqual(scope.specialIdle.snapshot.running,2,label)
    XCTAssertEqual(nodes.map(\.sourceIdleOwnerCount),owners,label)
    nodes[0].setDragging(true);nodes[0].setDragging(false);nodes[0].resumeIdleAfterLanding()
    f.scene.update(5);wall+=40;f.service.deliver(wallMilliseconds:wall);f.scene.update(5.04)
    XCTAssertTrue(nodes.allSatisfy{!$0.sourceIdleDeferred && !$0.authoredArtworkReceipt.pending},label)
    XCTAssertEqual(scope.specialIdle.snapshot.running,2,label)
    XCTAssertTrue(failures.isEmpty,"\(label): \(failures)")
    XCTAssertEqual(f.scene.engine.state,before,label)
    // Retiring one copy must not stop its sibling; late clocks after scene
    // retirement cannot repaint the captured nodes or keep registry work alive.
    nodes[0].dispose();XCTAssertEqual(scope.specialIdle.snapshot.running,1,label)
    f.scene.retireSourceAnimationBindings()
    let retired=nodes.map{paint($0)}
    wall+=400;f.service.deliver(wallMilliseconds:wall)
    XCTAssertEqual(nodes.map{paint($0)},retired,label)
    XCTAssertEqual(scope.specialIdle.snapshot.registered,0,label)
   }
  }
 }

 func testEveryRestoredSpecialRetiredDuringEntryCannotStartAfterLateFaceCompletion()throws {
  for tile in wildRoster() {
   let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
   var state=saved();state.tiles=[tile]
   let f=try Fixture(state,sourceOuterForRepair:true,wildRestore:true,sourceTasks:tasks)
   defer{f.dispose();fifo.dispose()}
   let scope=try XCTUnwrap(f.repairScope),node=try XCTUnwrap(f.construction.nodes[tile.id])
   f.scene.sourceBoardEntryEnabled=true
   XCTAssertTrue(f.scene.configureSourceBoardEntry(scope:scope,sound:{_,_,_ in {}},completed:{_ in}))
   XCTAssertTrue(tasks.layoutTask{
    f.scene.layout(size:f.scene.size,insets:.zero,animateEntry:true)
    XCTAssertTrue(f.scene.configureSourceRestoredPlainStarHalos(scope:scope,waitForSharedIdle:true))
    XCTAssertTrue(f.scene.configureSourceSpecialIdle(scope:scope))
   })
   XCTAssertTrue(node.sourceIdleDeferred,tile.id)
   f.scene.retireSourceAnimationBindings();f.service.deliver(wallMilliseconds:1500)
   f.scene.sourceRestoredWildFaceSettled(node)
   XCTAssertTrue(node.sourceIdleDeferred,tile.id)
   XCTAssertEqual(node.sourceIdleOwnerCount,0,tile.id)
   XCTAssertEqual(scope.specialIdle.snapshot.registered,0,tile.id)
  }
 }
 func testActualAllWildRestoreConstructorsRetainOrdinaryPrefixTiltAndRawFaceWithoutIdleOrFaceRNG()throws {
  for tile in wildRoster() {
   var state=saved();state.tiles=[tile];state.wildSpawnCount=7
   let f=try Fixture(state,wildRestore:true);defer{f.dispose()}
   let node=try XCTUnwrap(f.construction.nodes[tile.id]),recipe=try XCTUnwrap(f.construction.recipe)
   let core=try XCTUnwrap(recipe.state.tiles[0].archetype)
   let definition=try XCTUnwrap(NativeDiceArtwork.sourceWildSkinDefinition(kind:core.rawValue,variant:tile.variant))
   XCTAssertTrue(node === f.scene.sourceNativeTileNode(tile.id));XCTAssertTrue(node.sourceRestoredWildConstructorCurrent)
   XCTAssertEqual(node.kind,core.rawValue);XCTAssertEqual(node.variant,tile.variant);XCTAssertEqual(node.value,6)
   XCTAssertEqual(node.depth,1);XCTAssertEqual(node.sourceEventMode,"static");XCTAssertTrue(node.sourceIdleDeferred)
   XCTAssertEqual(node.sourceIdleOwnerCount,0);XCTAssertFalse(node.hasAnimatedArtwork)
   XCTAssertTrue(node.sourcePaintedNumbersTexture === f.construction.textures.texture("assets/tile.png",densityAware:false),"real ordinary constructor face survives until original face RAF")
   XCTAssertTrue(node.sourceRestoreWildFacePending);XCTAssertEqual(f.counter.count,1);XCTAssertEqual(f.service.pendingSourceAnimationFrameCount,2)
   let before=f.scene.engine.state,tilt=node.dragInnerTilt
   f.service.deliver(wallMilliseconds:16)
   XCTAssertEqual(f.counter.count,1,"Wild face must not pick ordinary numbers skin")
   XCTAssertEqual(f.construction.pendingFaceCount,0);XCTAssertFalse(node.sourceRestoreWildFacePending)
   XCTAssertTrue(node.sourcePaintedNumbersTexture === f.construction.textures.texture(definition.path,densityAware:false))
   // BLOOB retains its authored tilted face; logical size is independent of
   // the larger axis-aligned orbit bounds produced by that rotation.
   let face=try XCTUnwrap(node.sourceStarOrbitHost.children.compactMap{$0 as? SKSpriteNode}.first{$0.texture === node.sourcePaintedNumbersTexture})
   XCTAssertEqual(face.size.width,definition.size.width,accuracy:1e-3)
   XCTAssertEqual(face.size.height,definition.size.height,accuracy:1e-3)
   XCTAssertEqual(node.dragInnerTilt,tilt);XCTAssertTrue(node.sourcePipNodes.isEmpty);XCTAssertTrue(node.sourceStackLayerNodes.isEmpty)
   XCTAssertTrue(node.sourceIdleDeferred);XCTAssertEqual(node.sourceIdleOwnerCount,0);XCTAssertFalse(node.sourceWildSkinReceiptCurrent,"board face is not a typed APP upload receipt")
   XCTAssertEqual(f.scene.engine.state,before)
  }
 }
 func testRestoredPlainJuiceStartsAuthoredCupBounceAfterIdleAdmission() async throws {
  var state=saved();state.tiles=[.init(id:"juice-idle",cell:.init(column:0,row:0),value:6,archetype:.juice)]
  let f=try Fixture(state,wildRestore:true);defer{f.dispose()}
  let node=try XCTUnwrap(f.construction.nodes["juice-idle"])
  f.service.deliver(wallMilliseconds:16)
  XCTAssertFalse(node.hasAnimatedArtwork)
  // This bounded holder fixture does not run the entry timeline. Paint its
  // accepted landed visibility before releasing deferred idle; hidden work
  // must stay suspended, exactly as the production entrance contract requires.
  node.isHidden=false;node.alpha=1
  node.setSourceIdleDeferred(false)
  let artwork=try XCTUnwrap(node.visual.children.compactMap{$0 as? SKSpriteNode}.first(where:{$0.zPosition==2}))
  let deadline=CACurrentMediaTime()+5
  // hasAnimatedArtwork can become true from bubbles before cup decode.
  // Await the cup's own painted texture and phase instead.
  while (artwork.texture==nil || artwork.isHidden),CACurrentMediaTime()<deadline {
   node.tick(0.02,suspended:false,viewportCenter:195)
   try await Task.sleep(for:.milliseconds(20))
  }
  XCTAssertTrue(node.hasAnimatedArtwork,"Source restore must retain the original Juice bounce sheet, independently of bubbles")
  node.tick(0.1,suspended:false,viewportCenter:195)
  XCTAssertFalse(artwork.isHidden)
  let first=try XCTUnwrap(artwork.texture),receipt=node.authoredArtworkReceipt
  node.tick(0.3,suspended:false,viewportCenter:195)
  XCTAssertFalse(artwork.texture === first,"Cup receipt before \(receipt), after \(node.authoredArtworkReceipt)")
  let painted=artwork.texture
  node.tick(0.3,suspended:true,viewportCenter:195)
  XCTAssertTrue(artwork.texture === painted)
  node.setDragging(true);node.tick(0.1,suspended:false,viewportCenter:195)
  XCTAssertFalse(artwork.isHidden,"Original Juice bounce animates during actual pickup")
 }
 func testActualRestoredWildSameIdentityUpdateCannotRebuildPendingOrSettledFace()throws {
  var state=saved();state.tiles=[.init(id:"bee",cell:.init(column:0,row:0),value:6,archetype:.star,variant:"bee")]
  let f=try Fixture(state,wildRestore:true);defer{f.dispose()}
  let node=try XCTUnwrap(f.construction.nodes["bee"]),initial=node.sourcePaintedNumbersTexture
  node.update(value:6,kind:"wild",variant:"bee",depth:3,locked:false)
  XCTAssertTrue(node.sourcePaintedNumbersTexture === initial);XCTAssertEqual(node.sourceIdleOwnerCount,0)
  f.service.deliver(wallMilliseconds:16)
  let face=node.sourcePaintedNumbersTexture
  node.update(value:6,kind:"wild",variant:"bee",depth:2,locked:true)
  XCTAssertTrue(node.sourcePaintedNumbersTexture === face);XCTAssertTrue(node.sourceRestoredWildConstructorCurrent)
  XCTAssertEqual(node.sourceIdleOwnerCount,0);XCTAssertEqual(f.counter.count,1)
 }
 func testActualRestoredWildGenerationRetirementCancelsRawFaceAndPreservesLastPaint()throws {
  var state=saved();state.tiles=[.init(id:"bee",cell:.init(column:0,row:0),value:6,archetype:.star,variant:"bee")]
  let f=try Fixture(state,wildRestore:true);defer{f.dispose()}
  let node=try XCTUnwrap(f.construction.nodes["bee"]),face=node.sourcePaintedNumbersTexture
  f.scene.retireSourceAnimationBindings()
  f.scene.engine.restart(state:.init(tiles:[.init(id:"replacement",cell:.init(column:0,row:0),value:2)]))
  let before=f.scene.engine.state;f.service.deliver(wallMilliseconds:16)
  XCTAssertFalse(node.sourceRestoreWildFacePending);XCTAssertTrue(node.sourcePaintedNumbersTexture === face)
  XCTAssertEqual(f.counter.count,1);XCTAssertEqual(f.scene.engine.state,before);XCTAssertEqual(f.service.pendingSourceAnimationFrameCount,0)
 }
 func testActualRestoredWildMissingAdoptionCannotDecodeOrPaintRawFace()throws {
  var state=saved();state.tiles=[.init(id:"bee",cell:.init(column:0,row:0),value:6,archetype:.star,variant:"bee")]
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceFrameTransportEnabled:true);defer{service.dispose()}
  var draws=0
  let owner=try XCTUnwrap(NativeSourceInitialBoardConstruction.makeRestored(root:NativeTestResources.root,service:service,saved:state,random:{draws+=1;return 0.5}))
  let node=try XCTUnwrap(owner.nodes["bee"]),face=node.sourcePaintedNumbersTexture
  service.deliver(wallMilliseconds:16)
  XCTAssertFalse(owner.readyToAdopt);XCTAssertTrue(owner.nodes.isEmpty);XCTAssertTrue(node.sourcePaintedNumbersTexture === face)
  XCTAssertFalse(node.sourceRestoreWildFacePending);XCTAssertEqual(draws,1);XCTAssertEqual(service.pendingSourceAnimationFrameCount,0)
 }
 func testActualRestoredWildBackgroundRetainsRawFrameButGlobalPauseDoesNotOwnIt()throws {
  var state=saved();state.tiles=[.init(id:"bee",cell:.init(column:0,row:0),value:6,archetype:.star,variant:"bee")]
  let f=try Fixture(state,wildRestore:true);defer{f.dispose()}
  let node=try XCTUnwrap(f.construction.nodes["bee"]),face=node.sourcePaintedNumbersTexture
  f.service.setSourceGlobalPaused(true);f.service.setSourceForeground(false);f.service.deliver(wallMilliseconds:1000)
  XCTAssertTrue(node.sourceRestoreWildFacePending);XCTAssertTrue(node.sourcePaintedNumbersTexture === face)
  f.service.setSourceForeground(true);f.service.deliver(wallMilliseconds:1016)
  XCTAssertFalse(node.sourceRestoreWildFacePending);XCTAssertEqual(f.counter.count,1);XCTAssertTrue(node.sourceIdleDeferred)
  XCTAssertEqual(f.construction.pendingFaceCount,0);XCTAssertFalse(node.sourcePaintedNumbersTexture === face)
 }

 func testActualRestoredPlainStarWaitsForFaceThenResumesTypedSkinAndExistingHalo()async throws {
  let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
  var state=saved();state.tiles=[.init(id:"star",cell:.init(column:0,row:0),value:6,archetype:.star)]
  let f=try Fixture(state,sourceOuterForRepair:true,wildRestore:true,sourceTasks:tasks)
  let view=SKView(frame:.init(x:0,y:0,width:390,height:844));view.presentScene(f.scene)
  defer{view.presentScene(nil);f.dispose();fifo.dispose()}
  let node=try XCTUnwrap(f.construction.nodes["star"]),scope=try XCTUnwrap(f.repairScope)
  let before=f.scene.engine.state
  XCTAssertTrue(tasks.inputTask{XCTAssertTrue(f.scene.configureSourcePlainStarHalos(scope:scope,performanceNow:{0}))})
  XCTAssertTrue(node.sourceRestoreWildFacePending);XCTAssertTrue(node.sourceIdleDeferred)
  XCTAssertEqual(node.sourceLiveStarHaloCount,0)
  f.service.deliver(wallMilliseconds:16)
  for _ in 0..<400 {if node.sourceLiveStarHaloCount>0 && node.sourceWildSkinReceiptCurrent {break};try await Task.sleep(for:.milliseconds(10))}
  XCTAssertFalse(node.sourceIdleDeferred);XCTAssertTrue(node.sourceWildSkinReceiptCurrent)
  XCTAssertEqual(node.sourceWildSkinAssetPath,NativeDiceArtwork.definition(kind:"wild",variant:nil).path)
  XCTAssertGreaterThan(node.sourceLiveStarHaloCount,0);XCTAssertTrue(node.sourceRestoredWildConstructorCurrent)
  XCTAssertEqual(f.scene.engine.state,before)
  scope.dispose();XCTAssertEqual(node.sourceLiveStarHaloCount,0)
 }
 func testActualAllRestoredWildStaticSkinsUseTypedAPPReceiptsAndPreserveSameConstructorObjects()async throws {
  for tile in wildRoster() {
   let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
   var state=saved();state.tiles=[tile]
   let f=try Fixture(state,sourceOuterForRepair:true,wildRestore:true,sourceTasks:tasks)
   let view=SKView(frame:.init(x:0,y:0,width:390,height:844));view.presentScene(f.scene)
   defer{view.presentScene(nil);f.dispose();fifo.dispose()}
   let node=try XCTUnwrap(f.construction.nodes[tile.id]),scope=try XCTUnwrap(f.repairScope)
   let ready=expectation(description:"actual restored \(tile.id) static typed skin")
   var finished=false;node.onResourceReady={if node.sourceWildSkinReceiptCurrent,!finished {finished=true;ready.fulfill()}}
   let before=f.scene.engine.state
   tasks.inputTask {XCTAssertTrue(f.scene.configureSourceRestoredWildSkins(scope:scope))}
   f.service.deliver(wallMilliseconds:16)
   await fulfillment(of:[ready],timeout:4)
   XCTAssertTrue(node === f.scene.sourceNativeTileNode(tile.id));XCTAssertTrue(node.sourceRestoredWildConstructorCurrent)
   XCTAssertTrue(node.sourcePhysicalMarkersCovered);XCTAssertTrue(node.sourceWildSkinReceiptCurrent)
   let core=try XCTUnwrap(before.tiles[0].archetype),definition=try XCTUnwrap(NativeDiceArtwork.sourceWildSkinDefinition(kind:core.rawValue,variant:tile.variant))
   XCTAssertEqual(node.sourceWildSkinAssetPath,definition.path)
   // BLOOB retains its authored tilted face; logical size is independent of
   // the larger axis-aligned orbit bounds produced by that rotation.
   let face=try XCTUnwrap(node.sourceStarOrbitHost.children.compactMap{$0 as? SKSpriteNode}.first{$0.texture === node.sourcePaintedNumbersTexture})
   XCTAssertEqual(face.size.width,definition.size.width,accuracy:1e-3)
   XCTAssertEqual(face.size.height,definition.size.height,accuracy:1e-3)
   XCTAssertTrue(node.sourceIdleDeferred);XCTAssertEqual(node.sourceIdleOwnerCount,0);XCTAssertFalse(node.hasAnimatedArtwork)
   XCTAssertEqual(f.counter.count,1);XCTAssertEqual(f.scene.engine.state,before);XCTAssertEqual(f.construction.pendingFaceCount,0)
   node.onResourceReady=nil
  }
 }
 func testActualRestoredWildRetiredScopeCannotPublishLateStaticSkinOrRawFace()async throws {
  let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
  var state=saved();state.tiles=[.init(id:"bee",cell:.init(column:0,row:0),value:6,archetype:.star,variant:"bee")]
  let f=try Fixture(state,sourceOuterForRepair:true,wildRestore:true,sourceTasks:tasks);defer{f.dispose();fifo.dispose()}
  let node=try XCTUnwrap(f.construction.nodes["bee"]),scope=try XCTUnwrap(f.repairScope),face=node.sourcePaintedNumbersTexture,before=f.scene.engine.state
  tasks.inputTask {XCTAssertTrue(f.scene.configureSourceRestoredWildSkins(scope:scope))}
  f.repairContext?.dispose();f.service.deliver(wallMilliseconds:16)
  // Deliver actual queued decode/upload completions after the current Scope has retired.
  try await Task.sleep(nanoseconds:100_000_000)
  XCTAssertFalse(node.sourceWildSkinReceiptCurrent);XCTAssertFalse(node.sourceRestoreWildFacePending)
  XCTAssertTrue(node.sourcePaintedNumbersTexture === face);XCTAssertFalse(node.sourceRestoredWildConstructorCurrent)
  XCTAssertEqual(f.scene.engine.state,before);XCTAssertEqual(f.counter.count,1)
 }
 func testGenuineSavedHoneyWaitsForRawFaceAndExactSourceEntranceThenPreservesCore()async throws {
  var state=saved();state.tiles=[.init(id:"honey",cell:.init(column:0,row:0),value:6,archetype:.magnet,variant:"honey")]
  let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
  var wall=0.0
  let f=try Fixture(state,sourceOuterForRepair:true,wildRestore:true,sourceTasks:tasks,sourceWallMillisecondsNow:{wall});defer{f.dispose();fifo.dispose()}
  let scope=try XCTUnwrap(f.repairScope),node=try XCTUnwrap(f.construction.nodes["honey"])
  f.scene.sourceBoardEntryEnabled=true
  var completed:[NativeSourceBoardEntryOwner.Completion]=[]
  XCTAssertTrue(f.scene.configureSourceBoardEntry(scope:scope,sound:{_,_,_ in {}},completed:{completed.append($0)}))
  let view=SKView(frame:.init(x:0,y:0,width:390,height:844))
  let window=UIWindow(frame:view.bounds),controller=UIViewController();controller.view=view;window.rootViewController=controller
  window.makeKeyAndVisible();view.presentScene(f.scene)
  defer{view.presentScene(nil);window.isHidden=true;window.rootViewController=nil}
  f.scene.layout(size:view.bounds.size,insets:.zero,animateEntry:true)
  XCTAssertTrue(node.sourceRestoredWildConstructorCurrent);XCTAssertTrue(node.sourceRestoreWildFacePending)
  XCTAssertTrue(f.scene.configureSourceSpecialIdle(scope:scope))
  XCTAssertFalse(node.hasSourceHoneyIdle);XCTAssertTrue(node.sourceIdleDeferred)
  let before=f.scene.engine.state
  wall=16;f.service.deliver(wallMilliseconds:wall)
  XCTAssertFalse(node.sourceRestoreWildFacePending)
  XCTAssertFalse(node.hasSourceHoneyIdle,"raw face receipt cannot bypass normal entry")
  while completed.isEmpty && wall<1500 {wall+=16;f.service.deliver(wallMilliseconds:wall)}
  XCTAssertEqual(completed.map(\.outcome),[.normal])
  XCTAssertTrue(node.hasSourceHoneyIdle);XCTAssertFalse(node.sourceIdleDeferred)
  for _ in 0..<500 {if node.sourceWildSkinReceiptCurrent {break};try await Task.sleep(for:.milliseconds(2))}
  XCTAssertTrue(node.sourceWildSkinReceiptCurrent)
  for _ in 0..<500 {if node.sourceHoneyCohortCommitted {break};try await Task.sleep(for:.milliseconds(2))}
  XCTAssertTrue(node.sourceHoneyCohortCommitted);XCTAssertEqual(node.sourceHoneySprites.count,3)
  XCTAssertFalse(node.visual.children.contains{$0.name=="native-honey-idle-orbit"})
  let baseY=node.sourceBaseY,ids=node.sourceHoneySprites.map(ObjectIdentifier.init)
  wall+=400;f.service.deliver(wallMilliseconds:wall)
  XCTAssertEqual(node.sourceBaseY,baseY,accuracy:1e-5)
  XCTAssertEqual(node.sourceHoneySprites.map(ObjectIdentifier.init),ids)
  XCTAssertEqual(f.scene.engine.state,before,"visual restore never mutates saved gameplay/progression")
  XCTAssertEqual(scope.specialIdle.snapshot.running,1)
 }
 func testGenuineSavedBottleWaitsForRawFaceAndExactSourceEntranceThenPreservesCore()async throws {
  var state=saved();state.tiles=[.init(id:"bottle",cell:.init(column:0,row:0),value:6,archetype:.magnet,variant:"bottle")]
  let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
  var wall=0.0
  let f=try Fixture(state,sourceOuterForRepair:true,wildRestore:true,sourceTasks:tasks,sourceWallMillisecondsNow:{wall});defer{f.dispose();fifo.dispose()}
  let scope=try XCTUnwrap(f.repairScope),node=try XCTUnwrap(f.construction.nodes["bottle"])
  f.scene.sourceBoardEntryEnabled=true
  var completed:[NativeSourceBoardEntryOwner.Completion]=[]
  XCTAssertTrue(f.scene.configureSourceBoardEntry(scope:scope,sound:{_,_,_ in {}},completed:{completed.append($0)}))
  let view=SKView(frame:.init(x:0,y:0,width:390,height:844))
  let window=UIWindow(frame:view.bounds),controller=UIViewController();controller.view=view;window.rootViewController=controller
  window.makeKeyAndVisible();view.presentScene(f.scene)
  defer{view.presentScene(nil);window.isHidden=true;window.rootViewController=nil}
  f.scene.layout(size:view.bounds.size,insets:.zero,animateEntry:true)
  XCTAssertTrue(node.sourceRestoredWildConstructorCurrent);XCTAssertTrue(node.sourceRestoreWildFacePending)
  XCTAssertTrue(f.scene.configureSourceSpecialIdle(scope:scope))
  XCTAssertFalse(node.hasSourceBottleIdle);XCTAssertTrue(node.sourceIdleDeferred)
  let before=f.scene.engine.state
  wall=16;f.service.deliver(wallMilliseconds:wall)
  XCTAssertFalse(node.sourceRestoreWildFacePending)
  XCTAssertFalse(node.hasSourceBottleIdle,"raw face receipt cannot bypass normal entry")
  while completed.isEmpty && wall<1500 {wall+=16;f.service.deliver(wallMilliseconds:wall)}
  XCTAssertEqual(completed.map(\.outcome),[.normal])
  XCTAssertTrue(node.hasSourceBottleIdle);XCTAssertFalse(node.sourceIdleDeferred)
  for _ in 0..<500 {if node.sourceWildSkinReceiptCurrent {break};try await Task.sleep(for:.milliseconds(2))}
  XCTAssertTrue(node.sourceWildSkinReceiptCurrent)
  XCTAssertEqual(node.sourceBaseAnchorY,1,accuracy:1e-6)
  XCTAssertEqual(node.sourceBaseY,61.44,accuracy:1e-5)
  wall+=400;f.service.deliver(wallMilliseconds:wall)
  let pose=NativeBottleIdleMotion.sample(seconds:0.4)
  let face=try XCTUnwrap(node.sourceStarOrbitHost.children.compactMap{$0 as? SKSpriteNode}.first{$0.texture === node.sourcePaintedNumbersTexture})
  XCTAssertEqual(face.zRotation,-pose.rotation,accuracy:1e-6)
  XCTAssertEqual(node.sourceBaseY,61.44+pose.y,accuracy:1e-5)
  XCTAssertEqual(f.scene.engine.state,before,"visual restore never mutates saved gameplay/progression")
  XCTAssertEqual(scope.specialIdle.snapshot.running,1)
 }
 func testAllFourGenuineRestoredWildCoresShareSourceEntranceWithoutPrematureIdle()throws {
  var state=saved()
  state.tiles=zip([NativeWildArchetype.star,.juice,.magnet,.tnt],0..<4).map{core,column in
   .init(id:"entry-\(core.rawValue)",cell:.init(column:column,row:0),value:6,archetype:core)
  }
  let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
  var wall=0.0
  let f=try Fixture(state,sourceOuterForRepair:true,wildRestore:true,sourceTasks:tasks,sourceWallMillisecondsNow:{wall});defer{f.dispose();fifo.dispose()}
  let scope=try XCTUnwrap(f.repairScope)
  f.scene.sourceBoardEntryEnabled=true
  var completions:[NativeSourceBoardEntryOwner.Completion]=[]
  XCTAssertTrue(f.scene.configureSourceBoardEntry(scope:scope,sound:{_,_,_ in {}},completed:{completions.append($0)}))
  let view=SKView(frame:.init(x:0,y:0,width:390,height:844));view.presentScene(f.scene);defer{view.presentScene(nil)}
  f.scene.layout(size:view.bounds.size,insets:.zero,animateEntry:true)
  f.scene.synchronize(animateEntry:true)
  let before=f.scene.engine.state
  XCTAssertTrue(f.construction.nodes.values.allSatisfy{$0.sourceBoardEntryBinding != nil})
  wall=16;f.service.deliver(wallMilliseconds:wall)
  XCTAssertTrue(f.construction.nodes.values.allSatisfy{!$0.sourceRestoreWildFacePending && $0.sourceIdleDeferred && $0.sourceIdleOwnerCount==0})
  while completions.isEmpty && wall<1600 {wall+=16;f.service.deliver(wallMilliseconds:wall)}
  XCTAssertEqual(completions.map(\.outcome),[.normal])
  for node in f.construction.nodes.values {
   XCTAssertNil(node.sourceBoardEntryBinding);XCTAssertFalse(node.isHidden)
   XCTAssertEqual(node.sourceLocalScale.x,1,accuracy:1e-6)
   XCTAssertTrue(node.sourceIdleDeferred);XCTAssertEqual(node.sourceIdleOwnerCount,0)
  }
  XCTAssertEqual(f.scene.engine.state,before)
 }
 func testGenuineSavedBottleRetiredBeforeRawFaceCannotStartLateIdle()throws {
  var state=saved();state.tiles=[.init(id:"bottle",cell:.init(column:0,row:0),value:6,archetype:.magnet,variant:"bottle")]
  let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
  let f=try Fixture(state,sourceOuterForRepair:true,wildRestore:true,sourceTasks:tasks);defer{f.dispose();fifo.dispose()}
  let scope=try XCTUnwrap(f.repairScope),node=try XCTUnwrap(f.construction.nodes["bottle"])
  XCTAssertTrue(f.scene.configureSourceSpecialIdle(scope:scope));XCTAssertFalse(node.hasSourceBottleIdle)
  scope.dispose();f.scene.retireSourceAnimationBindings()
  let texture=node.sourcePaintedNumbersTexture,draws=f.counter.count
  f.service.deliver(wallMilliseconds:16)
  XCTAssertFalse(node.hasSourceBottleIdle);XCTAssertTrue(node.sourcePaintedNumbersTexture === texture)
  XCTAssertEqual(f.counter.count,draws);XCTAssertEqual(scope.specialIdle.snapshot.registered,0)
 }
 func testActualUnadoptedWildDisposeCancelsItsRawFrameEvenWhileNodeRemainsHeld()throws {
  var state=saved();state.tiles=[.init(id:"bee",cell:.init(column:0,row:0),value:6,archetype:.star,variant:"bee")]
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceFrameTransportEnabled:true);defer{service.dispose()}
  let owner=try XCTUnwrap(NativeSourceInitialBoardConstruction.makeRestored(root:NativeTestResources.root,service:service,saved:state,random:{0.5}))
  let node=try XCTUnwrap(owner.nodes["bee"]),face=node.sourcePaintedNumbersTexture
  XCTAssertEqual(service.pendingSourceAnimationFrameCount,2)
  owner.dispose()
  XCTAssertEqual(service.pendingSourceAnimationFrameCount,0);XCTAssertFalse(node.sourceRestoreWildFacePending)
  service.deliver(wallMilliseconds:16);XCTAssertTrue(node.sourcePaintedNumbersTexture === face)
 }

 func testActualRestoredWildFaceMatchesExecutedOriginalMobileBoardGeometryAndHitPolicy()throws {
  // SpriteKit painted bounds use Float precision; 0.001 px retains subpixel parity.
  // Actual board._setValueVisuals and registry were executed independently.
  // Original PNG headers supply source dimensions; no Native recipe is used
  // to generate these expected values.
  let source:[(String,String,Double,Double,Double)]=[("wild","assets/wild.png",128,128,0.5),("wild-juice","assets/wild-juice.png",128,128,0.5),("wild-magnet","assets/wild-magnet.png",122.88,122.88,0.5),("wild-tnt","assets/shop/explosion pack/tnt.png",128,128,0.5),("fish","assets/shop/fish/fish.png",128,128,0.5),("kanta","assets/shop/kanta/04.png",95.81286549707602,128,0.5),("bee","assets/shop/bee/bee1@2x.png",128,128,0.5),("laser-gun","assets/shop/gun/right gun@2x.png",184.32,184.32,0.5),("spaceship","assets/shop/spaceship/spaceship@2x.png",147.456,147.456,0.5),("bottle","assets/shop/bottle/glass bottle@2x.png",122.88,122.88,0.5),("honey","assets/shop/honey/honey.png",122.88,122.88,0.5),("flower","assets/shop/bush/flower.png",128,128,0.5),("barell","assets/shop/barell/barell-static.png",160.2,207.9,0.6296296296296297),("mushroom","assets/shop/mushroom/mushroom.png",128,128,0.5),("robo-cube","assets/shop/robo/robo-cube1.png",128,128,0.5),("cubero","assets/shop/cubero/cubero.png",170,128,0.5),("beach-ball","assets/shop/ball/ball.png",128,128,0.5)]
  for (key,path,width,height,anchorY) in source {
   let core=NativeWildArchetype(rawValue:key) ?? NativeSpecialDiceRegistry.variants[key]!.archetype
   let variant=NativeWildArchetype(rawValue:key)==nil ? key:nil
   var state=saved();state.tiles=[.init(id:key,cell:.init(column:0,row:0),value:6,archetype:core,variant:variant)]
   let f=try Fixture(state,sourceOuterForRepair:true,wildRestore:true);defer{f.dispose()}
   let node=try XCTUnwrap(f.construction.nodes[key])
   XCTAssertFalse(node.hasSourceSkinHitArea)
   f.service.deliver(wallMilliseconds:16)
   XCTAssertTrue(node.sourcePaintedNumbersTexture === f.construction.textures.texture(path,densityAware:false))
   XCTAssertEqual(Double(node.sourceStarOrbitMetrics.width),width,accuracy:1e-3)
   XCTAssertEqual(Double(node.sourceStarOrbitMetrics.height),height,accuracy:1e-3)
   XCTAssertEqual(node.sourceBaseAnchorY,anchorY,accuracy:1e-6)
   XCTAssertEqual(node.hasSourceSkinHitArea,variant != nil)
   if variant != nil {
    node.isHidden=false;let canvas=try XCTUnwrap(node.parent)
    XCTAssertTrue(node.containsSourceSkinInput(node.position,in:canvas,generation:state.generation))
    let outside=node.convert(CGPoint(x:65,y:0),to:canvas)
    XCTAssertFalse(node.containsSourceSkinInput(outside,in:canvas,generation:state.generation))
   }
   XCTAssertEqual(f.counter.count,1);XCTAssertFalse(node.sourceWildSkinReceiptCurrent)
  }
 }

 func testActualBeeMaskClampUsesRetainedPNGPixelMetadataNotLogicalFaceSize()throws {
  var state=saved();state.tiles=[.init(id:"bee",cell:.init(column:0,row:0),value:6,archetype:.star,variant:"bee")]
  let f=try Fixture(state,sourceOuterForRepair:true,wildRestore:true);defer{f.dispose()}
  let node=try XCTUnwrap(f.construction.nodes["bee"])
  f.service.deliver(wallMilliseconds:16);node.setSourceIdleDeferred(false)
  let data=try Data(contentsOf:NativeTestResources.root.appendingPathComponent("assets/shop/bee/bee1@2x.png"))
  func header(_ offset:Int)->Int{data[offset..<offset+4].reduce(0){($0<<8)|Int($1)}}
  let pixels=CGSize(width:header(16),height:header(20))
  let face=try XCTUnwrap(node.sourcePaintedNumbersTexture)
  XCTAssertEqual(f.construction.textures.sourceRasterPixelSize(for:face),pixels)
  XCTAssertEqual(f.construction.textures.sourceRasterLogicalWidth(for:face),pixels.width/2)
  XCTAssertNotEqual(pixels.width,node.sourceStarOrbitMetrics.width)
  XCTAssertTrue(node.beginSourceWildShimmer(service:f.service,random:{0.25},current:{true}))
  let clamp=try XCTUnwrap(node.sourceWildShimmerSprite?.shader?.uniformNamed("u_mask_clamp")).vectorFloat4Value
  XCTAssertEqual(clamp,NativeSourceWildShimmerRenderer.maskClamp(pixelSize:pixels,logicalWidth:pixels.width/2))
  XCTAssertNil(f.construction.textures.sourceRasterPixelSize(for:SKTexture(data:Data([255,0,0,255]),size:.init(width:1,height:1))))
 }

 func testActualSceneCanvasAndCarrierVisibilityPauseSameSweepAndResumeWithoutNewDraw()throws {
  var state=saved();state.tiles=[.init(id:"bee",cell:.init(column:0,row:0),value:6,archetype:.star,variant:"bee")]
  let f=try Fixture(state,sourceOuterForRepair:true,wildRestore:true);defer{f.dispose()}
  let view=SKView(frame:.init(x:0,y:0,width:390,height:844)),wrapper=UIView(frame:view.frame)
  wrapper.addSubview(view);view.presentScene(f.scene);defer{view.presentScene(nil)}
  f.scene.sourceWildShimmerEnabled=true
  let node=try XCTUnwrap(f.construction.nodes["bee"])
  f.service.deliver(wallMilliseconds:16);node.setSourceIdleDeferred(false);node.removeAction(forKey:"entry");node.alpha=1;node.isHidden=false
  var draws=0
  XCTAssertTrue(node.beginSourceWildShimmer(service:f.service,random:{draws+=1;return 0.25},current:{true}))
  for n in 1...110{f.service.deliver(wallMilliseconds:Double(n)*50+16)}
  let sprite=try XCTUnwrap(node.sourceWildShimmerSprite),shader=try XCTUnwrap(sprite.shader)
  let before=try XCTUnwrap(shader.uniformNamed("u_sweep")).vectorFloat2Value
  XCTAssertGreaterThan(try XCTUnwrap(shader.uniformNamed("u_opacity")).floatValue,0.1)
  wrapper.isHidden=true;f.scene.reconcileSourceWildShimmerVisibility()
  for n in 111...150{f.service.deliver(wallMilliseconds:Double(n)*50+16)}
  XCTAssertEqual(shader.uniformNamed("u_sweep")?.vectorFloat2Value,before)
  XCTAssertTrue(node.sourceWildShimmerSprite === sprite);XCTAssertEqual(draws,2)
  wrapper.isHidden=false
  let carrier=try XCTUnwrap(node.parent);carrier.alpha=0.001
  f.scene.reconcileSourceWildShimmerVisibility()
  for n in 151...160{f.service.deliver(wallMilliseconds:Double(n)*50+16)}
  XCTAssertEqual(shader.uniformNamed("u_sweep")?.vectorFloat2Value,before)
  carrier.alpha=0.5
  let base=try XCTUnwrap(node.sourceStarOrbitHost.children.compactMap{$0 as? SKSpriteNode}.first{$0 !== sprite && $0.texture === node.sourcePaintedNumbersTexture})
  base.isHidden=true // Source ignores the direct artwork's hidden fallback face.
  f.scene.reconcileSourceWildShimmerVisibility()
  for n in 161...163{f.service.deliver(wallMilliseconds:Double(n)*50+16)}
  XCTAssertNotEqual(shader.uniformNamed("u_sweep")?.vectorFloat2Value,before)
  XCTAssertEqual(draws,2);XCTAssertTrue(node.sourceWildShimmerSprite === sprite)
  // Real installed Pixi MaskFilter.apply keeps this1 under every carrier fade.
  XCTAssertEqual(shader.uniformNamed("u_mask_alpha")?.floatValue,1)
 }

 func testActualBeeShimmerStaleCurrentRemovesAlreadyVisibleMaskAndBothRoots()throws {
  var state=saved();state.tiles=[.init(id:"bee",cell:.init(column:0,row:0),value:6,archetype:.star,variant:"bee")]
  let f=try Fixture(state,sourceOuterForRepair:true,wildRestore:true);defer{f.dispose()}
  let node=try XCTUnwrap(f.construction.nodes["bee"])
  f.service.deliver(wallMilliseconds:16);node.setSourceIdleDeferred(false)
  node.isHidden=false
  var current=true
  XCTAssertTrue(node.beginSourceWildShimmer(service:f.service,random:{0.25},current:{current}))
  let sprite=try XCTUnwrap(node.sourceWildShimmerSprite)
  for n in 1...110{f.service.deliver(wallMilliseconds:Double(n)*50+16)}
  XCTAssertGreaterThan(try XCTUnwrap(sprite.shader?.uniformNamed("u_opacity")).floatValue,0.1)
  current=false;f.service.deliver(wallMilliseconds:5566)
  XCTAssertNil(node.sourceWildShimmerSprite);XCTAssertNil(sprite.parent);XCTAssertNil(sprite.shader)
  XCTAssertEqual(node.sourceWildShimmerRootCount,0);XCTAssertEqual(f.construction.textures.sourceWildShimmerGradients.references,0)
 }

 func testActualSceneSkinCallerStartsCapturedShimmerBeforeFamilyIdleAndKeepsFixedMask()async throws {
  let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
  var state=saved();state.tiles=[.init(id:"bee",cell:.init(column:0,row:0),value:6,archetype:.star,variant:"bee")]
  let f=try Fixture(state,sourceOuterForRepair:true,wildRestore:true,sourceTasks:tasks);defer{f.dispose();fifo.dispose()}
  let view=SKView(frame:.init(x:0,y:0,width:390,height:844));view.presentScene(f.scene);defer{view.presentScene(nil)}
  let node=try XCTUnwrap(f.construction.nodes["bee"]),scope=try XCTUnwrap(f.repairScope)
  f.service.deliver(wallMilliseconds:16);node.setSourceIdleDeferred(false)
  let original=node.sourcePaintedNumbersTexture,before=f.scene.engine.state
  f.scene.sourceWildShimmerEnabled=true
  var sawShimmerBeforeIdle=false
  tasks.inputTask {
   XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"bee",scope:scope,startSourceIdle:{
    sawShimmerBeforeIdle=node.sourceWildShimmerRootCount==1 && node.sourceWildShimmerSprite?.texture === original
    return true
   }))
  }
  XCTAssertTrue(sawShimmerBeforeIdle);XCTAssertEqual(f.counter.count,2)
  let deadline=Date().addingTimeInterval(4)
  while !node.sourceWildSkinReceiptCurrent && Date()<deadline {try await Task.sleep(nanoseconds:10_000_000)}
  XCTAssertTrue(node.sourceWildSkinReceiptCurrent);XCTAssertTrue(node.sourceWildShimmerSprite?.texture === original)
  XCTAssertEqual(f.scene.engine.state,before)
  f.scene.retireSourceAnimationBindings()
  XCTAssertNil(node.sourceWildShimmerSprite);XCTAssertEqual(f.construction.textures.sourceWildShimmerGradients.references,0)
 }

 func testActualRestoredBeeShimmerUsesCurrentRawFaceAndIdentityRetiresBothOwners()throws {
  var state=saved();state.tiles=[.init(id:"bee",cell:.init(column:0,row:0),value:6,archetype:.star,variant:"bee")]
  let f=try Fixture(state,sourceOuterForRepair:true,wildRestore:true);defer{f.dispose()}
  let node=try XCTUnwrap(f.construction.nodes["bee"])
  var draws=0
  XCTAssertFalse(node.beginSourceWildShimmer(service:f.service,random:{draws+=1;return 0.25},current:{true}))
  XCTAssertEqual(draws,0,"deferred or pending raw face cannot start shimmer")
  f.service.deliver(wallMilliseconds:16);node.setSourceIdleDeferred(false)
  let face=node.sourcePaintedNumbersTexture,before=f.scene.engine.state
  XCTAssertTrue(node.beginSourceWildShimmer(service:f.service,random:{draws+=1;return 0.25},current:{true}))
  let first=try XCTUnwrap(node.sourceWildShimmerSprite)
  XCTAssertTrue(first.texture === face);XCTAssertEqual(node.sourceWildShimmerRootCount,1)
  XCTAssertEqual(f.construction.textures.sourceWildShimmerGradients.references,1)
  XCTAssertTrue(node.beginSourceWildShimmer(service:f.service,random:{draws+=1;return 0.25},current:{true}))
  XCTAssertNil(first.parent);XCTAssertNil(first.shader);XCTAssertEqual(draws,2)
  XCTAssertEqual(node.sourceWildShimmerRootCount,1);XCTAssertEqual(f.construction.textures.sourceWildShimmerGradients.references,1)
  XCTAssertEqual(f.scene.engine.state,before)
  node.update(value:2,kind:"regular",variant:nil,depth:1,locked:false)
  XCTAssertNil(node.sourceWildShimmerSprite);XCTAssertEqual(node.sourceWildShimmerRootCount,0)
  XCTAssertEqual(f.construction.textures.sourceWildShimmerGradients.references,0)
 }
 func testActualRestoredBeeShimmerBindingRetirementPreservesFaceAndCannotPaintLate()throws {
  var state=saved();state.tiles=[.init(id:"bee",cell:.init(column:0,row:0),value:6,archetype:.star,variant:"bee")]
  let f=try Fixture(state,sourceOuterForRepair:true,wildRestore:true);defer{f.dispose()}
  let node=try XCTUnwrap(f.construction.nodes["bee"])
  f.service.deliver(wallMilliseconds:16);node.setSourceIdleDeferred(false)
  XCTAssertTrue(node.beginSourceWildShimmer(service:f.service,random:{0.25},current:{true}))
  let sprite=try XCTUnwrap(node.sourceWildShimmerSprite),face=node.sourcePaintedNumbersTexture
  node.retireSourceAnimationBindingsPreservingPaint()
  XCTAssertNil(sprite.parent);XCTAssertNil(sprite.shader);XCTAssertTrue(node.sourcePaintedNumbersTexture === face)
  for n in 1...150{f.service.deliver(wallMilliseconds:Double(n)*50+16)}
  XCTAssertNil(node.sourceWildShimmerSprite);XCTAssertEqual(f.construction.textures.sourceWildShimmerGradients.references,0)
 }

 func testActualMissingRestoredWildAssetRefusesBeforeAnyConstructorDrawAndKeepsOriginalAssetsUntouched()throws {
  let directory=FileManager.default.temporaryDirectory.appendingPathComponent("source-restore-missing-\(UUID().uuidString)")
  defer{try? FileManager.default.removeItem(at:directory)}
  let required=["assets/tile.png","assets/shadow.png"]+NativeRegularStackLayout.Skin.allCases.map{String($0.rawValue.dropFirst(2))}
  for path in required {
   let target=directory.appendingPathComponent(path)
   try FileManager.default.createDirectory(at:target.deletingLastPathComponent(),withIntermediateDirectories:true)
   try FileManager.default.createSymbolicLink(at:target,withDestinationURL:NativeTestResources.root.appendingPathComponent(path))
  }
  var state=saved();state.tiles=[.init(id:"bee",cell:.init(column:0,row:0),value:6,archetype:.star,variant:"bee")]
  let before=state,service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceFrameTransportEnabled:true)
  defer{service.dispose()};var draws=0
  XCTAssertNil(NativeSourceInitialBoardConstruction.makeRestored(root:directory,service:service,saved:state,random:{draws+=1;return 0.5}))
  XCTAssertEqual(draws,0);XCTAssertEqual(service.pendingSourceAnimationFrameCount,0);XCTAssertEqual(state,before)
 }

 @MainActor func testCompletedInactiveGuideRestorePreservesAssistButRefusesActiveAndIncompleteGuide()throws {
  var state=saved(),tutorial=NativeTutorialState()
  tutorial.active=false;tutorial.guideCompleted=true;tutorial.completionAssist=true
  state.tutorial=tutorial
  XCTAssertTrue(NativeSourceInitialBoardRecipe.canRestoreRegular(state))
  let recipe=try XCTUnwrap(NativeSourceInitialBoardRecipe.captureRestoredRegular(state,random:{0.1}))
  XCTAssertEqual(recipe.state.tutorial,tutorial)
  state.tutorial?.active=true;XCTAssertFalse(NativeSourceInitialBoardRecipe.canRestoreRegular(state))
  state.tutorial?.active=false;state.tutorial?.guideCompleted=false
  XCTAssertFalse(NativeSourceInitialBoardRecipe.canRestoreRegular(state))
 }

}
