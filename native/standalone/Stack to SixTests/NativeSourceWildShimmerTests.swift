import XCTest
@testable import Stack_to_Six
@MainActor final class NativeSourceWildShimmerTests:XCTestCase {
 func testEnvelopeMatchesExecutedOriginalGSAPTimeline(){
  // Actual fx.ts startWildShimmer with real GSAP; not computed by Swift.
  let rows:[(Double,Double,Double)]=[(0,0,-102.4),(0.07,0.173438,-102.4),(0.14,0.2625,-102.4),(0.28,0.3,-102.4),(0.78,0.3,-89.6),(1.28,0.3,0),(1.78,0.3,89.6),(2.28,0.3,102.4),(2.42,0.2625,102.4),(2.56,0,102.4)]
  for (t,a,x) in rows {
   let p=NativeSourceWildShimmerMotion.pose(seconds:t,width:128,height:128)
   XCTAssertEqual(p.alpha,a,accuracy:1e-6);XCTAssertEqual(p.x,x,accuracy:1e-6);XCTAssertEqual(p.y,x,accuracy:1e-6)
  }
  XCTAssertEqual(NativeSourceWildShimmerMotion.delay(random:0.25),5)
  XCTAssertEqual(NativeSourceWildShimmerMotion.delay(random:0.75),7)
  let p=NativeSourceWildShimmerMotion.pose(seconds:0,width:10,height:20)
  XCTAssertEqual(p.x,-51.2);XCTAssertEqual(p.y,-51.2)
 }
 func testRealSharedClockSchedulesNextDelayAtSweepStartAndReleasesBothRoots(){
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
  defer{service.dispose()}
  var draws=0,paint:[NativeSourceWildShimmerMotion.Pose]=[]
  let owner=NativeSourceWildShimmerClock(service:service,width:128,height:128,current:{true},random:{draws+=1;return draws==1 ? 0.25:0.75},paint:{paint.append($0)})
  XCTAssertTrue(owner.start());XCTAssertFalse(owner.start());XCTAssertEqual(draws,1)
  XCTAssertEqual(owner.activeRootCount,1);XCTAssertTrue(paint.isEmpty)
  for n in 1...110 {service.deliver(wallMilliseconds:Double(n)*50)}
  XCTAssertEqual(draws,2,"the next delay starts while this finite sweep is still active")
  XCTAssertEqual(owner.activeRootCount,2);XCTAssertFalse(paint.isEmpty)
  owner.dispose();owner.dispose();XCTAssertEqual(owner.activeRootCount,0)
  XCTAssertEqual(service.activeParticipantCount,0)
  let before=paint.count
  for n in 111...300{service.deliver(wallMilliseconds:Double(n)*50)}
  XCTAssertEqual(paint.count,before);XCTAssertEqual(draws,2)
 }
 func testVisibilityPausesRealDelayAndInvalidCurrentCannotStartSweep(){
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
  defer{service.dispose()}
  var current=true,draws=0,paints=0
  let owner=NativeSourceWildShimmerClock(service:service,width:128,height:128,current:{current},random:{draws+=1;return 0},paint:{_ in paints+=1})
  XCTAssertTrue(owner.start());owner.setVisible(false)
  for n in 1...100{service.deliver(wallMilliseconds:Double(n)*50)}
  XCTAssertEqual(draws,1);XCTAssertEqual(paints,0)
  current=false;owner.setVisible(true)
  for n in 101...200{service.deliver(wallMilliseconds:Double(n)*50)}
  XCTAssertEqual(draws,1);XCTAssertEqual(paints,0);XCTAssertEqual(owner.activeRootCount,0)
  XCTAssertEqual(service.activeParticipantCount,0)
 }
}
