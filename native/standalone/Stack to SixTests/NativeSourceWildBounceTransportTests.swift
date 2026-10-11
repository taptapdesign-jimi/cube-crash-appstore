import XCTest
@testable import Stack_to_Six

nonisolated final class NativeSourceWildBounceTransportTests:XCTestCase {
    @MainActor func testCapturedLevelFlowDirectionUsesDoubleSpeedAndNoAdditionalMath() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        defer{service.dispose()}
        var draws=0,acquired=0,released=0,finished=0,scale=0.0
        let owner=NativeSourceAppSpawnBounceOwner(service:service,hooks:.init(current:{true},readRotation:{0},paintScale:{scale=$0},paintRotation:{_ in},ensureFullOpacity:{},random:{draws+=1;return 0.9},acquireFrames:{acquired+=1;return{released+=1}},finished:{outcome in XCTAssertEqual(outcome,.completed);finished+=1}),timeScale:2,capturedDirection:1)
        XCTAssertTrue(owner.start());XCTAssertEqual(scale,0.3);XCTAssertEqual(draws,0);XCTAssertEqual(acquired,1)
        for wall in stride(from:10.0,through:270.0,by:10){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(finished,0);service.deliver(wallMilliseconds:280)
        XCTAssertEqual(finished,1);XCTAssertEqual(released,1);XCTAssertEqual(draws,0);XCTAssertEqual(scale,1)
    }
    @MainActor func testSourcePickupKeepsCapturedParentUntilTheNextRealRoot() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        defer{service.dispose()}
        var finished=0,released=0
        let owner=NativeSourceAppSpawnBounceOwner(service:service,hooks:.init(current:{true},readRotation:{0},paintScale:{_ in},paintRotation:{_ in},ensureFullOpacity:{},random:{XCTFail("Captured direction must not draw");return 0.2},acquireFrames:{return{released+=1}},finished:{outcome in XCTAssertEqual(outcome,.completed);finished+=1}),timeScale:2,capturedDirection:-1)
        XCTAssertTrue(owner.start());owner.removeChildrenForPickup()
        XCTAssertTrue(owner.active);XCTAssertEqual(finished,0);XCTAssertEqual(released,0)
        service.deliver(wallMilliseconds:10)
        XCTAssertFalse(owner.active);XCTAssertEqual(finished,1);XCTAssertEqual(released,1)
        owner.interrupt();XCTAssertEqual(released,1)
    }
}
