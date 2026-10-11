import XCTest
@testable import StackToSixGameplay

final class NativeSourceTntSharedSpawnTests:XCTestCase {
    private func make(mode:NativeRunMode = .journey,locked:Bool=true,sourceMath:NativeSourceMathRandomStream?=nil)->NativeGameplayEngine {
        var tiles:[NativeTile]=[
            .init(id:"tnt",cell:.init(column:0,row:0),value:6,archetype:.tnt),
            .init(id:"dst",cell:.init(column:1,row:0),value:2),
            .init(id:"other",cell:.init(column:4,row:8),value:3)]
        if locked {tiles.append(.init(id:"locked",cell:.init(column:0,row:1),value:0,locked:true))}
        let e=NativeGameplayEngine(state:.init(tiles:tiles,mode:mode),recordedRandomChoices:Array(repeating:0.2,count:300),sourceMathRandom:sourceMath)
        e.stagedTntActivation=true;e.stagedTntWildSpawnAssignments=true
        return e
    }
    private func reserve(_ e:NativeGameplayEngine)throws->NativeSpecialMovePlan {
        XCTAssertTrue(e.beginDrag(tileID:"tnt"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
        return try XCTUnwrap(e.pendingSpecial)
    }
    private func bindInitialAndOuterGuards(_ e:NativeGameplayEngine,outer:@escaping(NativeSourceTntLockedBonusGuardReceipt)->Bool) {
        e.sourceTntInitialAwaitEnabled=true;e.sourceTntPhysicalPreSpawnGuardsEnabled=true
        e.sourceTntLockedBonusPhysicalGuardsEnabled=true
        e.sourceTntSpawnBegin={_ in true};e.sourceTntCoroutineResume={_,_ in true}
        e.sourceTntLockedBonusGuardResume=outer
        e.sourceWildMinimumTileAuthority = .init(isCurrent:{true},capture:{
            guard let paint=NativeSourceNoMovesRuntimeSnapshot.PaintedStateReceipt(canonicalState:e.state,paintedState:e.state) else{return nil}
            return .init(paint:paint,tiles:Dictionary(uniqueKeysWithValues:e.state.tiles.map{($0.id,NativeNoMovesTileRuntime())}))
        })
        e.sourceFinalMergePresenceAuthority = .init(isCurrent:{true},capture:{
            .init(canonicalState:e.state,physicalTiles:e.state.tiles,runtime:Dictionary(uniqueKeysWithValues:e.state.tiles.map{($0.id,NativeNoMovesTileRuntime())}))
        })
    }
    private func releaseTwoInitialGuards(_ e:NativeGameplayEngine,plan:NativeSpecialMovePlan)throws {
        XCTAssertTrue(e.commitSpecialActivation(transactionID:plan.id).accepted)
        XCTAssertTrue(e.releaseSourceTntInitialAwait(try XCTUnwrap(e.sourceTntSpawnBeginReceipt)))
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
    }
    func testOuterBonusHasTwoDistinctCapturedAwaitReactionsAfterPrimaryBeforeNineConstructors()throws {
        let e=make(sourceMath:NativeSourceMathRandomStream{0.2}),plan=try reserve(e)
        var queued:[NativeSourceTntLockedBonusGuardReceipt]=[],constructors=0
        bindInitialAndOuterGuards(e,outer:{queued.append($0);return true})
        e.sourceWildLockedBonusConstruct={_,_ in constructors+=1;return true}
        try releaseTwoInitialGuards(e,plan:plan)
        XCTAssertEqual(e.pendingWildSpawnArrivals.count,1);XCTAssertEqual(constructors,0)
        XCTAssertEqual(e.sourceTntPhysicalPreSpawnChecks,3)
        let first=try XCTUnwrap(queued.first);XCTAssertEqual(first.stage,.preSpawn)
        XCTAssertTrue(e.resumeSourceTntLockedBonusGuard(first).accepted)
        XCTAssertEqual(constructors,0);XCTAssertEqual(e.sourceTntPhysicalPreSpawnChecks,4)
        XCTAssertEqual(queued.count,2);let second=queued[1]
        XCTAssertEqual(second.stage,.singleMergeSix);XCTAssertNotEqual(second.id,first.id)
        XCTAssertFalse(e.resumeSourceTntLockedBonusGuard(first).accepted)
        XCTAssertTrue(e.resumeSourceTntLockedBonusGuard(second).accepted)
        XCTAssertEqual(constructors,9);XCTAssertEqual(e.pendingWildLockedBonusPresentations.count,9)
        XCTAssertNil(e.pendingSourceTntLockedBonusGuard);XCTAssertNil(e.pendingDirectWild)
        XCTAssertFalse(e.resumeSourceTntLockedBonusGuard(second).accepted);XCTAssertEqual(constructors,9)
    }
    func testOuterBonusInlinePromiseResumeCannotConstructOrHideUnadmittedAwait()throws {
        let e=make(sourceMath:NativeSourceMathRandomStream{0.2}),plan=try reserve(e)
        var constructors=0
        bindInitialAndOuterGuards(e,outer:{e.resumeSourceTntLockedBonusGuard($0).accepted})
        e.sourceWildLockedBonusConstruct={_,_ in constructors+=1;return true}
        XCTAssertTrue(e.commitSpecialActivation(transactionID:plan.id).accepted)
        XCTAssertTrue(e.releaseSourceTntInitialAwait(try XCTUnwrap(e.sourceTntSpawnBeginReceipt)))
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertFalse(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertEqual(constructors,0);XCTAssertTrue(e.pendingWildLockedBonusPresentations.isEmpty)
        XCTAssertNil(e.pendingSourceTntLockedBonusGuard,"Rejected enqueue cannot leave a replayable await receipt")
    }
    func testOuterSingleGuardCaptureRestartCannotAllocateInSuccessor()throws {
        let e=make(sourceMath:NativeSourceMathRandomStream{0.2}),plan=try reserve(e)
        var queued:[NativeSourceTntLockedBonusGuardReceipt]=[],captures=0,constructors=0
        bindInitialAndOuterGuards(e,outer:{queued.append($0);return true})
        e.sourceWildLockedBonusConstruct={_,_ in constructors+=1;return true}
        e.sourceFinalMergePresenceAuthority = .init(isCurrent:{true},capture:{
            captures+=1;let old=e.state
            let result=NativeSourceFinalMergePresenceAuthority.Snapshot(canonicalState:old,physicalTiles:old.tiles,runtime:Dictionary(uniqueKeysWithValues:old.tiles.map{($0.id,NativeNoMovesTileRuntime())}))
            if captures==2 {e.restart(state:.init(tiles:[.init(id:"successor",cell:.init(column:0,row:0),value:4)]))}
            return result
        })
        try releaseTwoInitialGuards(e,plan:plan)
        XCTAssertFalse(e.resumeSourceTntLockedBonusGuard(try XCTUnwrap(queued.first)).accepted)
        XCTAssertEqual(e.state.tiles.map(\.id),["successor"]);XCTAssertEqual(constructors,0)
        XCTAssertNil(e.pendingSourceTntLockedBonusGuard);XCTAssertTrue(e.pendingWildLockedBonusPresentations.isEmpty)
    }
    func testOuterBonusCanResumeAfterGenuineIndependentPrimaryFinally()throws {
        let e=make(sourceMath:NativeSourceMathRandomStream{0.2}),plan=try reserve(e)
        var queued:[NativeSourceTntLockedBonusGuardReceipt]=[],finally=0,constructors=0
        bindInitialAndOuterGuards(e,outer:{queued.append($0);return true})
        e.sourceTntCoroutineFinally={_,_ in finally+=1;return true}
        e.sourceWildLockedBonusConstruct={_,_ in constructors+=1;return true}
        try releaseTwoInitialGuards(e,plan:plan)
        for _ in 0..<20 where finally==0 {
            let result:NativeMoveResult
            if let arrival=e.pendingWildSpawnArrivals.first {result=e.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id)}
            else if let action=e.pendingWildSpawnActions.first {result=e.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:action.id)}
            else {result=e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation)}
            XCTAssertTrue(result.accepted)
        }
        XCTAssertEqual(finally,1);XCTAssertTrue(e.hasSettledSourceTntSpawnCoroutine(transactionID:plan.id,generation:plan.generation))
        XCTAssertEqual(constructors,0);XCTAssertNotNil(e.pendingSpecial)
        XCTAssertTrue(e.resumeSourceTntLockedBonusGuard(try XCTUnwrap(queued.first)).accepted)
        XCTAssertTrue(e.resumeSourceTntLockedBonusGuard(queued[1]).accepted)
        XCTAssertEqual(constructors,9);XCTAssertNotNil(e.pendingSpecial)
        XCTAssertNil(e.pendingDirectWild);XCTAssertEqual(finally,1)
    }
    func testUnknownOuterPresenceCannotBecomeFalseOrConstructBonus()throws {
        let e=make(sourceMath:NativeSourceMathRandomStream{0.2}),plan=try reserve(e)
        var constructors=0,enqueues=0
        bindInitialAndOuterGuards(e,outer:{_ in enqueues+=1;return true})
        e.sourceFinalMergePresenceAuthority=nil
        e.sourceWildLockedBonusConstruct={_,_ in constructors+=1;return true}
        XCTAssertTrue(e.commitSpecialActivation(transactionID:plan.id).accepted)
        XCTAssertTrue(e.releaseSourceTntInitialAwait(try XCTUnwrap(e.sourceTntSpawnBeginReceipt)))
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertFalse(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertEqual(enqueues,0);XCTAssertEqual(constructors,0)
        XCTAssertNil(e.pendingSourceTntLockedBonusGuard);XCTAssertTrue(e.pendingWildLockedBonusPresentations.isEmpty)
        XCTAssertEqual(e.pendingWildSpawnArrivals.count,1,"Primary remains its own genuine awaited owner")
    }
    func testOuterEnqueueRestartCannotPublishOldRefusalIntoSuccessor()throws {
        let e=make(sourceMath:NativeSourceMathRandomStream{0.2}),plan=try reserve(e)
        var constructors=0
        bindInitialAndOuterGuards(e,outer:{_ in
            e.restart(state:.init(tiles:[.init(id:"successor",cell:.init(column:0,row:0),value:4)]));return true
        })
        e.sourceWildLockedBonusConstruct={_,_ in constructors+=1;return true}
        XCTAssertTrue(e.commitSpecialActivation(transactionID:plan.id).accepted)
        XCTAssertTrue(e.releaseSourceTntInitialAwait(try XCTUnwrap(e.sourceTntSpawnBeginReceipt)))
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertFalse(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertEqual(e.state.tiles.map(\.id),["successor"]);XCTAssertEqual(e.state.moves,50)
        XCTAssertNil(e.pendingSourceTntLockedBonusGuard);XCTAssertEqual(constructors,0)
    }
    func testKnownZeroPhysicalOuterBlockersContinueFalseGuardWithActualAwait()throws {
        let e=make(sourceMath:NativeSourceMathRandomStream{0.2}),plan=try reserve(e)
        var constructors=0,enqueues=0
        bindInitialAndOuterGuards(e,outer:{_ in enqueues+=1;return true})
        e.sourceFinalMergePresenceAuthority = .init(isCurrent:{true},capture:{
            var actual=e.state.tiles
            for i in actual.indices where actual[i].id != plan.source.id && actual[i].id != plan.destination.id {actual[i].alpha=0.01}
            return .init(canonicalState:e.state,physicalTiles:actual,runtime:Dictionary(uniqueKeysWithValues:actual.map{($0.id,NativeNoMovesTileRuntime())}))
        })
        e.sourceWildLockedBonusConstruct={_,_ in constructors+=1;return true}
        XCTAssertTrue(e.commitSpecialActivation(transactionID:plan.id).accepted)
        XCTAssertTrue(e.releaseSourceTntInitialAwait(try XCTUnwrap(e.sourceTntSpawnBeginReceipt)))
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertEqual(constructors,0);XCTAssertEqual(enqueues,1)
        XCTAssertNil(e.state.terminal);XCTAssertTrue(e.pendingWildLockedBonusPresentations.isEmpty)
    }
    func testInitialAwaitDefersActualPrimaryAndNineBonusConstructorsUntilCapturedFinaleRelease()throws {
        var draws=0,armed=false,visualMounted=false,bonusConstructors=0,enqueues=0
        let math=NativeSourceMathRandomStream{if armed {draws+=1;XCTAssertTrue(visualMounted)};return 0.2}
        let e=make(sourceMath:math),plan=try reserve(e)
        e.sourceTntInitialAwaitEnabled=true;e.sourceTntSpawnBegin={_ in true}
        e.sourceTntCoroutineResume={_,_ in enqueues+=1;return true}
        e.sourceWildLockedBonusConstruct={_,_ in bonusConstructors+=1;XCTAssertTrue(visualMounted);return true}
        armed=true
        XCTAssertTrue(e.commitSpecialActivation(transactionID:plan.id).accepted)
        let receipt=try XCTUnwrap(e.sourceTntSpawnBeginReceipt)
        XCTAssertEqual(draws,0);XCTAssertEqual(bonusConstructors,0)
        XCTAssertTrue(e.pendingWildSpawnActions.isEmpty);XCTAssertTrue(e.pendingWildSpawnArrivals.isEmpty)
        XCTAssertFalse(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertEqual(draws,0)
        visualMounted=true
        XCTAssertTrue(e.releaseSourceTntInitialAwait(receipt));XCTAssertEqual(enqueues,1)
        XCTAssertEqual(draws,0,"Enqueue cannot execute primary or bonus on its own")
        XCTAssertFalse(e.releaseSourceTntInitialAwait(receipt));XCTAssertEqual(enqueues,1)
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertGreaterThan(draws,0);XCTAssertEqual(bonusConstructors,9)
        XCTAssertEqual(e.pendingWildSpawnArrivals.count,1)
        XCTAssertFalse(e.releaseSourceTntInitialAwait(receipt))
    }
    func testInitialAwaitRejectsInlineResumeAndRetiredReceiptWithoutDrawOrBonusFallback()throws {
        var draws=0,armed=false
        let e=make(sourceMath:NativeSourceMathRandomStream{if armed {draws+=1};return 0.2}),plan=try reserve(e)
        e.sourceTntInitialAwaitEnabled=true;e.sourceTntSpawnBegin={_ in true}
        e.sourceTntCoroutineResume={id,g in e.resumeSourceWildSpawnCoroutine(transactionID:id,generation:g).accepted}
        armed=true;XCTAssertTrue(e.commitSpecialActivation(transactionID:plan.id).accepted)
        let receipt=try XCTUnwrap(e.sourceTntSpawnBeginReceipt),before=e.state
        XCTAssertFalse(e.releaseSourceTntInitialAwait(receipt));XCTAssertEqual(e.state,before);XCTAssertEqual(draws,0)
        e.sourceTntCoroutineResume={_,_ in true}
        XCTAssertTrue(e.releaseSourceTntInitialAwait(receipt));XCTAssertEqual(draws,0)
        e.restart(state:.init(tiles:[.init(id:"successor",cell:.init(column:0,row:0),value:4)]))
        XCTAssertFalse(e.releaseSourceTntInitialAwait(receipt))
        XCTAssertFalse(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertEqual(e.state.tiles.map(\.id),["successor"]);XCTAssertEqual(draws,0)
    }
    func testInitialAwaitRejectsLifecycleReplacementInsideEnqueueWithoutDrawingSuccessor()throws {
        var draws=0,armed=false
        let e=make(sourceMath:NativeSourceMathRandomStream{if armed {draws+=1};return 0.2}),plan=try reserve(e)
        e.sourceTntInitialAwaitEnabled=true;e.sourceTntSpawnBegin={_ in true}
        e.sourceTntCoroutineResume={_,_ in e.restart(state:.init(tiles:[.init(id:"successor",cell:.init(column:0,row:0),value:4)]));return true}
        armed=true;XCTAssertTrue(e.commitSpecialActivation(transactionID:plan.id).accepted)
        let receipt=try XCTUnwrap(e.sourceTntSpawnBeginReceipt)
        XCTAssertFalse(e.releaseSourceTntInitialAwait(receipt))
        XCTAssertFalse(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertEqual(e.state.tiles.map(\.id),["successor"]);XCTAssertEqual(draws,0)
    }
    func testAllSpawnPermitsRefusedSettlesCapturedFinallyWithoutInventingPrimaryOrNoTargetImpact()throws {
        let e=NativeGameplayEngine(state:.init(tiles:[
            .init(id:"tnt",cell:.init(column:0,row:0),value:6,archetype:.tnt),
            .init(id:"dst",cell:.init(column:1,row:0),value:2),
            .init(id:"wild-a",cell:.init(column:2,row:0),value:6,archetype:.star),
            .init(id:"wild-b",cell:.init(column:4,row:8),value:6,archetype:.juice),
            .init(id:"locked",cell:.init(column:0,row:1),value:0,locked:true)],mode:.journey),sourceMathRandom:NativeSourceMathRandomStream{return 0.2})
        e.stagedTntActivation=true;e.stagedTntWildSpawnAssignments=true;e.sourceTntInitialAwaitEnabled=true
        e.sourceTntSpawnBegin={_ in true};e.sourceTntCoroutineResume={_,_ in true};e.wildSpawnPermitAdmission={_ in false}
        var finally=0
        e.sourceTntCoroutineFinally={id,g in finally+=1;XCTAssertTrue(e.hasSettledSourceTntSpawnCoroutine(transactionID:id,generation:g));return true}
        let plan=try reserve(e)
        XCTAssertTrue(e.commitSpecialActivation(transactionID:plan.id).accepted)
        XCTAssertTrue(e.releaseSourceTntInitialAwait(try XCTUnwrap(e.sourceTntSpawnBeginReceipt)))
        for _ in 0..<100 where finally==0 {
            let r:NativeMoveResult
            if let action=e.pendingWildSpawnActions.first {r=e.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:action.id)}
            else {r=e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation)}
            XCTAssertTrue(r.accepted)
        }
        XCTAssertEqual(finally,1);XCTAssertTrue(e.pendingWildSpawnArrivals.isEmpty)
        XCTAssertTrue(e.reserveTntTargets(transactionID:plan.id).accepted)
        XCTAssertEqual(e.pendingSpecial?.targets.count,0)
        XCTAssertTrue(e.releaseTntReservation(transactionID:plan.id).accepted)
        XCTAssertTrue(e.commitSpecialBoard(transactionID:plan.id).accepted)
        XCTAssertNil(e.pendingSpecial);XCTAssertEqual(e.state.moves,49);XCTAssertEqual(finally,1)
    }
    func testInitialPhysicalGuardsBorrowCurrentTilesAtTwoDistinctNormalAwaitBoundaries()throws {
        var draws=0,armed=false,enqueues=0,captures=0
        let e=make(sourceMath:NativeSourceMathRandomStream{if armed {draws+=1};return 0.2}),plan=try reserve(e)
        e.sourceTntInitialAwaitEnabled=true;e.sourceTntPhysicalPreSpawnGuardsEnabled=true
        e.sourceTntSpawnBegin={_ in true};e.sourceTntCoroutineResume={_,_ in enqueues+=1;return true}
        e.sourceWildMinimumTileAuthority = .init(isCurrent:{true},capture:{
            captures+=1
            guard let paint=NativeSourceNoMovesRuntimeSnapshot.PaintedStateReceipt(canonicalState:e.state,paintedState:e.state) else{return nil}
            return .init(paint:paint,tiles:Dictionary(uniqueKeysWithValues:e.state.tiles.map{($0.id,NativeNoMovesTileRuntime())}))
        })
        armed=true;XCTAssertTrue(e.commitSpecialActivation(transactionID:plan.id).accepted)
        XCTAssertTrue(e.releaseSourceTntInitialAwait(try XCTUnwrap(e.sourceTntSpawnBeginReceipt)))
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertEqual(captures,1);XCTAssertEqual(enqueues,2);XCTAssertEqual(draws,0)
        XCTAssertTrue(e.pendingWildSpawnArrivals.isEmpty);XCTAssertTrue(e.pendingWildLockedBonusPresentations.isEmpty)
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertEqual(e.sourceTntPhysicalPreSpawnChecks,2);XCTAssertEqual(captures,2)
        XCTAssertGreaterThan(draws,0);XCTAssertEqual(e.pendingWildSpawnArrivals.count,1)
    }
    func testPhysicalInitialAwaitWithoutCurrentAuthorityCannotTurnUnknownGuardIntoFalse()throws {
        var draws=0,armed=false
        let e=make(sourceMath:NativeSourceMathRandomStream{if armed {draws+=1};return 0.2}),plan=try reserve(e)
        e.sourceTntInitialAwaitEnabled=true;e.sourceTntPhysicalPreSpawnGuardsEnabled=true
        e.sourceTntSpawnBegin={_ in true};e.sourceTntCoroutineResume={_,_ in true}
        armed=true;XCTAssertTrue(e.commitSpecialActivation(transactionID:plan.id).accepted)
        XCTAssertTrue(e.releaseSourceTntInitialAwait(try XCTUnwrap(e.sourceTntSpawnBeginReceipt)))
        let before=e.state
        XCTAssertFalse(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertEqual(e.state,before);XCTAssertEqual(draws,0);XCTAssertEqual(e.sourceTntPhysicalPreSpawnChecks,0)
        XCTAssertTrue(e.pendingWildSpawnArrivals.isEmpty);XCTAssertTrue(e.pendingWildLockedBonusPresentations.isEmpty)
    }
    func testSecondPhysicalGuardRetirementCannotSelectOrConstructInSuccessor()throws {
        var draws=0,armed=false,captures=0
        let e=make(sourceMath:NativeSourceMathRandomStream{if armed {draws+=1};return 0.2}),plan=try reserve(e)
        e.sourceTntInitialAwaitEnabled=true;e.sourceTntPhysicalPreSpawnGuardsEnabled=true
        e.sourceTntSpawnBegin={_ in true};e.sourceTntCoroutineResume={_,_ in true}
        e.sourceWildMinimumTileAuthority = .init(isCurrent:{true},capture:{
            captures+=1;let captured=e.state
            guard let paint=NativeSourceNoMovesRuntimeSnapshot.PaintedStateReceipt(canonicalState:captured,paintedState:captured) else{return nil}
            let snapshot=NativeSourceOrdinaryMinimumTileAuthority.Snapshot(paint:paint,tiles:Dictionary(uniqueKeysWithValues:captured.tiles.map{($0.id,NativeNoMovesTileRuntime())}))
            if captures==2 {e.restart(state:.init(tiles:[.init(id:"successor",cell:.init(column:0,row:0),value:4)]))}
            return snapshot
        })
        armed=true;XCTAssertTrue(e.commitSpecialActivation(transactionID:plan.id).accepted)
        XCTAssertTrue(e.releaseSourceTntInitialAwait(try XCTUnwrap(e.sourceTntSpawnBeginReceipt)))
        XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertEqual(draws,0)
        XCTAssertFalse(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertEqual(e.state.tiles.map(\.id),["successor"]);XCTAssertEqual(draws,0)
        XCTAssertTrue(e.pendingWildSpawnArrivals.isEmpty);XCTAssertTrue(e.pendingWildLockedBonusPresentations.isEmpty)
    }
    func testActualTntEntryMintsItsOwnReceiptBeforeSelectionAndNeverInventsDirectPlan()throws {
        let e=make();let plan=try reserve(e);var begins=0,finally=0
        e.sourceTntSpawnBegin={receipt in
            begins+=1;XCTAssertTrue(e.sourceTntSpawnBeginIsCurrent(receipt))
            XCTAssertEqual(receipt.ownerID,plan.id);XCTAssertNil(e.pendingDirectWild)
            XCTAssertTrue(e.pendingWildSpawnActions.isEmpty);XCTAssertTrue(e.pendingWildSpawnArrivals.isEmpty)
            return true
        }
        e.sourceTntCoroutineResume={id,g in XCTAssertEqual(id,plan.id);XCTAssertEqual(g,plan.generation);return true}
        e.sourceTntCoroutineFinally={id,g in
            finally+=1;XCTAssertEqual(id,plan.id);XCTAssertEqual(g,plan.generation)
            XCTAssertNotNil(e.pendingSpecial,"Spawn finally cannot consume independent TNT bonus owner")
            return true
        }
        e.sourceWildSpawnBegin={_ in XCTFail("TNT cannot claim Direct receipt");return false}
        e.sourceWildCoroutineFinally={_,_ in XCTFail("TNT cannot call Direct finally");return false}
        XCTAssertTrue(e.commitSpecialActivation(transactionID:plan.id).accepted)
        XCTAssertEqual(begins,1);XCTAssertEqual(e.state.moves,49);XCTAssertNil(e.pendingDirectWild)
        for _ in 0..<100 where finally==0 {
            let result:NativeMoveResult
            if let action=e.pendingWildSpawnActions.first {result=e.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:action.id)}
            else if let arrival=e.pendingWildSpawnArrivals.first {result=e.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id)}
            else {result=e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation)}
            XCTAssertTrue(result.accepted)
        }
        XCTAssertEqual(finally,1);XCTAssertEqual(e.pendingSpecial?.id,plan.id);XCTAssertNil(e.pendingDirectWild)
        XCTAssertTrue(e.hasSettledSourceTntSpawnCoroutine(transactionID:plan.id,generation:plan.generation))
        XCTAssertFalse(e.commitSpecialActivation(transactionID:plan.id).accepted)
        XCTAssertTrue(e.reserveTntTargets(transactionID:plan.id).accepted)
        let bonus=try XCTUnwrap(e.pendingSpecial)
        for target in bonus.targets {XCTAssertTrue(e.commitSpecialImpact(transactionID:plan.id,tileID:target.id).accepted)}
        XCTAssertTrue(e.commitSpecialBoard(transactionID:plan.id).accepted)
        XCTAssertNil(e.pendingSpecial);XCTAssertEqual(e.state.moves,49);XCTAssertEqual(e.state.cubesCracked,1)
    }
    func testRefusedTntEntryCannotDrawOrConstructOrFallbackToEagerSpawn()throws {
        let e=make(),plan=try reserve(e)
        e.sourceTntSpawnBegin={receipt in XCTAssertTrue(e.sourceTntSpawnBeginIsCurrent(receipt));return false}
        let result=e.commitSpecialActivation(transactionID:plan.id)
        XCTAssertFalse(result.accepted);XCTAssertTrue(result.events.contains{$0.reason=="source_tnt_spawn_begin_refused"})
        XCTAssertTrue(e.pendingWildSpawnActions.isEmpty);XCTAssertTrue(e.pendingWildSpawnArrivals.isEmpty)
        XCTAssertTrue(e.pendingWildLockedBonusPresentations.isEmpty);XCTAssertNil(e.pendingDirectWild)
        XCTAssertEqual(e.pendingSpecial?.id,plan.id)
        let charged=e.state
        XCTAssertFalse(e.commitSpecialActivation(transactionID:plan.id).accepted)
        XCTAssertEqual(e.state,charged,"Refused late spawn acquisition cannot replay genuine main debit")
    }
    func testTntArrivalCancellationFinallyKeepsActualBonusTransactionAndRejectsOldReceipt()throws {
        let e=make(mode:.arcade,locked:false),plan=try reserve(e);var finally=0
        e.sourceTntSpawnBegin={_ in true};e.sourceTntCoroutineFinally={_,_ in finally+=1;return true}
        XCTAssertTrue(e.commitSpecialActivation(transactionID:plan.id).accepted)
        let receipt=try XCTUnwrap(e.sourceTntSpawnBeginReceipt),action=try XCTUnwrap(e.pendingWildSpawnActions.first)
        XCTAssertTrue(e.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:action.id).accepted)
        let arrival=try XCTUnwrap(e.pendingWildSpawnArrivals.first)
        XCTAssertTrue(e.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id,interrupted:true).accepted)
        XCTAssertEqual(finally,1);XCTAssertEqual(e.pendingSpecial?.id,plan.id)
        XCTAssertFalse(e.sourceTntSpawnBeginIsCurrent(receipt));XCTAssertNil(e.pendingDirectWild)
        XCTAssertFalse(e.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id).accepted)
        e.restart(state:.init(tiles:[.init(id:"successor",cell:.init(column:0,row:0),value:4)]))
        XCTAssertFalse(e.sourceTntSpawnBeginIsCurrent(receipt));XCTAssertNil(e.sourceTntSpawnBeginReceipt)
        XCTAssertEqual(e.state.tiles.map(\.id),["successor"])
    }
    func testSourceTntProtectedPrefixRequiresGenuineMainEntryBeforeAccounting()throws {
        let e=make();e.sourceTntMain80Enabled=true
        let plan=try reserve(e),prefix=try XCTUnwrap(e.state.tiles.first{$0.id=="dst"})
        XCTAssertTrue(prefix.visible);XCTAssertEqual(prefix.alpha,1);XCTAssertEqual(prefix.value,6)
        XCTAssertEqual(prefix.stackDepth,2);XCTAssertTrue(prefix.sourceWildStateCleared)
        let before=e.state
        XCTAssertFalse(e.commitSpecialActivation(transactionID:plan.id).accepted);XCTAssertEqual(e.state,before)
        let receipt=try XCTUnwrap(e.registerSourceSpecialAbsorbOwner(transactionID:plan.id,generation:plan.generation))
        XCTAssertFalse(e.commitSpecialActivation(transactionID:plan.id).accepted);XCTAssertEqual(e.state,before)
        XCTAssertTrue(e.commitSourceSpecialAbsorbMain(receiptID:receipt.id,generation:receipt.generation).accepted)
        XCTAssertTrue(e.commitSpecialActivation(transactionID:plan.id).accepted)
        XCTAssertEqual(e.state.moves,49);XCTAssertEqual(e.state.cubesCracked,1)
        XCTAssertFalse(e.cancelSourceSpecialAbsorb(receiptID:receipt.id,generation:receipt.generation).accepted)
    }
    func testSourceTntSetupAbortRetiresOnlyActualUninstalledPairWithoutCharge()throws {
        let e=make();e.sourceTntMain80Enabled=true;let plan=try reserve(e)
        XCTAssertTrue(e.cancelSourceTntMainSetup(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertNil(e.pendingSpecial);XCTAssertEqual(e.state.moves,50);XCTAssertEqual(e.state.cubesCracked,0)
        XCTAssertEqual(Set(e.state.tiles.map(\.id)),Set(["other","locked"]))
        XCTAssertFalse(e.cancelSourceTntMainSetup(transactionID:plan.id,generation:plan.generation).accepted)
    }

    private func prepareLazyBonus(_ e:NativeGameplayEngine)throws->NativeSpecialMovePlan {
        e.sourceTntMain80Enabled=true;e.sourceTntBonusValuesAtImpact=true
        let plan=try reserve(e)
        let absorb=try XCTUnwrap(e.registerSourceSpecialAbsorbOwner(transactionID:plan.id,generation:plan.generation))
        XCTAssertTrue(e.commitSourceSpecialAbsorbMain(receiptID:absorb.id,generation:absorb.generation).accepted)
        XCTAssertTrue(e.commitSpecialActivation(transactionID:plan.id).accepted)
        XCTAssertTrue(e.reserveTntTargets(transactionID:plan.id).accepted)
        return try XCTUnwrap(e.pendingSpecial)
    }
    func testSourceBonusReservationCapturesTargetsButEachActualImpactDrawsItsOwnFace()throws {
        var draws=0,roll=0.2
        let e=make(sourceMath:NativeSourceMathRandomStream(draw:{draws+=1;return roll}))
        let plan=try prepareLazyBonus(e)
        XCTAssertTrue(plan.replacementValues.isEmpty);XCTAssertFalse(plan.targets.isEmpty)
        let before=draws;roll=0.9
        let first=try XCTUnwrap(plan.targets.first)
        XCTAssertTrue(e.commitSpecialImpact(transactionID:plan.id,tileID:first.id).accepted)
        XCTAssertGreaterThan(draws,before)
        let values=try XCTUnwrap(e.pendingSpecial?.replacementValues)
        XCTAssertEqual(values.count,1);XCTAssertNotEqual(values[0],first.value)
        XCTAssertEqual(e.state.tiles.first{$0.cell==first.cell}?.value,values[0])
        let settled=e.state,after=draws
        XCTAssertFalse(e.commitSpecialImpact(transactionID:plan.id,tileID:first.id).accepted)
        XCTAssertEqual(e.state,settled);XCTAssertEqual(draws,after)
    }
    func testSourceBonusFaceMathReentryPreservesReplacementGenerationAndStopsAfterOneDraw()throws {
        var e:NativeGameplayEngine!;var armed=false,draws=0
        let successor=NativeBoardState(tiles:[.init(id:"successor",cell:.init(column:0,row:0),value:4)],score:9876)
        e=make(sourceMath:NativeSourceMathRandomStream(draw:{draws+=1;if armed{armed=false;e.restart(state:successor)};return 0.25}))
        let plan=try prepareLazyBonus(e),first=try XCTUnwrap(plan.targets.first)
        let before=draws;armed=true
        XCTAssertFalse(e.commitSpecialImpact(transactionID:plan.id,tileID:first.id).accepted)
        XCTAssertEqual(draws,before+1);XCTAssertEqual(e.state.score,9876)
        XCTAssertEqual(e.state.tiles.map(\.id),["successor"]);XCTAssertNil(e.pendingSpecial)
    }
    func testRetiredLazyBonusValueCapabilityRefusesWithoutRawFaceFallbackOrDraw()throws {
        var draws=0
        let e=make(sourceMath:NativeSourceMathRandomStream(draw:{draws+=1;return 0.2}))
        let plan=try prepareLazyBonus(e),first=try XCTUnwrap(plan.targets.first)
        e.sourceTntBonusValuesAtImpact=false;let before=e.state,count=draws
        XCTAssertFalse(e.commitSpecialImpact(transactionID:plan.id,tileID:first.id).accepted)
        XCTAssertEqual(e.state,before);XCTAssertEqual(draws,count)
    }

}
