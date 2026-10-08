import XCTest
import UIKit
import SpriteKit
@testable import Stack_to_Six

@MainActor private final class NativeRAFNodeParticipant:NativeSourceAnimationParticipant {
 let node:SKNode
 var onPaint:((Double)->Void)?,elapsed:[Double]=[]
 init(node:SKNode){self.node=node}
 func advanceSourceAnimation(seconds:Double){elapsed.append(seconds);onPaint?(seconds)}
}
@MainActor final class NativeSourceRAFTransportUIKitTests:XCTestCase {
 func testMountedAwakeTickerLazyVisitSeesOriginalStackBeforeActualFaceCallback() {
  var wall=0.0;let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall},sourceFrameTransportEnabled:true)
  defer{service.dispose()};let canvas=SKNode(),oldLayer=SKNode(),sibling=NativeRAFNodeParticipant(node:SKNode()),click=NativeRAFNodeParticipant(node:oldLayer)
  canvas.addChild(oldLayer);var order:[String]=[],capturedParent:Bool?
  sibling.onPaint={_ in order.append("sibling")};_ = service.register(participant:sibling,duration:1,domain:.sourceGSAP(.defaultLazyTween),cleanup:{_ in})
  wall=25;let frame=service.requestSourceAnimationFrame(ownerID:"face",generation:7,callback:{order.append("face");oldLayer.removeFromParent();canvas.addChild(SKNode())})
  click.onPaint={_ in if capturedParent==nil {capturedParent=oldLayer.parent === canvas};order.append("click")}
  _ = service.register(participant:click,duration:1,domain:.sourceGSAP(.defaultLazyTween),cleanup:{_ in})
  service.deliver(wallMilliseconds:41);XCTAssertEqual(order,["sibling","click","face"]);XCTAssertEqual(capturedParent,true)
  XCTAssertFalse(frame!.active);XCTAssertNil(oldLayer.parent);XCTAssertEqual(service.displayLinkCreationCount,1)
 }
 func testMountedSleepingTickerSeesFaceReplacementBeforeFirstLazyRootPaint() {
  var wall=0.0;let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall},sourceFrameTransportEnabled:true)
  defer{service.dispose()};let canvas=SKNode(),oldLayer=SKNode(),click=NativeRAFNodeParticipant(node:oldLayer);canvas.addChild(oldLayer)
  var order:[String]=[],capturedParent:Bool?
  wall=25;_ = service.requestSourceAnimationFrame(ownerID:"face",generation:7,callback:{order.append("face");oldLayer.removeFromParent();canvas.addChild(SKNode())})
  click.onPaint={_ in capturedParent=oldLayer.parent === canvas;order.append("click")}
  _ = service.register(participant:click,duration:1,domain:.sourceGSAP(.defaultLazyTween),cleanup:{_ in})
  service.deliver(wallMilliseconds:41);XCTAssertEqual(order,["face","click"]);XCTAssertEqual(capturedParent,false);XCTAssertEqual(click.elapsed,[0.016])
 }
 func testOneSourceLinkDeliversFaceUnderForegroundGlobalPauseAndRetainsBackgroundReceipts() {
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
  defer{service.dispose()};let node=SKNode(),participant=NativeRAFNodeParticipant(node:node);var count=0
  _ = service.register(participant:participant,duration:1,domain:.sourceGSAP(.timeline),cleanup:{_ in})
  _ = service.setSourceGlobalPaused(true);_ = service.requestSourceAnimationFrame(ownerID:"paused-face",generation:1,callback:{count+=1;node.alpha=0.5})
  service.deliver(wallMilliseconds:100);XCTAssertEqual(count,1);XCTAssertEqual(node.alpha,0.5);XCTAssertTrue(participant.elapsed.isEmpty)
  let held=service.requestSourceAnimationFrame(ownerID:"background-face",generation:1,callback:{count+=1;node.alpha=1})
  service.setSourceForeground(false);service.deliver(wallMilliseconds:1000);XCTAssertEqual(count,1);XCTAssertTrue(held!.active);XCTAssertFalse(service.hasActiveClock)
  service.setSourceForeground(true);service.deliver(wallMilliseconds:1016);XCTAssertEqual(count,2);XCTAssertFalse(held!.active);XCTAssertTrue(participant.elapsed.isEmpty)
 }
 func testActualServiceDisposalSealsCapturedFrameCancelReentryAndNestedDeliveryIsNextFrame() {
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true);var order:[String]=[]
  _ = service.requestSourceAnimationFrame(ownerID:"A",generation:1,callback:{order.append("A");_ = service.requestSourceAnimationFrame(ownerID:"B",generation:1,callback:{order.append("B")},onCancelled:{order.append("cancelB");XCTAssertNil(service.requestSourceAnimationFrame(ownerID:"revive",generation:2,callback:{XCTFail()}))});service.deliver(wallMilliseconds:32)})
  service.deliver(wallMilliseconds:16);XCTAssertEqual(order,["A"]);service.dispose();service.deliver(wallMilliseconds:32)
  XCTAssertEqual(order,["A","cancelB"]);XCTAssertEqual(service.pendingSourceAnimationFrameCount,0);XCTAssertFalse(service.hasActiveClock)
 }

 func testActualSourceLinkHasBoundedEmptyRootGCTailAndFaceKeepsTickerFIFO() {
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true),root=NativeRAFNodeParticipant(node:SKNode());defer{service.dispose()}
  _ = service.register(participant:root,duration:0.08,domain:.sourceGSAP(.timeline),cleanup:{_ in})
  for i in 1...5 {service.deliver(wallMilliseconds:Double(i*16))};XCTAssertEqual(service.activeParticipantCount,0);XCTAssertTrue(service.hasActiveClock)
  var tickTime=0.0;_ = service.requestSourceAnimationFrame(ownerID:"actual-tail-face",generation:1,callback:{tickTime=service.sourceTickerSeconds;root.node.alpha=0.5})
  service.deliver(wallMilliseconds:96);XCTAssertEqual(tickTime,0.096,accuracy:1e-12);XCTAssertEqual(root.node.alpha,0.5)
  for i in 7...30 {service.deliver(wallMilliseconds:Double(i*16))}
  XCTAssertEqual(service.sourceTickerDispatchFrame,30);XCTAssertEqual(service.sourceTickerNextGCFrame,150);XCTAssertFalse(service.hasActiveClock);XCTAssertEqual(service.displayLinkCreationCount,1)
 }
}
