import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceStackPhysicalFaceSceneTests:XCTestCase {
 @MainActor private final class Counter {var depths:[Int]=[];var drawCount=0;var sample:(()->Int)?;func next()->Double{drawCount+=1;if let sample {depths.append(sample())};return 0.5}}
 @MainActor private final class Fixture {
  let service:NativeSourceAnimationClockService,scene:NativeBoardScene,outer:NativeSourceOuterTimelineAdapter,tween:NativeSourceDragTweenAdapter,session:NativeSharedSmokeRootSession,smoke:NativeSharedSmokeRootRenderer,companions:NativeRegularContactSceneCompanions,counter:Counter
  init(core:Bool=true,caller:Bool=true) {
   let counter=Counter();self.counter=counter
   service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true);outer=NativeSourceOuterTimelineAdapter(service:service);tween=NativeSourceDragTweenAdapter(service:service)
   session=NativeSharedSmokeRootSession(appOriginMilliseconds:0,visualRandom:{counter.next()});smoke=session.makeRenderer(service:service);companions=NativeRegularContactSceneCompanions(session:session,smoke:smoke,tween:tween,timeline:outer,monotonicMillisecondsNow:{0})
   var state=NativeBoardState(columns:5,rows:9,tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1),.init(id:"b",cell:.init(column:1,row:0),value:2),.init(id:"c",cell:.init(column:2,row:0),value:1),.init(id:"far",cell:.init(column:4,row:8),value:5)],rngState:12345);state.maxStackDepth=1
   let engine=NativeGameplayEngine(state:state);engine.sourceOrdinaryStackFacesEnabled=core
   scene=NativeBoardScene(engine:engine,resourceRoot:Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle"),size:CGSize(width:390,height:844))
   scene.sourceOuterTimelineDriver=outer;scene.sourceDragTweenDriver=tween;scene.configureSourceRegularContact(companions,admitted:{true});scene.sourceSameNodeStackAbsorbsEnabled=true;scene.configureSourceRegularStackHandoff(service:service,admitted:{true});scene.sourceRegularStackHandoffEnabled=true;scene.sourceStackCoreFaceReceiptsEnabled=caller
   scene.layout(size:scene.size,insets:.init(top:47,left:0,bottom:34,right:0));counter.sample={ [weak engine] in engine?.state.tiles.first{$0.id=="b"}?.stackDepth ?? -1}
  }
  func point(_ column:Int)throws->CGPoint {try XCTUnwrap(scene.boardGeometry).center(row:0,column:column)}
  func contact()throws {XCTAssertTrue(scene.beginDrag(at:try point(0)));service.deliver(wallMilliseconds:25);scene.moveDrag(to:try point(1),now:0.025);XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:try point(1),now:0.025)).accepted)}
  func dispose(){scene.dispose();companions.dispose();outer.dispose();tween.dispose();service.dispose()}
 }
 func testActualSameNodeFrameCommitsCorePhysicalDepthAndMaxAfterSkinBeforeLayers()throws {
  let f=Fixture();defer{f.dispose()};try f.contact();let b=try XCTUnwrap(f.scene.sourceNativeTileNode("b")),before=f.counter.depths.count,rng=f.scene.engine.state.rngState
  XCTAssertEqual(b.value,3);XCTAssertEqual(b.depth,1);XCTAssertEqual(f.scene.engine.state.tiles.first{$0.id=="b"}?.stackDepth,1);XCTAssertEqual(f.scene.engine.state.maxStackDepth,1)
  f.service.deliver(wallMilliseconds:41)
  XCTAssertEqual(Array(f.counter.depths.dropFirst(before)),[1,2,2,2,2]);XCTAssertEqual(b.depth,2);XCTAssertEqual(b.sourcePipNodes.count,3);XCTAssertEqual(f.scene.engine.state.tiles.first{$0.id=="b"}?.stackDepth,2);XCTAssertEqual(f.scene.engine.state.maxStackDepth,2);XCTAssertEqual(f.scene.engine.state.rngState,rng);XCTAssertTrue(f.scene.engine.pendingSourceOrdinaryStackFaces.isEmpty)
 }
 func testSource80FirstInActualFrameCannotPublishEarlierPhysicalMaxThanSiblingFace()throws {
  let f=Fixture();defer{f.dispose()};try f.contact();var observedBeforeFace=false,observedAfterFace=false
  f.scene.onStateChange={ state in
   guard f.scene.engine.pendingOrdinaryStack==nil else{return}
   if f.scene.engine.hasPendingSourceOrdinaryStackFace {observedBeforeFace=true;XCTAssertEqual(state.maxStackDepth,1);XCTAssertEqual(f.scene.sourceNativeTileNode("b")?.depth,1);XCTAssertTrue(f.scene.engine.hasUnsavableSourceGameplayState)}
   else {observedAfterFace=true;XCTAssertEqual(state.maxStackDepth,2);XCTAssertEqual(f.scene.sourceNativeTileNode("b")?.depth,2)}
  }
  f.service.deliver(wallMilliseconds:105);XCTAssertTrue(observedBeforeFace);XCTAssertTrue(observedAfterFace)
 }
 func testGlobalPauseDeliversGenuineFaceButNeverInventsMain80Completion()throws {
  let f=Fixture();defer{f.dispose()};try f.contact();f.scene.setSuspended(true);f.service.setSourceGlobalPaused(true)
  f.service.deliver(wallMilliseconds:141);XCTAssertEqual(f.scene.sourceNativeTileNode("b")?.depth,2);XCTAssertEqual(f.scene.engine.state.maxStackDepth,2);XCTAssertNotNil(f.scene.engine.pendingOrdinaryStack);XCTAssertEqual(f.scene.engine.state.moves,50)
 }
 func testCoreCallerFeatureMismatchFailsBeforeAnyAcceptedMutationOrContactRNG()throws {
  for pair in [(true,false),(false,true)] {
   let f=Fixture(core:pair.0,caller:pair.1);defer{f.dispose()};XCTAssertTrue(f.scene.beginDrag(at:try f.point(0)));f.service.deliver(wallMilliseconds:25);f.scene.moveDrag(to:try f.point(1),now:0.025);let before=f.scene.engine.state,draws=f.counter.drawCount
   XCTAssertFalse(try XCTUnwrap(f.scene.finishDrag(at:try f.point(1),now:0.025)).accepted);XCTAssertEqual(f.scene.engine.state,before);XCTAssertEqual(f.counter.drawCount,draws);XCTAssertTrue(f.scene.engine.pendingSourceOrdinaryStackFaces.isEmpty)
  }
 }
 func testCapturedScopeRetirementCannotSaveCancelledLivePartialFaceOrReviveThroughLateRAF()throws {
  let f=Fixture();defer{f.dispose()};try f.contact();let b=try XCTUnwrap(f.scene.sourceNativeTileNode("b")),texture=b.sourcePaintedNumbersTexture
  f.scene.retireSourceAnimationBindings();XCTAssertEqual(b.depth,1);XCTAssertEqual(f.scene.engine.state.maxStackDepth,1);XCTAssertTrue(f.scene.engine.hasUnsavableSourceGameplayState);XCTAssertEqual(f.scene.engine.unsettledSourceOrdinaryStackFaceCancellations.count,1)
  let before=f.scene.engine.state;f.service.deliver(wallMilliseconds:141);XCTAssertEqual(f.scene.engine.state,before);XCTAssertTrue(b.sourcePaintedNumbersTexture === texture)
 }
 func testActualWallPostcheckElapsedUnderBackgroundResumesAfterRealFaceWithoutSecond100msWait()async throws {
  let f=Fixture();defer{f.dispose()};try f.contact();var hid=false
  f.scene.onStateChange={ _ in if !hid,f.scene.engine.pendingOrdinaryStack==nil,f.scene.engine.hasPendingSourceOrdinaryStackFace {hid=true;f.service.setSourceForeground(false)}}
  f.service.deliver(wallMilliseconds:105);XCTAssertTrue(hid);XCTAssertEqual(f.scene.sourceNativeTileNode("b")?.depth,1)
  try await Task.sleep(nanoseconds:180_000_000)
  XCTAssertEqual(f.scene.engine.state.moves,50);XCTAssertEqual(f.scene.engine.pendingOrdinaryPostchecks.count,1)
  f.service.setSourceForeground(true);f.service.deliver(wallMilliseconds:121)
  XCTAssertEqual(f.scene.sourceNativeTileNode("b")?.depth,2);XCTAssertEqual(f.scene.engine.state.moves,49);XCTAssertTrue(f.scene.engine.pendingOrdinaryPostchecks.isEmpty)
 }
}
