import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeRegularContactSceneTests:XCTestCase {
 @MainActor private final class Fixture {
  let service:NativeSourceAnimationClockService,outer:NativeSourceOuterTimelineAdapter,tween:NativeSourceDragTweenAdapter,session:NativeSharedSmokeRootSession,smoke:NativeSharedSmokeRootRenderer,companions:NativeRegularContactSceneCompanions,scene:NativeBoardScene
  var draws:[Double]=[],audioDrawCounts:[Int]=[]
  private let counter:Counter
  var visualDrawCount:Int {counter.values.count}
  init(state suppliedState:NativeBoardState?=nil){
   service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0});outer=NativeSourceOuterTimelineAdapter(service:service);tween=NativeSourceDragTweenAdapter(service:service)
   // One captured stream for every synchronous contact/puff draw. Fixture
   // counter storage is independent of node/owner lifetimes.
   let counter=Counter();self.counter=counter;session=NativeSharedSmokeRootSession(appOriginMilliseconds:0,visualRandom:{counter.values.append(0.5);return 0.5});smoke=session.makeRenderer(service:service)
   companions=NativeRegularContactSceneCompanions(session:session,smoke:smoke,tween:tween,timeline:outer,monotonicMillisecondsNow:{0})
   let state=suppliedState ?? NativeBoardState(columns:5,rows:9,tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1),.init(id:"b",cell:.init(column:1,row:0),value:2),.init(id:"c",cell:.init(column:2,row:0),value:4),.init(id:"far",cell:.init(column:4,row:0),value:4)])
   scene=NativeBoardScene(engine:NativeGameplayEngine(state:state),resourceRoot:Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle"),size:CGSize(width:390,height:844));scene.sourceOuterTimelineDriver=outer;scene.sourceDragTweenDriver=tween
   scene.configureSourceRegularContact(companions,admitted:{true});scene.sourceSameNodeStackAbsorbsEnabled=true
   scene.layout(size:scene.size,insets:.init(top:47,left:0,bottom:34,right:0))
   scene.onGameplayReceipt={ [weak self] event,_,_,_ in guard event.kind == .merged else{return};self?.draws=counter.values;self?.audioDrawCounts.append(counter.values.count)}
  }
  @MainActor private final class Counter {var values:[Double]=[]}
  func stack()throws->NativeMoveResult {let g=try XCTUnwrap(scene.boardGeometry);XCTAssertTrue(scene.beginDrag(at:g.center(row:0,column:0)));service.deliver(wallMilliseconds:25);scene.moveDrag(to:g.center(row:0,column:1),now:0.025);return try XCTUnwrap(scene.finishDrag(at:g.center(row:0,column:1),now:0.025))}
  func dispose(){scene.dispose();companions.dispose();outer.dispose();tween.dispose();service.dispose()}
 }
 func testActualStackClickNeighborSmokeAndAuthoredAudioShareOneStreamInSourceOrder()throws {
  let f=Fixture();defer{f.dispose()};XCTAssertTrue(try f.stack().accepted)
  // Source last stack layer click3, impact2, one nearest ordinary recoil1,
  // THEN authored synchronous smoke allocations, THEN existing audio receipt.
  XCTAssertEqual(f.audioDrawCounts.count,1);XCTAssertGreaterThan(f.audioDrawCounts[0],6)
  XCTAssertTrue(try XCTUnwrap(f.scene.sourceNativeTileNode("b")).sourceOuterOwners.mergeImpact)
  XCTAssertEqual(f.companions.activeMotionCount,2);XCTAssertGreaterThan(f.smoke.activeOwnerCount,0)
  let neighbor=try XCTUnwrap(f.scene.sourceNativeTileNode("c")),base=neighbor.visual.position
  f.service.deliver(wallMilliseconds:80);XCTAssertNotEqual(neighbor.visual.position,base)
  f.service.deliver(wallMilliseconds:185);XCTAssertEqual(neighbor.visual.position.x,base.x,accuracy:2e-5);XCTAssertEqual(neighbor.visual.position.y,base.y,accuracy:2e-5)
  XCTAssertEqual(f.companions.activeMotionCount,0);XCTAssertEqual(f.audioDrawCounts.count,1)
 }
 func testPurePauseRetainsCapturedClickRecoilAndSmokeRootsWithoutLogicalArrival()throws {
  let f=Fixture();defer{f.dispose()};_ = try f.stack();let motion=f.companions.activeMotionCount,smoke=f.smoke.activeOwnerCount,state=f.scene.engine.state
  f.scene.setSuspended(true);f.service.setSourceGlobalPaused(true);f.service.deliver(wallMilliseconds:500)
  XCTAssertEqual(f.companions.activeMotionCount,motion);XCTAssertEqual(f.smoke.activeOwnerCount,smoke);XCTAssertEqual(f.scene.engine.state,state)
  f.scene.setSuspended(false);f.service.setSourceGlobalPaused(false);f.service.deliver(wallMilliseconds:700)
  XCTAssertNil(f.scene.engine.pendingOrdinaryStack);XCTAssertEqual(f.companions.activeMotionCount,0)
 }
 func testSceneDisposalTerminatesCapturedContactRootsWithoutReentryOrReplacementPaint()throws {
  let f=Fixture();_ = try f.stack();let old=try XCTUnwrap(f.scene.sourceNativeTileNode("c"));f.scene.dispose();let pose=old.visual.position
  XCTAssertEqual(f.companions.activeMotionCount,0);XCTAssertEqual(f.smoke.activeOwnerCount,0);XCTAssertEqual(f.service.activeParticipantCount,0)
  f.service.deliver(wallMilliseconds:1000);XCTAssertEqual(old.visual.position,pose);XCTAssertEqual(f.audioDrawCounts.count,1);f.dispose()
 }
 func testMissingFullPresentationAdmissionRejectsBeforeContactRNGAndCoreMutation()throws {
  let f=Fixture();defer{f.dispose()};let state=f.scene.engine.state
  f.scene.configureSourceRegularContact(f.companions,admitted:{false});let result=try f.stack()
  XCTAssertFalse(result.accepted);XCTAssertEqual(f.scene.engine.state,state);XCTAssertEqual(f.visualDrawCount,0);XCTAssertTrue(f.audioDrawCounts.isEmpty);XCTAssertEqual(f.companions.activeMotionCount,0);XCTAssertEqual(f.smoke.activeOwnerCount,0)
 }
 func testActualNeighborPickupInterruptsOnlyRotGAndTiltPreservesSourcePositionChannel()throws {
  let f=Fixture();defer{f.dispose()};_ = try f.stack();f.service.deliver(wallMilliseconds:80)
  let neighbor=try XCTUnwrap(f.scene.sourceNativeTileNode("c")),base=neighbor.sourceInnerPosition,g=try XCTUnwrap(f.scene.boardGeometry)
  XCTAssertTrue(f.scene.beginDrag(at:g.center(row:0,column:2)));XCTAssertEqual(f.companions.activeMotionCount,1) // click alone; captured recoil killed
  neighbor.dragInnerTilt=0.1;XCTAssertEqual(neighbor.sourceInnerPosition.x,base.x,accuracy:2e-5);XCTAssertEqual(neighbor.sourceInnerPosition.y,base.y,accuracy:2e-5)
  f.service.deliver(wallMilliseconds:185);XCTAssertEqual(neighbor.sourceInnerPosition.x,base.x,accuracy:2e-5);XCTAssertEqual(neighbor.sourceInnerPosition.y,base.y,accuracy:2e-5)
 }
 func testNeighborImpulseLivesInTileLocalUnitsAndRendersWithOuterGeometryScaleExactlyOnce()throws {
  let f=Fixture();defer{f.dispose()};_ = try f.stack();f.service.deliver(wallMilliseconds:80)
  let neighbor=try XCTUnwrap(f.scene.sourceNativeTileNode("c")),g=try XCTUnwrap(f.scene.boardGeometry)
  XCTAssertEqual(neighbor.sourceInnerPosition.x,1.575,accuracy:2e-5)
  let outer=neighbor.convert(CGPoint.zero,to:f.scene),painted=neighbor.visual.convert(CGPoint.zero,to:f.scene)
  XCTAssertEqual(painted.x-outer.x,1.575*g.scale,accuracy:3e-5)
 }
 func testDisposedCapturedSourceCannotBeRecreatedByRetentionQueryAfterReentrantSynchronization()throws {
  let f=Fixture();defer{f.dispose()};_ = try f.stack();let original=try XCTUnwrap(f.scene.sourceNativeTileNode("a"));original.dispose();f.scene.synchronize()
  XCTAssertNil(f.scene.sourceNativeTileNode("a"));XCTAssertNil(f.scene.engine.pendingOrdinaryStack);f.service.deliver(wallMilliseconds:105);XCTAssertNil(f.scene.sourceNativeTileNode("a"))
 }

 func testScopeRetirementUnhooksDriversAndPreservesPaintedDestinationAndUnrelatedInnerAction()throws {
  let f=Fixture();defer{f.dispose()};_ = try f.stack();f.service.deliver(wallMilliseconds:80)
  let node=try XCTUnwrap(f.scene.sourceNativeTileNode("b"));node.visual.run(.wait(forDuration:5),withKey:"unrelated-authored-family")
  let position=node.position,x=node.xScale,y=node.yScale,rotation=node.zRotation,inner=node.visual.position
  f.scene.retireSourceAnimationBindings()
  XCTAssertNil(f.scene.sourceOuterTimelineDriver);XCTAssertNil(f.scene.sourceDragTweenDriver);XCTAssertEqual(f.companions.activeMotionCount,0);XCTAssertEqual(f.smoke.activeOwnerCount,0)
  XCTAssertTrue(f.scene.sourceNativeTileNode("b") === node);XCTAssertEqual(node.position,position);XCTAssertEqual(node.xScale,x,accuracy:1e-6);XCTAssertEqual(node.yScale,y,accuracy:1e-6);XCTAssertEqual(node.zRotation,rotation,accuracy:1e-6);XCTAssertEqual(node.visual.position,inner);XCTAssertNotNil(node.visual.action(forKey:"unrelated-authored-family"))
  XCTAssertNil(f.scene.engine.pendingOrdinaryStack);f.service.deliver(wallMilliseconds:1000);XCTAssertEqual(node.xScale,x,accuracy:1e-6)
 }
 func testRetiredScopeMayStillDisposeSceneWithoutRawOwnersBeingStranded()throws {
  let f=Fixture();_ = try f.stack();f.scene.retireSourceAnimationBindings();f.scene.dispose()
  XCTAssertNil(f.scene.sourceNativeTileNode("b"));XCTAssertEqual(f.service.activeParticipantCount,0);f.dispose()
 }

 func testExternalAdmittedCallbackDisposeReturningTrueCannotReviveSourceDropOrDraw()throws {
  let f=Fixture();let initial=f.scene.engine.state
  f.scene.configureSourceRegularContact(f.companions,admitted:{f.scene.dispose();return true})
  let result=try f.stack();XCTAssertFalse(result.accepted);XCTAssertEqual(f.visualDrawCount,0);XCTAssertEqual(f.scene.engine.state,initial);XCTAssertNil(f.scene.engine.pendingOrdinaryStack);XCTAssertEqual(f.service.activeParticipantCount,0);f.dispose()
 }

 func testDestroyedMissingNativeIDIsExcludedBeforeFirstFourNeighborSelection()throws {
  let tiles:[NativeTile]=[.init(id:"a",cell:.init(column:0,row:0),value:1),.init(id:"b",cell:.init(column:1,row:0),value:2),.init(id:"c",cell:.init(column:2,row:0),value:4),.init(id:"d",cell:.init(column:3,row:0),value:4),.init(id:"e",cell:.init(column:4,row:0),value:4),.init(id:"f",cell:.init(column:0,row:1),value:4),.init(id:"destroyed",cell:.init(column:1,row:1),value:4,visible:false,alpha:0)]
  let f=Fixture(state:NativeBoardState(columns:5,rows:9,tiles:tiles));defer{f.dispose()}
  // Captured compatibility tombstone has no visual. Its fallback coordinate
  // (100,-100) is closer than the fourth living candidate, so excluding it
  // AFTER prefix4 would suppress that living node and consume only3 draws.
  var tombstone=NativeNoMovesTileRuntime();tombstone.destroyed=true;f.scene.engine.noMovesTileRuntime["destroyed"] = tombstone
  XCTAssertNil(f.scene.sourceNativeTileNode("destroyed"))
  let source=try XCTUnwrap(f.scene.sourceNativeTileNode("a")),destination=try XCTUnwrap(f.scene.sourceNativeTileNode("b")),canvas=try XCTUnwrap(destination.parent)
  destination.position = CGPoint(x:0,y:-100);source.position=CGPoint(x:200,y:-100)
  var nodes:[String:NativeDiceNode]=["a":source,"b":destination]
  for (id,x) in [("c",90.0),("d",95.0),("e",105.0),("f",110.0)] {let node=try XCTUnwrap(f.scene.sourceNativeTileNode(id));node.position=CGPoint(x:x,y:-100);nodes[id]=node}
  let last=try XCTUnwrap(nodes["f"]),initial=last.sourceInnerPosition,state=f.scene.engine.state
  let destroyedIDs=Set(f.scene.engine.noMovesTileRuntime.compactMap{$0.value.destroyed ? $0.key:nil})
  XCTAssertTrue(f.companions.suffix(source:source,destination:destination,tiles:tiles,nodes:nodes,destroyedTileIDs:destroyedIDs,canvas:canvas,generation:state.generation,tileSize:100,renderScale:1,reduced:false,current:{$0==state.generation}))
  XCTAssertEqual(f.companions.activeMotionCount,4);f.service.deliver(wallMilliseconds:55)
  XCTAssertNotEqual(last.sourceInnerPosition,initial);XCTAssertEqual(last.sourceInnerPosition.x,1.575,accuracy:2e-5)
  XCTAssertEqual(f.scene.engine.state,state)
 }

 func testScopeRetirementSealsInputDuringActualIdleReleaseWithoutAcceptedStack()throws {
  let f=Fixture();defer{f.dispose()};let node=try XCTUnwrap(f.scene.sourceNativeTileNode("b")),g=try XCTUnwrap(f.scene.boardGeometry)
  var pickupResults:[Bool]=[],finished=0
  XCTAssertNil(f.scene.engine.pendingOrdinaryStack)
  XCTAssertTrue(node.beginSourceIdle(.init(variantDraw:0.5,directionDraw:0.5,tiltDraw:0.5),release:{pickupResults.append(f.scene.beginDrag(at:g.center(row:0,column:1)))},onSmoke:{},onFinished:{finished+=1}))
  f.service.deliver(wallMilliseconds:40);f.scene.retireSourceAnimationBindings()
  XCTAssertEqual(pickupResults,[false]);XCTAssertEqual(finished,1);XCTAssertFalse(f.scene.engine.isDragging);XCTAssertEqual(f.service.activeParticipantCount,0)
  XCTAssertNil(f.scene.sourceOuterTimelineDriver);XCTAssertNil(f.scene.sourceDragTweenDriver)
  // Temporary seal ends after old bindings retire; an explicitly subsequent
  // input belongs to the remaining Raw surface and may still be admitted.
  XCTAssertTrue(f.scene.beginDrag(at:g.center(row:0,column:1)));f.scene.cancelDrag()
 }
 func testGenerationSyncInsideActualIdleReleasePreservesEnclosingSourceRetirementSeal()throws {
  let f=Fixture();defer{f.dispose()};let node=try XCTUnwrap(f.scene.sourceNativeTileNode("b")),g=try XCTUnwrap(f.scene.boardGeometry)
  var pickupResults:[Bool]=[],released=0
  XCTAssertTrue(node.beginSourceIdle(.init(variantDraw:0.5,directionDraw:0.5,tiltDraw:0.5),release:{
   released+=1;var fresh=f.scene.engine.state;fresh.generation+=1;f.scene.engine.restart(state:fresh);f.scene.synchronize()
   f.scene.configureSourceRegularContact(f.companions,admitted:{true})
   pickupResults.append(f.scene.beginDrag(at:g.center(row:0,column:1)))
  },onSmoke:{},onFinished:{}))
  f.scene.retireSourceAnimationBindings()
  XCTAssertEqual(released,1);XCTAssertEqual(pickupResults,[false]);XCTAssertFalse(f.scene.engine.isDragging);XCTAssertNil(f.scene.sourceContactVisualRandom);XCTAssertEqual(f.service.activeParticipantCount,0)
  f.scene.dispose();XCTAssertNil(f.scene.sourceNativeTileNode("b"))
 }

 func testOldNodeRetirementCannotRestoreOverSameIdentityReplacementOuterBinding()throws {
  let f=Fixture();defer{f.dispose()};let node=try XCTUnwrap(f.scene.sourceNativeTileNode("b")),g=try XCTUnwrap(f.scene.boardGeometry)
  var replacementScale:CGFloat?,released=0
  XCTAssertTrue(node.beginSourceIdle(.init(variantDraw:0.5,directionDraw:0.5,tiltDraw:0.5),release:{
   released+=1;node.installSourceOuterDriver(f.outer,generation:f.scene.engine.state.generation,geometryScale:g.scale)
   XCTAssertTrue(node.beginSourcePickup());f.service.deliver(wallMilliseconds:95);replacementScale=node.xScale
  },onSmoke:{},onFinished:{}))
  f.service.deliver(wallMilliseconds:40);let oldScale=node.xScale;node.retireSourceAnimationBindingsPreservingPaint()
  XCTAssertEqual(released,1);XCTAssertTrue(node.sourceOuterDriven);XCTAssertNotEqual(try XCTUnwrap(replacementScale),oldScale)
  XCTAssertEqual(node.xScale,try XCTUnwrap(replacementScale),accuracy:1e-6);XCTAssertTrue(node.sourceOuterOwners.pickupScale)
 }
 func testOldNodeRetirementCannotRestoreInnerPoseOverReplacementShadowBinding()throws {
  let f=Fixture();defer{f.dispose()};let node=try XCTUnwrap(f.scene.sourceNativeTileNode("b"))
  var replacementInner:CGPoint?,replacementRotation:CGFloat?
  XCTAssertTrue(node.beginSourceIdle(.init(variantDraw:0.5,directionDraw:0.5,tiltDraw:0.5),release:{
   node.installSourceDragTweenDriver(f.tween);node.dragInnerTilt=0.11;node.sourcePointerUp();f.service.deliver(wallMilliseconds:95)
   replacementInner=node.visual.position;replacementRotation=node.visual.zRotation
  },onSmoke:{},onFinished:{}))
  f.service.deliver(wallMilliseconds:40);node.retireSourceAnimationBindingsPreservingPaint()
  XCTAssertEqual(node.visual.position,try XCTUnwrap(replacementInner));XCTAssertEqual(node.visual.zRotation,try XCTUnwrap(replacementRotation),accuracy:1e-6)
 }
 func testOldNodeRetirementRevisionCannotRestoreOverReplacementAlreadyRetiredAgain()throws {
  let f=Fixture();defer{f.dispose()};let node=try XCTUnwrap(f.scene.sourceNativeTileNode("b")),g=try XCTUnwrap(f.scene.boardGeometry)
  var replacementPosition:CGPoint?,replacementScale:CGFloat?
  XCTAssertTrue(node.beginSourceIdle(.init(variantDraw:0.5,directionDraw:0.5,tiltDraw:0.5),release:{
   node.installSourceOuterDriver(f.outer,generation:f.scene.engine.state.generation,geometryScale:g.scale)
   node.position=CGPoint(x:212,y:303);XCTAssertTrue(node.beginSourcePickup());f.service.deliver(wallMilliseconds:95)
   node.retireSourceAnimationBindingsPreservingPaint();replacementPosition=node.position;replacementScale=node.xScale
  },onSmoke:{},onFinished:{}))
  f.service.deliver(wallMilliseconds:40);node.retireSourceAnimationBindingsPreservingPaint()
  XCTAssertFalse(node.sourceOuterDriven);XCTAssertEqual(node.position,try XCTUnwrap(replacementPosition));XCTAssertEqual(node.xScale,try XCTUnwrap(replacementScale),accuracy:1e-6)
 }


 func testSourceDisposeSealsActualIdleReleaseAgainstRestartDragConfigAndSync()throws {
  let f=Fixture();let node=try XCTUnwrap(f.scene.sourceNativeTileNode("b")),g=try XCTUnwrap(f.scene.boardGeometry)
  var attempts:[Bool]=[],released=0,publications=0,geometryChanged=false
  f.scene.onStateChange={_ in publications+=1}
  XCTAssertTrue(node.beginSourceIdle(.init(variantDraw:0.5,directionDraw:0.5,tiltDraw:0.5),release:{
   released+=1
   var next=f.scene.engine.state;next.generation+=1;f.scene.engine.restart(state:next)
   f.scene.configureSourceRegularContact(f.companions,admitted:{XCTFail("retired config must not publish admission");return true})
   f.scene.synchronize();f.scene.layout(size:CGSize(width:428,height:926),insets:.zero)
   geometryChanged=f.scene.boardGeometry?.tileSize != g.tileSize
   attempts.append(f.scene.beginDrag(at:g.center(row:0,column:1)))
   f.scene.evaluate();f.scene.prepareNextBoardEntry();f.scene.dispose()
  },onSmoke:{},onFinished:{}))
  f.service.deliver(wallMilliseconds:40);f.scene.dispose()
  XCTAssertEqual(released,1);XCTAssertEqual(attempts,[false]);XCTAssertFalse(geometryChanged);XCTAssertEqual(publications,0)
  XCTAssertFalse(f.scene.sourceAnimationBindingAdmissionOpen);XCTAssertFalse(f.scene.engine.isDragging)
  XCTAssertNil(f.scene.sourceNativeTileNode("b"));XCTAssertNil(f.scene.sourceContactVisualRandom)
  XCTAssertNil(f.scene.sourceOuterTimelineDriver);XCTAssertNil(f.scene.sourceDragTweenDriver)
  XCTAssertEqual(f.service.activeParticipantCount,0);f.service.deliver(wallMilliseconds:1000);XCTAssertEqual(released,1);f.dispose()
 }
 func testSourceDisposeKeepsCapturedAtomicSmallStackFinalizerWithoutUIReentry()throws {
  let f=Fixture();_ = try f.stack();let before=f.scene.engine.state;var publications=0
  f.scene.onStateChange={_ in publications+=1};f.scene.dispose()
  XCTAssertNil(f.scene.engine.pendingOrdinaryStack);XCTAssertFalse(f.scene.engine.isDragging)
  XCTAssertEqual(f.scene.engine.state.score,before.score);XCTAssertEqual(f.scene.engine.state.moves,before.moves)
  XCTAssertEqual(f.scene.engine.state.rngState,before.rngState);XCTAssertEqual(publications,0)
  XCTAssertNil(f.scene.sourceNativeTileNode("b"));XCTAssertEqual(f.service.activeParticipantCount,0);f.dispose()
 }
 func testDestructionInsideScopeRetirementRunsFullCleanupAndProtectsNewEngineGeneration()throws {
  let f=Fixture();let node=try XCTUnwrap(f.scene.sourceNativeTileNode("b"));var released=0,newGeneration:UInt64=0
  XCTAssertTrue(node.beginSourceIdle(.init(variantDraw:0.5,directionDraw:0.5,tiltDraw:0.5),release:{
   released+=1;var next=f.scene.engine.state;next.generation+=1;newGeneration=next.generation
   f.scene.engine.restart(state:next)
   XCTAssertTrue(f.scene.engine.beginDrag(tileID:"c",pointerID:99))
   f.scene.engine.setInputLock("native-board-entry-handoff",active:true)
   f.scene.dispose()
  },onSmoke:{},onFinished:{}))
  f.service.deliver(wallMilliseconds:40);f.scene.retireSourceAnimationBindings()
  XCTAssertEqual(released,1);XCTAssertEqual(f.scene.engine.state.generation,newGeneration)
  XCTAssertTrue(f.scene.engine.isDragging);f.scene.engine.cancelDrag();XCTAssertFalse(f.scene.engine.beginDrag(tileID:"c",pointerID:100))
  XCTAssertNil(f.scene.sourceNativeTileNode("b"));XCTAssertEqual(f.service.activeParticipantCount,0)
  f.scene.engine.cancelDrag();f.scene.engine.setInputLock("native-board-entry-handoff",active:false);f.dispose()
 }
 func testRawDefaultDisposeKeepsExistingUnsealedCallbackAdmission()throws {
  let f=Fixture();f.scene.retireSourceAnimationBindings();f.scene.sourceSameNodeStackAbsorbsEnabled=false
  XCTAssertFalse(f.scene.sourceDisposalSealingEnabled);var wasOpen=false,callbacks=0
  f.scene.animateExit {completed in
   callbacks+=1;XCTAssertFalse(completed);wasOpen=f.scene.sourceAnimationBindingAdmissionOpen
   f.scene.layout(size:CGSize(width:428,height:926),insets:.zero)
  }
  f.scene.dispose();XCTAssertTrue(wasOpen);XCTAssertEqual(callbacks,1)
  XCTAssertEqual(f.scene.size,CGSize(width:428,height:926));XCTAssertNil(f.scene.sourceNativeTileNode("b"));f.dispose()
 }

 func testSourceDisposeExitCallbackIsSealedBeforeDisposedAndCannotStealNewRunDrag()throws {
  let f=Fixture(),g=try XCTUnwrap(f.scene.boardGeometry);var callbacks=0,attempts:[Bool]=[],newGeneration:UInt64=0
  f.scene.animateExit {completed in
   callbacks+=1;XCTAssertFalse(completed);XCTAssertFalse(f.scene.sourceAnimationBindingAdmissionOpen)
   var next=f.scene.engine.state;next.generation+=1;f.scene.engine.restart(state:next);newGeneration=f.scene.engine.state.generation
   XCTAssertTrue(f.scene.engine.beginDrag(tileID:"c",pointerID:99))
   f.scene.engine.setInputLock("native-board-entry-handoff",active:true)
   f.scene.configureSourceRegularContact(f.companions,admitted:{XCTFail("config during destructive source cleanup");return true})
   f.scene.synchronize();f.scene.layout(size:CGSize(width:428,height:926),insets:.zero)
   attempts.append(f.scene.beginDrag(at:g.center(row:0,column:1)))
   f.scene.moveDrag(to:g.center(row:0,column:2));XCTAssertNil(f.scene.finishDrag(at:g.center(row:0,column:2),now:0.5))
   f.scene.prepareNextBoardEntry();f.scene.evaluate();f.scene.dispose()
  }
  f.scene.dispose();XCTAssertEqual(callbacks,1);XCTAssertEqual(attempts,[false]);XCTAssertEqual(f.scene.size,CGSize(width:390,height:844))
  XCTAssertEqual(f.scene.engine.state.generation,newGeneration);XCTAssertTrue(f.scene.engine.isDragging)
  f.scene.engine.cancelDrag();XCTAssertFalse(f.scene.engine.beginDrag(tileID:"c",pointerID:100))
  f.scene.engine.setInputLock("native-board-entry-handoff",active:false)
  XCTAssertNil(f.scene.sourceNativeTileNode("b"));XCTAssertNil(f.scene.sourceContactVisualRandom);XCTAssertEqual(f.service.activeParticipantCount,0);f.dispose()
 }

 func testSourceDisposePointerReleaseRechecksGenerationBeforeRestoringOldNodeFromNewTile()throws {
  let f=Fixture(),g=try XCTUnwrap(f.scene.boardGeometry),node=try XCTUnwrap(f.scene.sourceNativeTileNode("b"))
  XCTAssertTrue(f.scene.beginDrag(at:g.center(row:0,column:1)));let capturedDepth=node.zPosition
  var callbacks=0,newGeneration:UInt64=0
  f.scene.onPointerState={active in
   guard !active else{return};callbacks+=1
   var next=f.scene.engine.state;let index=next.tiles.firstIndex{$0.id=="b"}!
   next.tiles[index].cell=NativeCell(column:1,row:7);f.scene.engine.restart(state:next);newGeneration=f.scene.engine.state.generation
   XCTAssertTrue(f.scene.engine.beginDrag(tileID:"c",pointerID:99))
  }
  f.scene.dispose();XCTAssertEqual(callbacks,1);XCTAssertEqual(f.scene.engine.state.generation,newGeneration)
  XCTAssertEqual(node.zPosition,capturedDepth);XCTAssertTrue(f.scene.engine.isDragging)
  XCTAssertEqual(f.scene.engine.state.tiles.first{$0.id=="b"}?.cell,NativeCell(column:1,row:7))
  XCTAssertNil(f.scene.sourceNativeTileNode("b"));XCTAssertEqual(f.service.activeParticipantCount,0)
  f.scene.engine.cancelDrag();f.dispose()
 }
}
