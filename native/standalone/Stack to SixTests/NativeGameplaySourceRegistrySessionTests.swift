import XCTest
@testable import Stack_to_Six
import StackToSixGameplay

nonisolated final class NativeGameplaySourceRegistrySessionTests:XCTestCase {
    @MainActor func scope(_ session:NativeGameplaySourceRegistrySession,epoch:UInt64=1)->NativeGameplaySourceRegistrySession.Scope {
        let s=session.beginScope(epoch:epoch);s.bindParentCurrent{return true};return s
    }
    @MainActor func failingEngine()->NativeGameplayEngine {
        let e=NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:4),.init(id:"b",cell:.init(column:1,row:0),value:3)]))
        e.stagedSourceNoMoves=true;return e
    }
    @MainActor func lock(_ e:NativeGameplayEngine,after:@escaping()->Void) throws -> NativeNoMovesCandidateOwner.Plan {
        guard case .candidate(let p)=e.beginSourceNoMoves(origin:.levelEnd) else{throw Failure.noPlan}
        XCTAssertEqual(e.deliverSourceNoMovesWait(plan:p,generation:1),.exit(p))
        XCTAssertEqual(e.deliverSourceNoMovesTextExit(plan:p,generation:1,delivery:.exited),.acquireInputLock(p))
        XCTAssertEqual(e.acquireSourceNoMovesLock(plan:p,generation:1,afterLock:after),.confirmedFinal(p))
        return p
    }
    enum Failure:Error {case noPlan}
    @MainActor func testActualPostLockTwelveSecondLazyPrunePreservesCoreBusyAndFinalCleanup() async throws {
        var now=100.0;let session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{now}),s=scope(session),e=failingEngine()
        let binder=NativeSourceNoMovesTerminalFieldsBinder(scope:s,engine:e);binder.callbackMounted()
        let p=try lock(e){XCTAssertTrue(binder.terminalFields(active:true,ttlMilliseconds:12000))}
        XCTAssertEqual(s.snapshot(isWild:false)?.inputReasons,["terminal-no-moves"])
        now=12099;XCTAssertEqual(s.snapshot(isWild:false)?.inputReasons.count,1)
        now=12100;XCTAssertEqual(s.snapshot(isWild:false)?.inputReasons,[])
        XCTAssertTrue(e.flags.busyEnding);XCTAssertEqual(s.snapshot(isWild:false)?.failScreenPending,true)
        let result=e.finishSourceNoMovesBoardExit(plan:p,generation:1);XCTAssertTrue(result.accepted)
        let receipt=try XCTUnwrap(e.completedSourceNoMovesReceipt)
        XCTAssertTrue(binder.resultCleanup(receipt:receipt));XCTAssertFalse(binder.resultCleanup(receipt:receipt))
        XCTAssertEqual(s.snapshot(isWild:false)?.failScreenPending,false)
    }
    @MainActor func testNoMovesCannotMountFromCandidateBeforeActualLockOrWithoutEndpoint() async throws {
        let session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{100}),s=scope(session),e=failingEngine()
        guard case .candidate=e.beginSourceNoMoves(origin:.levelEnd) else{throw Failure.noPlan}
        XCTAssertNil(s.lockNoMoves(engine:e,generation:1,ttlMilliseconds:12000))
        s.endpointMounted(.terminalNoMovesInput)
        XCTAssertNil(s.lockNoMoves(engine:e,generation:1,ttlMilliseconds:12000))
        XCTAssertEqual(s.snapshot(isWild:false)?.inputReasons,[])
    }
    @MainActor func testRetiredSameGenerationAReleaseCannotEraseReplacementCTerminalKey() async throws {
        let session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{100}),a=scope(session),ae=failingEngine()
        let ab=NativeSourceNoMovesTerminalFieldsBinder(scope:a,engine:ae);ab.callbackMounted()
        _ = try lock(ae){XCTAssertTrue(ab.terminalFields(active:true,ttlMilliseconds:12000))};a.dispose()
        let c=scope(session,epoch:2),ce=failingEngine(),cb=NativeSourceNoMovesTerminalFieldsBinder(scope:c,engine:ce);cb.callbackMounted()
        _ = try lock(ce){XCTAssertTrue(cb.terminalFields(active:true,ttlMilliseconds:12000))}
        XCTAssertFalse(ab.terminalFields(active:false,ttlMilliseconds:12000))
        XCTAssertEqual(c.snapshot(isWild:false)?.inputReasons,["terminal-no-moves"])
        XCTAssertTrue(cb.terminalFields(active:false,ttlMilliseconds:12000))
    }
    @MainActor func testDateReentrantScopeReplacementRejectsStaleClaim() async throws {
        var replace:(()->Void)?
        let session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{let f=replace;replace=nil;f?();return 100}),a=scope(session)
        a.endpointMounted(.specialContactCommitRelease)
        var c:NativeGameplaySourceRegistrySession.Scope?
        replace={c=self.scope(session,epoch:2);c?.endpointMounted(.specialContactCommitRelease)}
        XCTAssertNil(a.claimSpecial(kind:.star));XCTAssertFalse(a.current)
        XCTAssertEqual(c?.claimSpecial(kind:.juice),1)
    }
    @MainActor func testNoMovesDateReentryFalseDoesNotRepublishOuterCapture() async throws {
        var reenter:(()->Void)?
        let session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{let f=reenter;reenter=nil;f?();return 100}),s=scope(session),e=failingEngine()
        let b=NativeSourceNoMovesTerminalFieldsBinder(scope:s,engine:e);b.callbackMounted()
        reenter={_ = b.terminalFields(active:false,ttlMilliseconds:12000)}
        _ = try lock(e){XCTAssertFalse(b.terminalFields(active:true,ttlMilliseconds:12000))}
        XCTAssertEqual(s.snapshot(isWild:false)?.inputReasons,[])
        XCTAssertEqual(s.snapshot(isWild:false)?.failScreenPending,false)
    }
    @MainActor func testActualSpecialClaimCommitWildOnlyReleaseAndMonotonicAppTokens() async throws {
        var now=10.0;let session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{now}),a=scope(session)
        a.endpointMounted(.specialContactCommitRelease)
        let token=try XCTUnwrap(a.claimSpecial(kind:.tnt))
        XCTAssertEqual(a.snapshot(isWild:false)?.inputReasons,["special-transaction"])
        now=20;XCTAssertTrue(a.commitSpecial(token:token,revision:3))
        XCTAssertEqual(a.snapshot(isWild:false)?.inputReasons,[])
        XCTAssertEqual(a.snapshot(isWild:true)?.inputReasons,["special-transaction"])
        XCTAssertEqual(a.snapshot(isWild:true)?.special?.phase,.visualTail)
        XCTAssertEqual(a.snapshot(isWild:true)?.special?.expiresAt,15010)
        a.dispose();let c=scope(session,epoch:2);c.endpointMounted(.specialContactCommitRelease)
        XCTAssertFalse(c.releaseSpecial(token:token));XCTAssertTrue(a.releaseSpecial(token:token))
        XCTAssertFalse(a.releaseSpecial(token:token));XCTAssertEqual(c.claimSpecial(kind:.star),2)
    }
    @MainActor func testLazySpecialExpiryDoesNotManufactureCompletionAndStaleReleaseKeepsNewGate() async throws {
        var now=100.0;let session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{now}),a=scope(session)
        a.endpointMounted(.specialContactCommitRelease);let token=try XCTUnwrap(a.claimSpecial(kind:.magnet))
        now=15100;let c=scope(session,epoch:2);c.endpointMounted(.specialContactCommitRelease)
        XCTAssertEqual(c.claimSpecial(kind:.juice),2)
        XCTAssertFalse(a.releaseSpecial(token:token))
        XCTAssertEqual(c.snapshot(isWild:false)?.inputReasons,["special-transaction"])
        XCTAssertEqual(c.snapshot(isWild:false)?.special?.token,2)
    }
    @MainActor func testMagnetGuardBeyondTtlRequiresCapturedOwnLifecycleFinallyOnce() async throws {
        var now=100.0;let session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{now}),a=scope(session)
        a.endpointMounted(.magnetGuardBeginFinally);let one=try XCTUnwrap(a.beginMagnetGuard()),two=try XCTUnwrap(a.beginMagnetGuard())
        now=100000;XCTAssertEqual(a.snapshot(isWild:false)?.endgameGuard.count,2)
        a.dispose();let c=scope(session,epoch:2);c.endpointMounted(.magnetGuardBeginFinally)
        XCTAssertFalse(c.releaseMagnetGuard(one,ownsLifecycle:true));XCTAssertFalse(a.releaseMagnetGuard(one,ownsLifecycle:false))
        XCTAssertTrue(a.releaseMagnetGuard(one,ownsLifecycle:true));XCTAssertFalse(a.releaseMagnetGuard(one,ownsLifecycle:true))
        XCTAssertEqual(c.snapshot(isWild:false)?.endgameGuard.sources,["mergePulledTilesIntoMerge6"])
        XCTAssertTrue(a.releaseMagnetGuard(two,ownsLifecycle:true));XCTAssertEqual(c.snapshot(isWild:false)?.endgameGuard.active,false)
    }
    @MainActor func testParentCurrentReentrySealAndEmptyCapabilitiesDoNotAdmitProducer() async throws {
        let session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{100}),a=session.beginScope(epoch:1)
        var retired=false;a.bindParentCurrent {if !retired {retired=true;a.dispose()};return true}
        a.endpointMounted(.sourceTileLifecycle);XCTAssertFalse(a.current)
        XCTAssertNil(a.snapshot(isWild:false));XCTAssertEqual(a.missing([.sourceTileLifecycle]),["sourceTileLifecycle"])
    }
}
