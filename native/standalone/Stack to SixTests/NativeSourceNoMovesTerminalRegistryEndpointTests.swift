import XCTest
import StackToSixGameplay
@testable import Stack_to_Six

nonisolated final class NativeSourceNoMovesTerminalRegistryEndpointTests:XCTestCase {
    @MainActor func scope(_ session:NativeGameplaySourceRegistrySession)->NativeGameplaySourceRegistrySession.Scope {
        let scope=session.beginScope(epoch:1);scope.bindParentCurrent{return true};return scope
    }
    @MainActor func engine()->NativeGameplayEngine {
        let e=NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:4),.init(id:"b",cell:.init(column:1,row:0),value:3)]));e.stagedSourceNoMoves=true;return e
    }
    enum Failure:Error {case noPlan}
    @MainActor func lock(_ e:NativeGameplayEngine,endpoint:NativeSourceNoMovesTerminalRegistryEndpoint,observer:@escaping(Bool,Int)->Void={_,_ in}) throws -> NativeNoMovesCandidateOwner.Plan {
        guard case .candidate(let plan)=e.beginSourceNoMoves(origin:.levelEnd) else{throw Failure.noPlan}
        XCTAssertEqual(e.deliverSourceNoMovesWait(plan:plan,generation:1),.exit(plan))
        XCTAssertEqual(e.deliverSourceNoMovesTextExit(plan:plan,generation:1,delivery:.exited),.acquireInputLock(plan))
        _=e.acquireSourceNoMovesLock(plan:plan,generation:1,afterLock:{_ = endpoint.terminalFields(active:true,ttlMilliseconds:12000,observer:observer)})
        return plan
    }
    @MainActor func testNoCapabilityBeforeTruePublicationAndCoreActualLockBeforeObserver()async throws {
        let session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{100}),scope=scope(session),e=engine()
        let endpoint=NativeSourceNoMovesTerminalRegistryEndpoint(scope:scope,engine:e)
        XCTAssertEqual(scope.missing([.terminalNoMovesInput]),["terminalNoMovesInput"])
        XCTAssertFalse(endpoint.current);XCTAssertFalse(endpoint.terminalFields(active:true,ttlMilliseconds:12000,observer:{_,_ in XCTFail()}))
        XCTAssertTrue(endpoint.confirmPublication(current:{true}));XCTAssertTrue(scope.missing([.terminalNoMovesInput]).isEmpty)
        _=try lock(e,endpoint:endpoint){active,ttl in
            XCTAssertTrue(active);XCTAssertEqual(ttl,12000);XCTAssertTrue(e.flags.busyEnding)
            XCTAssertEqual(scope.snapshot(isWild:false)?.inputReasons,["terminal-no-moves"])
        }
        endpoint.retire();XCTAssertEqual(scope.snapshot(isWild:false)?.inputReasons,[])
        XCTAssertEqual(scope.missing([.terminalNoMovesInput]),["terminalNoMovesInput"])
    }
    @MainActor func testCompletedBoardExitDoesNotReleaseUntilExplicitActualFinalCleanup()async throws {
        let session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{100}),scope=scope(session),e=engine()
        let endpoint=NativeSourceNoMovesTerminalRegistryEndpoint(scope:scope,engine:e)
        XCTAssertTrue(endpoint.confirmPublication(current:{true}));let plan=try lock(e,endpoint:endpoint)
        XCTAssertTrue(e.finishSourceNoMovesBoardExit(plan:plan,generation:1).accepted)
        let receipt=try XCTUnwrap(e.completedSourceNoMovesReceipt)
        XCTAssertEqual(scope.snapshot(isWild:false)?.inputReasons,["terminal-no-moves"])
        XCTAssertTrue(endpoint.actualFinalCleanup(receipt:receipt));XCTAssertFalse(endpoint.actualFinalCleanup(receipt:receipt))
        XCTAssertEqual(scope.snapshot(isWild:false)?.inputReasons,[])
    }
    @MainActor func testSameScopeReentrantAObserverInstallsCBeforeAUnhookCannotEraseC()async throws {
        let session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{100}),scope=scope(session),e=engine()
        let a=NativeSourceNoMovesTerminalRegistryEndpoint(scope:scope,engine:e)
        var current=a,c:NativeSourceNoMovesTerminalRegistryEndpoint?
        XCTAssertTrue(a.confirmPublication(current:{current === a}))
        _=try lock(e,endpoint:a){_,_ in
            let replacement=NativeSourceNoMovesTerminalRegistryEndpoint(scope:scope,engine:e);c=replacement;current=replacement
            XCTAssertTrue(replacement.confirmPublication(current:{current === replacement}))
            XCTAssertTrue(replacement.terminalFields(active:true,ttlMilliseconds:12000,observer:{_,_ in}))
            a.retire()
        }
        XCTAssertTrue(try XCTUnwrap(c).current);XCTAssertFalse(a.current)
        XCTAssertTrue(scope.missing([.terminalNoMovesInput]).isEmpty)
        XCTAssertEqual(scope.snapshot(isWild:false)?.inputReasons,["terminal-no-moves"])
        c?.retire();XCTAssertEqual(scope.snapshot(isWild:false)?.inputReasons,[])
        XCTAssertEqual(scope.missing([.terminalNoMovesInput]),["terminalNoMovesInput"])
    }
    @MainActor func testPublicationPredicateRetirementCannotInstallOrReviveCapability()async throws {
        let session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{100}),scope=scope(session),e=engine()
        let a=NativeSourceNoMovesTerminalRegistryEndpoint(scope:scope,engine:e)
        XCTAssertFalse(a.confirmPublication(current:{a.retire();return true}))
        XCTAssertFalse(a.confirmPublication(current:{true}));XCTAssertFalse(a.current)
        XCTAssertEqual(scope.missing([.terminalNoMovesInput]),["terminalNoMovesInput"])
    }
    @MainActor func testRetireBeforeExternalDateCleanupKeepsNewSameScopeCTokenAndCapability()async throws {
        var reenter:(()->Void)?
        let session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{let f=reenter;reenter=nil;f?();return 100}),scope=scope(session),e=engine()
        let a=NativeSourceNoMovesTerminalRegistryEndpoint(scope:scope,engine:e)
        XCTAssertTrue(a.confirmPublication(current:{true}));_=try lock(e,endpoint:a)
        var c:NativeSourceNoMovesTerminalRegistryEndpoint?
        reenter={
            let next=NativeSourceNoMovesTerminalRegistryEndpoint(scope:scope,engine:e);c=next
            XCTAssertTrue(next.confirmPublication(current:{true}))
            XCTAssertTrue(next.terminalFields(active:true,ttlMilliseconds:12000,observer:{_,_ in}))
        }
        a.retire();a.retire()
        XCTAssertTrue(c?.current==true);XCTAssertTrue(scope.missing([.terminalNoMovesInput]).isEmpty)
        XCTAssertEqual(scope.snapshot(isWild:false)?.inputReasons,["terminal-no-moves"])
        c?.retire();XCTAssertEqual(scope.snapshot(isWild:false)?.inputReasons,[])
    }
    @MainActor func testGenerationReplacementRejectsOldEndpointAndOldTrueCannotLockNewRun()async throws {
        let session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{100}),scope=scope(session),e=engine()
        let a=NativeSourceNoMovesTerminalRegistryEndpoint(scope:scope,engine:e)
        XCTAssertTrue(a.confirmPublication(current:{true}));e.restart(state:e.state)
        XCTAssertFalse(a.current);XCTAssertFalse(a.terminalFields(active:true,ttlMilliseconds:12000,observer:{_,_ in XCTFail()}))
        a.retire();XCTAssertEqual(scope.snapshot(isWild:false)?.inputReasons,[])
    }
}
