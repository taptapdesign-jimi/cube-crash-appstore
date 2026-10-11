import XCTest
import SpriteKit
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceMagnetMainSceneTests:XCTestCase {
 @MainActor private final class Time {var wall=0.0}
 @MainActor private final class Fixture {
  let time=Time(),fifo=NativeSourceMicrotaskFIFO(),tasks:NativeSourceMicrotaskAdapters,service:NativeSourceAnimationClockService
  let context:NativeGameplaySourceContext,scope:NativeGameplaySourceContext.Scope,scene:NativeBoardScene,view:SKView
  init(enabled:Bool=true,variant:String?=nil,reversed:Bool=false)throws {
   tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
   service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{[time] in time.wall},sourceFrameTransportEnabled:true)
   service.sourceMicrotaskTasks=tasks
   context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{0.5},sourceMicrotaskTasks:tasks)
   let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"m",cell:.init(column:0,row:0),value:reversed ? 2:6,archetype:reversed ? nil:.magnet,variant:reversed ? nil:variant),.init(id:"d",cell:.init(column:1,row:0),value:reversed ? 6:2,archetype:reversed ? .magnet:nil,variant:reversed ? variant:nil),.init(id:"a",cell:.init(column:3,row:0),value:1),.init(id:"b",cell:.init(column:4,row:8),value:3)]),recordedRandomChoices:Array(repeating:0,count:300))
   scene=NativeBoardScene(engine:engine,resourceRoot:try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle")),size:.init(width:390,height:844))
   let scene=scene
   scope=try XCTUnwrap(context.beginScene(engine:engine,retire:{[weak scene] in scene?.retireSourceAnimationBindings()}))
   scene.sourceOuterTimelineDriver=scope.timeline;scene.sourceDragTweenDriver=scope.tween
   scene.sourceSameNodeStackAbsorbsEnabled=true;scene.sourceContactVisualRandom={0.5};scene.sourceStackAbsorbAdmission={_,_ in true}
   scene.configureSourceRegularStackHandoff(service:service,admitted:{true})
   scene.layout(size:scene.size,insets:.init(top:47,left:0,bottom:34,right:0))
   view=SKView(frame:.init(x:0,y:0,width:390,height:844));view.presentScene(scene)
   let dst=try XCTUnwrap(scene.sourceNativeTileNode(reversed ? "m":"d"))
   XCTAssertTrue(dst.queueSourceStackValue(2,addStack:0,service:service,random:{0.5},current:{true}))
   time.wall=16;service.deliver(wallMilliseconds:16)
   XCTAssertTrue(scene.configureSourceMicrotaskBoundaries(scope:scope,fifo:fifo))
   XCTAssertTrue(scene.configureSourceSpecialTransactions(scope:scope))
   // This bounded main-marker fixture never delivers the independent Pixi
   // pull clock; full physical/coroutine producer is a separate admitted set.
   let bindings=NativeSourceMagnetSceneBindings(admitted:{true},ownsLifecycle:{$0.generation==engine.state.generation},simulate:{false},observation:{_ in nil},fallback:{_,_,_ in false},fxStatus:{nil},clearLastMerge:{_ in},updateGhostVisibility:{},centralCheck:{_ in},cleanupPullAnimations:{_ in},releasePullFlag:{_ in})
   XCTAssertTrue(scene.configureSourceMagnetVerification(scope:scope,bindings:bindings))
   if enabled {XCTAssertTrue(scene.configureSourceMagnetMain80(scope:scope))}
  }
  func point(_ column:Int)throws->CGPoint{try XCTUnwrap(scene.boardGeometry).center(row:0,column:column)}
  func contact()throws->NativeMoveResult {
   var result:NativeMoveResult?
   tasks.inputTask {
    XCTAssertTrue(scene.beginDrag(at:try! point(0)));time.wall=25;service.deliver(wallMilliseconds:25)
    scene.moveDrag(to:try! point(1),now:0.025);result=scene.finishDrag(at:try! point(1),now:0.025)
   }
   return try XCTUnwrap(result)
  }
  func deliver(_ wall:Double){time.wall=wall;service.deliver(wallMilliseconds:wall)}
  func dispose(){scene.dispose();context.dispose();service.dispose();fifo.dispose();view.presentScene(nil)}
 }
 func testRegularIntoEveryMagnetBackingUsesActualFirstRafBeforeMain()async throws {
  for variant:String? in [nil,"spaceship","bottle","honey"] {
   let f=try Fixture(variant:variant,reversed:true);defer{f.dispose()}
   let ready=await withCheckedContinuation { continuation in
    f.scene.prepareSourceSpecialWildDestinationFaceResources(scope:f.scope){continuation.resume(returning:$0)}
   }
   XCTAssertTrue(ready)
   let dst=try XCTUnwrap(f.scene.sourceNativeTileNode("d")),src=try XCTUnwrap(f.scene.sourceNativeTileNode("m"))
   let contact=try f.contact()
   XCTAssertTrue(contact.accepted,(variant ?? "core")+":"+contact.resolution.reason)
   let face=try XCTUnwrap(f.scene.engine.pendingSourceSpecialWildDestinationFace)
   XCTAssertTrue(f.scene.sourceNativeTileNode("d") === dst);XCTAssertTrue(f.scene.sourceNativeTileNode("m") === src)
   XCTAssertTrue(dst.sourceWildStateCleared);XCTAssertFalse(dst.sourceResidualWildPresence)
   f.deliver(41)
   XCTAssertNil(f.scene.engine.pendingSourceSpecialWildDestinationFace)
   XCTAssertTrue(dst.sourceResidualWildPresence);XCTAssertEqual(dst.sourceStackDepth,1)
   XCTAssertFalse(f.scene.engine.sourceSpecialAbsorbMainEntered)
   XCTAssertEqual(f.scene.engine.state.tiles.first{$0.id=="d"},face.face.afterFace)
   f.deliver(109)
   XCTAssertTrue(f.scene.engine.sourceSpecialAbsorbMainEntered);XCTAssertNil(f.scene.sourceNativeTileNode("m"))
   XCTAssertTrue(f.scene.sourceNativeTileNode("d") === dst)
  }
 }
 func testActualNormalContactRetainsPairThenFirstRealMainCallbackClosesCancelWindow()throws {
  let f=try Fixture();defer{f.dispose()};let src=try XCTUnwrap(f.scene.sourceNativeTileNode("m")),dst=try XCTUnwrap(f.scene.sourceNativeTileNode("d")),before=f.scene.engine.state
  XCTAssertTrue(try f.contact().accepted);let receipt=try XCTUnwrap(f.scene.engine.pendingSourceSpecialAbsorb)
  XCTAssertTrue(f.scene.sourceNativeTileNode("m") === src);XCTAssertTrue(f.scene.sourceNativeTileNode("d") === dst)
  XCTAssertEqual(dst.value,6);XCTAssertFalse(dst.isHidden);XCTAssertEqual(dst.alpha,1)
  XCTAssertEqual(f.scene.engine.state.tile(at:.init(column:1,row:0))?.visible,true)
  XCTAssertFalse(f.scene.engine.sourceSpecialAbsorbMainEntered);XCTAssertNil(f.scene.engine.pendingMagnetRespawn)
  let pose=src.position;f.scene.synchronize();XCTAssertEqual(src.position,pose)
  f.deliver(104);XCTAssertFalse(f.scene.engine.sourceSpecialAbsorbMainEntered)
  f.deliver(105);XCTAssertFalse(f.scene.engine.sourceSpecialAbsorbMainEntered)
  f.deliver(109);XCTAssertTrue(f.scene.engine.sourceSpecialAbsorbMainEntered)
  XCTAssertNil(f.scene.sourceNativeTileNode("m"));XCTAssertTrue(f.scene.sourceNativeTileNode("d") === dst)
  XCTAssertFalse(f.scene.engine.cancelSourceSpecialAbsorb(receiptID:receipt.id,generation:receipt.generation).accepted)
  XCTAssertNil(f.scene.engine.pendingMagnetRespawn);XCTAssertEqual(f.scene.engine.state.score,before.score);XCTAssertEqual(f.scene.engine.state.moves,before.moves)
 }
 func testAuthoredMagnetVariantsRetainRealPrefixAndRejectStaleMainAfterDestinationLoss()throws {
  for variant in ["spaceship","bottle","honey"] {
   let f=try Fixture(variant:variant);defer{f.dispose()}
   let before=f.scene.engine.state,dst=try XCTUnwrap(f.scene.sourceNativeTileNode("d"))
   XCTAssertTrue(try f.contact().accepted,variant)
   let plan=try XCTUnwrap(f.scene.engine.pendingSpecial)
   XCTAssertEqual(plan.variant,variant);XCTAssertTrue(f.scene.sourceNativeTileNode("d") === dst)
   XCTAssertEqual(dst.value,6);XCTAssertEqual(dst.alpha,1);XCTAssertFalse(dst.isHidden)
   dst.removeFromParent();f.scene.synchronize();f.deliver(500)
   XCTAssertNil(f.scene.engine.pendingSpecial);XCTAssertNil(f.scene.engine.pendingSourceSpecialAbsorb)
   XCTAssertEqual(f.scene.engine.state.score,before.score);XCTAssertEqual(f.scene.engine.state.moves,before.moves)
   XCTAssertFalse(f.scene.engine.sourceSpecialAbsorbMainEntered)
   for target in plan.targets {XCTAssertFalse(try XCTUnwrap(f.scene.engine.state.tiles.first{$0.id==target.id}).resolutionOwned)}
  }
 }
 func testSourceGlobalPauseNeverManufacturesMainFromWallOrFaceRaf()throws {
  let f=try Fixture();defer{f.dispose()};XCTAssertTrue(try f.contact().accepted)
  let before=f.scene.engine.state
  f.service.setSourceGlobalPaused(true);f.deliver(400)
  XCTAssertFalse(f.scene.engine.sourceSpecialAbsorbMainEntered);XCTAssertEqual(f.scene.engine.state,before)
  XCTAssertEqual(f.scene.sourceNativeTileNode("d")?.value,6)
  f.service.setSourceGlobalPaused(false);f.deliver(480)
  XCTAssertTrue(f.scene.engine.sourceSpecialAbsorbMainEntered);XCTAssertNil(f.scene.engine.pendingMagnetRespawn)
 }
 func testActualSameGenerationDestinationLossCancelsPairAndPreservesAccounting()throws {
  let f=try Fixture();defer{f.dispose()};XCTAssertTrue(try f.contact().accepted)
  let before=f.scene.engine.state,plan=try XCTUnwrap(f.scene.engine.pendingSpecial)
  try XCTUnwrap(f.scene.sourceNativeTileNode("d")).removeFromParent();f.scene.synchronize()
  XCTAssertNil(f.scene.engine.pendingSpecial);XCTAssertNil(f.scene.engine.pendingSourceSpecialAbsorb)
  XCTAssertEqual(f.scene.engine.state.score,before.score);XCTAssertEqual(f.scene.engine.state.moves,before.moves);XCTAssertEqual(f.scene.engine.state.rngState,before.rngState)
  for target in plan.targets {let tile=try XCTUnwrap(f.scene.engine.state.tiles.first{$0.id==target.id});XCTAssertFalse(tile.magnetOwned);XCTAssertFalse(tile.resolutionOwned);XCTAssertFalse(tile.locked)}
  f.deliver(500);XCTAssertFalse(f.scene.engine.sourceSpecialAbsorbMainEntered)
 }
 func testDefaultOffStillRejectsUnadmittedNormalSpecialBeforeAutoOrCoreClaim()throws {
  let f=try Fixture(enabled:false);defer{f.dispose()};let before=f.scene.engine.state
  XCTAssertFalse(try f.contact().accepted);XCTAssertEqual(f.scene.engine.state,before)
  XCTAssertNil(f.scene.engine.pendingSpecial);XCTAssertNil(f.scope.registries.snapshot(isWild:false)?.special)
 }
 func testCueReentrantDisposeBeforeMainRegistrationClosesAcceptedSetupWithoutFalseArrival()throws {
  let f=try Fixture();defer{f.dispose()};let before=f.scene.engine.state
  f.scene.onGameplayReceipt={event,_,_,_ in if event.kind == .merged {f.scene.dispose()}}
  XCTAssertTrue(try f.contact().accepted);XCTAssertNil(f.scene.engine.pendingSpecial);XCTAssertNil(f.scene.engine.pendingSourceSpecialAbsorb)
  XCTAssertEqual(f.scene.engine.state.score,before.score);XCTAssertEqual(f.scene.engine.state.moves,before.moves)
  XCTAssertEqual(f.service.activeParticipantCount,0)
 }
}
