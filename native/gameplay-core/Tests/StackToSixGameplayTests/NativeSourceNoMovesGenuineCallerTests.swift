import XCTest
@testable import StackToSixGameplay

final class NativeSourceNoMovesGenuineCallerTests:XCTestCase {
    func install(_ e:NativeGameplayEngine,kinds:Set<NativeSourceNoMovesCallerReceipt.Kind>=[.ordinaryMovesDepleted,.mergeMovesDepleted],fresh:NativeResolution.Kind = .fail) {
        e.stagedSourceNoMoves=true;e.sourceNoMovesCallerReceiptsEnabled=true
        e.sourceNoMovesCallerAdmission = .init(generation:e.state.generation,kinds:kinds)
        e.sourceNoMovesRuntimeAuthority = .init(isCurrent:{true},capture:{[weak e] in
            guard let e else{return nil};return .init(state:e.state,tiles:Dictionary(uniqueKeysWithValues:e.state.tiles.map{($0.id,.init())}),wildContinuationPending:false,gameplayTransactionActive:false,livingDragActive:false,endgameGuardActive:false,nonFinalMergeSixGuardActive:false,freshResult:.init(fresh,reason:"controlled-original-checker-result"),capabilities:Set(NativeSourceNoMovesRuntimeSnapshot.Capability.allCases))
        })
    }
    func ordinary(moves:Int=1)->NativeGameplayEngine {
        let e=NativeGameplayEngine(state:.init(tiles:[.init(id:"s",cell:.init(column:0,row:0),value:1),.init(id:"d",cell:.init(column:1,row:0),value:1),.init(id:"other",cell:.init(column:2,row:0),value:1)],moves:moves));e.stagedOrdinaryMoves=true;return e
    }
    func debit(_ e:NativeGameplayEngine)throws->NativeSourceNoMovesCallerReceipt? {
        XCTAssertTrue(e.beginDrag(tileID:"s"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
        let plan=try XCTUnwrap(e.pendingOrdinaryStack);XCTAssertNil(e.sourceNoMovesCaller(ownerID:plan.id,generation:plan.generation,kind:.ordinaryMovesDepleted))
        XCTAssertTrue(e.finishOrdinaryStackAbsorb(receiptID:plan.id,generation:plan.generation).accepted)
        XCTAssertNil(e.sourceNoMovesCaller(ownerID:plan.id,generation:plan.generation,kind:.ordinaryMovesDepleted))
        XCTAssertTrue(e.commitOrdinaryPostcheck(receiptID:plan.id,generation:plan.generation).accepted)
        return e.sourceNoMovesCaller(ownerID:plan.id,generation:plan.generation,kind:.ordinaryMovesDepleted)
    }
    func six()->NativeGameplayEngine {
        let e=NativeGameplayEngine(state:.init(tiles:[.init(id:"s",cell:.init(column:0,row:0),value:3),.init(id:"d",cell:.init(column:1,row:0),value:3),.init(id:"other",cell:.init(column:2,row:0),value:5)],moves:1));e.stagedOrdinaryMoves=true;e.stagedOrdinaryAssignments=true;return e
    }
    func main(_ e:NativeGameplayEngine)throws->(NativeOrdinaryMovePlan,NativeMoveResult) {
        XCTAssertTrue(e.beginDrag(tileID:"s"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
        let plan=try XCTUnwrap(e.pendingOrdinarySix);XCTAssertTrue(e.pendingSourceNoMovesCallerReceipts.isEmpty)
        return (plan,e.commitOrdinarySix(receiptID:plan.id,generation:plan.generation))
    }
    func testRawDefaultDebitHasNoCallerAndSameMovesBehavior()throws {
        let e=ordinary();XCTAssertFalse(e.sourceNoMovesCallerReceiptsEnabled);XCTAssertNil(try debit(e));XCTAssertEqual(e.state.moves,0);XCTAssertTrue(e.pendingSourceNoMovesCallerReceipts.isEmpty)
    }
    func testMissingCapturedAdmissionDoesNotPublishEvenWithFlagTrue()throws {
        let e=ordinary();e.stagedSourceNoMoves=true;e.sourceNoMovesCallerReceiptsEnabled=true
        XCTAssertNil(try debit(e));XCTAssertEqual(e.state.moves,0)
    }
    func testActualSuccessfulDebitCreatesSingleGenuineProvenanceAfterPostcheckOnly()throws {
        let e=ordinary();install(e);let r=try XCTUnwrap(try debit(e))
        XCTAssertEqual(r.kind,.ordinaryMovesDepleted);XCTAssertEqual(e.state.moves,0);XCTAssertEqual(e.pendingSourceNoMovesCallerReceipts,[r]);XCTAssertEqual(r.admissionID,e.sourceNoMovesCallerAdmission?.id)
        XCTAssertFalse(e.commitOrdinaryPostcheck(receiptID:r.ownerID,generation:r.generation).accepted);XCTAssertEqual(e.pendingSourceNoMovesCallerReceipts,[r])
    }
    func testSourceStuckPostcheckReturnsBeforeDebitAndCannotCreateZeroCaller()throws {
        let e=NativeGameplayEngine(state:.init(tiles:[.init(id:"s",cell:.init(column:0,row:0),value:2),.init(id:"d",cell:.init(column:1,row:0),value:3)],moves:1));e.stagedOrdinaryMoves=true;install(e)
        XCTAssertNil(try debit(e));XCTAssertEqual(e.state.moves,1)
    }
    func testUnsupportedKindPublicationRefusesReceiptWithoutInventingGuard()throws {
        let e=ordinary();install(e,kinds:[.mergeMovesDepleted]);XCTAssertNil(try debit(e));XCTAssertEqual(e.state.moves,0)
    }
    func testSourceZeroDebitAtAlreadyZeroUsesLiteralMaxAndStillCapturesCaller()throws {
        let e=ordinary(moves:0);install(e);let r=try XCTUnwrap(try debit(e));XCTAssertEqual(r.kind,.ordinaryMovesDepleted);XCTAssertEqual(e.state.moves,0)
    }
    func testActualSixMainKeepsLiveDestinationAndStopsBeforeSpawnAndRng()throws {
        let e=six();install(e);let rng=e.state.rngState,meter=e.state.wildMeter
        let (plan,result)=try main(e);let r=try XCTUnwrap(e.sourceNoMovesCaller(ownerID:plan.id,generation:plan.generation,kind:.mergeMovesDepleted));let dst=try XCTUnwrap(e.state.tiles.first{$0.id=="d"})
        XCTAssertTrue(result.accepted);XCTAssertEqual(e.state.moves,0);XCTAssertEqual(dst.value,6);XCTAssertFalse(dst.locked);XCTAssertTrue(dst.visible);XCTAssertEqual(dst.alpha,1);XCTAssertTrue(dst.merge6CleanupOwned)
        XCTAssertFalse(result.events.contains{$0.kind == .spawned || $0.kind == .ordinarySpawnsPrepareRequested || $0.kind == .ordinaryDestinationCleanupPrepared})
        XCTAssertEqual(e.state.rngState,rng);XCTAssertGreaterThan(e.state.wildMeter,meter);XCTAssertTrue(e.ordinarySixGameplayCommitted)
        XCTAssertFalse(e.releaseOrdinarySixHandoff(receiptID:r.ownerID,generation:r.generation).accepted)
    }
    func testOnlyActualContinueResumesSpawnAndDoesNotRepeatScoreMovesMeterOrRng()throws {
        let e=six();install(e);let (plan,_)=try main(e);let r=try XCTUnwrap(e.sourceNoMovesCaller(ownerID:plan.id,generation:plan.generation,kind:.mergeMovesDepleted)),before=e.state
        let result=e.continueSourceMergeSixAfterNoMovesCaller(r)
        XCTAssertTrue(result.accepted);XCTAssertTrue(result.events.contains{$0.kind == .ordinarySpawnsPrepareRequested && $0.value==50});XCTAssertTrue(result.events.contains{$0.kind == .ordinaryDestinationCleanupPrepared && $0.value==100})
        XCTAssertEqual(e.state.moves,before.moves);XCTAssertEqual(e.state.score,before.score);XCTAssertEqual(e.state.wildMeter,before.wildMeter);XCTAssertEqual(e.state.rngState,before.rngState)
        XCTAssertFalse(e.continueSourceMergeSixAfterNoMovesCaller(r).accepted)
    }
    func testCapturedCandidateUsesActualCallerOptionsNotGenericOriginInference()throws {
        for kind in [NativeSourceNoMovesCallerReceipt.Kind.ordinaryMovesDepleted,.mergeMovesDepleted] {
            let e=kind == .ordinaryMovesDepleted ? ordinary():six();install(e)
            let r:NativeSourceNoMovesCallerReceipt
            if kind == .ordinaryMovesDepleted {r=try XCTUnwrap(try debit(e))}else{let (plan,_)=try main(e);r=try XCTUnwrap(e.sourceNoMovesCaller(ownerID:plan.id,generation:plan.generation,kind:kind))}
            guard case .candidate(let plan)=e.beginSourceNoMovesFromCaller(r) else{return XCTFail()}
            XCTAssertEqual(plan.trigger.rawValue,r.reason);XCTAssertEqual(plan.waitMilliseconds,1500);XCTAssertNil(plan.trigger.exitTimeoutMilliseconds);XCTAssertEqual(plan.trigger.resetHint,kind == .ordinaryMovesDepleted)
        }
    }
    func testOnlyActualConfirmedInvocationFinishesCallerBeforeBoardExitAndIndependentCleanup()throws {
        let e=ordinary();install(e);let r=try XCTUnwrap(try debit(e));var finished:[NativeSourceNoMovesCallerReceipt]=[]
        e.sourceNoMovesCallerCompletionBinding = .init(admissionID:r.admissionID,deliver:{finished.append($0)})
        guard case .candidate(let p)=e.beginSourceNoMovesFromCaller(r) else{return XCTFail()}
        _=e.deliverSourceNoMovesWait(plan:p,generation:r.generation);_=e.deliverSourceNoMovesTextExit(plan:p,generation:r.generation,delivery:.exited);_=e.acquireSourceNoMovesLock(plan:p,generation:r.generation)
        XCTAssertTrue(finished.isEmpty);XCTAssertTrue(e.finishSourceNoMovesCallerInvocation(planToken:p.token,generation:r.generation));XCTAssertEqual(finished,[r])
        XCTAssertFalse(e.finishSourceNoMovesCallerInvocation(planToken:p.token,generation:r.generation));XCTAssertTrue(e.finishSourceNoMovesBoardExit(plan:p,generation:r.generation).accepted);XCTAssertEqual(finished,[r])
        let done=try XCTUnwrap(e.completedSourceNoMovesReceipt);XCTAssertTrue(e.finishSourceNoMovesFinalCleanup(receipt:done));XCTAssertEqual(finished,[r]);XCTAssertFalse(e.finishSourceNoMovesFinalCleanup(receipt:done));XCTAssertEqual(finished,[r])
    }
    func testActualRollbackFinishesCapturedRunOnce()throws {
        let e=ordinary();install(e);let r=try XCTUnwrap(try debit(e));var count=0;e.sourceNoMovesCallerCompletionBinding = .init(admissionID:r.admissionID,deliver:{_ in count+=1})
        guard case .candidate(let p)=e.beginSourceNoMovesFromCaller(r) else{return XCTFail()}
        guard case .rollback=e.deliverSourceNoMovesWait(plan:p,generation:r.generation,cancelled:true) else{return XCTFail()};XCTAssertEqual(count,0)
        XCTAssertTrue(e.finishSourceNoMovesCallerRollback(planToken:p.token,generation:r.generation));XCTAssertEqual(count,1)
        XCTAssertFalse(e.finishSourceNoMovesCallerRollback(planToken:p.token,generation:r.generation));XCTAssertEqual(count,1)
        _=e.deliverSourceNoMovesWait(plan:p,generation:r.generation,cancelled:true);XCTAssertEqual(count,1)
    }
    func testRetiredAdmissionOrGenerationReplacementCannotContinueOrBegin()throws {
        for restart in [false,true] {let e=six();install(e);let (plan,_)=try main(e);let r=try XCTUnwrap(e.sourceNoMovesCaller(ownerID:plan.id,generation:plan.generation,kind:.mergeMovesDepleted))
            if restart{e.restart(state:e.state)}else{e.sourceNoMovesCallerAdmission?.retire()}
            XCTAssertFalse(e.sourceNoMovesCallerIsCurrent(r));XCTAssertEqual(e.beginSourceNoMovesFromCaller(r),.ignored);XCTAssertFalse(e.continueSourceMergeSixAfterNoMovesCaller(r).accepted)
        }
    }
    func testMissingRuntimeEndpointPreservesConservativeOwnershipAndDurableSave()throws {
        let e=six();install(e);let (plan,_)=try main(e);let r=try XCTUnwrap(e.sourceNoMovesCaller(ownerID:plan.id,generation:plan.generation,kind:.mergeMovesDepleted)),before=e.state
        XCTAssertTrue(e.refuseSourceNoMovesCaller(r));XCTAssertEqual(e.state,before);XCTAssertTrue(e.hasUnsavableSourceGameplayState);XCTAssertEqual(e.resolve().reason,"source_no_moves_caller_endpoint_missing")
        XCTAssertFalse(e.continueSourceMergeSixAfterNoMovesCaller(r).accepted);XCTAssertFalse(e.releaseOrdinarySixHandoff(receiptID:r.ownerID,generation:r.generation).accepted)
        XCTAssertTrue(e.retireSourceNoMovesCaller(r));XCTAssertFalse(e.retireSourceNoMovesCaller(r))
    }
    func testReturningCapturedAAfterNewAdmissionCCannotRetireCOrMutateScore()throws {
        let e=ordinary();install(e);let r=try XCTUnwrap(try debit(e)),score=e.state.score
        let c=NativeSourceNoMovesCallerAdmission(generation:e.state.generation,kinds:[.ordinaryMovesDepleted]);e.sourceNoMovesCallerAdmission=c
        XCTAssertFalse(e.sourceNoMovesCallerIsCurrent(r));XCTAssertTrue(e.retireSourceNoMovesCaller(r));XCTAssertTrue(e.sourceNoMovesCallerAdmission === c);XCTAssertEqual(e.state.score,score)
    }
    func testCoreCandidatePublicationCannotManufactureConfirmedNativeInvocation()throws {
        let e=ordinary();install(e);let r=try XCTUnwrap(try debit(e));var count=0
        e.sourceNoMovesCallerCompletionBinding = .init(admissionID:r.admissionID,deliver:{_ in count+=1})
        guard case .candidate(let p)=e.beginSourceNoMovesFromCaller(r) else{return XCTFail()}
        XCTAssertFalse(e.finishSourceNoMovesCallerInvocation(planToken:p.token,generation:r.generation));XCTAssertEqual(count,0)
        XCTAssertFalse(e.finishSourceNoMovesCallerRollback(planToken:p.token,generation:r.generation));XCTAssertEqual(count,0)
    }
    func testActualRollbackCompletionReentryCannotClearIndependentAdmissionAndBindingC()throws {
        let e=ordinary();install(e);let r=try XCTUnwrap(try debit(e))
        let c=NativeSourceNoMovesCallerAdmission(generation:r.generation,kinds:[.ordinaryMovesDepleted])
        let bindingC=NativeSourceNoMovesCallerCompletionBinding(admissionID:c.id,deliver:{_ in XCTFail("not C's receipt")})
        var count=0;e.sourceNoMovesCallerCompletionBinding = .init(admissionID:r.admissionID,deliver:{captured in
            count+=1;XCTAssertEqual(captured,r);e.sourceNoMovesCallerAdmission=c;e.sourceNoMovesCallerCompletionBinding=bindingC
            XCTAssertTrue(e.retireSourceNoMovesCaller(captured))
        })
        guard case .candidate(let p)=e.beginSourceNoMovesFromCaller(r) else{return XCTFail()}
        _=e.deliverSourceNoMovesWait(plan:p,generation:r.generation,cancelled:true)
        XCTAssertTrue(e.finishSourceNoMovesCallerRollback(planToken:p.token,generation:r.generation));XCTAssertEqual(count,1)
        XCTAssertTrue(e.sourceNoMovesCallerAdmission === c);XCTAssertTrue(e.sourceNoMovesCallerCompletionBinding === bindingC)
        XCTAssertFalse(e.finishSourceNoMovesCallerRollback(planToken:p.token,generation:r.generation));XCTAssertEqual(count,1)
    }

}
