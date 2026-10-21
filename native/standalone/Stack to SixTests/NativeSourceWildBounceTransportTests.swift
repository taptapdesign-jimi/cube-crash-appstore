import XCTest
@testable import Stack_to_Six

nonisolated final class NativeSourceWildBounceTransportTests:XCTestCase {
    @MainActor func testNewFaceEntryHasReadableGrowthWithoutMiniatureStartOrChangingSettle() {
        for speed in [1.0,2.0] {
            let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
            defer{service.dispose()}
            var scales:[Double]=[],finishes=0,releases=0,draws=0
            let owner=NativeSourceAppSpawnBounceOwner(service:service,hooks:.init(current:{true},readRotation:{0},paintScale:{scales.append($0)},paintRotation:{_ in},ensureFullOpacity:{},random:{draws+=1;return 0.2},acquireFrames:{return{releases+=1}},finished:{_ in finishes+=1}),timeScale:speed,initialScale:NativeSourceAppSpawnBounceOwner.nativeEntryScale)
            XCTAssertTrue(owner.start());XCTAssertEqual(scales.first,0.70)
            for wall in stride(from:5.0,through:600.0/speed,by:5){service.deliver(wallMilliseconds:wall)}
            XCTAssertTrue(scales.contains{$0>0.75 && $0<0.98},"Enter has visible intermediate sizes")
            XCTAssertTrue(scales.allSatisfy{$0>=0.70 && $0<1.13})
            XCTAssertEqual(scales.last,1);XCTAssertEqual(draws,1);XCTAssertEqual(finishes,1);XCTAssertEqual(releases,1)
            for time in [0.18,0.24,0.30,0.36,0.42,0.50,0.56] {
                XCTAssertEqual(NativeSourceAppSpawnBounceOwner.scale(time,initialScale:0.70),NativeSourceAppSpawnBounceOwner.scale(time),accuracy:1e-9)
            }
            owner.interrupt();XCTAssertEqual(finishes,1)
        }
    }
    @MainActor func testNativeBoardBounceRetainsFullSizeWithSameTimingAndEntropy() {
        for speed in [1.0,2.0] {
            let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
            defer{service.dispose()}
            var scales:[Double]=[],draws=0,released=0,finished=0
            let owner=NativeSourceAppSpawnBounceOwner(service:service,hooks:.init(current:{true},readRotation:{0},paintScale:{scales.append($0)},paintRotation:{_ in},ensureFullOpacity:{},random:{draws+=1;return 0.2},acquireFrames:{return{released+=1}},finished:{outcome in XCTAssertEqual(outcome,.completed);finished+=1}),timeScale:speed,preservesBoardSize:true)
            XCTAssertTrue(owner.start());XCTAssertEqual(scales.first,1);XCTAssertEqual(draws,1)
            for wall in stride(from:5.0,through:600.0/speed,by:5){service.deliver(wallMilliseconds:wall)}
            XCTAssertTrue(scales.allSatisfy{$0>=0.95999 && $0<1.10})
            XCTAssertEqual(scales.last,1);XCTAssertEqual(draws,1);XCTAssertEqual(released,1);XCTAssertEqual(finished,1)
            XCTAssertEqual(service.activeParticipantCount,0)
            owner.interrupt();XCTAssertEqual(finished,1)
        }
    }
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
