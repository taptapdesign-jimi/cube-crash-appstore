import XCTest
@testable import Stack_to_Six

nonisolated final class NativeSourceWildBounceTransportTests:XCTestCase {
    @MainActor func testNativeFreshFaceHasFullLengthGrowthAndOriginalSettle() {
        for suppliedSpeed in [1.0,2.0] {
            let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
            defer{service.dispose()}
            var scales:[Double]=[],finishes=0,releases=0,draws=0
            let owner=NativeSourceAppSpawnBounceOwner(service:service,hooks:.init(current:{true},readRotation:{0},paintScale:{scales.append($0)},paintRotation:{_ in},ensureFullOpacity:{},random:{draws+=1;return 0.2},acquireFrames:{return{releases+=1}},finished:{_ in finishes+=1}),timeScale:suppliedSpeed,nativeFreshFace:true)
            XCTAssertTrue(owner.start());XCTAssertEqual(scales.first,0)
            for wall in stride(from:5.0,through:290.0,by:5){service.deliver(wallMilliseconds:wall)}
            XCTAssertEqual(finishes,0,"Native fresh faces retain their full bounce even in an accelerated caller")
            for wall in stride(from:295.0,through:590.0,by:5){service.deliver(wallMilliseconds:wall)}
            XCTAssertTrue(scales.contains{$0>0.1 && $0<0.7})
            XCTAssertTrue(scales.allSatisfy{$0>=0 && $0<1.20})
            XCTAssertEqual(scales.last,1);XCTAssertEqual(draws,1);XCTAssertEqual(finishes,1);XCTAssertEqual(releases,1)
            for time in [0.18,0.24,0.30,0.36,0.42,0.50,0.56] {
                XCTAssertEqual(NativeSourceAppSpawnBounceOwner.scale(time,initialScale:0),NativeSourceAppSpawnBounceOwner.scale(time),accuracy:1e-9)
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
    @MainActor func testFreshFaceLateFirstAndStalledFramesPreserveVisibleGrowthAndFinishOnce() {
        for firstDelay in [200.0,450.0,900.0] {
            let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
            defer{service.dispose()}
            var scales:[Double]=[],finished=0,released=0
            let owner=NativeSourceAppSpawnBounceOwner(service:service,hooks:.init(current:{true},readRotation:{0},paintScale:{scales.append($0)},paintRotation:{_ in},ensureFullOpacity:{},random:{0.2},acquireFrames:{return{released+=1}},finished:{_ in finished+=1}),timeScale:2,nativeFreshFace:true)
            XCTAssertTrue(owner.start());XCTAssertEqual(scales,[0])
            service.deliver(wallMilliseconds:firstDelay)
            XCTAssertEqual(scales.last,0);XCTAssertEqual(finished,0)
            service.deliver(wallMilliseconds:firstDelay+16)
            let firstGrowth=scales.last!
            XCTAssertGreaterThan(firstGrowth,0);XCTAssertLessThan(firstGrowth,0.5)
            service.deliver(wallMilliseconds:firstDelay+416)
            XCTAssertGreaterThan(scales.last!,firstGrowth);XCTAssertLessThan(scales.last!,1)
            XCTAssertEqual(finished,0,"A stalled callback must not consume the unseen bounce")
            for wall in stride(from:firstDelay+432,through:firstDelay+1100,by:16){service.deliver(wallMilliseconds:wall)}
            XCTAssertTrue(scales.contains{$0>1.05},"Authored overshoot stays visible")
            XCTAssertEqual(scales.last,1);XCTAssertEqual(finished,1);XCTAssertEqual(released,1)
            XCTAssertEqual(service.activeParticipantCount,0)
            owner.interrupt();XCTAssertEqual(finished,1)
        }
    }
    @MainActor func testFreshFaceCancellationBeforeFirstPaintRestoresOnlyLiveCarrier() {
        for aliveAfterStart in [true,false] {
            let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
            defer{service.dispose()}
            var alive=true,scale=1.0,finished=0,released=0
            let owner=NativeSourceAppSpawnBounceOwner(service:service,hooks:.init(current:{alive},readRotation:{0},paintScale:{scale=$0},paintRotation:{_ in},ensureFullOpacity:{},random:{0.2},acquireFrames:{return{released+=1}},finished:{_ in finished+=1}),nativeFreshFace:true)
            XCTAssertTrue(owner.start());XCTAssertEqual(scale,0)
            alive=aliveAfterStart;owner.interrupt();owner.interrupt()
            XCTAssertEqual(scale,aliveAfterStart ? 1:0)
            XCTAssertEqual(finished,1);XCTAssertEqual(released,1);XCTAssertEqual(service.activeParticipantCount,0)
        }
    }
    @MainActor func testFreshFaceCannotAdvanceWhileMountedDrawSerialIsFrozen() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        defer{service.dispose()}
        var serial:UInt64=1,scales:[Double]=[],finished=0,released=0
        let owner=NativeSourceAppSpawnBounceOwner(service:service,hooks:.init(current:{true},readRotation:{0},paintScale:{scales.append($0)},paintRotation:{_ in},ensureFullOpacity:{},random:{0.2},acquireFrames:{return{released+=1}},finished:{_ in finished+=1}),nativeFreshFace:true,nativeFrameSerial:{serial})
        XCTAssertTrue(owner.start())
        for wall in stride(from:16.0,through:896.0,by:16){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(scales,[0,0]);XCTAssertEqual(finished,0);XCTAssertEqual(released,0)
        for wall in stride(from:912.0,through:1568.0,by:16){serial+=1;service.deliver(wallMilliseconds:wall)}
        XCTAssertTrue(scales.contains{$0>0 && $0<0.95});XCTAssertTrue(scales.contains{$0>1.05})
        XCTAssertEqual(scales.last,1);XCTAssertEqual(finished,1);XCTAssertEqual(released,1)
        XCTAssertEqual(service.activeParticipantCount,0)
    }
    @MainActor func testFreshFrameReaderRetirementCancelsWithoutLateProgress() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        defer{service.dispose()}
        var serial:UInt64?=1,alive=true,paints=0,released=0,finished=0
        let owner=NativeSourceAppSpawnBounceOwner(service:service,hooks:.init(current:{alive},readRotation:{0},paintScale:{_ in paints+=1},paintRotation:{_ in},ensureFullOpacity:{},random:{0.2},acquireFrames:{return{released+=1}},finished:{outcome in XCTAssertEqual(outcome,.interrupted);finished+=1}),nativeFreshFace:true,nativeFrameSerial:{serial})
        XCTAssertTrue(owner.start());service.deliver(wallMilliseconds:16)
        let captured=paints;serial=nil;alive=false;service.deliver(wallMilliseconds:32)
        XCTAssertEqual(paints,captured);XCTAssertEqual(finished,1);XCTAssertEqual(released,1)
        XCTAssertEqual(service.activeParticipantCount,0)
        service.deliver(wallMilliseconds:48);owner.interrupt();XCTAssertEqual(finished,1)
    }
    @MainActor func testFreshFrameReaderReentrantCancellationCannotDeliverRetiredRoot() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        defer{service.dispose()}
        var owner:NativeSourceAppSpawnBounceOwner?,paints=0,finished=0,released=0
        owner=NativeSourceAppSpawnBounceOwner(service:service,hooks:.init(current:{true},readRotation:{0},paintScale:{_ in paints+=1},paintRotation:{_ in},ensureFullOpacity:{},random:{0.2},acquireFrames:{return{released+=1}},finished:{_ in finished+=1}),nativeFreshFace:true,nativeFrameSerial:{owner?.interrupt();return 1})
        XCTAssertTrue(owner!.start());XCTAssertEqual(paints,1)
        service.deliver(wallMilliseconds:16)
        XCTAssertEqual(paints,2,"Only captured live-carrier restoration may paint after cancellation")
        XCTAssertEqual(finished,1);XCTAssertEqual(released,1);XCTAssertEqual(service.activeParticipantCount,0)
        owner=nil
    }
}
