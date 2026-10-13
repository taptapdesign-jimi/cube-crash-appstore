import XCTest
import SpriteKit
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceWildDestinationFaceSceneTests:XCTestCase {
 @MainActor private final class Clock {var wall=0.0;var draws=0;func next()->Double{draws+=1;return 0.5}}
 @MainActor private final class Fixture {
  let clock:Clock,service:NativeSourceAnimationClockService,context:NativeGameplaySourceContext,scope:NativeGameplaySourceContext.Scope,scene:NativeBoardScene,view:SKView
  let initial:NativeSourceInitialBoardConstruction?
  let window:UIWindow
  var failures:[String]=[]
  init(_ kind:NativeWildArchetype,final:Bool=true,restoredSource:Bool=false)throws {
   let c=Clock();clock=c
   service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{c.wall},sourceFrameTransportEnabled:true)
   context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{c.next()})
   let saved=NativeBoardState(tiles:[.init(id:"src",cell:.init(column:0,row:0),value:4,stackDepth:4),.init(id:"dst",cell:.init(column:1,row:0),value:6,archetype:kind)]+(final ? []:[.init(id:"other",cell:.init(column:4,row:8),value:3)]))
   initial=restoredSource ? try XCTUnwrap(NativeSourceInitialBoardConstruction.makeRestored(root:NativeTestResources.root,service:service,saved:saved,random:{c.next()})):nil
   let e=NativeGameplayEngine(state:initial?.recipe?.state ?? saved,sourceMathRandom:context.mathRandom)
   e.stagedOrdinaryMoves=true;e.stagedOrdinaryAssignments=true;e.stagedDirectWildMoves=true;e.stagedDirectWildAssignments=true
   scene=NativeBoardScene(engine:e,resourceRoot:NativeTestResources.root,size:.init(width:390,height:844),sourceInitialConstruction:initial)
   let captured=scene
   scope=try XCTUnwrap(context.beginScene(engine:e,retire:{[weak captured] in captured?.retireSourceAnimationBindings()}))
   scene.sourceOuterTimelineDriver=scope.timeline;scene.sourceDragTweenDriver=scope.tween
   scene.sourceSameNodeStackAbsorbsEnabled=true;scene.sourceOrdinarySixSameNodeEnabled=true;scene.sourceDirectWildSameNodeEnabled=true
   scene.sourceDirectWildDestinationFaceEnabled=true
   scene.sourceContactVisualRandom={c.next()};scene.configureSourceRegularStackHandoff(service:service,admitted:{true})
   scene.layout(size:scene.size,insets:.init(top:47,left:0,bottom:34,right:0))
   view=SKView(frame:.init(x:0,y:0,width:390,height:844));view.presentScene(scene)
   let host=UIViewController();host.view=view
   window=UIWindow(frame:view.bounds);window.rootViewController=host;window.makeKeyAndVisible()
   scene.onPresentationFailure={[weak self] in self?.failures.append($0)}
   scene.onSourcePresentationFailure={[weak self] reason,_ in self?.failures.append(reason)}
   let src=try XCTUnwrap(scene.sourceNativeTileNode("src"))
   XCTAssertTrue(src.queueSourceStackValue(4,addStack:0,service:service,random:{c.next()},current:{true}))
   c.wall=16;service.deliver(wallMilliseconds:16)
   XCTAssertTrue(scene.configureSourceSpecialTransactions(scope:scope))
   XCTAssertTrue(scene.configureSourceSpecialIdle(scope:scope))
   XCTAssertTrue(scene.configureSourceOrdinarySixMain(scope:scope,acquireIdle:{[weak scene] reason in scene?.acquireSourceSpecialIdle(reason:reason)}))
  }
  func prepare(_ test:XCTestCase,face:Bool=true)async throws {
   let loaded=test.expectation(description:"Genuine Source HUD selected upload")
   var prepared:NativeSourceHUDStarTexturePreparation.Prepared?
   scope.hudStarTextures.prepare(root:NativeTestResources.root,current:{[scope] in scope.current}){prepared=$0;loaded.fulfill()}
   await test.fulfillment(of:[loaded],timeout:5)
   scene.sourceHUDStarJobsPresentationEnabled=true
   XCTAssertTrue(scene.configureSourceHUDStarJobs(scope:scope,prepared:try XCTUnwrap(prepared),capture:{[weak scene] _ in
    guard let target=scene?.sourceHUDStarTargetScreen else{return nil};return .init(screenOrigin:.zero,hudTarget:target)
   }))
   XCTAssertTrue(scene.configureSourceDirectWildMain(scope:scope))
   if face {
    let ready=test.expectation(description:"Existing texture owner actual default Star upload")
    scene.prepareSourceDirectWildDestinationFace(scope:scope){XCTAssertTrue($0);ready.fulfill()}
    await test.fulfillment(of:[ready],timeout:5)
   }
  }
  func contact()throws->NativeMoveResult {
   let g=try XCTUnwrap(scene.boardGeometry)
   XCTAssertTrue(scene.beginDrag(at:g.center(row:0,column:0)));deliver(25)
   scene.moveDrag(to:g.center(row:0,column:1),now:0.025)
   return try XCTUnwrap(scene.finishDrag(at:g.center(row:0,column:1),now:0.025))
  }
  func deliver(_ wall:Double){clock.wall=wall;service.deliver(wallMilliseconds:wall)}
  func dispose(){scene.dispose();context.dispose();service.dispose();view.presentScene(nil);window.isHidden=true;window.rootViewController=nil}
 }
 func testActualRestoredJuiceShimmerIsRetiredBeforeDestinationFaceAndCannotResumeFromResidualWild()async throws {
  let f=try Fixture(.juice,final:false,restoredSource:true);defer{f.dispose()}
  let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
  let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
  window.windowScene=previous?.windowScene;window.rootViewController=host;window.makeKeyAndVisible()
  host.view.addSubview(f.view)
  defer{window.isHidden=true;window.rootViewController=nil;previous?.makeKeyAndVisible()}
  try await f.prepare(self)
  let entryDeadline=Date().addingTimeInterval(5)
  while !f.scene.isBoardEntryComplete && Date()<entryDeadline{try await Task.sleep(nanoseconds:20_000_000)}
  XCTAssertTrue(f.scene.isBoardEntryComplete)
  let dst=try XCTUnwrap(f.scene.sourceNativeTileNode("dst"))
  XCTAssertTrue(dst.sourceRestoredWildConstructorCurrent);XCTAssertFalse(dst.sourceRestoreWildFacePending)
  // Arm the already-proven restored face owner; complete non-Bee automatic
  // idle admission remains separate. This test owns actual consumption cleanup.
  dst.setSourceIdleDeferred(false)
  var shimmerDraws=0
  XCTAssertTrue(dst.beginSourceWildShimmer(service:f.service,random:{shimmerDraws+=1;return 0},current:{[weak scope=f.scope] in scope?.current==true}))
  let sprite=try XCTUnwrap(dst.sourceWildShimmerSprite),shader=try XCTUnwrap(sprite.shader)
  for wall in stride(from:66.0,through:4266.0,by:50){f.deliver(wall)}
  XCTAssertGreaterThan(try XCTUnwrap(shader.uniformNamed("u_opacity")).floatValue,0.1)
  XCTAssertEqual(shimmerDraws,2);XCTAssertEqual(dst.sourceWildShimmerRootCount,2)
  let drawsBeforeConsumption=shimmerDraws,before=f.scene.engine.state
  XCTAssertTrue(try f.contact().accepted)
  XCTAssertTrue(f.scene.sourceNativeTileNode("dst") === dst)
  XCTAssertEqual(dst.kind,"regular");XCTAssertTrue(dst.sourceWildStateCleared)
  XCTAssertNil(dst.sourceWildShimmerSprite);XCTAssertNil(sprite.parent);XCTAssertNil(sprite.shader)
  XCTAssertEqual(dst.sourceWildShimmerRootCount,0)
  XCTAssertEqual(try XCTUnwrap(f.initial).textures.sourceWildShimmerGradients.references,0)
  XCTAssertEqual(f.scene.engine.state.moves,before.moves);XCTAssertEqual(f.scene.engine.state.score,before.score)
  f.deliver(41);f.deliver(57)
  XCTAssertTrue(dst.sourceResidualWildPresence)
  XCTAssertTrue(try XCTUnwrap(f.scene.engine.state.tiles.first{$0.id=="dst"}).isWild)
  XCTAssertFalse(dst.beginSourceWildShimmer(service:f.service,random:{shimmerDraws+=1;return 0},current:{[weak scope=f.scope] in scope?.current==true}))
  for wall in stride(from:107.0,through:8107.0,by:50){f.deliver(wall)}
  XCTAssertEqual(shimmerDraws,drawsBeforeConsumption)
  XCTAssertNil(dst.sourceWildShimmerSprite);XCTAssertEqual(dst.sourceWildShimmerRootCount,0)
 }
 func testFourGenuineWildDestinationsKeepActualBackingThenFirstRAFWildPresenceWithNoMainAccounting()async throws {
  for kind in [NativeWildArchetype.star,.juice] {for final in [false,true] {
   let f=try Fixture(kind,final:final);defer{f.dispose()};try await f.prepare(self)
   let dst=try XCTUnwrap(f.scene.sourceNativeTileNode("dst")),oldTexture=try XCTUnwrap(dst.sourcePaintedNumbersTexture),before=f.scene.engine.state
   XCTAssertTrue(try f.contact().accepted);XCTAssertTrue(f.scene.sourceNativeTileNode("dst") === dst)
   XCTAssertTrue(dst.sourcePaintedNumbersTexture === oldTexture);XCTAssertTrue(dst.sourceWildStateCleared);XCTAssertFalse(dst.sourceResidualWildPresence)
   XCTAssertEqual(dst.depth,final ? 1:4);XCTAssertEqual(dst.sourceStackLayerNodes.count,final ? 0:3)
   for (index,node) in dst.sourceStackLayerNodes.enumerated() {
    let sprite=try XCTUnwrap(node.children.first as? SKSpriteNode)
    XCTAssertTrue(sprite.texture === oldTexture);XCTAssertEqual(sprite.frame.width,128*(1-CGFloat(index+1)*0.05),accuracy:2e-5)
   }
   XCTAssertFalse(dst.isHidden);XCTAssertEqual(dst.sourceFinalResultChildrenHidden,final)
   XCTAssertNotNil(f.scene.engine.pendingSourceWildDestinationFace);XCTAssertEqual(f.scene.engine.state.moves,before.moves)
   f.deliver(41)
   let actual=try XCTUnwrap(f.scene.engine.state.tiles.first{$0.id=="dst"})
   XCTAssertTrue(dst.sourceResidualWildPresence);XCTAssertTrue(actual.sourceResidualWildPresence);XCTAssertTrue(actual.isWild);XCTAssertNil(actual.gameplayArchetype);XCTAssertNil(actual.archetype)
   XCTAssertEqual(dst.depth,1);XCTAssertEqual(actual.stackDepth,1);XCTAssertTrue(dst.sourceStackLayerNodes.isEmpty);XCTAssertTrue(dst.sourcePipNodes.isEmpty)
   XCTAssertEqual(try XCTUnwrap(dst.sourcePaintedNumbersTexture).size().width,145,accuracy:0.001)
   XCTAssertEqual(f.scene.engine.state.moves,before.moves);XCTAssertEqual(f.scene.engine.state.score,before.score);XCTAssertEqual(f.scene.engine.state.rngState,before.rngState)
   f.deliver(57);XCTAssertEqual(dst.sourceWildDestinationFrameCount,0);XCTAssertTrue(dst.sourcePipNodes.isEmpty)
  }}
 }
 func testOriginalJuicePlanAndHUDAccountingStayJuiceAfterStarFaceAndActualMain()async throws {
  let f=try Fixture(.juice);defer{f.dispose()};try await f.prepare(self)
  XCTAssertTrue(try f.contact().accepted);let before=f.scene.engine.state
  f.deliver(41);XCTAssertEqual(f.scene.engine.pendingDirectWild?.archetype,.juice);XCTAssertTrue(f.scene.engine.completedSourceWildDestinationFace?.afterFace.isWild==true)
  f.deliver(57);f.deliver(104);f.deliver(105);f.deliver(109)
  XCTAssertEqual(f.scene.engine.state.moves,before.moves-1);XCTAssertNil(f.scene.engine.sourceDirectWildPrefix);XCTAssertNil(f.scene.engine.pendingSourceWildDestinationFace)
  XCTAssertEqual(f.scene.engine.sourceHUDStarJobs.count,1,"Juice actual main must retain its earned HUD job")
  XCTAssertEqual(f.context.contactMutations.revision,1,"Juice actual main must publish one physical contact mutation")
  XCTAssertTrue(f.failures.isEmpty,"Source failures="+f.failures.joined(separator:",")+" pendingHUD="+String(f.scene.engine.pendingHUDStars.count)+" HUDenabled="+String(f.scene.engine.sourceHUDStarJobsEnabled))
 }
 func testClearedWildSixRepairPreservesCurrentFaceButRejectsRetiredOwner()async throws {
  for kind in [NativeWildArchetype.star,.juice] {
   let f=try Fixture(kind,final:false);defer{f.dispose()};try await f.prepare(self)
   XCTAssertTrue(try f.contact().accepted)
   let dst=try XCTUnwrap(f.scene.sourceNativeTileNode("dst"))
   // The preceding ordinary spawn's sweep can run before the face RAF,
   // after it, or after nested RAF delivery; all share the same real owner.
   for wall in [25.0,41.0,57.0] {
    if wall>25 {f.deliver(wall)}
    let model=try XCTUnwrap(f.scene.engine.state.tiles.first{$0.id=="dst"})
    XCTAssertTrue(dst.sourceClearedWildSixPresentationCurrent(model:model))
    let texture=dst.sourcePaintedNumbersTexture,scale=dst.sourceLocalScale,alpha=dst.alpha
    XCTAssertTrue(dst.repairSourceClearedWildSixOpacity(model:model))
    XCTAssertTrue(dst.sourcePaintedNumbersTexture === texture)
    XCTAssertEqual(dst.sourceLocalScale,scale);XCTAssertEqual(dst.alpha,alpha)
   }
   dst.retireSourceWildDestinationFrames()
   XCTAssertFalse(dst.sourceClearedWildSixPresentationCurrent(model:try XCTUnwrap(f.scene.engine.state.tiles.first{$0.id=="dst"})))
   XCTAssertFalse(dst.repairSourceClearedWildSixOpacity(model:try XCTUnwrap(f.scene.engine.state.tiles.first{$0.id=="dst"})),"Residual flags alone cannot admit an ownerless face")
  }
 }
 func testForegroundGlobalPauseStillDeliversRawFaceAndNestedRAFButNeverMainArrival()async throws {
  let f=try Fixture(.star,final:false);defer{f.dispose()};try await f.prepare(self);XCTAssertTrue(try f.contact().accepted)
  let before=f.scene.engine.state
  f.scene.setSuspended(true);f.service.setSourceGlobalPaused(true);f.deliver(41);f.deliver(57)
  XCTAssertTrue(f.scene.engine.state.tiles.first{$0.id=="dst"}?.sourceResidualWildPresence==true)
  XCTAssertEqual(f.scene.engine.state.moves,before.moves);XCTAssertEqual(f.scene.engine.state.score,before.score);XCTAssertNotNil(f.scene.engine.pendingDirectWild)
  f.service.setSourceGlobalPaused(false);f.scene.setSuspended(false);f.deliver(480)
  XCTAssertEqual(f.scene.engine.state.moves,before.moves-1)
 }
 func testBackgroundNoRAFDoesNotFabricateFaceAndForegroundResumesSameCapturedNode()async throws {
  let f=try Fixture(.juice,final:false);defer{f.dispose()};try await f.prepare(self);let dst=try XCTUnwrap(f.scene.sourceNativeTileNode("dst"))
  XCTAssertTrue(try f.contact().accepted);let before=f.scene.engine.state
  f.service.setSourceForeground(false);f.deliver(41)
  XCTAssertFalse(dst.sourceResidualWildPresence);XCTAssertEqual(f.scene.engine.state,before)
  f.service.setSourceForeground(true);f.deliver(57)
  XCTAssertTrue(f.scene.sourceNativeTileNode("dst") === dst);XCTAssertTrue(dst.sourceResidualWildPresence)
 }
 func testRealDestructionBeforeFirstFaceRetiresQueuesPairAndDoesNotAwardOrRevive()async throws {
  let f=try Fixture(.star,final:false);defer{f.dispose()};try await f.prepare(self);let dst=try XCTUnwrap(f.scene.sourceNativeTileNode("dst"))
  XCTAssertTrue(try f.contact().accepted);let before=f.scene.engine.state
  f.scene.dispose();f.deliver(41);f.deliver(57);f.deliver(480)
  XCTAssertFalse(dst.sourceContactNodeAlive);XCTAssertFalse(dst.sourceResidualWildPresence);XCTAssertNil(f.scene.engine.pendingSourceWildDestinationFace)
  XCTAssertEqual(f.scene.engine.state.moves,before.moves);XCTAssertEqual(f.scene.engine.state.score,before.score);XCTAssertTrue(f.scene.engine.pendingHUDStars.isEmpty)
 }
 func testMissingSelectedUploadRefusesBeforeClaimLogicalRNGOrNodePrefix()async throws {
  let f=try Fixture(.star);defer{f.dispose()};try await f.prepare(self,face:false)
  let before=f.scene.engine.state,dst=try XCTUnwrap(f.scene.sourceNativeTileNode("dst")),draws=f.clock.draws
  XCTAssertFalse(try f.contact().accepted);XCTAssertEqual(f.scene.engine.state,before);XCTAssertNil(f.scene.engine.pendingDirectWild)
  XCTAssertFalse(dst.sourceWildStateCleared);XCTAssertEqual(f.context.contactMutations.revision,0)
  // Pointer pickup has Source motion randomness only when its actual graph owns it;
  // rejected contact creates no prefix stack/face draw or gameplay RNG mutation.
  XCTAssertEqual(f.clock.draws,draws)
 }
}
