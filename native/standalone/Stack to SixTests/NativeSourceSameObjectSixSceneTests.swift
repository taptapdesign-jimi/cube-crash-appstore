import XCTest
import SpriteKit
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceSameObjectSixSceneTests:XCTestCase {
 @MainActor private final class Counter {var draws=0,acquired=0,released=0,dateCalls=0;var date=1000.0;func next()->Double{draws+=1;return 0.5}}
 @MainActor private final class Fixture {
  let fifo:NativeSourceMicrotaskFIFO?
  let service:NativeSourceAnimationClockService,context:NativeGameplaySourceContext,scope:NativeGameplaySourceContext.Scope,scene:NativeBoardScene,view:SKView,counter:Counter
  init(enabled:Bool=true,final:Bool=true,lockedSettlement:Bool=false)throws {
   let c=Counter();counter=c
   fifo=lockedSettlement ? NativeSourceMicrotaskFIFO():nil
   let tasks=fifo.map{NativeSourceMicrotaskAdapters(fifo:$0)}
   service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
   service.sourceMicrotaskTasks=tasks
   context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{c.next()},sourceDateMilliseconds:{c.dateCalls+=1;return c.date},sourceMicrotaskTasks:tasks)
   var tiles:[NativeTile]=[.init(id:"a",cell:.init(column:0,row:0),value:2),.init(id:"b",cell:.init(column:1,row:0),value:4)]+(final ? []:[.init(id:"other",cell:.init(column:4,row:8),value:3)])
   if lockedSettlement {tiles.append(.init(id:"locked",cell:.init(column:3,row:0),value:0,locked:true))}
   scene=NativeBoardScene(engine:NativeGameplayEngine(state:.init(columns:5,rows:9,tiles:tiles)),resourceRoot:Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle"),size:.init(width:390,height:844))
   let scene=scene
   scope=try XCTUnwrap(context.beginScene(engine:scene.engine,retire:{[weak scene] in scene?.retireSourceAnimationBindings()}))
   scene.sourceOuterTimelineDriver=scope.timeline;scene.sourceDragTweenDriver=scope.tween
   scene.sourceSameNodeStackAbsorbsEnabled=true;scene.sourceOrdinarySixSameNodeEnabled=enabled
   scene.sourceContactVisualRandom={c.next()};scene.sourceStackAbsorbAdmission={_,_ in true}
   scene.configureSourceRegularStackHandoff(service:service,admitted:{true})
   scene.layout(size:scene.size,insets:.init(top:47,left:0,bottom:34,right:0))
   view=SKView(frame:.init(x:0,y:0,width:390,height:844));view.presentScene(scene)
   let target=try XCTUnwrap(scene.sourceNativeTileNode("b"))
   XCTAssertTrue(target.queueSourceStackValue(4,addStack:0,service:service,random:{c.next()},current:{true}))
   service.deliver(wallMilliseconds:16)
   if enabled {XCTAssertTrue(scene.configureSourceOrdinarySixMain(scope:scope,acquireIdle:{reason in
    XCTAssertEqual(reason,"merge6-resolution");c.acquired+=1;var released=false
    return {guard !released else{return};released=true;c.released+=1}
   }))}
   if let fifo {XCTAssertTrue(scene.configureSourceMicrotaskBoundaries(scope:scope,fifo:fifo));XCTAssertTrue(scene.configureSourceOrdinaryLockedSettlements(scope:scope))}
  }
  func point(_ column:Int)throws->CGPoint{try XCTUnwrap(scene.boardGeometry).center(row:0,column:column)}
  func contact()throws->NativeMoveResult {
   XCTAssertTrue(scene.beginDrag(at:try point(0)));service.deliver(wallMilliseconds:25)
   scene.moveDrag(to:try point(1),now:0.025)
   return try XCTUnwrap(scene.finishDrag(at:try point(1),now:0.025))
  }
  func dispose(){scene.dispose();context.dispose();service.dispose();fifo?.dispose()}
 }
 func testActualSameSourceAndDestinationRetainedAndIdleAcquiredBeforeCueUntilMainCallback()throws {
  let f=try Fixture();defer{f.dispose()};let src=try XCTUnwrap(f.scene.sourceNativeTileNode("a")),dst=try XCTUnwrap(f.scene.sourceNativeTileNode("b")),before=f.scene.engine.state
  var cueDraws:Int?
  f.scene.onGameplayReceipt={event,_,_,_ in if event.kind == .ordinarySixReserved {XCTAssertEqual(f.counter.acquired,1);cueDraws=f.counter.draws}}
  XCTAssertTrue(try f.contact().accepted);XCTAssertNotNil(cueDraws)
  XCTAssertNil(dst.sourceMergeSixCleanupToken);XCTAssertEqual(f.scene.sourceMergeSixDestinationHasCleanupClaim(id:"b"),false,"final ordinary destination has no cleanup claim")
  XCTAssertEqual(f.counter.draws-(try XCTUnwrap(cueDraws)),1) // final Source depth1: hero draw; delayed skin not yet.
  XCTAssertEqual(f.scene.engine.state.score,before.score);XCTAssertEqual(f.scene.engine.state.moves,before.moves)
  XCTAssertEqual(f.scene.sourceSameObjectSixCount,1);XCTAssertTrue(f.scene.sourceNativeTileNode("a") === src);XCTAssertTrue(f.scene.sourceNativeTileNode("b") === dst)
  XCTAssertEqual(dst.value,6);XCTAssertFalse(dst.isHidden);XCTAssertTrue(dst.sourceFinalResultChildrenHidden);XCTAssertEqual(f.scene.engine.state.tiles.first{$0.id=="b"}?.visible,true);let painted=src.position
  f.scene.synchronize();XCTAssertEqual(src.position,painted);XCTAssertTrue(f.scene.sourceNativeTileNode("a") === src)
  f.service.deliver(wallMilliseconds:104);XCTAssertEqual(f.scene.engine.state.moves,before.moves)
  f.service.deliver(wallMilliseconds:105);XCTAssertEqual(f.scene.engine.state.moves,before.moves);XCTAssertNotNil(f.scene.engine.pendingOrdinarySix)
  // Original GSAP240Hz gate:104 dispatched,105 is APP RAF only;109 is the next genuine ticker dispatch.
  f.service.deliver(wallMilliseconds:109);XCTAssertEqual(f.scene.engine.state.moves,before.moves-1);XCTAssertNil(f.scene.engine.pendingOrdinarySix)
  XCTAssertEqual(f.scene.sourceSameObjectSixCount,0);XCTAssertEqual(f.counter.released,1);XCTAssertGreaterThan(f.scope.sixResources.activeShards,0)
 }
 func testFinalChildrenRemainHiddenAcrossActualFaceRAFAndReentrantSynchronization()throws {
  let f=try Fixture();defer{f.dispose()};XCTAssertTrue(try f.contact().accepted)
  let dst=try XCTUnwrap(f.scene.sourceNativeTileNode("b")),plan=try XCTUnwrap(f.scene.engine.pendingOrdinarySix)
  XCTAssertFalse(dst.isHidden);XCTAssertTrue(dst.sourceFinalResultChildrenHidden)
  f.service.deliver(wallMilliseconds:32);f.scene.synchronize()
  XCTAssertTrue(f.scene.sourceNativeTileNode("b") === dst);XCTAssertFalse(dst.isHidden);XCTAssertTrue(dst.sourceFinalResultChildrenHidden)
  XCTAssertEqual(f.scene.engine.state.tiles.first{$0.id=="b"}?.visible,plan.destination.visible)
  XCTAssertEqual(dst.alpha,1);XCTAssertEqual(f.scene.engine.state.moves,50)
 }
 func testForegroundGlobalPauseAllowsFaceRAFButNeverManufacturesMainArrival()throws {
  let f=try Fixture(final:false);defer{f.dispose()};XCTAssertTrue(try f.contact().accepted);let before=f.scene.engine.state,dst=try XCTUnwrap(f.scene.sourceNativeTileNode("b"))
  let cleanup=try XCTUnwrap(dst.sourceMergeSixCleanupToken);XCTAssertTrue(f.scope.mergeSixDestinationCleanup.owns(dst,token:cleanup));XCTAssertEqual(f.scene.sourceMergeSixDestinationHasCleanupClaim(id:"b"),true)
  XCTAssertTrue(dst.sourceNonFinalMergeSix);XCTAssertEqual(dst.sourceNonFinalMergeSixAt,1000)
  XCTAssertEqual(f.counter.dateCalls,2,"Actual non-final prefix has distinct tile and global Date writers")
  XCTAssertEqual(f.context.nonFinalMergeSixGuardUntil,3500)
  XCTAssertEqual(f.scope.captureNonFinalMergeSixGuardActive(),true)
  f.counter.date=3500;XCTAssertEqual(f.scope.captureNonFinalMergeSixGuardActive(),false)
  XCTAssertTrue(dst.sourceNonFinalMergeSix,"Tile marker is distinct from the expiring app guard")
  f.scene.setSuspended(true);f.service.setSourceGlobalPaused(true);f.service.deliver(wallMilliseconds:400)
  XCTAssertEqual(dst.value,6);XCTAssertEqual(f.scene.engine.state,before);XCTAssertEqual(f.counter.released,0);XCTAssertNotNil(f.scene.engine.pendingOrdinarySix)
  XCTAssertTrue(f.scope.mergeSixDestinationCleanup.owns(dst,token:cleanup),"global pause cannot release destination claim")
  f.service.setSourceGlobalPaused(false);f.scene.setSuspended(false);f.service.deliver(wallMilliseconds:480)
  XCTAssertEqual(f.scene.engine.state.moves,before.moves-1);XCTAssertEqual(f.scene.sourceSameObjectSixCount,0)
 }
 func testDestructiveDisposeBeforeActualMainRemovesOnlyCapturedPairAndKeepsAccounting()throws {
  let f=try Fixture(final:false);defer{f.dispose()};XCTAssertTrue(try f.contact().accepted);let before=f.scene.engine.state
  f.scene.dispose();XCTAssertNil(f.scene.engine.pendingOrdinarySix);XCTAssertEqual(f.scene.engine.state.tiles.map(\.id),["other"])
  XCTAssertEqual(f.scene.engine.state.score,before.score);XCTAssertEqual(f.scene.engine.state.moves,before.moves);XCTAssertEqual(f.scene.engine.state.rngState,before.rngState);XCTAssertEqual(f.counter.released,1)
  f.service.deliver(wallMilliseconds:600);XCTAssertEqual(f.scene.engine.state.moves,before.moves)
 }
 func testActualCueReentrantDisposeBeforeMainInstallCannotLeaveCoreOrReviveOwners()throws {
  let f=try Fixture(final:false);defer{f.dispose()};let before=f.scene.engine.state
  f.scene.onGameplayReceipt={event,_,_,_ in if event.kind == .ordinarySixReserved {f.scene.dispose()}}
  XCTAssertTrue(try f.contact().accepted);XCTAssertNil(f.scene.engine.pendingOrdinarySix);XCTAssertEqual(f.scene.engine.state.moves,before.moves);XCTAssertEqual(f.scene.engine.state.score,before.score)
  XCTAssertEqual(f.scene.sourceSameObjectSixCount,0);XCTAssertEqual(f.counter.released,1);XCTAssertEqual(f.service.activeParticipantCount,0)
 }
 func testDefaultOffStillRefusesUnadmittedSixWithoutAutoRootsOrDraws()throws {
  let f=try Fixture(enabled:false);defer{f.dispose()};let before=f.scene.engine.state,draws=f.counter.draws
  XCTAssertFalse(try f.contact().accepted);XCTAssertEqual(f.scene.engine.state,before);XCTAssertEqual(f.counter.draws,draws);XCTAssertNil(f.scene.engine.sourceMergeSixAutoCenterHook);XCTAssertEqual(f.counter.acquired,0)
 }
 func testActualPhysicalDestinationLossSettlesCapturedCoreWithoutClockArrival()throws {
  let f=try Fixture(final:false);defer{f.dispose()};XCTAssertTrue(try f.contact().accepted);let before=f.scene.engine.state
  let dst=try XCTUnwrap(f.scene.sourceNativeTileNode("b"));dst.removeFromParent();f.scene.synchronize()
  XCTAssertNil(f.scene.engine.pendingOrdinarySix);XCTAssertEqual(f.scene.engine.state.tiles.map(\.id),["other"])
  XCTAssertEqual(f.scene.engine.state.score,before.score);XCTAssertEqual(f.scene.engine.state.moves,before.moves);XCTAssertEqual(f.counter.released,1)
  f.service.deliver(wallMilliseconds:105);XCTAssertEqual(f.scene.engine.state.moves,before.moves)
 }

 func testRealWallWatchdogRetainsSourceUntilGenuineResumedMainCallback()async throws {
  let f=try Fixture(final:false);defer{f.dispose()}
  XCTAssertTrue(try f.contact().accepted)
  let src=try XCTUnwrap(f.scene.sourceNativeTileNode("a")),dst=try XCTUnwrap(f.scene.sourceNativeTileNode("b")),before=f.scene.engine.state
  f.service.setSourceGlobalPaused(true);f.scene.setSuspended(true)
  f.service.deliver(wallMilliseconds:400)
  let pose=src.position
  try await Task.sleep(for:.milliseconds(1350))
  XCTAssertNil(f.scene.sourceNativeTileNode("b"));XCTAssertFalse(dst.sourceContactNodeAlive)
  XCTAssertTrue(f.scene.sourceNativeTileNode("a") === src);XCTAssertTrue(src.sourceContactNodeAlive);XCTAssertEqual(src.position,pose)
  XCTAssertEqual(f.scene.engine.state.tiles.map(\.id),["a","other"])
  XCTAssertNotNil(f.scene.engine.pendingOrdinarySix);XCTAssertTrue(f.scene.engine.hasUnsavableSourceGameplayState)
  XCTAssertEqual(f.scene.engine.state.score,before.score);XCTAssertEqual(f.scene.engine.state.moves,before.moves);XCTAssertEqual(f.scene.engine.state.rngState,before.rngState)
  XCTAssertEqual(f.counter.released,0)
  f.scene.synchronize();XCTAssertTrue(f.scene.sourceNativeTileNode("a") === src)
  f.service.setSourceGlobalPaused(false);f.scene.setSuspended(false);f.service.deliver(wallMilliseconds:480)
  XCTAssertNil(f.scene.sourceNativeTileNode("a"));XCTAssertNil(f.scene.engine.pendingOrdinarySix)
  XCTAssertEqual(f.scene.engine.state.tiles.map(\.id),["other"]);XCTAssertEqual(f.scene.engine.state.moves,before.moves);XCTAssertEqual(f.scene.engine.state.score,before.score)
  XCTAssertEqual(f.counter.released,1);XCTAssertEqual(f.scene.sourceSameObjectSixCount,0)
 }

 func testRealWallWatchdogFinalAndReplacementClaimCannotRemoveCurrentNodes()async throws {
  for mode in ["final","replacement","last-merge","resolver-final"] {
   let f=try Fixture(final:mode == "final");defer{f.dispose()}
   XCTAssertTrue(try f.contact().accepted)
   let src=try XCTUnwrap(f.scene.sourceNativeTileNode("a")),dst=try XCTUnwrap(f.scene.sourceNativeTileNode("b")),before=f.scene.engine.state
   f.service.setSourceGlobalPaused(true);f.scene.setSuspended(true);f.service.deliver(wallMilliseconds:400)
   var replacement:UInt64?
   if mode == "replacement" {replacement=f.scope.mergeSixDestinationCleanup.claim(dst)}
   if mode == "last-merge" {dst.sourceMergeSixLastMerge=true}
   if mode == "resolver-final" {dst.sourceMergeSixFinalAllowedByResolver=true}
   try await Task.sleep(for:.milliseconds(1350))
   XCTAssertEqual(f.scene.engine.state,before,mode);XCTAssertTrue(f.scene.sourceNativeTileNode("a") === src,mode);XCTAssertTrue(f.scene.sourceNativeTileNode("b") === dst,mode)
   XCTAssertEqual(f.counter.released,0,mode);XCTAssertNotNil(f.scene.engine.pendingOrdinarySix,mode)
   if let replacement {XCTAssertTrue(f.scope.mergeSixDestinationCleanup.owns(dst,token:replacement))}
   else {XCTAssertNil(dst.sourceMergeSixCleanupToken,mode)}
  }
 }
 func testDisposeBeforeAndAfterActualWallWatchdogCannotRetainOrReviveSource()async throws {
  for after in [false,true] {
   let f=try Fixture(final:false);defer{f.dispose()};XCTAssertTrue(try f.contact().accepted)
   let src=try XCTUnwrap(f.scene.sourceNativeTileNode("a")),before=f.scene.engine.state
   f.service.setSourceGlobalPaused(true);f.scene.setSuspended(true);f.service.deliver(wallMilliseconds:400)
   if after {try await Task.sleep(for:.milliseconds(1350));XCTAssertNil(f.scene.sourceNativeTileNode("b"));XCTAssertTrue(src.sourceContactNodeAlive)}
   f.scene.dispose()
   XCTAssertFalse(src.sourceContactNodeAlive);XCTAssertNil(f.scene.engine.pendingOrdinarySix);XCTAssertEqual(f.scene.engine.state.tiles.map(\.id),["other"])
   XCTAssertEqual(f.counter.released,1);XCTAssertEqual(f.scene.engine.state.moves,before.moves);XCTAssertEqual(f.scene.engine.state.score,before.score);XCTAssertEqual(f.scene.engine.state.rngState,before.rngState)
   if !after {try await Task.sleep(for:.milliseconds(1350))}
   f.service.setSourceGlobalPaused(false);f.service.deliver(wallMilliseconds:480)
   XCTAssertEqual(f.scene.engine.state.tiles.map(\.id),["other"]);XCTAssertEqual(f.counter.released,1);XCTAssertNil(f.scene.engine.pendingOrdinarySix)
  }
 }

 func testActualLockedSpawnPromiseFIFOResumesRemainderAfterUnlock()async throws {
  let f=try Fixture(final:false,lockedSettlement:true);defer{f.dispose()}
  let fifo=try XCTUnwrap(f.fifo)
  let probes=try XCTUnwrap(fifo.makeMeterScope(boundProducers:Set(NativeSourceMicrotaskFIFO.Boundary.allCases),isCurrent:{f.scope.current}));defer{probes.dispose()}
  let completed=expectation(description:"actual wall unlock queues and completes exact Source Promise continuation")
  var trace:[String]=[],observed=false
  f.scene.onSourcePresentationFailure={reason,_ in XCTFail(reason)}
  f.scene.onGameplayEvent={event in
   if event.kind == .sourceOrdinaryLockedSettlementPrepared {
    observed=true;trace.append("unlock")
    XCTAssertFalse(try! XCTUnwrap(f.scene.engine.state.tiles.first{$0.id=="locked"}).locked)
    XCTAssertNotNil(f.scene.engine.pendingSourceOrdinaryLockedSettlement)
    XCTAssertTrue(f.scene.engine.pendingOrdinaryAssignments.isEmpty)
    XCTAssertTrue(probes.enqueue{trace.append("prior-reaction");XCTAssertNotNil(f.scene.engine.pendingSourceOrdinaryLockedSettlement)})
   }
   if observed,event.kind == .ordinaryAssignmentsPrepared {
    XCTAssertTrue(fifo.isInsideCheckpoint);XCTAssertNil(f.scene.engine.pendingSourceOrdinaryLockedSettlement)
    XCTAssertEqual(f.scene.engine.pendingOrdinaryAssignments.first?.kind,.remainderPrimary)
    trace.append("remainder");completed.fulfill();observed=false
   }
  }
  XCTAssertTrue(try f.contact().accepted);f.service.deliver(wallMilliseconds:109)
  await fulfillment(of:[completed],timeout:4)
  XCTAssertEqual(trace,["unlock","prior-reaction","remainder"])
  XCTAssertNil(f.scene.engine.pendingSourceOrdinaryLockedSettlement)
  let plan=try XCTUnwrap(f.scene.engine.pendingOrdinarySix)
  XCTAssertNil(f.scene.captureSourceOrdinaryMinimumActiveCount(ownerID:plan.id,generation:plan.generation),"fixture has no admitted physical lifecycle authority; do not fabricate count or rescue")
 }

 func testQueuedLockedHelperReceiptCannotTouchRestartedSameIDBoard()async throws {
  let f=try Fixture(final:false,lockedSettlement:true);defer{f.dispose()}
  let fifo=try XCTUnwrap(f.fifo),restarted=expectation(description:"earlier Source reaction restarts actual board before helper continuation")
  let probes=try XCTUnwrap(fifo.makeMeterScope(boundProducers:Set(NativeSourceMicrotaskFIFO.Boundary.allCases),isCurrent:{f.scope.current}));defer{probes.dispose()}
  var receipt:NativeGameplayEngine.SourceOrdinaryLockedSettlement?,snapshot:NativeBoardState?
  f.scene.onGameplayEvent={event in
   if event.kind == .sourceOrdinaryLockedSettlementPrepared {
    receipt=f.scene.engine.pendingSourceOrdinaryLockedSettlement
    XCTAssertTrue(probes.enqueue{
     f.scene.engine.restart(state:.init(columns:5,rows:9,tiles:[.init(id:"b",cell:.init(column:1,row:0),value:3)],score:777))
     snapshot=f.scene.engine.state;f.scene.synchronize();restarted.fulfill()
    })
   }
  }
  XCTAssertTrue(try f.contact().accepted);f.service.deliver(wallMilliseconds:109)
  await fulfillment(of:[restarted],timeout:4)
  try await Task.sleep(for:.milliseconds(150))
  let current=try XCTUnwrap(snapshot),old=try XCTUnwrap(receipt)
  XCTAssertEqual(f.scene.engine.state,current);XCTAssertEqual(f.scene.sourceNativeTileNode("b")?.value,3)
  XCTAssertNil(f.scene.engine.pendingSourceOrdinaryLockedSettlement);XCTAssertNil(f.scene.engine.pendingOrdinarySix)
  XCTAssertFalse(f.scene.engine.continueSourceOrdinaryLockedSettlement(old).accepted);XCTAssertEqual(f.scene.engine.state,current)
 }

}
