import XCTest
@testable import Stack_to_Six

nonisolated final class NativeSourceLockedBonusPopTests:XCTestCase {
    @MainActor func testBalancedLockedBonusEntryRetainsOriginalSettleAndNoMiniatureStart() {
        XCTAssertEqual(NativeSourceLockedBonusPopOwner.scale(0,initialScale:0.70),0.70)
        XCTAssertGreaterThan(NativeSourceLockedBonusPopOwner.scale(0.025,initialScale:0.70),0.70)
        for time in [0.16,0.20,0.26,0.30,0.36,0.44,0.48] {
            XCTAssertEqual(NativeSourceLockedBonusPopOwner.scale(time,initialScale:0.70),NativeSourceLockedBonusPopOwner.scale(time),accuracy:1e-9)
        }
    }
    @MainActor func testNativeBoardLockedBonusStaysFullSizeThroughoutStaggerAndPop() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        let timeouts=NativeSourceAppTimeoutOwner();defer{service.dispose();timeouts.cancelAll()}
        var scales:[Double]=[],finished=0,released=0
        let owner=NativeSourceLockedBonusPopOwner(service:service,timeouts:timeouts,generation:7,delayMilliseconds:250,direction:1,hooks:.init(current:{true},locked:{false},readRotation:{0},scale:{scales.append($0)},rotation:{_ in},repair:{XCTFail("Unlocked tile must not be repaired")},acquire:{return{released+=1}},finished:{finished+=1}),preservesBoardSize:true)
        XCTAssertTrue(owner.start());XCTAssertEqual(scales,[1])
        for wall in stride(from:5.0,through:750.0,by:5){service.deliver(wallMilliseconds:wall)}
        XCTAssertTrue(scales.allSatisfy{$0>=0.95999 && $0<1.10})
        XCTAssertEqual(scales.last,1);XCTAssertEqual(finished,1);XCTAssertEqual(released,1)
        XCTAssertEqual(service.activeParticipantCount,0);XCTAssertEqual(timeouts.pendingCount,0)
        owner.dispose();XCTAssertEqual(finished,1)
    }
    @MainActor func testTwoActualAPPRootsAndGuardedRepairAfterUnlock()async {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        let timeouts=NativeSourceAppTimeoutOwner()
        defer{service.dispose();timeouts.cancelAll()}
        var scale=0.0,rotation=0.0,locked=true,repairs=0,finished=0,released=0
        let owner=NativeSourceLockedBonusPopOwner(service:service,timeouts:timeouts,generation:7,delayMilliseconds:150,direction:1,
            hooks:.init(current:{true},locked:{locked},readRotation:{0.05},scale:{scale=$0},rotation:{rotation=$0},repair:{repairs+=1},acquire:{return{released+=1}},finished:{finished+=1}))
        XCTAssertTrue(owner.start());XCTAssertEqual(scale,0.30);XCTAssertEqual(service.activeParticipantCount,2)
        for wall in stride(from:10.0,through:140.0,by:10){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(scale,0.30);XCTAssertEqual(rotation,0)
        service.deliver(wallMilliseconds:200)
        XCTAssertEqual(scale,NativeSourceLockedBonusPopOwner.scale(0.05),accuracy:1e-6)
        XCTAssertEqual(rotation,NativeSourceLockedBonusPopOwner.rotation(0.05,initial:0.05,direction:1),accuracy:1e-6)
        for wall in stride(from:210.0,through:640.0,by:10){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(service.activeParticipantCount,0);XCTAssertEqual(repairs,1);XCTAssertEqual(timeouts.pendingCount,1)
        locked=false
        try? await Task.sleep(for:.milliseconds(120))
        XCTAssertEqual(repairs,1,"Unlocked tile never gets stale locked alpha")
        XCTAssertEqual(finished,1);XCTAssertEqual(released,1);XCTAssertEqual(timeouts.pendingCount,0)
        owner.dispose();XCTAssertEqual(finished,1)
    }
    @MainActor func testReentrantAcquisitionReleasesReceiptWithoutPublishingRoots(){
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        let timeouts=NativeSourceAppTimeoutOwner();defer{service.dispose();timeouts.cancelAll()}
        var owner:NativeSourceLockedBonusPopOwner?,released=0,finished=0
        owner=NativeSourceLockedBonusPopOwner(service:service,timeouts:timeouts,generation:7,delayMilliseconds:0,direction:1,
            hooks:.init(current:{true},locked:{true},readRotation:{0},scale:{_ in},rotation:{_ in},repair:{XCTFail("No repair after reentry")},
                acquire:{owner?.dispose();return{released+=1}},finished:{finished+=1}))
        XCTAssertFalse(owner!.start());XCTAssertEqual(released,1);XCTAssertEqual(finished,1)
        XCTAssertEqual(service.activeParticipantCount,0);XCTAssertEqual(timeouts.pendingCount,0);owner=nil
    }
    @MainActor func testGenerationRetirementBeforeFirstDelayedFrameDoesNoLatePaint(){
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        let timeouts=NativeSourceAppTimeoutOwner();defer{service.dispose();timeouts.cancelAll()}
        var current=true,paints=0,finished=0,released=0
        let owner=NativeSourceLockedBonusPopOwner(service:service,timeouts:timeouts,generation:7,delayMilliseconds:300,direction:1,
            hooks:.init(current:{current},locked:{true},readRotation:{0},scale:{_ in paints+=1},rotation:{_ in paints+=1},repair:{XCTFail("No stale repair")},
                acquire:{return{released+=1}},finished:{finished+=1}))
        XCTAssertTrue(owner.start());XCTAssertEqual(paints,1);current=false
        service.deliver(wallMilliseconds:10);service.deliver(wallMilliseconds:100)
        XCTAssertEqual(paints,1);XCTAssertEqual(finished,1);XCTAssertEqual(released,1)
        XCTAssertEqual(service.activeParticipantCount,0);XCTAssertEqual(timeouts.pendingCount,0)
    }
    @MainActor func testCapturedCancellationRetiresBothRootsAndPendingRepairOnce(){
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        let timeouts=NativeSourceAppTimeoutOwner();defer{service.dispose();timeouts.cancelAll()}
        var finished=0,released=0,repairs=0
        let owner=NativeSourceLockedBonusPopOwner(service:service,timeouts:timeouts,generation:7,delayMilliseconds:0,direction:-1,
            hooks:.init(current:{true},locked:{true},readRotation:{0},scale:{_ in},rotation:{_ in},repair:{repairs+=1},acquire:{return{released+=1}},finished:{finished+=1}))
        XCTAssertTrue(owner.start())
        for wall in stride(from:10.0,through:490.0,by:10){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(timeouts.pendingCount,1);XCTAssertEqual(repairs,1)
        owner.dispose();owner.dispose()
        XCTAssertEqual(timeouts.pendingCount,0);XCTAssertEqual(service.activeParticipantCount,0)
        XCTAssertEqual(finished,1);XCTAssertEqual(released,1)
    }
}
