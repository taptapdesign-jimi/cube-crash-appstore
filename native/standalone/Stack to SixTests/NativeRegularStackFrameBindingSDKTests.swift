import XCTest
@testable import Stack_to_Six

@MainActor final class NativeRegularStackFrameBindingSDKTests:XCTestCase {
 @MainActor private final class Host:NativeRegularStackFrameHost {
  let sourceTileID="dst"
  var sourceGeneration:UInt64=1,sourceAlive=true,sourceValue=2,sourceAlpha=0.7,sourceLocked=false,sourceStackDepth=2,sourceMaxStackDepth=2
  var sourceBaseScaleX=0.5,sourceBaseScaleY=0.5
  var skins:[NativeRegularStackLayout.Skin]=[],installed:[NativeRegularStackLayout]=[]
  func prepareSourceStackSkin(_ skin:NativeRegularStackLayout.Skin){skins.append(skin);sourceBaseScaleX=0.25;sourceBaseScaleY=0.125}
  func installSourceStackFace(_ layout:NativeRegularStackLayout){installed.append(layout)}
 }
 func testActualOneShotCommitsNewSkinIntrinsicScaleStackAndFaceTogether()async throws {
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true),host=Host();var draws=0
  let binding=NativeRegularStackFrameBinding(host:host,service:service,available:Set(NativeRegularStackLayout.Skin.allCases),random:{draws+=1;return 0.5},current:{true});defer{binding.dispose();service.dispose()}
  XCTAssertTrue(binding.setValue(4,addStack:1));XCTAssertEqual(host.sourceValue,4);XCTAssertEqual(host.sourceStackDepth,2);XCTAssertEqual(draws,0);XCTAssertEqual(service.activeParticipantCount,0)
  service.deliver(wallMilliseconds:16)
  let layout=try XCTUnwrap(host.installed.first);XCTAssertEqual(layout.depth,3);XCTAssertEqual(layout.skin,.second);XCTAssertEqual(layout.layers[0].spriteScaleX,0.2375,accuracy:1e-12);XCTAssertEqual(layout.layers[0].spriteScaleY,0.11875,accuracy:1e-12);XCTAssertEqual(draws,8);XCTAssertEqual(binding.pendingFrameCount,0);XCTAssertFalse(service.hasActiveClock)
 }
 func testGlobalPauseDoesNotPauseFaceRAFButBackgroundDoes()async {
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true),host=Host()
  let binding=NativeRegularStackFrameBinding(host:host,service:service,available:[.base],random:{0.2},current:{true});defer{binding.dispose();service.dispose()}
  service.setSourceGlobalPaused(true);service.setSourceForeground(false);XCTAssertTrue(binding.setValue(4,addStack:1));service.deliver(wallMilliseconds:16);XCTAssertTrue(host.installed.isEmpty)
  service.setSourceForeground(true);service.deliver(wallMilliseconds:32);XCTAssertEqual(host.installed.count,1);XCTAssertEqual(host.sourceStackDepth,3)
 }
 func testTwoQueuedValuesReadThenCurrentDepthInOnePhysicalFrame()async {
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true),host=Host()
  let binding=NativeRegularStackFrameBinding(host:host,service:service,available:[.base],random:{0.2},current:{true});defer{binding.dispose();service.dispose()}
  XCTAssertTrue(binding.setValue(3,addStack:1));XCTAssertTrue(binding.setValue(5,addStack:1));XCTAssertEqual(service.pendingSourceAnimationFrameCount,2)
  service.deliver(wallMilliseconds:16);XCTAssertEqual(host.installed.map(\.depth),[3,4]);XCTAssertEqual(host.sourceValue,5);XCTAssertEqual(host.sourceMaxStackDepth,4);XCTAssertEqual(binding.pendingFrameCount,0)
 }
 func testCancelledOldBindingCannotStealReplacementSameIDGeneration()async {
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true),host=Host();var draws=0
  let old=NativeRegularStackFrameBinding(host:host,service:service,available:[.base],random:{draws+=1;return 0.2},current:{true});XCTAssertTrue(old.setValue(3,addStack:1));old.dispose()
  let replacement=NativeRegularStackFrameBinding(host:host,service:service,available:[.base],random:{draws+=1;return 0.2},current:{true});defer{replacement.dispose();service.dispose()};XCTAssertTrue(replacement.setValue(4,addStack:2));service.deliver(wallMilliseconds:16)
  XCTAssertEqual(host.installed.count,1);XCTAssertEqual(host.sourceStackDepth,4);XCTAssertEqual(draws,11)
 }
 func testCurrentPredicateRetirementCannotReviveOldPaintOrRegistration()async {
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true),host=Host();var retire=false,draws=0,binding:NativeRegularStackFrameBinding!
  binding=NativeRegularStackFrameBinding(host:host,service:service,available:[.base],random:{draws+=1;return 0.2},current:{if retire {binding.dispose()};return true});defer{service.dispose()}
  XCTAssertTrue(binding.setValue(4,addStack:1));retire=true;service.deliver(wallMilliseconds:16);XCTAssertEqual(draws,0);XCTAssertTrue(host.installed.isEmpty);XCTAssertNil(binding.pendingReceipts.first);XCTAssertFalse(binding.setValue(5,addStack:1))
 }
 func testDisabledAppTransportFailsClosedWithoutInventedAnimationFrame()async {
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0),host=Host()
  let binding=NativeRegularStackFrameBinding(host:host,service:service,available:[.base],random:{0.2},current:{true});defer{binding.dispose();service.dispose()}
  XCTAssertFalse(binding.setValue(4,addStack:1));XCTAssertTrue(binding.pendingReceipts.isEmpty);XCTAssertEqual(host.sourceStackDepth,2);XCTAssertTrue(host.installed.isEmpty);XCTAssertFalse(service.hasActiveClock)
 }
 func testCurrentPredicateRetirementDuringCapturedValueSetterCannotConsumeLaterSkinRNG()async {
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true),host=Host();var duringDelivery=false,calls=0,draws=0,binding:NativeRegularStackFrameBinding!
  binding=NativeRegularStackFrameBinding(host:host,service:service,available:[.base],random:{draws+=1;return 0.2},current:{if duringDelivery {calls+=1;if calls==2 {binding.dispose()}};return true});defer{service.dispose()}
  XCTAssertTrue(binding.setValue(4,addStack:1));duringDelivery=true;service.deliver(wallMilliseconds:16)
  XCTAssertEqual(calls,2);XCTAssertEqual(draws,0);XCTAssertTrue(host.installed.isEmpty);XCTAssertTrue(binding.pendingReceipts.isEmpty);XCTAssertEqual(host.sourceStackDepth,2)
 }
 func testCurrentPredicateRetirementDuringImmediateValueSetterCannotLeavePendingReceipt()async {
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true),host=Host();var calls=0,binding:NativeRegularStackFrameBinding!
  binding=NativeRegularStackFrameBinding(host:host,service:service,available:[.base],random:{0.2},current:{calls+=1;if calls==3 {binding.dispose()};return true});defer{service.dispose()}
  XCTAssertFalse(binding.setValue(4,addStack:1));XCTAssertTrue(binding.pendingReceipts.isEmpty);XCTAssertEqual(service.pendingSourceAnimationFrameCount,0);XCTAssertTrue(host.installed.isEmpty)
 }

}
