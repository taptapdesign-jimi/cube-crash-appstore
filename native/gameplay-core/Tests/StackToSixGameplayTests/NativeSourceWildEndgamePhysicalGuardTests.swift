import XCTest
@testable import StackToSixGameplay

/// Core component receipts only; actual APP50/FIFO/face callers are verified
/// separately by the mounted standalone root tests.
final class NativeSourceWildEndgamePhysicalGuardTests:XCTestCase {
    private func make(draw:@escaping()->Double={0.2},mode:NativeRunMode = .arcade)->NativeGameplayEngine {
        let e=NativeGameplayEngine(state:.init(tiles:[
            .init(id:"star",cell:.init(column:0,row:0),value:6,archetype:.star),
            .init(id:"destination",cell:.init(column:1,row:0),value:2),
            .init(id:"other",cell:.init(column:4,row:8),value:1)],mode:mode),
            sourceMathRandom:NativeSourceMathRandomStream(draw:draw))
        e.stagedDirectWildMoves=true;e.stagedDirectWildAssignments=true
        e.sourceWildEndgamePhysicalGuardsEnabled=true
        e.sourceWildSpawnBegin={_ in true};e.sourceWildCoroutineResume={_,_ in true}
        e.sourceWildCoroutineFinally={_,_ in true}
        e.sourceFinalMergePresenceAuthority = .init(isCurrent:{true},capture:{
            .init(canonicalState:e.state,physicalTiles:e.state.tiles,
                  runtime:Dictionary(uniqueKeysWithValues:e.state.tiles.map{($0.id,NativeNoMovesTileRuntime())}))
        })
        return e
    }
    private func begin(_ e:NativeGameplayEngine)throws->NativeDirectWildMovePlan {
        XCTAssertTrue(e.beginDrag(tileID:"star"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
        let plan=try XCTUnwrap(e.pendingDirectWild)
        XCTAssertTrue(e.commitDirectWildGameplay(transactionID:plan.id).accepted)
        XCTAssertTrue(e.releaseSourceDirectInitialAwait(try XCTUnwrap(e.pendingSourceDirectInitialAwait)))
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        return plan
    }
    private func primary(_ e:NativeGameplayEngine,_ plan:NativeDirectWildMovePlan)throws->NativeWildSpawnArrival {
        let delay=try XCTUnwrap(e.pendingWildSpawnActions.first)
        XCTAssertEqual(delay.kind,.wait);XCTAssertEqual(delay.delayMilliseconds,50)
        XCTAssertTrue(e.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:delay.id).accepted)
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        return try XCTUnwrap(e.pendingWildSpawnArrivals.first)
    }
    func testCapturedFiftyCallbackAndTwoAwaitsPrecedePrimaryWithNoGuardEntropy()throws {
        var draws=0
        let e=make(draw:{draws+=1;return 0.2}),plan=try begin(e)
        XCTAssertEqual(e.sourceDirectEndgamePreSpawnChecks,1)
        XCTAssertEqual(e.sourceWildEndgamePhysicalGuardChecks,0)
        let entropy=draws,delay=try XCTUnwrap(e.pendingWildSpawnActions.first)
        XCTAssertEqual(delay.kind,.wait);XCTAssertEqual(delay.delayMilliseconds,50)
        XCTAssertTrue(e.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:delay.id).accepted)
        XCTAssertEqual(e.sourceWildEndgameDelayCallbacks,1);XCTAssertEqual(e.sourceWildEndgamePhysicalGuardChecks,1)
        XCTAssertEqual(draws,entropy);XCTAssertTrue(e.pendingWildSpawnActions.isEmpty)
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertEqual(e.sourceWildEndgamePhysicalGuardChecks,2);XCTAssertEqual(draws,entropy)
        XCTAssertTrue(e.pendingWildSpawnArrivals.isEmpty)
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertGreaterThan(draws,entropy);XCTAssertFalse(e.pendingWildSpawnArrivals.isEmpty)
    }
    func testActualPrimaryArrivalPhysicalVerificationAndAfterGuardPrecedeFinally()throws {
        let e=make(),plan=try begin(e),arrival=try primary(e,plan)
        XCTAssertTrue(e.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id).accepted)
        XCTAssertEqual(e.sourceWildEndgameActiveVerificationChecks,1)
        XCTAssertEqual(e.sourceWildEndgamePhysicalGuardChecks,2)
        XCTAssertFalse(e.hasSettledSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation))
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertEqual(e.sourceWildEndgamePhysicalGuardChecks,3)
        XCTAssertFalse(e.hasSettledSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation))
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertFalse(e.hasSettledSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation))
        XCTAssertEqual(e.pendingWildSpawnActions.count,3,"Arcade Star keeps Journey's saved extra drops")
        while let action=e.pendingWildSpawnActions.first {
            XCTAssertTrue(e.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:action.id).accepted)
            XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        }
        XCTAssertTrue(e.hasSettledSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation))
        XCTAssertNil(e.sourceNoMovesRuntimeAuthority)
    }
    func testEndgameBeforeSingleCaptureRestartCannotConstructOrDrawSuccessor()throws {
        var draws=0
        let e=make(draw:{draws+=1;return 0.2}),plan=try begin(e),delay=try XCTUnwrap(e.pendingWildSpawnActions.first)
        XCTAssertTrue(e.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:delay.id).accepted)
        let entropy=draws
        e.sourceFinalMergePresenceAuthority = .init(isCurrent:{true},capture:{
            let old=e.state
            let snapshot=NativeSourceFinalMergePresenceAuthority.Snapshot(canonicalState:old,physicalTiles:old.tiles,
                runtime:Dictionary(uniqueKeysWithValues:old.tiles.map{($0.id,NativeNoMovesTileRuntime())}))
            e.restart(state:.init(tiles:[.init(id:"successor",cell:.init(column:0,row:0),value:4)]))
            return snapshot
        })
        XCTAssertFalse(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertEqual(e.state.tiles.map(\.id),["successor"]);XCTAssertEqual(e.state.moves,50)
        XCTAssertEqual(draws,entropy);XCTAssertEqual(e.sourceWildEndgamePhysicalGuardChecks,0)
        XCTAssertTrue(e.pendingWildSpawnActions.isEmpty)
    }
    func testUnknownPhysicalCaptureAfterGuardCannotManufactureCleanBoardOrFinally()throws {
        let e=make(),plan=try begin(e),arrival=try primary(e,plan)
        XCTAssertTrue(e.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id).accepted)
        e.sourceFinalMergePresenceAuthority = .init(isCurrent:{true},capture:{nil})
        XCTAssertFalse(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertEqual(e.sourceWildEndgamePhysicalGuardChecks,2)
        XCTAssertFalse(e.hasSettledSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation))
        XCTAssertNil(e.state.terminal);XCTAssertNil(e.sourceNoMovesRuntimeAuthority)
    }
    func testNegativeHardPhysicalVerificationReturnsThroughOriginalRecoveryRatherThanRefusingAdmission()throws {
        let e=make()
        e.wildSpawnPermitAdmission={purpose in purpose != .primary}
        let plan=try begin(e)
        let delay=try XCTUnwrap(e.pendingWildSpawnActions.first)
        XCTAssertTrue(e.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:delay.id).accepted)
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        for _ in 0..<8 {
            guard let action=e.pendingWildSpawnActions.first else {
                XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted);continue
            }
            if action.kind == .hardPrimary {break}
            XCTAssertTrue(e.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:action.id).accepted)
        }
        let hard=try XCTUnwrap(e.pendingWildSpawnActions.first);XCTAssertEqual(hard.kind,.hardPrimary)
        e.sourceFinalMergePresenceAuthority = .init(isCurrent:{true},capture:{
            var physical=e.state.tiles
            for index in physical.indices where physical[index].cell==plan.destination.cell {physical[index].visible=false}
            return .init(canonicalState:e.state,physicalTiles:physical,
                runtime:Dictionary(uniqueKeysWithValues:physical.map{($0.id,NativeNoMovesTileRuntime())}))
        })
        var retired:[String]=[]
        e.sourceWildFailedPrimaryRetire={tile,owner,generation in
            guard owner==plan.id,generation==plan.generation else{return false}
            retired.append(tile.id);return true
        }
        let result=e.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:hard.id)
        XCTAssertTrue(result.accepted)
        let firstFailed=try XCTUnwrap(e.state.tile(at:plan.destination.cell))
        XCTAssertNil(e.state.terminal)
        XCTAssertGreaterThan(e.sourceWildEndgameActiveVerificationChecks,0)
        XCTAssertFalse(e.hasSettledSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation))
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertFalse(e.pendingWildSpawnActions.isEmpty,"Negative verification retains real recovery work")
        let secondHard=try XCTUnwrap(e.pendingWildSpawnActions.first)
        XCTAssertEqual(secondHard.kind,.hardPrimary)
        XCTAssertTrue(e.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:secondHard.id).accepted)
        XCTAssertEqual(retired,[firstFailed.id],"Real negative Wild capture authorizes only its exact failed holder retirement")
        XCTAssertFalse(e.state.tiles.contains{$0.id==firstFailed.id})
        XCTAssertNotEqual(e.state.tile(at:plan.destination.cell)?.id,firstFailed.id,"Second hard constructor is not skipped by stale occupied cell")
    }
    func testGenuineJourneyEndgameOuterBonusBothAwaitsPrecedeCapturedPrimaryFifty()throws {
        let e=make(mode:.journey)
        e.sourceDirectEndgameLockedBonusGuardsEnabled=true
        var receipts:[NativeSourceDirectLockedBonusGuardReceipt]=[]
        e.sourceDirectLockedBonusGuardResume={receipts.append($0);return true}
        let plan=try begin(e)
        XCTAssertEqual(e.sourceDirectEndgamePreSpawnChecks,1)
        XCTAssertEqual(e.sourceDirectEndgameLockedBonusGuardChecks,1)
        XCTAssertEqual(e.sourceWildEndgameDelayCallbacks,0);XCTAssertEqual(e.sourceWildEndgamePhysicalGuardChecks,0)
        XCTAssertTrue(e.pendingWildLockedBonusPresentations.isEmpty)
        XCTAssertTrue(e.resumeSourceDirectLockedBonusGuard(try XCTUnwrap(receipts.first)).accepted)
        XCTAssertEqual(e.sourceDirectEndgameLockedBonusGuardChecks,2)
        XCTAssertTrue(e.pendingWildLockedBonusPresentations.isEmpty)
        XCTAssertTrue(e.resumeSourceDirectLockedBonusGuard(try XCTUnwrap(receipts.last)).accepted)
        XCTAssertEqual(e.pendingWildLockedBonusPresentations.count,9)
        XCTAssertEqual(e.sourceWildEndgameDelayCallbacks,0)
        XCTAssertNil(e.pendingSourceDirectLockedBonusGuard)
        let wait=try XCTUnwrap(e.pendingWildSpawnActions.first)
        XCTAssertEqual(wait.kind,.wait);XCTAssertEqual(wait.delayMilliseconds,50)
        XCTAssertEqual(wait.transactionID,plan.id)
    }
}
