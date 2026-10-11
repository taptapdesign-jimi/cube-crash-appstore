import XCTest
@testable import StackToSixGameplay

final class NativeSourceWildExtraFinalGuardTests:XCTestCase {
    private func make(resume:Bool=true,random:@escaping()->Double={0.2})->NativeGameplayEngine {
        let e=NativeGameplayEngine(state:.init(tiles:[
            .init(id:"star",cell:.init(column:0,row:0),value:6,starOrbitCount:3,archetype:.star),
            .init(id:"destination",cell:.init(column:1,row:0),value:2),
            .init(id:"other",cell:.init(column:4,row:8),value:3),
            .init(id:"locked",cell:.init(column:0,row:1),value:0,locked:true)],board:8),sourceMathRandom:NativeSourceMathRandomStream(draw:random))
        e.stagedDirectWildMoves=true;e.stagedDirectWildAssignments=true
        e.sourceWildExtraFinalGuardsEnabled=true
        if resume {e.sourceWildCoroutineResume={_,_ in true}}
        e.sourceWildCoroutineFinally={_,_ in true}
        e.sourceWildMinimumTileAuthority = .init(isCurrent:{true},capture:{
            guard let paint=NativeSourceNoMovesRuntimeSnapshot.PaintedStateReceipt(canonicalState:e.state,paintedState:e.state) else{return nil}
            return .init(paint:paint,tiles:Dictionary(uniqueKeysWithValues:e.state.tiles.map{($0.id,NativeNoMovesTileRuntime())}))
        })
        e.sourceFinalMergePresenceAuthority = .init(isCurrent:{true},capture:{
            .init(canonicalState:e.state,physicalTiles:e.state.tiles,runtime:Dictionary(uniqueKeysWithValues:e.state.tiles.map{($0.id,NativeNoMovesTileRuntime())}))
        })
        return e
    }
    private func reserve(_ e:NativeGameplayEngine)throws->NativeDirectWildMovePlan {
        XCTAssertTrue(e.beginDrag(tileID:"star"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
        return try XCTUnwrap(e.pendingDirectWild)
    }
    private func step(_ e:NativeGameplayEngine,_ plan:NativeDirectWildMovePlan)->NativeMoveResult {
        if let action=e.pendingWildSpawnActions.first {return e.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:action.id)}
        if let arrival=e.pendingWildSpawnArrivals.first {return e.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id)}
        return e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation)
    }
    func testActualStarSelectionWaitsForBothPhysicalExtraGuardReactionsWithoutGuardEntropy()throws {
        var draws=0
        let e=make(random:{draws+=1;return 0.2}),plan=try reserve(e)
        var minimumReads=0
        let actualMinimum=try XCTUnwrap(e.sourceWildMinimumTileAuthority)
        e.sourceWildMinimumTileAuthority = .init(isCurrent:actualMinimum.isCurrent,capture:{minimumReads+=1;return actualMinimum.capture()})
        XCTAssertTrue(e.commitDirectWildGameplay(transactionID:plan.id).accepted)
        for _ in 0..<50 where minimumReads==0 {XCTAssertTrue(step(e,plan).accepted)}
        XCTAssertEqual(minimumReads,1);XCTAssertEqual(e.sourceWildExtraFinalGuardChecks,0)
        XCTAssertTrue(e.pendingWildSpawnActions.isEmpty,"Sufficient minimum's own Promise await precedes any extra guard")
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertEqual(e.sourceWildExtraFinalGuardChecks,1)
        XCTAssertTrue(e.pendingWildSpawnActions.isEmpty);XCTAssertTrue(e.pendingWildSpawnArrivals.isEmpty)
        let before=e.state,entropy=draws
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertEqual(e.sourceWildExtraFinalGuardChecks,2);XCTAssertEqual(draws,entropy)
        XCTAssertEqual(e.state,before);XCTAssertTrue(e.pendingWildSpawnActions.isEmpty)
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertFalse(e.pendingWildSpawnActions.isEmpty);XCTAssertGreaterThan(draws,entropy)
        XCTAssertNil(e.sourceNoMovesRuntimeAuthority)
    }
    func testMissingActualCoroutineBridgeCannotFallBackToRawExtraSelection()throws {
        let e=make(resume:false),plan=try reserve(e)
        XCTAssertTrue(e.commitDirectWildGameplay(transactionID:plan.id).accepted)
        var rejected=false
        for _ in 0..<50 where !rejected {rejected = !step(e,plan).accepted}
        XCTAssertTrue(rejected);XCTAssertEqual(e.sourceWildExtraFinalGuardChecks,0)
        XCTAssertTrue(e.pendingWildSpawnActions.isEmpty);XCTAssertNil(e.sourceNoMovesRuntimeAuthority)
    }
    func testExtraPhysicalCaptureRestartCannotAdvanceOldPhaseOrDrawSuccessorSelection()throws {
        let e=make(),plan=try reserve(e)
        e.sourceFinalMergePresenceAuthority = .init(isCurrent:{true},capture:{
            let old=e.state
            let captured=NativeSourceFinalMergePresenceAuthority.Snapshot(canonicalState:old,physicalTiles:old.tiles,runtime:Dictionary(uniqueKeysWithValues:old.tiles.map{($0.id,NativeNoMovesTileRuntime())}))
            e.restart(state:.init(tiles:[.init(id:"successor",cell:.init(column:0,row:0),value:4)]))
            return captured
        })
        XCTAssertTrue(e.commitDirectWildGameplay(transactionID:plan.id).accepted)
        var rejected=false
        for _ in 0..<50 where !rejected {rejected = !step(e,plan).accepted}
        XCTAssertTrue(rejected);XCTAssertEqual(e.state.tiles.map(\.id),["successor"])
        XCTAssertEqual(e.state.moves,50);XCTAssertEqual(e.sourceWildExtraFinalGuardChecks,0)
        XCTAssertTrue(e.pendingWildSpawnActions.isEmpty)
    }
    func testCancelledNormalArrivalRequestsExactRetainedCleanupAfterActualFinally()throws {
        let e=make()
        e.sourceDirectNormalPreSpawnGuardsEnabled=true;e.sourceWildSpawnBegin={_ in true}
        e.sourceDirectPhysicalFinalSnapshotEnabled=true
        var order:[String]=[],cleanups:[NativeGameplayEngine.SourceRetainedDirectDestination]=[]
        e.sourceWildCoroutineFinally={_,_ in order.append("finally");return true}
        e.sourceRetainedDirectDestinationCleanup={receipt in order.append("cleanup");cleanups.append(receipt);return true}
        let plan=try reserve(e)
        XCTAssertTrue(e.commitDirectWildGameplay(transactionID:plan.id).accepted)
        let retained=try XCTUnwrap(e.sourceRetainedDirectDestination)
        XCTAssertFalse(retained.endgame)
        XCTAssertTrue(e.releaseSourceDirectInitialAwait(try XCTUnwrap(e.pendingSourceDirectInitialAwait)))
        for _ in 0..<64 {
            if !e.pendingWildSpawnArrivals.isEmpty {break}
            XCTAssertTrue(step(e,plan).accepted)
        }
        let arrival=try XCTUnwrap(e.pendingWildSpawnArrivals.first)
        let primary=try XCTUnwrap(e.state.tiles.first{$0.id==arrival.tileID})
        XCTAssertTrue(e.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id,interrupted:true).accepted)
        XCTAssertEqual(order,["finally","cleanup"]);XCTAssertEqual(cleanups,[retained])
        XCTAssertTrue(e.hasSettledSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation))
        XCTAssertEqual(e.state.tiles.first{$0.id==primary.id},primary,"Rejected awaited arrival never sweeps the separately constructed primary")
        XCTAssertTrue(e.removeSourceRetainedDirectDestination(retained).accepted)
        XCTAssertNil(e.sourceRetainedDirectDestination)
        XCTAssertFalse(e.state.sourceDetachedGridTileIDs?.contains(retained.tileID) ?? false)
        XCTAssertEqual(e.state.tiles.first{$0.id==primary.id},primary)
    }
    func testNormalDirectInitialPhysicalPublicationAndBothAwaitsPrecedeSelection()throws {
        var draws=0
        let e=make(random:{draws+=1;return 0.2})
        e.sourceDirectNormalPreSpawnGuardsEnabled=true;e.sourceWildSpawnBegin={_ in true}
        let plan=try reserve(e)
        XCTAssertTrue(e.commitDirectWildGameplay(transactionID:plan.id).accepted)
        let receipt=try XCTUnwrap(e.pendingSourceDirectInitialAwait),entropy=draws
        XCTAssertEqual(e.sourceDirectNormalPreSpawnChecks,0)
        XCTAssertTrue(e.pendingWildSpawnActions.isEmpty);XCTAssertTrue(e.pendingWildLockedBonusPresentations.isEmpty)
        XCTAssertFalse(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertTrue(e.releaseSourceDirectInitialAwait(receipt))
        XCTAssertEqual(e.sourceDirectNormalPreSpawnChecks,1);XCTAssertEqual(draws,entropy)
        XCTAssertFalse(e.releaseSourceDirectInitialAwait(receipt))
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertEqual(e.sourceDirectNormalPreSpawnChecks,2);XCTAssertEqual(draws,entropy)
        XCTAssertTrue(e.pendingWildSpawnActions.isEmpty);XCTAssertTrue(e.pendingWildLockedBonusPresentations.isEmpty)
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertNil(e.pendingSourceDirectInitialAwait);XCTAssertGreaterThan(draws,entropy)
        XCTAssertFalse(e.pendingWildLockedBonusPresentations.isEmpty)
        XCTAssertNil(e.sourceNoMovesRuntimeAuthority)
    }
    func testDirectInitialPhysicalCaptureRestartProtectsSuccessorBeforeAnySelection()throws {
        let e=make();e.sourceDirectNormalPreSpawnGuardsEnabled=true;e.sourceWildSpawnBegin={_ in true}
        let plan=try reserve(e)
        XCTAssertTrue(e.commitDirectWildGameplay(transactionID:plan.id).accepted)
        let receipt=try XCTUnwrap(e.pendingSourceDirectInitialAwait)
        e.sourceFinalMergePresenceAuthority = .init(isCurrent:{true},capture:{
            let old=e.state
            let captured=NativeSourceFinalMergePresenceAuthority.Snapshot(canonicalState:old,physicalTiles:old.tiles,runtime:Dictionary(uniqueKeysWithValues:old.tiles.map{($0.id,NativeNoMovesTileRuntime())}))
            e.restart(state:.init(tiles:[.init(id:"successor",cell:.init(column:0,row:0),value:4)]))
            return captured
        })
        XCTAssertFalse(e.releaseSourceDirectInitialAwait(receipt))
        XCTAssertEqual(e.state.tiles.map(\.id),["successor"]);XCTAssertEqual(e.state.moves,50)
        XCTAssertEqual(e.sourceDirectNormalPreSpawnChecks,0);XCTAssertNil(e.pendingSourceDirectInitialAwait)
        XCTAssertTrue(e.pendingWildSpawnActions.isEmpty)
    }
    func testDirectInitialMissingPhysicalDependencyRefusesBeforeGameplayDebit()throws {
        let e=make();e.sourceDirectNormalPreSpawnGuardsEnabled=true;e.sourceWildSpawnBegin={_ in true}
        let plan=try reserve(e),before=e.state
        e.sourceFinalMergePresenceAuthority=nil
        XCTAssertFalse(e.commitDirectWildGameplay(transactionID:plan.id).accepted)
        XCTAssertEqual(e.state,before);XCTAssertNil(e.pendingSourceDirectInitialAwait)
        XCTAssertTrue(e.pendingWildSpawnActions.isEmpty)
    }
    func testBothRejectedDirectInitialEnqueuesRetireWithoutRawReplay()throws {
        for rejectSecond in [false,true] {
            let e=make();e.sourceDirectNormalPreSpawnGuardsEnabled=true;e.sourceWildSpawnBegin={_ in true}
            let plan=try reserve(e)
            XCTAssertTrue(e.commitDirectWildGameplay(transactionID:plan.id).accepted)
            let receipt=try XCTUnwrap(e.pendingSourceDirectInitialAwait)
            if rejectSecond {
                XCTAssertTrue(e.releaseSourceDirectInitialAwait(receipt))
                e.sourceWildCoroutineResume={_,_ in false}
                XCTAssertFalse(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
            } else {
                e.sourceWildCoroutineResume={_,_ in false}
                XCTAssertFalse(e.releaseSourceDirectInitialAwait(receipt))
            }
            XCTAssertNil(e.pendingSourceDirectInitialAwait)
            XCTAssertFalse(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
            XCTAssertTrue(e.pendingWildSpawnActions.isEmpty);XCTAssertTrue(e.pendingWildLockedBonusPresentations.isEmpty)
        }
    }
    func testDirectInitialInlineReplyAndRetiredReceiptCannotConstruct()throws {
        let e=make();e.sourceDirectNormalPreSpawnGuardsEnabled=true;e.sourceWildSpawnBegin={_ in true}
        let plan=try reserve(e)
        XCTAssertTrue(e.commitDirectWildGameplay(transactionID:plan.id).accepted)
        let receipt=try XCTUnwrap(e.pendingSourceDirectInitialAwait)
        e.sourceWildCoroutineResume={id,generation in
            XCTAssertFalse(e.resumeSourceWildSpawnCoroutine(transactionID:id,generation:generation).accepted)
            return true
        }
        XCTAssertTrue(e.releaseSourceDirectInitialAwait(receipt))
        XCTAssertTrue(e.pendingWildSpawnActions.isEmpty)
        XCTAssertTrue(e.retireSourceDirectInitialAwait(receipt))
        XCTAssertFalse(e.releaseSourceDirectInitialAwait(receipt))
        XCTAssertFalse(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertTrue(e.pendingWildLockedBonusPresentations.isEmpty)
    }
    private func beginOuter(_ e:NativeGameplayEngine)throws->NativeDirectWildMovePlan {
        e.sourceDirectNormalPreSpawnGuardsEnabled=true;e.sourceDirectNormalLockedBonusGuardsEnabled=true
        e.sourceWildSpawnBegin={_ in true}
        let plan=try reserve(e)
        XCTAssertTrue(e.commitDirectWildGameplay(transactionID:plan.id).accepted)
        XCTAssertTrue(e.releaseSourceDirectInitialAwait(try XCTUnwrap(e.pendingSourceDirectInitialAwait)))
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        return plan
    }
    func testOuterBonusInheritsActualFaintHolderAlphaInsteadOfCanonicalConstructorAlpha()throws {
        let e=make();var receipts:[NativeSourceDirectLockedBonusGuardReceipt]=[]
        e.sourceDirectLockedBonusGuardResume={receipts.append($0);return true}
        e.sourceFinalMergePresenceAuthority = .init(isCurrent:{true},capture:{
            var actual=e.state.tiles
            for index in actual.indices where actual[index].id=="locked" {actual[index].alpha=0.25}
            return .init(canonicalState:e.state,physicalTiles:actual,
                runtime:Dictionary(uniqueKeysWithValues:actual.map{($0.id,NativeNoMovesTileRuntime())}))
        })
        _=try beginOuter(e)
        XCTAssertEqual(e.state.tiles.first{$0.id=="locked"}?.alpha,1,"Actual Source constructor model may retain alpha1 while its painted holder is faint")
        XCTAssertTrue(e.resumeSourceDirectLockedBonusGuard(try XCTUnwrap(receipts.first)).accepted)
        XCTAssertTrue(e.resumeSourceDirectLockedBonusGuard(try XCTUnwrap(receipts.last)).accepted)
        XCTAssertEqual(e.pendingWildLockedBonusPresentations.count,9)
        XCTAssertTrue(e.pendingWildLockedBonusPresentations.allSatisfy{$0.alpha==0.25},"v9 captures the actual existing locked holder's alpha")
    }
    func testOuterBonusMissingOrRetiredPhysicalObservationCannotAllocateOrDraw()throws {
        for retireDuringCapture in [false,true] {
            var draws=0,receipts:[NativeSourceDirectLockedBonusGuardReceipt]=[]
            let e=make(random:{draws+=1;return 0.2})
            e.sourceDirectLockedBonusGuardResume={receipts.append($0);return true}
            _=try beginOuter(e)
            XCTAssertTrue(e.resumeSourceDirectLockedBonusGuard(try XCTUnwrap(receipts.first)).accepted)
            var admitted=true
            let authority=NativeSourceFinalMergePresenceAuthority(isCurrent:{admitted},capture:{
                guard retireDuringCapture else{return nil}
                let snapshot=NativeSourceFinalMergePresenceAuthority.Snapshot(canonicalState:e.state,physicalTiles:e.state.tiles,
                    runtime:Dictionary(uniqueKeysWithValues:e.state.tiles.map{($0.id,NativeNoMovesTileRuntime())}))
                admitted=false;return snapshot
            })
            e.sourceFinalMergePresenceAuthority=authority
            let entropy=draws,before=e.state
            XCTAssertFalse(e.resumeSourceDirectLockedBonusGuard(try XCTUnwrap(receipts.last)).accepted)
            XCTAssertEqual(draws,entropy);XCTAssertEqual(e.state,before)
            XCTAssertTrue(e.pendingWildLockedBonusPresentations.isEmpty)
        }
    }
    func testPartialBonusSeamKeepsItsCanonicalReferenceWithoutBorrowingFullPhysicalAdmission()throws {
        let e=make(),plan=try reserve(e)
        XCTAssertFalse(e.sourceDirectNormalLockedBonusGuardsEnabled)
        e.sourceFinalMergePresenceAuthority = .init(isCurrent:{true},capture:{
            var actual=e.state.tiles
            for index in actual.indices where actual[index].id=="locked" {actual[index].alpha=0.25}
            return .init(canonicalState:e.state,physicalTiles:actual,
                runtime:Dictionary(uniqueKeysWithValues:actual.map{($0.id,NativeNoMovesTileRuntime())}))
        })
        XCTAssertTrue(e.commitDirectWildGameplay(transactionID:plan.id).accepted)
        for _ in 0..<64 where e.pendingWildLockedBonusPresentations.isEmpty {XCTAssertTrue(step(e,plan).accepted)}
        XCTAssertEqual(e.pendingWildLockedBonusPresentations.count,9)
        XCTAssertTrue(e.pendingWildLockedBonusPresentations.allSatisfy{$0.alpha==1})
    }
    func testDirectOuterPrimaryStartsBeforeTwoIndependentBonusAwaitsAndNineConstructors()throws {
        var draws=0,receipts:[NativeSourceDirectLockedBonusGuardReceipt]=[]
        let e=make(random:{draws+=1;return 0.2})
        e.sourceDirectLockedBonusGuardResume={receipts.append($0);return true}
        let plan=try beginOuter(e)
        XCTAssertEqual(e.sourceDirectNormalPreSpawnChecks,2);XCTAssertEqual(e.sourceDirectNormalLockedBonusGuardChecks,1)
        XCTAssertFalse(e.pendingWildSpawnArrivals.isEmpty,"Actual primary bounce was published before outer helper")
        XCTAssertTrue(e.pendingWildLockedBonusPresentations.isEmpty)
        let entropy=draws,pre=try XCTUnwrap(receipts.first)
        XCTAssertEqual(pre.ownerID,plan.id);XCTAssertEqual(pre.stage,.preSpawn)
        XCTAssertTrue(e.resumeSourceDirectLockedBonusGuard(pre).accepted)
        XCTAssertEqual(e.sourceDirectNormalLockedBonusGuardChecks,2);XCTAssertEqual(draws,entropy)
        XCTAssertTrue(e.pendingWildLockedBonusPresentations.isEmpty)
        XCTAssertFalse(e.resumeSourceDirectLockedBonusGuard(pre).accepted)
        let single=try XCTUnwrap(receipts.last);XCTAssertEqual(single.stage,.singleMergeSix)
        XCTAssertTrue(e.resumeSourceDirectLockedBonusGuard(single).accepted)
        XCTAssertEqual(e.pendingWildLockedBonusPresentations.count,9);XCTAssertGreaterThan(draws,entropy)
        XCTAssertNil(e.pendingSourceDirectLockedBonusGuard)
        XCTAssertFalse(e.resumeSourceDirectLockedBonusGuard(single).accepted)
    }
    func testDirectOuterCanResumeAfterGenuinePrimaryFinallyWithoutTntConversion()throws {
        let e=make();var receipts:[NativeSourceDirectLockedBonusGuardReceipt]=[]
        e.sourceDirectLockedBonusGuardResume={receipts.append($0);return true}
        let plan=try beginOuter(e)
        for _ in 0..<80 where !e.hasSettledSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation) {
            XCTAssertTrue(step(e,plan).accepted)
        }
        XCTAssertTrue(e.hasSettledSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation))
        XCTAssertFalse(e.hasSettledSourceTntSpawnCoroutine(transactionID:plan.id,generation:plan.generation))
        XCTAssertTrue(e.hasUnsavableSourceGameplayState,"The still-owned outer helper blocks a partial Native snapshot after independent primary finally")
        XCTAssertTrue(e.resumeSourceDirectLockedBonusGuard(try XCTUnwrap(receipts.first)).accepted)
        XCTAssertTrue(e.resumeSourceDirectLockedBonusGuard(try XCTUnwrap(receipts.last)).accepted)
        XCTAssertEqual(e.pendingWildLockedBonusPresentations.count,9)
    }
    func testDirectOuterRejectedSecondEnqueueRetiresWithoutConstructorOrPrimaryReplay()throws {
        let e=make();var receipts:[NativeSourceDirectLockedBonusGuardReceipt]=[]
        e.sourceDirectLockedBonusGuardResume={receipts.append($0);return true}
        let plan=try beginOuter(e),pre=try XCTUnwrap(receipts.first)
        e.sourceDirectLockedBonusGuardResume={_ in false}
        XCTAssertFalse(e.resumeSourceDirectLockedBonusGuard(pre).accepted)
        XCTAssertNil(e.pendingSourceDirectLockedBonusGuard);XCTAssertTrue(e.pendingWildLockedBonusPresentations.isEmpty)
        XCTAssertFalse(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
    }
    func testDirectOuterSecondPhysicalCaptureRestartProtectsSuccessor()throws {
        let e=make();var receipts:[NativeSourceDirectLockedBonusGuardReceipt]=[]
        e.sourceDirectLockedBonusGuardResume={receipts.append($0);return true}
        _=try beginOuter(e)
        e.sourceFinalMergePresenceAuthority = .init(isCurrent:{true},capture:{
            let old=e.state
            let captured=NativeSourceFinalMergePresenceAuthority.Snapshot(canonicalState:old,physicalTiles:old.tiles,runtime:Dictionary(uniqueKeysWithValues:old.tiles.map{($0.id,NativeNoMovesTileRuntime())}))
            e.restart(state:.init(tiles:[.init(id:"successor",cell:.init(column:0,row:0),value:4)]))
            return captured
        })
        XCTAssertFalse(e.resumeSourceDirectLockedBonusGuard(try XCTUnwrap(receipts.first)).accepted)
        XCTAssertEqual(e.state.tiles.map(\.id),["successor"]);XCTAssertEqual(e.state.moves,50)
        XCTAssertEqual(e.sourceDirectNormalLockedBonusGuardChecks,0);XCTAssertNil(e.pendingSourceDirectLockedBonusGuard)
    }
}
