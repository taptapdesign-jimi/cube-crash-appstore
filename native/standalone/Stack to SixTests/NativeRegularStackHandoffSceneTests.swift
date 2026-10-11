import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeRegularStackHandoffSceneTests:XCTestCase {
 @MainActor private final class Counter {var draws=0;func next()->Double{draws+=1;return 0.5}}
 @MainActor private final class Fixture {
  let service:NativeSourceAnimationClockService,scene:NativeBoardScene,outer:NativeSourceOuterTimelineAdapter,tween:NativeSourceDragTweenAdapter,session:NativeSharedSmokeRootSession,smoke:NativeSharedSmokeRootRenderer,companions:NativeRegularContactSceneCompanions,counter:Counter
  init(sourceDepth:Int=1,destinationDepth:Int=1,frames:Bool=true,feature:Bool=true,primeCombo:Bool=false) {
   service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:frames)
   outer=NativeSourceOuterTimelineAdapter(service:service);tween=NativeSourceDragTweenAdapter(service:service)
   let counter=Counter();self.counter=counter
   session=NativeSharedSmokeRootSession(appOriginMilliseconds:0,visualRandom:{counter.next()});smoke=session.makeRenderer(service:service)
   companions=NativeRegularContactSceneCompanions(session:session,smoke:smoke,tween:tween,timeline:outer,monotonicMillisecondsNow:{0})
   var state=NativeBoardState(columns:5,rows:9,tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1,stackDepth:sourceDepth),.init(id:"b",cell:.init(column:1,row:0),value:2,stackDepth:destinationDepth),.init(id:"c",cell:.init(column:2,row:0),value:1),.init(id:"far",cell:.init(column:4,row:8),value:5)])
   state.maxStackDepth=max(sourceDepth,destinationDepth)
   if primeCombo {state.tiles += [.init(id:"d",cell:.init(column:4,row:6),value:1),.init(id:"e",cell:.init(column:4,row:7),value:1)]}
   let engine=NativeGameplayEngine(state:state)
   if primeCombo {precondition(engine.beginDrag(tileID:"d",pointerID:9));precondition(engine.drop(target:.init(column:4,row:7),pointerID:9,now:0).accepted)}
   scene=NativeBoardScene(engine:engine,resourceRoot:Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle"),size:CGSize(width:390,height:844))
   scene.sourceOuterTimelineDriver=outer;scene.sourceDragTweenDriver=tween;scene.configureSourceRegularContact(companions,admitted:{true});scene.sourceSameNodeStackAbsorbsEnabled=true
   scene.configureSourceRegularStackHandoff(service:service,admitted:{true});scene.sourceRegularStackHandoffEnabled=feature
   scene.layout(size:scene.size,insets:.init(top:47,left:0,bottom:34,right:0))
  }
  func point(_ column:Int)throws->CGPoint{try XCTUnwrap(scene.boardGeometry).center(row:0,column:column)}
  func pickup()throws{XCTAssertTrue(scene.beginDrag(at:try point(0)));service.deliver(wallMilliseconds:25);scene.moveDrag(to:try point(1),now:0.025)}
  @discardableResult func contact()throws->NativeMoveResult{try pickup();return try XCTUnwrap(scene.finishDrag(at:try point(1),now:0.025))}
  func dispose(){scene.dispose();companions.dispose();outer.dispose();tween.dispose();service.dispose()}
 }
 func testImmediateValueOldPhysicalDepthAndMaxCounterConvergeOnlyOnRealFaceRAF()throws {
  let f=Fixture();defer{f.dispose()};let b=try XCTUnwrap(f.scene.sourceNativeTileNode("b")),oldTexture=b.sourcePaintedNumbersTexture
  var soundDraws:Int?
  f.scene.onGameplayReceipt={event,_,_,_ in if event.kind == .merged {soundDraws=f.counter.draws;XCTAssertTrue(b.sourceOuterOwners.mergeImpact);XCTAssertEqual(f.scene.sourceRegularStackFeedbackRootCount,0)}}
  XCTAssertTrue(try f.contact().accepted);XCTAssertEqual(b.value,3);XCTAssertEqual(b.depth,1);XCTAssertTrue(b.sourceStackLayerNodes.isEmpty);XCTAssertTrue(b.sourcePaintedNumbersTexture === oldTexture)
  XCTAssertEqual(f.scene.engine.state.maxStackDepth,2);XCTAssertEqual(b.sourceMaxStackDepth,1);XCTAssertEqual(f.scene.engine.resolve().kind,.wait);XCTAssertTrue(f.scene.engine.hasUnsavableSourceGameplayState)
  let before=try XCTUnwrap(soundDraws);XCTAssertEqual(f.counter.draws,before)
  f.service.deliver(wallMilliseconds:41);XCTAssertEqual(b.depth,2);XCTAssertEqual(b.sourceMaxStackDepth,2);XCTAssertEqual(f.counter.draws-before,5);XCTAssertEqual(b.sourcePipNodes.count,3)
 }
 func testOldStackSuffixBeginsAfterAudioThenFaceReplacesCapturedChildrenWithoutCancellingFiniteTail()throws {
  let f=Fixture(sourceDepth:2,destinationDepth:2);defer{f.dispose()};let b=try XCTUnwrap(f.scene.sourceNativeTileNode("b")),oldChildren=b.sourceStackLayerNodes
  var audioDraws:Int?,audioCount=0
  f.scene.onGameplayReceipt={event,_,_,_ in if event.kind == .merged {audioCount+=1;audioDraws=f.counter.draws;XCTAssertEqual(f.scene.sourceRegularStackFeedbackRootCount,0);XCTAssertFalse(b.sourceStackLayerNodes.contains{$0.name=="source-stack-contact-overlay"})}}
  XCTAssertTrue(try f.contact().accepted);XCTAssertEqual(audioCount,1);XCTAssertEqual(f.counter.draws-(try XCTUnwrap(audioDraws)),2)
  XCTAssertEqual(f.scene.sourceRegularStackFeedbackRootCount,oldChildren.count*2);XCTAssertEqual(b.depth,2);XCTAssertTrue(b.sourceStackLayerNodes.contains{$0.name=="source-stack-contact-overlay"})
  f.service.deliver(wallMilliseconds:41);XCTAssertEqual(b.depth,4);XCTAssertEqual(b.sourceMaxStackDepth,4);XCTAssertTrue(oldChildren.allSatisfy{$0.parent==nil});XCTAssertFalse(b.sourceStackLayerNodes.contains{$0.name=="source-stack-contact-overlay"})
  XCTAssertGreaterThan(f.scene.sourceRegularStackFeedbackRootCount,0)
  for milliseconds in stride(from:57,through:681,by:16){f.service.deliver(wallMilliseconds:Double(milliseconds))}
  XCTAssertEqual(f.scene.sourceRegularStackFeedbackRootCount,0);XCTAssertNil(f.scene.engine.pendingOrdinaryStack)
 }
 func testRAFDisabledServiceRefusesBeforeCoreScoreMovesRandomOrPhysicalMutation()throws {
  let f=Fixture(frames:false);defer{f.dispose()};try f.pickup();let before=f.scene.engine.state,b=try XCTUnwrap(f.scene.sourceNativeTileNode("b")),texture=b.sourcePaintedNumbersTexture,draws=f.counter.draws
  let result=try XCTUnwrap(f.scene.finishDrag(at:try f.point(1),now:0.025));XCTAssertFalse(result.accepted);XCTAssertEqual(f.scene.engine.state,before);XCTAssertEqual(f.counter.draws,draws);XCTAssertEqual(b.depth,1);XCTAssertTrue(b.sourcePaintedNumbersTexture === texture);XCTAssertEqual(b.sourcePendingStackFrameCount,0)
 }
 func testPhysicalDepthMismatchRefusesInsteadOfReadingPrecommittedCoreDepth()throws {
  let f=Fixture();defer{f.dispose()};try f.pickup();let b=try XCTUnwrap(f.scene.sourceNativeTileNode("b"));b.sourceStackDepth=3;let before=f.scene.engine.state,draws=f.counter.draws
  let result=try XCTUnwrap(f.scene.finishDrag(at:try f.point(1),now:0.025));XCTAssertFalse(result.accepted);XCTAssertEqual(f.scene.engine.state,before);XCTAssertEqual(f.counter.draws,draws);XCTAssertEqual(b.sourcePendingStackFrameCount,0)
 }
 func testExternalReadinessMutationOfSameGenerationCoreInvalidatesCapturedDropDecision()throws {
  let f=Fixture(primeCombo:true);defer{f.dispose()};try f.pickup();let old=f.scene.engine.state
  f.scene.configureSourceRegularStackHandoff(service:f.service,admitted:{f.scene.engine.expireCombo(now:10);return true})
  let result=try XCTUnwrap(f.scene.finishDrag(at:try f.point(1),now:0.025));XCTAssertFalse(result.accepted);XCTAssertEqual(f.scene.engine.state.generation,old.generation);XCTAssertEqual(f.scene.engine.state.revision,old.revision);XCTAssertEqual(f.scene.engine.state.combo,0);XCTAssertEqual(f.scene.engine.state.score,old.score);XCTAssertEqual(f.scene.engine.state.moves,old.moves);XCTAssertNil(f.scene.engine.pendingOrdinaryStack);XCTAssertEqual(f.counter.draws,0)
 }
 func testRapidPickupBeforeRAFSeesImmediateValueAndCoreHandoffRejectsMerge()throws {
  let f=Fixture();defer{f.dispose()};XCTAssertTrue(try f.contact().accepted);let b=try XCTUnwrap(f.scene.sourceNativeTileNode("b"))
  XCTAssertEqual(b.value,3);XCTAssertEqual(b.depth,1);XCTAssertTrue(f.scene.beginDrag(at:try f.point(1)));f.scene.moveDrag(to:try f.point(2),now:0.026)
  let rejected=try XCTUnwrap(f.scene.finishDrag(at:try f.point(2),now:0.026));XCTAssertFalse(rejected.accepted);XCTAssertEqual(f.scene.engine.state.tiles.first{$0.id=="b"}?.value,3)
  f.service.deliver(wallMilliseconds:41);f.service.deliver(wallMilliseconds:141);XCTAssertNil(f.scene.engine.pendingOrdinaryStack)
  XCTAssertTrue(f.scene.beginDrag(at:try f.point(1)));f.scene.moveDrag(to:try f.point(2),now:0.142);XCTAssertTrue(try XCTUnwrap(f.scene.finishDrag(at:try f.point(2),now:0.142)).accepted);XCTAssertEqual(f.scene.engine.pendingOrdinaryStack?.source.stackDepth,2)
 }
 func testForegroundGlobalPauseDeliversFaceWithoutInventingSource80Arrival()throws {
  let f=Fixture();defer{f.dispose()};XCTAssertTrue(try f.contact().accepted);f.scene.setSuspended(true);f.service.setSourceGlobalPaused(true)
  f.service.deliver(wallMilliseconds:141);XCTAssertEqual(f.scene.sourceNativeTileNode("b")?.depth,2);XCTAssertNotNil(f.scene.engine.pendingOrdinaryStack);XCTAssertEqual(f.scene.engine.state.moves,50)
  f.scene.setSuspended(false);f.service.setSourceGlobalPaused(false);f.service.deliver(wallMilliseconds:281);XCTAssertNil(f.scene.engine.pendingOrdinaryStack)
 }
 func testDefaultOffKeepsExistingComponentContactAndImmediateRawDepth()throws {
  let f=Fixture(feature:false);defer{f.dispose()};XCTAssertTrue(try f.contact().accepted);let b=try XCTUnwrap(f.scene.sourceNativeTileNode("b"))
  XCTAssertEqual(b.depth,2);XCTAssertEqual(b.sourcePendingStackFrameCount,0);XCTAssertEqual(f.scene.sourceRegularStackFeedbackRootCount,0)
 }
 func testRetirementCancelsOnlyCapturedFaceAndFeedbackAndDoesNotPaintReplacement()throws {
  let f=Fixture(sourceDepth:2,destinationDepth:2);defer{f.dispose()};XCTAssertTrue(try f.contact().accepted);let old=try XCTUnwrap(f.scene.sourceNativeTileNode("b")),draws=f.counter.draws
  f.scene.retireSourceAnimationBindings();XCTAssertEqual(old.sourcePendingStackFrameCount,0);XCTAssertEqual(f.scene.sourceRegularStackFeedbackRootCount,0)
  let oldTexture=old.sourcePaintedNumbersTexture,oldDepth=old.depth
  f.service.deliver(wallMilliseconds:141);XCTAssertEqual(f.counter.draws,draws);XCTAssertEqual(old.depth,oldDepth);XCTAssertTrue(old.sourcePaintedNumbersTexture === oldTexture)
 }
}
