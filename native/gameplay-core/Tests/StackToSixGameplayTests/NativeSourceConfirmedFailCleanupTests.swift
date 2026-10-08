import XCTest
@testable import StackToSixGameplay
final class NativeSourceConfirmedFailCleanupTests:XCTestCase {
    func fixture(stars:Bool=false)->NativeGameplayEngine {
        let e=NativeGameplayEngine(state:.init(tiles: stars ? [.init(id:"s",cell:.init(column:0,row:0),value:6,archetype:.star),.init(id:"d",cell:.init(column:1,row:0),value:2),.init(id:"a",cell:.init(column:2,row:0),value:4),.init(id:"b",cell:.init(column:3,row:0),value:3)] : [.init(id:"a",cell:.init(column:2,row:0),value:4),.init(id:"b",cell:.init(column:3,row:0),value:3)]),recordedRandomChoices:Array(repeating:0,count:300))
        if stars {XCTAssertTrue(e.beginDrag(tileID:"s"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
            for t in e.state.tiles where t.id != "a" && t.id != "b" {var r=NativeNoMovesTileRuntime();r.destroyed=true;e.noMovesTileRuntime[t.id]=r}
        }
        e.stagedSourceNoMoves=true;return e
    }
    func confirmed(_ e:NativeGameplayEngine)throws->NativeNoMovesCandidateOwner.Plan {
        guard case .candidate(let p)=e.beginSourceNoMoves(origin:.levelEnd) else{throw Failure.noPlan}
        _=e.deliverSourceNoMovesWait(plan:p,generation:1);_=e.deliverSourceNoMovesTextExit(plan:p,generation:1,delivery:.exited)
        XCTAssertEqual(e.acquireSourceNoMovesLock(plan:p,generation:1),.confirmedFinal(p));return p
    }
    enum Failure:Error {case noPlan}
    func testCleanupCannotRunBeforeGenuineConfirmedLock()throws {
        let e=fixture();guard case .candidate(let p)=e.beginSourceNoMoves(origin:.levelEnd) else{return XCTFail()}
        let state=e.state;XCTAssertFalse(e.cancelSourceConfirmedFailHUDStars(plan:p,generation:1,receiptIDs:[]));XCTAssertEqual(e.state,state)
    }
    func testOutstandingCapturedStarsDiscardWithoutScoreRNGOrMovesAndLateArrivalRejected()throws {
        let e=fixture(stars:true);XCTAssertFalse(e.pendingHUDStars.isEmpty);let p=try confirmed(e)
        let receipts=e.pendingHUDStars,state=e.state
        XCTAssertTrue(e.cancelSourceConfirmedFailHUDStars(plan:p,generation:1,receiptIDs:receipts.map(\.id)))
        XCTAssertTrue(e.pendingHUDStars.isEmpty);XCTAssertEqual(e.state,state)
        for r in receipts {XCTAssertFalse(e.commitHUDStarArrival(receiptID:r.id,generation:r.generation).accepted)}
        XCTAssertEqual(e.state.score,state.score)
    }
    func testGenuineArrivalBeforeCleanupPreservesEarned100Only()throws {
        let e=fixture(stars:true),first=try XCTUnwrap(e.pendingHUDStars.first)
        let before=e.state.score;XCTAssertTrue(e.commitHUDStarArrival(receiptID:first.id,generation:1).accepted)
        let p=try confirmed(e),earned=e.state.score
        XCTAssertEqual(earned,before+100)
        XCTAssertTrue(e.cancelSourceConfirmedFailHUDStars(plan:p,generation:1,receiptIDs:e.pendingHUDStars.map(\.id)))
        XCTAssertEqual(e.state.score,earned)
    }
    func testBoardExitRetainsBusyAndTerminalKeyUntilActualFinalFinallyOnce()throws {
        let e=fixture(),p=try confirmed(e)
        XCTAssertTrue(e.finishSourceNoMovesBoardExit(plan:p,generation:1).accepted)
        let r=try XCTUnwrap(e.completedSourceNoMovesReceipt),state=e.state
        XCTAssertTrue(e.flags.busyEnding)
        XCTAssertTrue(e.finishSourceNoMovesFinalCleanup(receipt:r));XCTAssertFalse(e.finishSourceNoMovesFinalCleanup(receipt:r))
        XCTAssertFalse(e.flags.busyEnding);XCTAssertEqual(e.state,state)
    }
    func testStaleFinalCleanupCannotClearReplacementBusyOrTerminalKey()throws {
        let e=fixture(),p=try confirmed(e);_=e.finishSourceNoMovesBoardExit(plan:p,generation:1)
        let r=try XCTUnwrap(e.completedSourceNoMovesReceipt)
        e.restart(state:.init(tiles:[]));var flags=e.flags;flags.busyEnding=true;e.setRuntimeFlags(flags);e.setInputLock("terminal-no-moves",active:true)
        XCTAssertFalse(e.finishSourceNoMovesFinalCleanup(receipt:r));XCTAssertTrue(e.flags.busyEnding)
    }
    func testActualPreExitAbortFinallyReleasesBusyWithoutFabricatingBoardExitAndRejectsLateExit()throws {
        let e=fixture(),p=try confirmed(e),flow=try XCTUnwrap(e.sourceNoMovesFinalFlowReceipt)
        XCTAssertNil(e.completedSourceNoMovesReceipt);XCTAssertTrue(e.flags.busyEnding)
        XCTAssertTrue(e.finishSourceConfirmedFinalFlow(receipt:flow));XCTAssertFalse(e.finishSourceConfirmedFinalFlow(receipt:flow))
        XCTAssertFalse(e.flags.busyEnding);XCTAssertNil(e.state.terminal)
        XCTAssertFalse(e.finishSourceNoMovesBoardExit(plan:p,generation:1).accepted)
        XCTAssertNil(e.completedSourceNoMovesReceipt)
    }

}
