import XCTest
@testable import Stack_to_Six

@MainActor final class NativeSourceTutorialActivationTests:XCTestCase {
    @MainActor private final class State {var wall=0.0,current=true,ready=true,prepareResult=true,prepared=0,activated=0;var readyAction:(()->Void)?}
    @MainActor private final class Fixture {
        let state=State(),fifo=NativeSourceMicrotaskFIFO(),timeouts=NativeSourceAppTimeoutOwner()
        let service:NativeSourceAnimationClockService
        var owner:NativeSourceTutorialActivationOwner?
        init()throws {
            let state=state
            service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{state.wall},sourceFrameTransportEnabled:true)
            let tasks=NativeSourceMicrotaskAdapters(fifo:fifo);service.sourceMicrotaskTasks=tasks;timeouts.sourceMicrotaskTasks=tasks
            owner=try XCTUnwrap(NativeSourceTutorialActivationOwner(service:service,timeouts:timeouts,generation:1,current:{state.current},ready:{state.readyAction?();return state.ready},prepare:{[fifo] in XCTAssertTrue(fifo.isAcceptingJobs);state.prepared+=1;return state.prepareResult},activated:{state.activated+=1}))
        }
        func deliver(_ wall:Double){state.wall=wall;service.deliver(wallMilliseconds:wall)}
        func dispose(){owner?.dispose();timeouts.cancelAll();service.dispose();fifo.dispose()}
    }
    func testTwoSeparateActualRAFsThenRealWall1250TimeoutAndSinglePreparation()async throws {
        let f=try Fixture();defer{f.dispose()};XCTAssertTrue(try XCTUnwrap(f.owner).start())
        XCTAssertEqual(f.timeouts.pendingCount,0);f.deliver(16);XCTAssertEqual(f.timeouts.pendingCount,0)
        f.deliver(32);XCTAssertEqual(f.timeouts.pendingCount,1);XCTAssertEqual(f.state.prepared,0)
        try await Task.sleep(for:.milliseconds(900));XCTAssertEqual(f.state.prepared,0)
        try await Task.sleep(for:.milliseconds(450));XCTAssertEqual(f.state.prepared,1);XCTAssertEqual(f.state.activated,1);XCTAssertEqual(f.owner?.phase,.prepared);XCTAssertEqual(f.timeouts.pendingCount,0)
        f.deliver(2000);XCTAssertEqual(f.state.prepared,1)
    }
    func testReadinessRetriesOnlyAtActualRAFWithoutEarlyTimeout()throws {
        let f=try Fixture();defer{f.dispose()};f.state.ready=false;XCTAssertTrue(try XCTUnwrap(f.owner).start())
        f.deliver(16);f.deliver(32);f.deliver(48);XCTAssertEqual(f.timeouts.pendingCount,0);XCTAssertEqual(f.state.prepared,0)
        f.state.ready=true;f.deliver(64);XCTAssertEqual(f.timeouts.pendingCount,1);XCTAssertEqual(f.owner?.phase,.waiting)
    }
    func testBackgroundRetainsRAFAndGlobalPauseDoesNotReplaceWallTimeout()async throws {
        let f=try Fixture();defer{f.dispose()};XCTAssertTrue(try XCTUnwrap(f.owner).start());f.service.setSourceForeground(false)
        f.deliver(1000);XCTAssertEqual(f.timeouts.pendingCount,0)
        f.service.setSourceForeground(true);f.service.setSourceGlobalPaused(true);f.deliver(1016);XCTAssertEqual(f.timeouts.pendingCount,0)
        f.deliver(1032);XCTAssertEqual(f.timeouts.pendingCount,1)
        try await Task.sleep(for:.milliseconds(1350));XCTAssertEqual(f.state.prepared,1);XCTAssertEqual(f.state.activated,1)
    }
    func testFailedPreparationRestartsOriginalTwoRAFGraphWithoutDuplicateTimer()async throws {
        let f=try Fixture();defer{f.dispose()};f.state.prepareResult=false;XCTAssertTrue(try XCTUnwrap(f.owner).start());f.deliver(16);f.deliver(32);f.service.setSourceForeground(false)
        try await Task.sleep(for:.milliseconds(1350));XCTAssertEqual(f.state.prepared,1);XCTAssertEqual(f.timeouts.pendingCount,0);XCTAssertEqual(f.owner?.phase,.frames)
        f.state.prepareResult=true;f.service.setSourceForeground(true);f.deliver(48);XCTAssertEqual(f.timeouts.pendingCount,0);f.deliver(64);XCTAssertEqual(f.timeouts.pendingCount,1)
        try await Task.sleep(for:.milliseconds(1350));XCTAssertEqual(f.state.prepared,2);XCTAssertEqual(f.state.activated,1)
    }
    func testReentrantReadinessRetirementCannotScheduleTimerOrReviveCallback()throws {
        let f=try Fixture();defer{f.dispose()};f.state.readyAction={ [weak f] in f?.owner?.dispose() }
        XCTAssertTrue(try XCTUnwrap(f.owner).start());f.deliver(16);f.deliver(32)
        XCTAssertEqual(f.owner?.phase,.retired);XCTAssertEqual(f.timeouts.pendingCount,0);XCTAssertEqual(f.state.prepared,0);XCTAssertFalse(f.owner?.pendingFrame ?? true)
    }
    func testCapturedRetirementCancelsActualTimeoutAndLatePreparation()async throws {
        let f=try Fixture();defer{f.dispose()};XCTAssertTrue(try XCTUnwrap(f.owner).start());f.deliver(16);f.deliver(32);f.owner?.dispose();f.owner?.dispose()
        XCTAssertEqual(f.timeouts.pendingCount,0);try await Task.sleep(for:.milliseconds(1350));XCTAssertEqual(f.state.prepared,0);XCTAssertEqual(f.state.activated,0)
    }
}
