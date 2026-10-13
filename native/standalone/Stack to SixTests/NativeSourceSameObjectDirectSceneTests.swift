import XCTest
import SpriteKit
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceSameObjectDirectSceneTests:XCTestCase {
 @MainActor private final class Clock {var wall=0.0;var draws=0;var date=1150.0;func next()->Double{draws+=1;return 0.5}}
 @MainActor private final class Fixture {
  let clock:Clock,service:NativeSourceAnimationClockService,context:NativeGameplaySourceContext,scope:NativeGameplaySourceContext.Scope,scene:NativeBoardScene,view:SKView
  var failures:[String]=[]
  init(final:Bool=true,magnetNoPull:Bool=false)throws {
   let c=Clock();clock=c
   service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{c.wall},sourceFrameTransportEnabled:true)
   context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{c.next()},sourceDateMilliseconds:{c.date})
   var tiles:[NativeTile]=[.init(id:"wild",cell:.init(column:0,row:0),value:6,starOrbitCount:1,archetype:magnetNoPull ? .magnet:.star),.init(id:"regular",cell:.init(column:1,row:0),value:4)]
   if !final {tiles.append(.init(id:"other",cell:.init(column:4,row:8),value:3,merge6CleanupOwned:magnetNoPull))}
   if magnetNoPull {tiles.append(.init(id:"locked",cell:.init(column:3,row:0),value:0,locked:true))}
   let e=NativeGameplayEngine(state:.init(tiles:tiles),sourceMathRandom:context.mathRandom)
   e.stagedOrdinaryMoves=true;e.stagedOrdinaryAssignments=true;e.stagedDirectWildMoves=true;e.stagedDirectWildAssignments=true
   scene=NativeBoardScene(engine:e,resourceRoot:NativeTestResources.root,size:.init(width:390,height:844))
   let captured=scene
   scope=try XCTUnwrap(context.beginScene(engine:e,retire:{[weak captured] in captured?.retireSourceAnimationBindings()}))
   scene.sourceOuterTimelineDriver=scope.timeline;scene.sourceDragTweenDriver=scope.tween
   scene.sourceSameNodeStackAbsorbsEnabled=true;scene.sourceOrdinarySixSameNodeEnabled=true;scene.sourceDirectWildSameNodeEnabled=true
   scene.sourceContactVisualRandom={c.next()};scene.configureSourceRegularStackHandoff(service:service,admitted:{true})
   scene.layout(size:scene.size,insets:.init(top:47,left:0,bottom:34,right:0))
   view=SKView(frame:.init(x:0,y:0,width:390,height:844));view.presentScene(scene)
   scene.onSourcePresentationFailure={[weak self] reason,_ in self?.failures.append(reason)}
   scene.onPresentationFailure={[weak self] reason in self?.failures.append(reason)}
   let dst=try XCTUnwrap(scene.sourceNativeTileNode("regular"))
   XCTAssertTrue(dst.queueSourceStackValue(4,addStack:0,service:service,random:{c.next()},current:{true}))
   c.wall=16;service.deliver(wallMilliseconds:16)
   XCTAssertTrue(scene.configureSourceSpecialTransactions(scope:scope))
   XCTAssertTrue(scene.configureSourceSpecialIdle(scope:scope))
   XCTAssertTrue(scene.configureSourceOrdinarySixMain(scope:scope,acquireIdle:{[weak scene] reason in scene?.acquireSourceSpecialIdle(reason:reason)}))
  }
  func readyHUD(_ test:XCTestCase)async throws {
   let loaded=test.expectation(description:"Actual Source HUD selected texture upload")
   var prepared:NativeSourceHUDStarTexturePreparation.Prepared?
   scope.hudStarTextures.prepare(root:NativeTestResources.root,current:{[scope] in scope.current}){prepared=$0;loaded.fulfill()}
   await test.fulfillment(of:[loaded],timeout:5)
   let receipt=try XCTUnwrap(prepared)
   scene.sourceHUDStarJobsPresentationEnabled=true
   XCTAssertTrue(scene.configureSourceHUDStarJobs(scope:scope,prepared:receipt,capture:{[weak scene] _ in
    guard let target=scene?.sourceHUDStarTargetScreen else{return nil}
    // Genuine Direct call must override this other-call origin with captured
    // actual physical destination while keeping actual HUD target supplier.
    return .init(screenOrigin:.zero,hudTarget:target)
   }))
   XCTAssertTrue(scene.configureSourceDirectWildMain(scope:scope))
  }
  func contact()throws->NativeMoveResult {
   let geometry=try XCTUnwrap(scene.boardGeometry)
   XCTAssertTrue(scene.beginDrag(at:geometry.center(row:0,column:0)));deliver(25)
   scene.moveDrag(to:geometry.center(row:0,column:1),now:0.025)
   return try XCTUnwrap(scene.finishDrag(at:geometry.center(row:0,column:1),now:0.025))
  }
  func deliver(_ wall:Double){clock.wall=wall;service.deliver(wallMilliseconds:wall)}
  func dispose(){scene.dispose();context.dispose();service.dispose();view.presentScene(nil)}
 }
 func testActualSourceNoPullMagnetMountsDirectAwaitedPrimary()async throws {
  let f=try Fixture(final:false,magnetNoPull:true);defer{f.dispose()};try await f.readyHUD(self)
  let original=try XCTUnwrap(f.scene.sourceNativeTileNode("regular"))
  XCTAssertTrue(try f.contact().accepted)
  let plan=try XCTUnwrap(f.scene.engine.pendingDirectWild)
  XCTAssertEqual(plan.archetype,.magnet);XCTAssertFalse(plan.isFinal)
  XCTAssertNil(f.scene.engine.pendingSpecial)
  f.deliver(104);f.deliver(105);f.deliver(109)
  XCTAssertTrue(f.scene.engine.directWildGameplayCommitted)
  XCTAssertFalse(f.scene.engine.pendingWildSpawnArrivals.isEmpty,"actual primary bounce is awaited rather than eager no-pull refill")
  XCTAssertEqual(f.scene.engine.state.moves,49)
  XCTAssertTrue(f.scene.sourceNativeTileNode("regular") === original || original.parent==nil)
  XCTAssertTrue(f.failures.isEmpty,f.failures.joined(separator:", "))
 }
 func testActualDirectPairPrefixAndMainCommitUseSameObjectAndGenuineHUDJob()async throws {
  let f=try Fixture();defer{f.dispose()};try await f.readyHUD(self)
  let src=try XCTUnwrap(f.scene.sourceNativeTileNode("wild")),dst=try XCTUnwrap(f.scene.sourceNativeTileNode("regular")),before=f.scene.engine.state
  XCTAssertTrue(try f.contact().accepted);XCTAssertEqual(f.scene.sourceSameObjectSixCount,1)
  XCTAssertNotNil(dst.sourceMergeSixCleanupToken);XCTAssertTrue(f.scope.mergeSixDestinationCleanup.hasClaim(dst));XCTAssertEqual(f.scene.sourceMergeSixDestinationHasCleanupClaim(id:"regular"),true,"Special final carrier remains cleanup-owned")
  XCTAssertFalse(dst.sourceNonFinalMergeSix);XCTAssertNil(dst.sourceNonFinalMergeSixAt)
  XCTAssertTrue(dst.sourceMergeSixLastMerge);XCTAssertTrue(dst.sourceMergeSixFinalAllowedByResolver)
  XCTAssertEqual(f.context.nonFinalMergeSixGuardUntil,0)
  XCTAssertTrue(f.scene.sourceNativeTileNode("wild") === src);XCTAssertTrue(f.scene.sourceNativeTileNode("regular") === dst)
  XCTAssertEqual(f.scene.engine.sourceDirectWildPrefix?.preparedDestination.value,6);XCTAssertTrue(dst.sourceWildStateCleared);XCTAssertFalse(dst.isHidden);XCTAssertTrue(dst.visual.isHidden)
  XCTAssertTrue(f.scope.specialIdle.snapshot.suspended);XCTAssertEqual(f.scene.engine.state.moves,before.moves)
  f.deliver(104);f.deliver(105);XCTAssertEqual(f.scene.engine.state.moves,before.moves)
  f.deliver(109);XCTAssertEqual(f.scene.engine.state.moves,before.moves-1);XCTAssertNil(f.scene.engine.sourceDirectWildPrefix)
  XCTAssertEqual(f.scene.engine.sourceHUDStarJobs.count,1);XCTAssertEqual(f.scene.engine.pendingHUDStars.count,1);XCTAssertEqual(f.context.contactMutations.revision,1)
 }
 func testActualNonFinalDirectPrefixOwnsDistinctTileMarkerAndAppWallGuard()async throws {
  let f=try Fixture(final:false);defer{f.dispose()};try await f.readyHUD(self)
  let dst=try XCTUnwrap(f.scene.sourceNativeTileNode("regular"))
  XCTAssertTrue(try f.contact().accepted)
  XCTAssertTrue(dst.sourceNonFinalMergeSix);XCTAssertEqual(dst.sourceNonFinalMergeSixAt,1150)
  XCTAssertFalse(dst.sourceMergeSixLastMerge);XCTAssertFalse(dst.sourceMergeSixFinalAllowedByResolver)
  XCTAssertEqual(f.context.nonFinalMergeSixGuardUntil,3650)
  XCTAssertEqual(f.scene.captureSourceNonFinalMergeSixGuardActive(),true)
  f.clock.date=3650;XCTAssertEqual(f.scene.captureSourceNonFinalMergeSixGuardActive(),false)
  XCTAssertTrue(dst.sourceNonFinalMergeSix)
 }
 func testTruePreMainDisposeConsumesCapturedPrefixWithoutScoreRNGOrHUDReward()async throws {
  let f=try Fixture();defer{f.dispose()};try await f.readyHUD(self);XCTAssertTrue(try f.contact().accepted)
  let before=f.scene.engine.state
  f.scene.dispose();XCTAssertNil(f.scene.engine.pendingDirectWild);XCTAssertNil(f.scene.engine.sourceDirectWildPrefix);XCTAssertTrue(f.scene.engine.state.tiles.isEmpty)
  XCTAssertEqual(f.scene.engine.state.moves,before.moves);XCTAssertEqual(f.scene.engine.state.score,before.score);XCTAssertEqual(f.scene.engine.state.rngState,before.rngState);XCTAssertTrue(f.scene.engine.pendingHUDStars.isEmpty)
  f.deliver(600);XCTAssertEqual(f.scene.engine.state.moves,before.moves);XCTAssertFalse(f.scope.specialIdle.snapshot.suspended)
 }
 func testForegroundGlobalPauseKeepsRealMainAndIdleGuardUntilResume()async throws {
  let f=try Fixture();defer{f.dispose()};try await f.readyHUD(self);XCTAssertTrue(try f.contact().accepted);let before=f.scene.engine.state
  f.scene.setSuspended(true);f.service.setSourceGlobalPaused(true);f.deliver(400)
  XCTAssertEqual(f.scene.engine.state,before);XCTAssertNotNil(f.scene.engine.sourceDirectWildPrefix);XCTAssertTrue(f.scope.specialIdle.snapshot.suspended)
  f.service.setSourceGlobalPaused(false);f.scene.setSuspended(false);f.deliver(480)
  XCTAssertEqual(f.scene.engine.state.moves,before.moves-1);XCTAssertNil(f.scene.engine.sourceDirectWildPrefix);XCTAssertEqual(f.scene.engine.sourceHUDStarJobs.count,1)
 }
 func testMissingActualHUDAdmissionRefusesBeforeCoreClaimRNGOrAutoRoot()throws {
  let f=try Fixture();defer{f.dispose()};let before=f.scene.engine.state
  XCTAssertFalse(f.scene.configureSourceDirectWildMain(scope:f.scope) && f.scene.sourceHUDStarJobsAdmissionOpen)
  let draws=f.clock.draws;XCTAssertFalse(try f.contact().accepted)
  XCTAssertEqual(f.scene.engine.state,before);XCTAssertNil(f.scene.engine.pendingDirectWild);XCTAssertNil(f.scene.engine.sourceDirectWildPrefix);XCTAssertEqual(f.clock.draws,draws);XCTAssertEqual(f.context.contactMutations.revision,0)
 }
}
