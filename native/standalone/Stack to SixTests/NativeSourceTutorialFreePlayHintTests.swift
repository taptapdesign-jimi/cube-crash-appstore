import XCTest
import CoreGraphics
@testable import Stack_to_Six
@MainActor final class NativeSourceTutorialFreePlayHintTests:XCTestCase {
 @MainActor private final class Fixture {
  var wall=0.0,current=true,poses:[NativeSourceTutorialFreePlayPlan.Pose]=[]
  let fifo=NativeSourceMicrotaskFIFO()
  var service:NativeSourceAnimationClockService!,owner:NativeSourceTutorialFreePlayHintOwner!
  init()throws {
   service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{[weak self] in self?.wall ?? 0},sourceFrameTransportEnabled:true)
   service.sourceMicrotaskTasks=NativeSourceMicrotaskAdapters(fifo:fifo)
   let plan=NativeSourceTutorialFreePlayPlan(moves:[.init(from:CGRect(x:0,y:0,width:60,height:60),to:CGRect(x:120,y:0,width:60,height:60))])
   owner=try XCTUnwrap(NativeSourceTutorialFreePlayHintOwner(service:service,plan:plan,fingertip:.zero,current:{[weak self] in self?.current==true},paint:{[weak self] pose in self?.poses.append(pose)}))
  }
  func deliver(_ ms:Double){wall=ms;service.deliver(wallMilliseconds:ms)}
  func dispose(){owner.dispose();service.dispose();fifo.dispose()}
 }
 func testRealTimelineRepeatsSharesGlobalPauseAndRetiresExactRootKeepingPaint()throws {
  let f=try Fixture();defer{f.dispose()};XCTAssertTrue(f.owner.start());XCTAssertFalse(f.owner.start());XCTAssertTrue(f.poses.isEmpty)
  for t in stride(from:16.0,through:2400,by:16){f.deliver(t)}
  XCTAssertTrue(f.owner.active);XCTAssertGreaterThan(f.poses.count,100)
  let count=f.poses.count,paint=f.poses.last
  _=f.service.setSourceGlobalPaused(true)
  for t in stride(from:2416.0,through:3200,by:16){f.deliver(t)}
  XCTAssertEqual(f.poses.count,count);XCTAssertEqual(f.poses.last,paint)
  _=f.service.setSourceGlobalPaused(false);f.deliver(3216);XCTAssertGreaterThan(f.poses.count,count)
  let unrelated=try XCTUnwrap(f.service.register(participant:f.owner,duration:0.2,domain:.sourceGSAP(.timeline),cleanup:{_ in}))
  f.owner.dispose();XCTAssertFalse(f.owner.active);XCTAssertTrue(unrelated.active)
  let retained=f.poses.last
  for t in stride(from:3232.0,through:3700,by:16){f.deliver(t)}
  XCTAssertEqual(f.poses.last,retained);XCTAssertEqual(f.service.activeParticipantCount,0)
 }
 func testTypedRepeatAdmissionIsBoundedAndOrdinaryInfinityRemainsRejected()throws {
  let f=try Fixture();defer{f.dispose()}
  XCTAssertNil(f.service.registerTutorialFreePlayHint(participant:f.owner,moves:0,cleanup:{_ in}))
  XCTAssertNil(f.service.registerTutorialFreePlayHint(participant:f.owner,moves:5,cleanup:{_ in}))
  XCTAssertNil(f.service.register(participant:f.owner,duration:.infinity,domain:.sourceGSAP(.timeline),cleanup:{_ in}))
  XCTAssertTrue(f.owner.start());f.current=false;f.deliver(16)
  XCTAssertFalse(f.owner.active);XCTAssertTrue(f.poses.isEmpty);XCTAssertEqual(f.service.activeParticipantCount,0)
 }
}
