import XCTest
@testable import Stack_to_Six

@MainActor final class NativeSourceTutorialExitTests:XCTestCase {
    @MainActor private final class Fixture {
        var wall=0.0,current=true,sheet:[Double]=[],pointer:[NativeSourceTutorialIntroOwner.PointerPose]=[],hidden=0
        let fifo=NativeSourceMicrotaskFIFO(),timeouts=NativeSourceAppTimeoutOwner()
        var service:NativeSourceAnimationClockService!,owner:NativeSourceTutorialIntroOwner!
        init()throws {
            let tasks=NativeSourceMicrotaskAdapters(fifo:fifo);timeouts.sourceMicrotaskTasks=tasks
            service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{[weak self] in self?.wall ?? 0},sourceFrameTransportEnabled:true)
            service.sourceMicrotaskTasks=tasks
            owner=try XCTUnwrap(NativeSourceTutorialIntroOwner(service:service,timeouts:timeouts,generation:1,current:{[weak self] in self?.current==true},sheet:{[weak self] in self?.sheet.append($0)},pointer:{[weak self] in self?.pointer.append($0)},reveal:{},focus:{},conceal:{[weak self] in self?.hidden+=1}))
        }
        func deliver(_ value:Double){wall=value;service.deliver(wallMilliseconds:value)}
        func settle(){for t in stride(from:16.0,through:600,by:16){deliver(t)}}
        func dispose(){owner.dispose();timeouts.cancelAll();service.dispose();fifo.dispose()}
    }
    func testPointerCompletionCreatesSheetRootOnlyAfterActualUnpausedAPPFrames()throws {
        let f=try Fixture();defer{f.dispose()};f.owner.restorePointer();f.settle()
        var pointerDone=0,sheetDone=0
        XCTAssertTrue(f.owner.popOutPointer{pointerDone+=1;XCTAssertTrue(f.owner.exitSheet{sheetDone+=1})})
        _=f.service.setSourceGlobalPaused(true)
        for t in stride(from:608.0,through:1000,by:16){f.deliver(t)}
        XCTAssertEqual(pointerDone,0);XCTAssertEqual(sheetDone,0);XCTAssertEqual(f.hidden,0)
        _=f.service.setSourceGlobalPaused(false)
        for t in stride(from:1008.0,through:1248,by:16){f.deliver(t)}
        XCTAssertEqual(pointerDone,1);XCTAssertEqual(f.hidden,1);XCTAssertEqual(sheetDone,0)
        for t in stride(from:1264.0,through:1700,by:16){f.deliver(t)}
        XCTAssertEqual(sheetDone,1);XCTAssertEqual(try XCTUnwrap(f.sheet.last),1,accuracy:1e-9)
        XCTAssertEqual(try XCTUnwrap(f.pointer.last).alpha,0,accuracy:1e-9)
        XCTAssertEqual(try XCTUnwrap(f.pointer.last).scale,0,accuracy:1e-9)
        XCTAssertEqual(f.service.activeParticipantCount,0)
    }
    func testPointerOverwriteDoesNotEmitRetiredCompletion()throws {
        let f=try Fixture();defer{f.dispose()};f.owner.restorePointer();f.settle()
        var done=0;XCTAssertTrue(f.owner.popOutPointer{done+=1});f.deliver(608);f.owner.restorePointer()
        for t in stride(from:624.0,through:1400,by:16){f.deliver(t)}
        XCTAssertEqual(done,0);XCTAssertEqual(f.hidden,0);XCTAssertEqual(try XCTUnwrap(f.pointer.last).scale,1,accuracy:1e-9)
    }
    func testScopeRetirementAndExplicitDisposeCannotAdvancePhase()throws {
        for explicit in [false,true] {
            let f=try Fixture();defer{f.dispose()};var done=0
            XCTAssertTrue(f.owner.exitSheet{done+=1});f.deliver(16)
            if explicit{f.owner.dispose()}else{f.current=false}
            for t in stride(from:32.0,through:600,by:16){f.deliver(t)}
            XCTAssertEqual(done,0);XCTAssertEqual(f.service.activeParticipantCount,0)
        }
    }
    func testEarlyExitDoesNotCancelOriginalIndependentIntroTimers()async throws {
        let f=try Fixture();defer{f.dispose()};f.service.setSourceForeground(false)
        XCTAssertTrue(f.owner.start());XCTAssertTrue(f.owner.popOutPointer{})
        XCTAssertEqual(f.timeouts.pendingReceipts.map(\.sourceID),["tutorial-pointer1200","tutorial-sheet800"])
        try await Task.sleep(for:.milliseconds(1300))
        XCTAssertTrue(f.owner.sheetStarted);XCTAssertTrue(f.owner.pointerStarted)
        XCTAssertEqual(f.timeouts.pendingCount,0)
    }
}
