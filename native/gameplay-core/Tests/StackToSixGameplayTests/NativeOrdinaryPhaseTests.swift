import XCTest
@testable import StackToSixGameplay
final class NativeOrdinaryPhaseTests:XCTestCase {
    func die(_ id:String,_ value:Int,_ column:Int)->NativeTile{NativeTile(id:id,cell:NativeCell(column:column,row:0),value:value)}
    func engine(_ values:[Int])->NativeGameplayEngine{let e=NativeGameplayEngine(state:NativeBoardState(tiles:values.enumerated().map{die("d\($0.offset)",$0.element,$0.offset)}),recordedRandomChoices:Array(repeating:0,count:100));e.stagedOrdinaryMoves=true;return e}
    @discardableResult func drop(_ e:NativeGameplayEngine,_ source:String,_ column:Int,_ time:Double=0)->NativeMoveResult{XCTAssertTrue(e.beginDrag(tileID:source));return e.drop(target:NativeCell(column:column,row:0),now:time)}
    func testMissingOrdinarySixPresentationRejectsBeforeReservationAndReadinessCanRecover() {
        for values in [[1,5],[1,5,2,1]] {
            let e=engine(values),before=e.state
            e.ordinarySixPresentationAdmitted={false}
            let rejected=drop(e,"d0",1)
            XCTAssertFalse(rejected.accepted);XCTAssertEqual(rejected.events.first?.reason,"native_ordinary_six_presentation_not_ready")
            XCTAssertEqual(e.state,before);XCTAssertNil(e.pendingOrdinarySix);XCTAssertTrue(e.pendingOrdinarySpawns.isEmpty)
            e.ordinarySixPresentationAdmitted={true}
            XCTAssertTrue(drop(e,"d0",1).accepted);XCTAssertEqual(e.pendingOrdinarySix?.id,"native-six:\(before.generation):1")
            XCTAssertEqual(e.state.rngState,before.rngState);XCTAssertEqual(e.state.moves,before.moves);XCTAssertEqual(e.state.score,before.score)
        }
    }
    func testOrdinarySixProtectsCapturedCarrierBeforeActual80msMain() {
        let e=engine([1,5,2,1]);let rng=e.state.rngState
        XCTAssertTrue(drop(e,"d0",1,10).accepted);let p=e.pendingOrdinarySix!
        XCTAssertEqual(e.state.score,0);XCTAssertEqual(e.state.moves,50);XCTAssertEqual(e.state.combo,0);XCTAssertEqual(e.state.cubesCracked,0)
        XCTAssertEqual(e.state.rngState,rng);XCTAssertTrue(e.state.tile(at:p.destination.cell)!.merge6CleanupOwned)
        XCTAssertFalse(e.beginDrag(tileID:p.source.id));XCTAssertFalse(e.beginDrag(tileID:p.destination.id));XCTAssertEqual(e.resolve().kind,.wait)
        XCTAssertFalse(e.releaseOrdinarySixHandoff(receiptID:p.id,generation:p.generation).accepted)
        let r=e.commitOrdinarySix(receiptID:p.id,generation:p.generation)
        XCTAssertTrue(r.accepted);XCTAssertEqual(e.state.score,12);XCTAssertEqual(e.state.moves,49);XCTAssertEqual(e.state.cubesCracked,1)
        XCTAssertFalse(e.commitOrdinarySix(receiptID:p.id,generation:p.generation).accepted)
        for id in e.pendingOrdinarySpawns {XCTAssertTrue(e.commitOrdinarySpawnArrival(receiptID:p.id,generation:p.generation,tileID:id).accepted)}
        XCTAssertTrue(e.releaseOrdinarySixHandoff(receiptID:p.id,generation:p.generation).accepted);XCTAssertNil(e.pendingOrdinarySix)
    }
    func testCapturedFinalSixSuppressesAllSpawnsAndBackgroundCommitsExactlyOnce()throws {
        let e=engine([1,5]);e.stateSnapshotCheck()
        XCTAssertTrue(drop(e,"d0",1).accepted);let p=e.pendingOrdinarySix!
        XCTAssertTrue(p.isFinal);XCTAssertNil(e.state.terminal);XCTAssertEqual(e.state.moves,50)
        e.cancelForBackground();let settled=e.state
        XCTAssertEqual(settled.moves,49);XCTAssertEqual(settled.score,12);XCTAssertEqual(settled.terminal?.kind,.complete);XCTAssertTrue(settled.tiles.isEmpty)
        let saved=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(settled));XCTAssertEqual(saved,settled)
        e.cancelForBackground();XCTAssertEqual(e.state,settled);XCTAssertFalse(e.commitOrdinarySix(receiptID:p.id,generation:p.generation).accepted)
    }
    func testRestartRevokesCapturedSixAndSmallStackDebits() {
        let e=engine([1,5,1,2]);XCTAssertTrue(drop(e,"d0",1).accepted);let p=e.pendingOrdinarySix!
        e.restart(state:NativeBoardState(tiles:[die("new",1,0)]));let fresh=e.state
        XCTAssertFalse(e.commitOrdinarySix(receiptID:p.id,generation:p.generation).accepted);XCTAssertEqual(e.state,fresh)
        let s=engine([1,2,1]);XCTAssertTrue(drop(s,"d0",1).accepted);let stack=s.pendingOrdinaryStack!
        XCTAssertTrue(s.finishOrdinaryStackAbsorb(receiptID:stack.id,generation:stack.generation).accepted)
        s.restart(state:NativeBoardState(tiles:[die("new",1,0)]));XCTAssertFalse(s.commitOrdinaryPostcheck(receiptID:stack.id,generation:stack.generation).accepted)
    }
    func testSmallStackCommitsContactStateImmediatelyAndRetainsPickupBeforeHandoff() {
        let e=engine([1,2,1]);XCTAssertTrue(drop(e,"d0",1,10).accepted);let p=e.pendingOrdinaryStack!
        XCTAssertEqual(e.state.tile(at:p.destination.cell)?.value,3);XCTAssertEqual(e.state.score,3);XCTAssertEqual(e.state.combo,1);XCTAssertEqual(e.state.moves,50)
        XCTAssertEqual(e.state.wildMeter,0.1,accuracy:1e-10);XCTAssertTrue(e.beginDrag(tileID:"d2"))
        XCTAssertFalse(e.drop(target:p.destination.cell,now:10.04).accepted);XCTAssertEqual(e.state.score,3)
        XCTAssertTrue(e.beginDrag(tileID:"d2"));XCTAssertTrue(e.finishOrdinaryStackAbsorb(receiptID:p.id,generation:p.generation).accepted)
        XCTAssertEqual(e.pendingOrdinaryPostchecks.first?.delayMilliseconds,100)
        XCTAssertTrue(e.drop(target:p.destination.cell,now:10.081).accepted)
        XCTAssertEqual(e.state.tile(at:p.destination.cell)?.value,4);XCTAssertEqual(e.state.moves,50)
    }
    func testSourcePostcheckDebitsContinueOnlyAndReturnsBeforeDebitOnNoMoves() {
        let e=engine([1,2,1]);XCTAssertTrue(drop(e,"d0",1).accepted);let p=e.pendingOrdinaryStack!
        XCTAssertTrue(e.finishOrdinaryStackAbsorb(receiptID:p.id,generation:p.generation).accepted)
        XCTAssertTrue(e.commitOrdinaryPostcheck(receiptID:p.id,generation:p.generation).accepted);XCTAssertEqual(e.state.moves,49)
        XCTAssertFalse(e.commitOrdinaryPostcheck(receiptID:p.id,generation:p.generation).accepted);XCTAssertEqual(e.state.moves,49)
        let fail=engine([3,2]);XCTAssertTrue(drop(fail,"d0",1).accepted);let q=fail.pendingOrdinaryStack!
        XCTAssertTrue(fail.finishOrdinaryStackAbsorb(receiptID:q.id,generation:q.generation).accepted)
        XCTAssertTrue(fail.commitOrdinaryPostcheck(receiptID:q.id,generation:q.generation).accepted);XCTAssertEqual(fail.state.moves,50);XCTAssertEqual(fail.resolve().kind,.fail)
    }
    func testBusyEndingChangedDuringActualPostcheckWaitCannotCreateMoveDebitBeforeFailReturn() {
        let e=engine([3,2]);XCTAssertTrue(drop(e,"d0",1).accepted);let p=e.pendingOrdinaryStack!
        XCTAssertTrue(e.finishOrdinaryStackAbsorb(receiptID:p.id,generation:p.generation).accepted)
        XCTAssertEqual(e.pendingOrdinaryPostchecks.first?.delayMilliseconds,100)
        var flags=e.flags;flags.busyEnding=true;e.setRuntimeFlags(flags)
        XCTAssertTrue(e.commitOrdinaryPostcheck(receiptID:p.id,generation:p.generation).accepted)
        XCTAssertEqual(e.state.moves,50);XCTAssertEqual(e.state.score,5)
    }
    func testInterruptedSmallStackFinalizesBoardButDoesNotInventDebitedMove()throws {
        let e=engine([1,2,1]);XCTAssertTrue(drop(e,"d0",1).accepted);let p=e.pendingOrdinaryStack!
        e.cancelForBackground();XCTAssertNil(e.pendingOrdinaryStack);XCTAssertTrue(e.pendingOrdinaryPostchecks.isEmpty)
        XCTAssertFalse(e.state.tiles.contains{$0.id==p.source.id});XCTAssertEqual(e.state.score,3);XCTAssertEqual(e.state.moves,50)
        let saved=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(e.state));XCTAssertTrue(saved.validationIssues().isEmpty)
        XCTAssertFalse(e.finishOrdinaryStackAbsorb(receiptID:p.id,generation:p.generation).accepted)
    }
    func testSixHandoffAllowsOnlySubSixStacksAndOlderEpochCannotSpawnAfterThem() {
        let e=engine([1,5,1,2]);XCTAssertTrue(drop(e,"d0",1).accepted);let six=e.pendingOrdinarySix!
        XCTAssertTrue(drop(e,"d2",3,0.04).accepted);let stack=e.pendingOrdinaryStack!
        XCTAssertEqual(e.state.score,3);XCTAssertEqual(e.state.moves,50)
        let main=e.commitOrdinarySix(receiptID:six.id,generation:six.generation)
        XCTAssertTrue(main.accepted);XCTAssertFalse(main.events.contains{$0.kind == .spawned})
        XCTAssertEqual(e.state.score,27);XCTAssertEqual(e.state.moves,49);XCTAssertEqual(e.state.tile(at:stack.destination.cell)?.value,3)
        XCTAssertTrue(e.finishOrdinaryStackAbsorb(receiptID:stack.id,generation:stack.generation).accepted)
        XCTAssertTrue(e.releaseOrdinarySixHandoff(receiptID:six.id,generation:six.generation).accepted)
        XCTAssertTrue(e.commitOrdinaryPostcheck(receiptID:stack.id,generation:stack.generation).accepted)
        XCTAssertEqual(e.state.moves,49) // Current lone3 fails before the source moves debit.
    }
    func testCompetingPointerCannotCancelPickupDuringOwnedStackHandoff() {
        let e=engine([1,2,1]);XCTAssertTrue(drop(e,"d0",1).accepted);let p=e.pendingOrdinaryStack!
        XCTAssertTrue(e.beginDrag(tileID:"d2",pointerID:17))
        XCTAssertFalse(e.drop(target:p.destination.cell,pointerID:99).accepted);XCTAssertTrue(e.isDragging)
        XCTAssertTrue(e.finishOrdinaryStackAbsorb(receiptID:p.id,generation:p.generation).accepted)
        XCTAssertTrue(e.drop(target:p.destination.cell,pointerID:17).accepted)
    }
    func testOrdinaryLogicalSpawnArrivalNeverHoldsInputThroughDecorativeBounce() {
        let e=engine([1,5,1,2]);XCTAssertTrue(drop(e,"d0",1).accepted);let p=e.pendingOrdinarySix!
        XCTAssertTrue(e.commitOrdinarySix(receiptID:p.id,generation:p.generation).accepted)
        let ids=e.pendingOrdinarySpawns;XCTAssertFalse(ids.isEmpty)
        XCTAssertTrue(e.beginDrag(tileID:ids.first!));e.cancelDrag()
        XCTAssertFalse(e.releaseOrdinarySixHandoff(receiptID:p.id,generation:p.generation).accepted)
        for id in ids {XCTAssertTrue(e.commitOrdinarySpawnArrival(receiptID:p.id,generation:p.generation,tileID:id).accepted);XCTAssertFalse(e.commitOrdinarySpawnArrival(receiptID:p.id,generation:p.generation,tileID:id).accepted)}
        XCTAssertTrue(e.releaseOrdinarySixHandoff(receiptID:p.id,generation:p.generation).accepted)
        XCTAssertTrue(e.beginDrag(tileID:ids.first!))
    }
    func testActualWildAndTutorialFailReturnsDoNotDebitAndBusyAbsorbStillDebits() {
        for tutorial in [false,true] {
            var state=NativeBoardState(tiles:[die("d0",3,0),die("d1",2,1)])
            if tutorial {var t=NativeTutorialState();t.step = .freePlay;t.completionAssist=true;state.tutorial=t}else{state.wildMeter=0.95}
            let e=NativeGameplayEngine(state:state,rewardPicker:{_,_ in NativeWildRewardChoice(.star)});e.stagedOrdinaryMoves=true
            XCTAssertTrue(drop(e,"d0",1).accepted);let p=e.pendingOrdinaryStack!
            XCTAssertTrue(e.finishOrdinaryStackAbsorb(receiptID:p.id,generation:p.generation).accepted)
            XCTAssertTrue(e.commitOrdinaryPostcheck(receiptID:p.id,generation:p.generation).accepted)
            XCTAssertEqual(e.state.moves,50);XCTAssertEqual(e.resolve().reason,tutorial ? "tutorial_final_chance_pending":"wild_continuation_pending")
        }
        let busy=engine([3,2]);XCTAssertTrue(drop(busy,"d0",1).accepted);let p=busy.pendingOrdinaryStack!
        var f=busy.flags;f.busyEnding=true;busy.setRuntimeFlags(f)
        XCTAssertTrue(busy.finishOrdinaryStackAbsorb(receiptID:p.id,generation:p.generation).accepted)
        XCTAssertTrue(busy.commitOrdinaryPostcheck(receiptID:p.id,generation:p.generation).accepted);XCTAssertEqual(busy.state.moves,49)
    }
    func testAnotherOrdinarySixIsRejectedWhileSourceHandoffOwnsDestination() {
        let e=engine([1,5,2,4]);XCTAssertTrue(drop(e,"d0",1).accepted)
        XCTAssertTrue(e.beginDrag(tileID:"d2"));XCTAssertFalse(e.drop(target:NativeCell(column:3,row:0)).accepted)
        XCTAssertEqual(e.state.moves,50);XCTAssertEqual(e.state.score,0);XCTAssertEqual(e.pendingOrdinarySix?.source.id,"d0")
    }
}
private extension NativeGameplayEngine {func stateSnapshotCheck(){XCTAssertTrue(state.validationIssues().isEmpty)}}
