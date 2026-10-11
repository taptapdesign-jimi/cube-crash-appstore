import XCTest
import StackToSixGameplay

/// Genuine Engine main-completion receipt. Controlled boundary authority is
/// explicit fixture data and does not publish missing product capabilities.
@MainActor final class NativeSourcePreDebitTestGate {var callback:(()->Bool)?}
@MainActor final class NativeSourcePreDebitTestEngine {
    let currentGate=NativeSourcePreDebitTestGate()
    let engine:NativeGameplayEngine
    let ownerID:String
    let receipt:NativeSourceOrdinaryPreDebitReceipt
    var endpoint:NativeSourceOrdinaryPreDebitAdmission {engine.sourceOrdinaryPreDebitAdmission!}
    init(moves:Int=20)throws {
        engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"s",cell:.init(column:0,row:0),value:1),.init(id:"d",cell:.init(column:1,row:0),value:1),.init(id:"other",cell:.init(column:2,row:0),value:5)],moves:moves))
        engine.stagedOrdinaryMoves=true;engine.stagedSourceNoMoves=true;engine.sourceNoMovesCallerReceiptsEnabled=true
        let admission=NativeSourceNoMovesCallerAdmission(generation:engine.state.generation,kinds:[.ordinaryMovesDepleted]);engine.sourceNoMovesCallerAdmission=admission
        let e=engine
        engine.sourceNoMovesRuntimeAuthority = .init(isCurrent:{true},capture:{.init(state:e.state,tiles:Dictionary(uniqueKeysWithValues:e.state.tiles.map{($0.id,.init())}),wildContinuationPending:false,gameplayTransactionActive:false,livingDragActive:false,endgameGuardActive:false,nonFinalMergeSixGuardActive:false,freshResult:.init(.fail,reason:"controlled-source-boundary"),capabilities:Set(NativeSourceNoMovesRuntimeSnapshot.Capability.allCases))})
        XCTAssertTrue(engine.beginDrag(tileID:"s"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
        let plan=try XCTUnwrap(engine.pendingOrdinaryStack);ownerID=plan.id
        XCTAssertNil(engine.claimSourceOrdinaryPreDebit(ownerID:plan.id,generation:plan.generation))
        XCTAssertTrue(engine.finishOrdinaryStackAbsorb(receiptID:plan.id,generation:plan.generation).accepted)
        let gate=currentGate
        engine.sourceOrdinaryPreDebitAdmission = .init(callerAdmissionID:admission.id,generation:plan.generation,isCurrent:{gate.callback?() ?? true})
        engine.sourceOrdinaryPreDebitEnabled=true
        receipt=try XCTUnwrap(engine.claimSourceOrdinaryPreDebit(ownerID:plan.id,generation:plan.generation))
    }
    func dispose(){engine.sourceNoMovesRuntimeAuthority=nil;engine.sourceOrdinaryPreDebitAdmission=nil;engine.sourceNoMovesCallerAdmission=nil}
}
@MainActor final class NativeSourceOrdinaryPreDebitCoreTests:XCTestCase {
    func testOnlyActualPostcheckCanClaimAndEarlyReturnDoesNotDebitOrRepeat()throws {
        let f=try NativeSourcePreDebitTestEngine();defer{f.dispose()};let before=f.engine.state
        XCTAssertNil(f.engine.claimSourceOrdinaryPreDebit(ownerID:f.ownerID,generation:f.receipt.generation))
        XCTAssertTrue(f.engine.finishSourceOrdinaryPreDebit(f.receipt,outcome:.returned).accepted)
        XCTAssertEqual(f.engine.state,before);XCTAssertTrue(f.engine.pendingOrdinaryPostchecks.isEmpty)
        XCTAssertFalse(f.engine.finishSourceOrdinaryPreDebit(f.receipt,outcome:.continueToDebit).accepted);XCTAssertEqual(f.engine.state.moves,20)
    }
    func testSurvivingDebitCreatesGenuineOrdinaryZeroCallerExactlyOnce()throws {
        let f=try NativeSourcePreDebitTestEngine(moves:1);defer{f.dispose()}
        XCTAssertTrue(f.engine.finishSourceOrdinaryPreDebit(f.receipt,outcome:.continueToDebit).accepted);XCTAssertEqual(f.engine.state.moves,0)
        let caller=try XCTUnwrap(f.engine.sourceNoMovesCaller(ownerID:f.ownerID,generation:f.receipt.generation,kind:.ordinaryMovesDepleted))
        XCTAssertEqual(caller.ownerID,f.ownerID);XCTAssertFalse(caller.isPreDebit)
        XCTAssertFalse(f.engine.finishSourceOrdinaryPreDebit(f.receipt,outcome:.continueToDebit).accepted);XCTAssertEqual(f.engine.pendingSourceNoMovesCallerReceipts.count,1)
    }
    func testAllSixDistinctTriggerReceiptsKeepProvenanceAndDoNotEnterOldTwoCallerRoute()throws {
        let triggers:[NativeNoMovesCandidateOwner.Trigger]=[.lastTwoRegular,.lastTwoSelf,.lastThreeRegular,.lastThreeSelf,.singleRegular,.postMerge]
        for trigger in triggers {
            let f=try NativeSourcePreDebitTestEngine();defer{f.dispose()}
            let caller=try XCTUnwrap(f.engine.prepareSourceOrdinaryPreDebitNoMoves(f.receipt,trigger:trigger))
            XCTAssertTrue(caller.isPreDebit);XCTAssertEqual(caller.trigger,trigger);XCTAssertEqual(caller.reason,trigger.rawValue)
            XCTAssertNil(f.engine.prepareSourceOrdinaryPreDebitNoMoves(f.receipt,trigger:trigger));XCTAssertTrue(f.engine.sourceNoMovesCallerIsCurrent(caller))
        }
    }
    func testReentrantCurrentRetirementAndMissingEndpointCannotDebitOrRevive()throws {
        let f=try NativeSourcePreDebitTestEngine();defer{f.dispose()};let before=f.engine.state,old=f.endpoint
        var called=0;f.currentGate.callback={called+=1;old.retire();f.engine.sourceOrdinaryPreDebitAdmission=nil;return true}
        XCTAssertFalse(f.engine.sourceOrdinaryPreDebitIsCurrent(f.receipt));XCTAssertEqual(called,1);XCTAssertFalse(f.engine.finishSourceOrdinaryPreDebit(f.receipt,outcome:.continueToDebit).accepted);XCTAssertEqual(f.engine.state,before)
    }
    func testUnsupportedQuarantineDoesNotDebitAndRetirementOnlyRemovesCapturedMetadata()throws {
        let f=try NativeSourcePreDebitTestEngine();defer{f.dispose()};let before=f.engine.state
        XCTAssertTrue(f.engine.refuseSourceOrdinaryPreDebit(f.receipt));XCTAssertFalse(f.engine.sourceOrdinaryPreDebitIsCurrent(f.receipt))
        XCTAssertEqual(f.engine.resolve().reason,"source_ordinary_predebit_endpoint_missing");XCTAssertTrue(f.engine.retireSourceOrdinaryPreDebit(f.receipt));XCTAssertEqual(f.engine.state,before)
        XCTAssertEqual(f.engine.pendingOrdinaryPostchecks.map(\.id),[f.ownerID])
    }
}
