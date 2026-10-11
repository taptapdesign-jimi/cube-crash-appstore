import XCTest
import SpriteKit
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceDirectPrefixNodeTests:XCTestCase {
 @MainActor private final class Fixture {
  let service:NativeSourceAnimationClockService,context:NativeGameplaySourceContext,scope:NativeGameplaySourceContext.Scope,scene:NativeBoardScene,view:SKView
  init(final:Bool,sourceWild:Bool=true)throws {
   service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
   context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{0.5})
   let src=NativeTile(id:"src",cell:.init(column:0,row:0),value:sourceWild ? 6:4,stackDepth:2,archetype:sourceWild ? .star:nil,variant:sourceWild ? "fish":nil)
   let dst=NativeTile(id:"dst",cell:.init(column:1,row:0),value:sourceWild ? 4:6,stackDepth:3,archetype:sourceWild ? nil:.star,variant:sourceWild ? nil:"fish")
   let engine=NativeGameplayEngine(state:.init(tiles:[src,dst]+(final ? []:[.init(id:"other",cell:.init(column:4,row:8),value:3)])))
   engine.stagedDirectWildMoves=true;engine.stagedDirectWildAssignments=true
   // Component projection: genuine canonical reservation before installing
   // Scene's deliberately closed whole-direct presentation admission gate.
   XCTAssertTrue(engine.beginDrag(tileID:"src"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
   XCTAssertNotNil(engine.pendingDirectWild)
   scene=NativeBoardScene(engine:engine,resourceRoot:Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle"),size:.init(width:390,height:844))
   let capturedScene=scene
   scope=try XCTUnwrap(context.beginScene(engine:engine,retire:{[weak capturedScene] in capturedScene?.retireSourceAnimationBindings()}))
   scene.sourceOuterTimelineDriver=scope.timeline;scene.sourceDragTweenDriver=scope.tween
   scene.sourceSameNodeStackAbsorbsEnabled=true;scene.sourceContactVisualRandom={0.5}
   scene.configureSourceRegularStackHandoff(service:service,admitted:{true})
   scene.layout(size:scene.size,insets:.init(top:47,left:0,bottom:34,right:0))
   view=SKView(frame:.init(x:0,y:0,width:390,height:844));view.presentScene(scene)
   if sourceWild {
    let target=try XCTUnwrap(scene.sourceNativeTileNode("dst"))
    XCTAssertTrue(target.queueSourceStackValue(4,addStack:0,service:service,random:{0.5},current:{true}))
    service.deliver(wallMilliseconds:16)
   }
  }
  func prefix()throws->NativeSourceDirectWildPrefixReceipt {
   let plan=try XCTUnwrap(scene.engine.pendingDirectWild)
   XCTAssertTrue(scene.engine.prepareSourceDirectWildPrefix(receiptID:plan.id,generation:plan.generation).accepted)
   return try XCTUnwrap(scene.engine.sourceDirectWildPrefix)
  }
  func dispose(){scene.dispose();context.dispose();service.dispose()}
 }
 func testActualRegularDestinationProjectionRetainsObjectAndFinalParentVisibilityAcrossFaceRAF()throws {
  let f=try Fixture(final:true);defer{f.dispose()};let node=try XCTUnwrap(f.scene.sourceNativeTileNode("dst")),prefix=try f.prefix(),parent=node.parent
  XCTAssertTrue(node.prepareSourceDirectWildRegularDestination(prefix,service:f.service,random:{0.5},onFaceCancelled:{}))
  XCTAssertEqual(node.value,6);XCTAssertEqual(node.depth,1);XCTAssertTrue(node.sourceWildStateCleared);XCTAssertTrue(node.parent === parent)
  XCTAssertFalse(node.isHidden);XCTAssertTrue(node.visual.isHidden);XCTAssertFalse(node.hasAnimatedArtwork)
  f.service.deliver(wallMilliseconds:25)
  XCTAssertFalse(node.isHidden);XCTAssertTrue(node.visual.isHidden);XCTAssertEqual(node.sourceEventMode,"none");XCTAssertNotNil(f.scene.engine.pendingDirectWild)
 }
 func testActualRegularNonfinalProjectionUsesCapturedDepthAndPendingRealFace()throws {
  let f=try Fixture(final:false);defer{f.dispose()};let node=try XCTUnwrap(f.scene.sourceNativeTileNode("dst")),prefix=try f.prefix()
  XCTAssertTrue(node.prepareSourceDirectWildRegularDestination(prefix,service:f.service,random:{0.5},onFaceCancelled:{}))
  XCTAssertEqual(node.value,6);XCTAssertEqual(node.depth,4);XCTAssertGreaterThan(node.sourcePendingStackFrameCount,0)
  f.service.deliver(wallMilliseconds:25)
  XCTAssertEqual(node.sourcePendingStackFrameCount,0);XCTAssertFalse(node.visual.isHidden);XCTAssertTrue(node.sourceWildStateCleared)
 }
 func testWildDestinationWithoutActualRetainedRegularBackingIsRefusedWithoutRebuild()throws {
  let f=try Fixture(final:true,sourceWild:false);defer{f.dispose()};let node=try XCTUnwrap(f.scene.sourceNativeTileNode("dst")),texture=node.sourcePaintedNumbersTexture,prefix=try f.prefix()
  XCTAssertFalse(node.prepareSourceDirectWildRegularDestination(prefix,service:f.service,random:{XCTFail("No replacement skin draw admitted");return 0.5},onFaceCancelled:{}))
  XCTAssertTrue(node.sourcePaintedNumbersTexture === texture);XCTAssertFalse(node.sourceWildStateCleared);XCTAssertEqual(node.variant,"fish")
 }
}
