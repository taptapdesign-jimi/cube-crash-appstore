import XCTest
import SpriteKit
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

/// PRIVATE Source small-stack routing only; Six/direct destructive owner is not
/// admitted. All elapsed delivery is the injected APP service, never Scene.update.
@MainActor final class NativeSameNodeStackSceneTests:XCTestCase {
 private var root:URL{Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")}
 @MainActor private struct Fixture {
  let service:NativeSourceAnimationClockService,outer:NativeSourceOuterTimelineAdapter,drag:NativeSourceDragTweenAdapter,scene:NativeBoardScene
  func dispose(){scene.dispose();outer.dispose();drag.dispose();service.dispose()}
 }
 private func fixture(destination:Int=2)->Fixture {
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0}),outer=NativeSourceOuterTimelineAdapter(service:service),drag=NativeSourceDragTweenAdapter(service:service)
  let state=NativeBoardState(columns:5,rows:9,tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1),.init(id:"b",cell:.init(column:1,row:0),value:destination),.init(id:"c",cell:.init(column:2,row:0),value:4)])
  let scene=NativeBoardScene(engine:NativeGameplayEngine(state:state),resourceRoot:root,size:CGSize(width:390,height:844))
  scene.sourceOuterTimelineDriver=outer;scene.sourceDragTweenDriver=drag;scene.sourceSameNodeStackAbsorbsEnabled=true;scene.sourceStackAbsorbAdmission={_,_ in true};scene.sourceContactVisualRandom={0.5}
  scene.layout(size:scene.size,insets:UIEdgeInsets(top:47,left:0,bottom:34,right:0))
  return Fixture(service:service,outer:outer,drag:drag,scene:scene)
 }
 private func point(_ f:Fixture,_ column:Int)throws->CGPoint{try XCTUnwrap(f.scene.boardGeometry).center(row:0,column:column)}
 @discardableResult private func stack(_ f:Fixture,upMilliseconds:Double=25)throws->NativeMoveResult {
  XCTAssertTrue(f.scene.beginDrag(at:try point(f,0)));f.service.deliver(wallMilliseconds:upMilliseconds)
  f.scene.moveDrag(to:try point(f,1),now:upMilliseconds/1000)
  return try XCTUnwrap(f.scene.finishDrag(at:try point(f,1),now:upMilliseconds/1000))
 }
 func testActualSameFullNodeRetainedAcrossAcceptedModelRemovalAndRepeatedSynchronizationUntilMain80() throws {
  let f=fixture();defer{f.dispose()};let original=try XCTUnwrap(f.scene.sourceNativeTileNode("a")),family=SKNode();original.visual.addChild(family)
  XCTAssertTrue(try stack(f).accepted);let score=f.scene.engine.state.score
  XCTAssertNotNil(f.scene.engine.pendingOrdinaryStack);XCTAssertTrue(f.scene.sourceNativeTileNode("a") === original);XCTAssertTrue(family.parent === original.visual)
  f.service.deliver(wallMilliseconds:30);let painted=original.position
  f.scene.synchronize();f.scene.synchronize()
  XCTAssertEqual(original.position,painted);XCTAssertTrue(f.scene.sourceNativeTileNode("a") === original)
  f.service.deliver(wallMilliseconds:104);XCTAssertNotNil(f.scene.engine.pendingOrdinaryStack)
  f.service.deliver(wallMilliseconds:105);XCTAssertNil(f.scene.engine.pendingOrdinaryStack);XCTAssertNil(f.scene.sourceNativeTileNode("a"));XCTAssertEqual(f.scene.engine.state.score,score)
 }
 func testActualRapid25msPickupOverlapMatchesPinnedSourceScaleAndKeepsCapturedFamily() throws {
  let f=fixture();defer{f.dispose()};let node=try XCTUnwrap(f.scene.sourceNativeTileNode("a")),family=SKNode();node.visual.addChild(family);family.zRotation=0.21
  XCTAssertTrue(try stack(f).accepted);f.service.deliver(wallMilliseconds:30)
  XCTAssertEqual(node.sourceLocalScale.x,1.112253,accuracy:1e-6);XCTAssertEqual(node.sourceLocalScale.y,1.077713,accuracy:1e-6)
  XCTAssertTrue(family.parent === node.visual);XCTAssertEqual(family.zRotation,CGFloat(Float(0.21)),accuracy:1e-8)
 }
 func testPurePauseRetainsMainReceiptAndResumeUsesSourceGlobalTimelineDomain() throws {
  let f=fixture();defer{f.dispose()};_ = try stack(f);let before=f.scene.engine.state
  f.scene.setSuspended(true);f.service.setSourceGlobalPaused(true)
  f.service.deliver(wallMilliseconds:400);XCTAssertEqual(f.scene.engine.state,before);XCTAssertNotNil(f.scene.engine.pendingOrdinaryStack)
  f.service.setSourceGlobalPaused(false);f.scene.setSuspended(false)
  f.service.deliver(wallMilliseconds:480);XCTAssertNil(f.scene.engine.pendingOrdinaryStack)
 }
 func testDestructiveSceneDisposeBeforeMainRegistrationAtomicallySettlesAcceptedSmallStackOnce() throws {
  let f=fixture();defer{f.dispose()};var disposed=false
  f.scene.onStateChange={_ in if !disposed{disposed=true;f.scene.dispose()}}
  XCTAssertTrue(try stack(f).accepted)
  XCTAssertNil(f.scene.engine.pendingOrdinaryStack);XCTAssertFalse(f.scene.engine.state.tiles.contains{$0.id=="a"});XCTAssertEqual(f.scene.engine.state.tile(at:.init(column:1,row:0))?.value,3)
  XCTAssertEqual(f.service.activeParticipantCount,0);f.service.deliver(wallMilliseconds:500);XCTAssertEqual(f.scene.engine.state.tile(at:.init(column:1,row:0))?.value,3)
 }
 func testUnadmittedSixRejectsBeforeCoreCaptureOrVisualRandomDraws() throws {
  let f=fixture(destination:5);defer{f.dispose()};let before=f.scene.engine.state;var draws=0
  f.scene.sourceContactVisualRandom={draws+=1;return 0.5}
  let result=try stack(f);XCTAssertFalse(result.accepted);XCTAssertEqual(result.events.first?.reason,"source_same_node_absorb_not_admitted");XCTAssertEqual(f.scene.engine.state,before);XCTAssertEqual(draws,0);XCTAssertNil(f.scene.engine.pendingOrdinarySix)
 }
 func testBoundedImpactDrawsVariantThenVariationAndOwnsDestinationScaleNotSourceInnerFeedback() throws {
  let f=fixture();defer{f.dispose()};var draws:[Double]=[]
  f.scene.sourceContactVisualRandom={let value=draws.isEmpty ? 0.2:0.7;draws.append(value);return value}
  _ = try stack(f);let target=try XCTUnwrap(f.scene.sourceNativeTileNode("b"))
  XCTAssertEqual(draws,[0.2,0.7]);XCTAssertTrue(target.sourceOuterOwners.mergeImpact)
  XCTAssertNil(target.visual.action(forKey:"stack"));f.service.deliver(wallMilliseconds:90);XCTAssertTrue(target.sourceOuterOwners.mergeImpact)
 }
}
