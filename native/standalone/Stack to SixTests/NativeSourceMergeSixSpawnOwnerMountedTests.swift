import XCTest
import SpriteKit
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceMergeSixSpawnOwnerMountedTests:XCTestCase {
 @MainActor private final class Counter {var now:Double=1000,dateCalls=0,acquired=0,released=0,companionTrace:[String]=[]}
 @MainActor private final class Fixture {
  let counter=Counter(),service:NativeSourceAnimationClockService,context:NativeGameplaySourceContext,scope:NativeGameplaySourceContext.Scope,scene:NativeBoardScene,view:SKView
  let fifo=NativeSourceMicrotaskFIFO()
  init(enabled:Bool=true,final:Bool=false,depleted:Bool=false)throws {
   let c=counter
   service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
   let tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
   if depleted {service.sourceMicrotaskTasks=tasks}
   context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{0.5},sourceDateMilliseconds:{c.dateCalls+=1;return c.now},sourceMicrotaskTasks:depleted ? tasks:nil)
   let tiles:[NativeTile]=[.init(id:"a",cell:.init(column:0,row:0),value:2,stackDepth:depleted ? 2:1),.init(id:"b",cell:.init(column:1,row:0),value:4)]+(final ? []:[.init(id:"other",cell:.init(column:4,row:8),value:3)])
   scene=NativeBoardScene(engine:NativeGameplayEngine(state:.init(columns:5,rows:9,tiles:tiles,moves:depleted ? 1:50)),resourceRoot:NativeTestResources.root,size:.init(width:390,height:844))
   let captured=scene;scope=try XCTUnwrap(context.beginScene(engine:scene.engine,retire:{[weak captured] in captured?.retireSourceAnimationBindings()}))
   scene.sourceOuterTimelineDriver=scope.timeline;scene.sourceDragTweenDriver=scope.tween
   scene.sourceSameNodeStackAbsorbsEnabled=true;scene.sourceOrdinarySixSameNodeEnabled=true
   scene.sourceContactVisualRandom={0.5};scene.sourceStackAbsorbAdmission={_,_ in true}
   scene.configureSourceRegularStackHandoff(service:service,admitted:{true})
   scene.layout(size:scene.size,insets:.init(top:47,left:0,bottom:34,right:0),animateEntry:false)
   view=SKView(frame:.init(x:0,y:0,width:390,height:844));view.presentScene(scene)
   let target=try XCTUnwrap(scene.sourceNativeTileNode("b"));XCTAssertTrue(target.queueSourceStackValue(4,addStack:0,service:service,random:{0.5},current:{true}));service.deliver(wallMilliseconds:16)
   XCTAssertTrue(scene.configureSourceOrdinarySixMain(scope:scope,acquireIdle:{_ in c.acquired+=1;var ended=false;return{guard !ended else{return};ended=true;c.released+=1}}))
   scene.sourceEndgameMutationLedgerEnabled=true;XCTAssertTrue(scene.configureSourceEndgameMutationLedger(scope:scope))
   scene.sourceOrdinarySixSpawnOwnerEnabled=enabled
   if enabled {XCTAssertTrue(scene.configureSourceOrdinarySixSpawnOwner(scope:scope,resets:{_,_ in
    // Explicit test-only ordinary null-Special / queue endpoint. No product
    // capability is published by these controlled companion callbacks.
    .init(releaseSpecialTransaction:{c.companionTrace.append("release-special")},queueWildAfterGuardRelease:{c.companionTrace.append("queue")})
   }))}
   if depleted {
    scene.engine.stagedOrdinaryAssignments=true;scene.engine.stagedSourceNoMoves=true
    XCTAssertTrue(scene.configureSourceMicrotaskBoundaries(scope:scope,fifo:fifo))
    scene.sourceNoMovesPresentationEnabled=true;scene.sourceNoMovesRuntimeAuthorityEnabled=true;scene.sourceNoMovesDepletedCallersEnabled=true
    let engine=scene.engine
    let authority=NativeSourceNoMovesRuntimeAuthority(isCurrent:{[weak scope] in scope?.current==true},capture:{[weak engine] in
     guard let engine else{return nil}
     return .init(state:engine.state,tiles:Dictionary(uniqueKeysWithValues:engine.state.tiles.map{($0.id,.init())}),wildContinuationPending:false,gameplayTransactionActive:false,livingDragActive:false,endgameGuardActive:false,nonFinalMergeSixGuardActive:false,freshResult:.init(.fail,reason:"controlled-depleted-caller"),capabilities:Set(NativeSourceNoMovesRuntimeSnapshot.Capability.allCases))
    })
    XCTAssertTrue(scene.configureSourceNoMoves(bindings:.init(runtimeAuthority:authority,visibleShowCue:{_,_ in},admitted:{[weak scope] _ in scope?.current==true},refreshRuntime:{},ordinaryCallerReady:{_,_ in false},levelEndPreflight:{nil},stopIdleAndIdleSmoke:{},restartIdle:{},persistStuckState:{},resetHint:{},terminalFields:{_,_ in},queueGuardRelease:{_ in},scheduleGSAPRecheck:{_,_ in},exitFailure:{}),showText:{_,_ in},beginTextExit:{_,_ in},clearText:{},confirmedBoardExit:{_,_ in},callerInvocationReceiptBound:true))
    // Genuine installed depleted caller deliberately returns unsupported after
    // its controlled final-chance endpoint; no spawn arrival is synthesized.
    XCTAssertTrue(scene.configureSourceNoMovesDepletedCallers(.init(kinds:[.mergeMovesDepleted],admitted:{_,_ in true},busyEnding:{false},ensureTutorialSingleTile:{_,done in done(false)},forceFresh:{_ in .init(.fail,reason:"controlled-depleted-caller")},resetHint:{},deferWild:{_ in false},tutorialFinalChance:{_,done in done(nil)},cleanVisibility:{(false,false)},clean:{_ in})))
   }
  }
  func contact()throws->NativeOrdinaryMovePlan {
   let geometry=try XCTUnwrap(scene.boardGeometry),a=geometry.center(row:0,column:0),b=geometry.center(row:0,column:1)
   XCTAssertTrue(scene.beginDrag(at:a));service.deliver(wallMilliseconds:25);scene.moveDrag(to:b,now:0.025)
   XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:b,now:0.025)).accepted);return try XCTUnwrap(scene.engine.pendingOrdinarySix)
  }
  func dispose(){scene.dispose();context.dispose();service.dispose();fifo.dispose();view.presentScene(nil)}
 }
 func testActualMainPrefixAllocatesTokenAndStampsDateBeforePreparationWithoutNativeHandoffReset()throws {
  let f=try Fixture();defer{f.dispose()};let p=try f.contact()
  // Genuine non-final tile/guard writes also use the shared Date provider.
  // Token acquisition owns one additional read and its distinct ledger write.
  let prefixDateCalls=f.counter.dateCalls
  XCTAssertEqual(f.context.endgameMutations.snapshot.sequence,0)
  XCTAssertFalse(f.context.endgameMutations.mergeSixSpawns.inProgress)
  f.counter.now=2222;f.service.deliver(wallMilliseconds:109)
  let claim=try XCTUnwrap(f.context.endgameMutations.mergeSixSpawns.active)
  XCTAssertEqual(claim.ownerID,p.id);XCTAssertEqual(claim.generation,p.generation);XCTAssertEqual(claim.token,1)
  XCTAssertEqual(f.counter.dateCalls,prefixDateCalls+1);XCTAssertEqual(f.context.endgameMutations.snapshot.lastMutationAt,2222)
  XCTAssertTrue(f.scene.engine.ordinarySpawnPreparationPending);XCTAssertTrue(f.scene.engine.pendingSourceOrdinarySixSpawnBeginReceipts.isEmpty)
  XCTAssertEqual(f.counter.released,0);XCTAssertTrue(f.counter.companionTrace.isEmpty)
  XCTAssertFalse(f.context.endgameMutations.allFourWritersConnected)
 }
 func testRealCapturedScopeRetirementResetsTokenCompanionsWithoutDateAndCannotRevive()throws {
  let f=try Fixture();defer{f.dispose()};_=try f.contact();f.service.deliver(wallMilliseconds:109)
  let before=f.context.endgameMutations.snapshot;XCTAssertTrue(f.context.endgameMutations.mergeSixSpawns.inProgress)
  _=try XCTUnwrap(f.context.beginScene(retire:{}));XCTAssertFalse(f.scope.current)
  XCTAssertFalse(f.context.endgameMutations.mergeSixSpawns.inProgress);XCTAssertEqual(f.context.endgameMutations.snapshot,before)
  XCTAssertEqual(f.counter.released,1);XCTAssertEqual(f.counter.companionTrace,["release-special","queue"])
  f.service.deliver(wallMilliseconds:350);XCTAssertEqual(f.context.endgameMutations.snapshot,before)
 }
 func testFinalAndUnselectedRawDoNotRequestOrAllocateSourceSpawnToken()throws {
  for f in [try Fixture(final:true),try Fixture(enabled:false)] {
   defer{f.dispose()};_=try f.contact();let prefixDateCalls=f.counter.dateCalls
   f.service.deliver(wallMilliseconds:109)
   XCTAssertFalse(f.context.endgameMutations.mergeSixSpawns.inProgress);XCTAssertEqual(f.counter.dateCalls,prefixDateCalls)
   XCTAssertEqual(f.context.endgameMutations.snapshot.sequence,0)
   XCTAssertEqual(f.context.endgameMutations.mergeSixSpawns.allocationSequence,0)
  }
 }
 func testActualDestinationCleanupTokensProtectExactNodeAndCannotReleaseReplacement()throws {
  let textures=NativeBoardTextures(root:NativeTestResources.root)
  let node=NativeDiceNode(id:"cleanup-original",value:6,kind:"regular",variant:nil,depth:1,locked:false,textures:textures)
  let replacement=NativeDiceNode(id:"cleanup-original",value:6,kind:"regular",variant:nil,depth:1,locked:false,textures:textures)
  let owner=NativeSourceMergeSixDestinationCleanupOwner()
  defer{node.dispose();replacement.dispose();textures.dispose()}
  let first=try XCTUnwrap(owner.claim(node));XCTAssertEqual(first,1)
  XCTAssertTrue(owner.hasClaim(node));XCTAssertEqual(node.sourceEventMode,"none")
  XCTAssertFalse(owner.hasClaim(replacement));XCTAssertFalse(owner.release(replacement,token:first))
  let second=try XCTUnwrap(owner.claim(node));XCTAssertEqual(second,2)
  XCTAssertFalse(owner.protect(node,token:first));XCTAssertFalse(owner.release(node,token:first));XCTAssertTrue(owner.hasClaim(node))
  XCTAssertTrue(owner.release(node,token:second));XCTAssertFalse(owner.hasClaim(node));XCTAssertFalse(owner.release(node,token:second))
  XCTAssertEqual(node.sourceEventMode,"none","literal release does not invent input restoration")
  let third=try XCTUnwrap(owner.claim(node));node.dispose()
  XCTAssertFalse(owner.hasClaim(node));XCTAssertFalse(owner.owns(node,token:third));XCTAssertNil(owner.claim(node))
  owner.forget(node);XCTAssertNil(node.sourceMergeSixCleanupToken)
 }

 func testActualDepletedCallerRetainedSixWatchdogSurvivesConsumedSourceWithoutSpawnContinuation()async throws {
  let f=try Fixture(depleted:true);defer{f.dispose()}
  let plan=try f.contact(),destination=try XCTUnwrap(f.scene.sourceNativeTileNode("b"))
  f.service.deliver(wallMilliseconds:109)
  XCTAssertTrue(f.scene.engine.ordinarySixGameplayCommitted)
  XCTAssertNil(f.scene.sourceNativeTileNode("a"))
  XCTAssertEqual(f.scene.engine.pendingOrdinarySix?.id,plan.id)
  XCTAssertNil(f.scene.engine.pendingOrdinaryDestinationCleanup)
  XCTAssertEqual(destination.sourceValue,6)
  try await Task.sleep(for:.milliseconds(300))
  XCTAssertEqual(f.scene.engine.pendingOrdinarySix?.id,plan.id)
  XCTAssertTrue(f.scene.engine.ordinarySixGameplayCommitted)
  XCTAssertEqual(f.scene.engine.state.tiles.first{$0.id=="b"}?.value,6)
  XCTAssertTrue(f.scene.sourceNativeTileNode("b") === destination)
  XCTAssertTrue(f.scope.mergeSixDestinationCleanup.hasClaim(destination))
  XCTAssertTrue(f.scene.engine.pendingOrdinaryAssignments.isEmpty)
  XCTAssertEqual(f.scene.engine.state.tiles.first{$0.id=="b"}?.stackDepth,3)
  let before=f.scene.engine.state,callers=f.scene.engine.pendingSourceNoMovesCallerReceipts,flags=f.scene.engine.flags
  XCTAssertEqual(callers.count,1)
  f.service.setSourceGlobalPaused(true);f.service.setSourceForeground(false)
  try await Task.sleep(for:.milliseconds(1100))
  XCTAssertFalse(f.scene.engine.state.tiles.contains{$0.id=="b"})
  XCTAssertNil(f.scene.engine.pendingOrdinaryDestinationCleanup)
  XCTAssertNil(f.scene.sourceNativeTileNode("b"))
  XCTAssertFalse(destination.sourceContactNodeAlive)
  let after=f.scene.engine.state
  XCTAssertEqual(after.tiles,before.tiles.filter{$0.id != "b"})
  XCTAssertEqual(after.score,before.score);XCTAssertEqual(after.moves,before.moves);XCTAssertEqual(after.combo,before.combo)
  XCTAssertEqual(after.cubesCracked,before.cubesCracked);XCTAssertEqual(after.wildMeter,before.wildMeter)
  XCTAssertEqual(after.rngState,before.rngState);XCTAssertEqual(after.revision,before.revision)
  XCTAssertEqual(f.scene.engine.flags,flags);XCTAssertEqual(f.scene.engine.pendingSourceNoMovesCallerReceipts,callers)
  XCTAssertEqual(f.scene.engine.pendingOrdinarySix,plan);XCTAssertTrue(f.scene.engine.hasUnsavableSourceGameplayState)
  f.service.setSourceForeground(true)
  XCTAssertFalse(f.scene.engine.state.tiles.contains{$0.id=="b"},"Resume cannot resurrect the cleaned old destination")
 }

 func testCommittedWatchdogRejectsReclaimedDetachedFinalSpecialAndDisposedDestination()async throws {
  for failure in ["reclaimed","detached","final","special","disposed"] {
   let f=try Fixture(depleted:true);defer{f.dispose()}
   _=try f.contact();let destination=try XCTUnwrap(f.scene.sourceNativeTileNode("b"))
   f.service.deliver(wallMilliseconds:109)
   XCTAssertTrue(f.scene.engine.ordinarySixGameplayCommitted)
   let before=f.scene.engine.state
   switch failure {
   case "reclaimed":XCTAssertNotNil(f.scope.mergeSixDestinationCleanup.claim(destination))
   case "detached":destination.removeFromParent()
   case "final":destination.sourceMergeSixFinalAllowedByResolver=true
   case "special":destination.update(value:6,kind:"wild",variant:"flower",depth:3,locked:false);XCTAssertTrue(destination.isSpecial)
   default:f.scene.dispose()
   }
   try await Task.sleep(for:.milliseconds(1400))
   XCTAssertEqual(f.scene.engine.state,before,failure)
   if failure != "disposed" {XCTAssertTrue(destination.sourceContactNodeAlive,failure)}
  }
 }
 func testCommittedOldGenerationWatchdogCannotRemoveSameIDReplacement()async throws {
  let f=try Fixture(depleted:true);defer{f.dispose()}
  _=try f.contact();let old=try XCTUnwrap(f.scene.sourceNativeTileNode("b"))
  f.service.deliver(wallMilliseconds:109)
  let oldGeneration=f.scene.engine.state.generation
  f.scene.engine.restart(state:.init(columns:5,rows:9,tiles:[.init(id:"b",cell:.init(column:1,row:0),value:6)],generation:oldGeneration+1))
  f.scene.synchronize()
  let replacement=try XCTUnwrap(f.scene.sourceNativeTileNode("b")),state=f.scene.engine.state
  XCTAssertFalse(old === replacement);XCTAssertFalse(old.sourceContactNodeAlive)
  try await Task.sleep(for:.milliseconds(1400))
  XCTAssertEqual(f.scene.engine.state,state)
  XCTAssertTrue(f.scene.sourceNativeTileNode("b") === replacement)
  XCTAssertTrue(replacement.sourceContactNodeAlive)
 }

 func testRealWallDestinationWatchdogSurvivesAnimationPauseAndCannotReleaseReclaimedNode()async throws {
  let textures=NativeBoardTextures(root:NativeTestResources.root),timers=NativeSourceAppTimeoutOwner()
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceFrameTransportEnabled:true)
  let source=NativeDiceNode(id:"watch-source",value:2,kind:"regular",variant:nil,depth:1,locked:false,textures:textures)
  let destination=NativeDiceNode(id:"watch-destination",value:6,kind:"regular",variant:nil,depth:1,locked:false,textures:textures)
  let owner=NativeSourceMergeSixDestinationCleanupOwner(),removed=expectation(description:"actual wall1200 destination watchdog")
  defer{timers.cancelAll();source.dispose();destination.dispose();textures.dispose();service.dispose()}
  let old=try XCTUnwrap(owner.claim(destination))
  XCTAssertNotNil(owner.scheduleOrdinaryWatchdog(tile:destination,token:old,generation:1,timeouts:timers,current:{true},lastMerge:{false},finalAllowed:{false},special:{false},removeDestination:{_ in XCTFail("old token cannot remove reclaimed object")}))
  let captured=try XCTUnwrap(owner.claim(destination));var removals=0
  XCTAssertNotNil(owner.scheduleOrdinaryWatchdog(tile:destination,token:captured,generation:1,timeouts:timers,current:{true},lastMerge:{false},finalAllowed:{false},special:{false},removeDestination:{node in
   XCTAssertTrue(node === destination);XCTAssertTrue(source.sourceContactNodeAlive);XCTAssertNil(destination.sourceMergeSixCleanupToken)
   removals+=1;node.dispose();removed.fulfill()
  }))
  service.setSourceGlobalPaused(true)
  try await Task.sleep(for:.milliseconds(100));XCTAssertEqual(removals,0);XCTAssertTrue(owner.owns(destination,token:captured))
  await fulfillment(of:[removed],timeout:3)
  XCTAssertEqual(removals,1);XCTAssertTrue(source.sourceContactNodeAlive);XCTAssertEqual(source.value,2);XCTAssertEqual(timers.pendingCount,0)
 }

}
