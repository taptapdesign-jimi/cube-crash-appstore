import XCTest
@testable import StackToSixGameplay
final class NativeSourceNoMovesCompletedReceiptTests:XCTestCase {
    private func engine()->NativeGameplayEngine {
        let e=NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:4),.init(id:"b",cell:.init(column:1,row:0),value:3)]))
        e.stagedSourceNoMoves=true;return e
    }
    private func confirm(_ e:NativeGameplayEngine,delivery:NativeNoMovesCandidateOwner.ExitDelivery = .exited)throws->NativeNoMovesCandidateOwner.Plan {
        guard case .candidate(let p)=e.beginSourceNoMoves(origin:.levelEnd)else{throw NSError(domain:"candidate",code:1)}
        XCTAssertNil(e.completedSourceNoMovesReceipt)
        XCTAssertEqual(e.deliverSourceNoMovesWait(plan:p,generation:1),.exit(p))
        XCTAssertEqual(e.deliverSourceNoMovesTextExit(plan:p,generation:1,delivery:delivery),.acquireInputLock(p))
        guard case .confirmedFinal=e.acquireSourceNoMovesLock(plan:p,generation:1)else{throw NSError(domain:"lock",code:1)}
        XCTAssertNil(e.completedSourceNoMovesReceipt)
        return p
    }
    func testActualBoardExitAlonePublishesHandledReceiptOnceWithoutMutatingRunCounters()throws {
        let e=engine(),p=try confirm(e),before=e.state
        let result=e.finishSourceNoMovesBoardExit(plan:p,generation:1)
        XCTAssertTrue(result.accepted)
        let r=try XCTUnwrap(e.completedSourceNoMovesReceipt)
        XCTAssertEqual(r.planToken,p.token);XCTAssertTrue(r.boardExitCompleted);XCTAssertTrue(r.noMovesFlowHandled)
        XCTAssertTrue(r.admits(generation:1,resolution:result.resolution))
        XCTAssertEqual(e.state.moves,before.moves);XCTAssertEqual(e.state.rngState,before.rngState);XCTAssertEqual(e.state.tiles,before.tiles)
        XCTAssertFalse(e.finishSourceNoMovesBoardExit(plan:p,generation:1).accepted);XCTAssertEqual(e.completedSourceNoMovesReceipt,r)
    }
    func testUnavailableTextStillMeansHandledFlowAfterRealExitNotVisibleTextClaim()throws {
        let e=engine(),p=try confirm(e,delivery:.rejected)
        let result=e.finishSourceNoMovesBoardExit(plan:p,generation:1)
        XCTAssertTrue(result.accepted);XCTAssertTrue(try XCTUnwrap(e.completedSourceNoMovesReceipt).noMovesFlowHandled)
    }
    func testWrongGenerationAndUnconfirmedExitCannotCreateReceipt()throws {
        let e=engine()
        guard case .candidate(let p)=e.beginSourceNoMoves(origin:.levelEnd)else{return XCTFail("candidate")}
        XCTAssertFalse(e.finishSourceNoMovesBoardExit(plan:p,generation:1).accepted)
        XCTAssertFalse(e.finishSourceNoMovesBoardExit(plan:p,generation:2).accepted)
        XCTAssertNil(e.completedSourceNoMovesReceipt)
    }
    func testRestartInvalidatesResultProvenanceEvenIfNextBoardHasSameResolution()throws {
        let e=engine(),p=try confirm(e)
        let result=e.finishSourceNoMovesBoardExit(plan:p,generation:1),r=try XCTUnwrap(e.completedSourceNoMovesReceipt)
        XCTAssertFalse(r.admits(generation:2,resolution:result.resolution))
        e.restart(state:.init(tiles:[],generation:2))
        XCTAssertNil(e.completedSourceNoMovesReceipt)
        XCTAssertFalse(e.finishSourceNoMovesBoardExit(plan:p,generation:1).accepted)
    }
    func testRawTerminalNeverClaimsSourceBoardExit() {
        let e=engine();e.stagedSourceNoMoves=false
        _=e.resolve();XCTAssertNil(e.completedSourceNoMovesReceipt)
    }
}
