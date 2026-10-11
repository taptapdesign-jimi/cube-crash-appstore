import XCTest
import UIKit
import SpriteKit
@testable import Stack_to_Six

@MainActor final class NativeRegularStackFeedbackNodeTests:XCTestCase {
 @MainActor private final class Fixture {
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true),canvas=SKNode()
  let textures:NativeBoardTextures,node:NativeDiceNode,outer:NativeSourceOuterTimelineAdapter,bridge:NativeRegularStackFeedbackNodeBridge
  var draws=0
  init(){textures=NativeBoardTextures(root:Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle"));node=NativeDiceNode(id:"suffix",value:2,kind:"regular",variant:nil,depth:2,locked:false,textures:textures);outer=NativeSourceOuterTimelineAdapter(service:service);canvas.addChild(node);node.installSourceOuterDriver(outer,generation:1,geometryScale:0.5);bridge=NativeRegularStackFeedbackNodeBridge(tile:node,service:service,current:{true})}
  func dispose(){bridge.dispose();node.dispose();outer.dispose();service.dispose();textures.dispose()}
 }
 func testActualOldChildCaptureAppendsOriginalBrownRectangleThenRotationAndDelayedFade()throws {
  let f=Fixture();defer{f.dispose()};let old=try XCTUnwrap(f.node.sourceStackLayerNodes.first),position=old.position,rotation=old.zRotation
  XCTAssertTrue(f.bridge.play(sourceDepth:2,random:{f.draws+=1;return 0.5}));XCTAssertEqual(f.draws,2);XCTAssertEqual(f.bridge.activeRootCount,2)
  let overlay=try XCTUnwrap(f.node.sourceStackLayerNodes.last as? SKShapeNode);XCTAssertFalse(overlay === old);XCTAssertEqual(overlay.position,position);XCTAssertEqual(overlay.zRotation,rotation,accuracy:1e-6);XCTAssertEqual(overlay.zPosition,-1);XCTAssertEqual(overlay.alpha,1)
  f.service.deliver(wallMilliseconds:100);XCTAssertNotEqual(old.zRotation,rotation);XCTAssertEqual(overlay.alpha,1)
  f.service.deliver(wallMilliseconds:200);f.service.deliver(wallMilliseconds:400);XCTAssertEqual(overlay.alpha,CGFloat(Float(0.25)),accuracy:1e-6)
  f.service.deliver(wallMilliseconds:601);XCTAssertNil(overlay.parent);XCTAssertEqual(f.bridge.activeRootCount,0)
 }
 func testFaceRAFIdentityReplacementRetiresOldChildrenWithoutCancellingSourceFiniteTail()throws {
  let f=Fixture();defer{f.dispose()};let old=try XCTUnwrap(f.node.sourceStackLayerNodes.first)
  XCTAssertTrue(f.bridge.play(sourceDepth:2,random:{0.5}));XCTAssertTrue(f.node.queueSourceStackValue(4,addStack:1,service:f.service,random:{0.5},current:{true}))
  f.service.deliver(wallMilliseconds:16);let new=try XCTUnwrap(f.node.sourceStackLayerNodes.first),pose=new.zRotation;XCTAssertFalse(old === new);XCTAssertEqual(f.bridge.activeRootCount,2)
  old.removeFromParent();f.node.sourceStackContainer.addChild(old) // Source destroyed-object cannot revive by reparenting
  let retiredPose=old.zRotation;f.service.deliver(wallMilliseconds:32);XCTAssertEqual(old.zRotation,retiredPose);XCTAssertEqual(new.zRotation,pose);XCTAssertEqual(f.bridge.activeRootCount,2)
 }
 func testSourceDepthOneBranchConsumesNoSuffixDrawsShapesOrClockRoots()throws {
  let f=Fixture();defer{f.dispose()};let count=f.node.sourceStackLayerNodes.count
  XCTAssertTrue(f.bridge.play(sourceDepth:1,random:{f.draws+=1;return 0.5}));XCTAssertEqual(f.draws,0);XCTAssertEqual(f.node.sourceStackLayerNodes.count,count);XCTAssertEqual(f.bridge.activeRootCount,0);XCTAssertEqual(f.service.activeParticipantCount,0)
 }
 func testActualNodeDisposalAndBridgeRetirementCannotPaintReplacementSameID()throws {
  let f=Fixture();XCTAssertTrue(f.bridge.play(sourceDepth:2,random:{0.5}));f.node.dispose();f.bridge.dispose()
  let replacement=NativeDiceNode(id:"suffix",value:5,kind:"regular",variant:nil,depth:2,locked:false,textures:f.textures);f.canvas.addChild(replacement);let layer=try XCTUnwrap(replacement.sourceStackLayerNodes.first),pose=layer.zRotation
  f.service.deliver(wallMilliseconds:100);XCTAssertEqual(layer.zRotation,pose);XCTAssertEqual(f.bridge.activeRootCount,0);replacement.dispose();f.dispose()
 }
}
