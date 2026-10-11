import XCTest
@testable import StackToSixGameplay

@MainActor final class NativeSourceOrdinaryFreshConstructorTests:XCTestCase {
    private func prepared(endgame:Bool=false,draw:@escaping()->Double)throws->(NativeGameplayEngine,NativeOrdinaryMovePlan,NativeOrdinaryAssignment) {
        let e=NativeGameplayEngine(state:.init(tiles:[
            .init(id:"s",cell:.init(column:0,row:0),value:1),
            .init(id:"d",cell:.init(column:1,row:0),value:5),
            .init(id:"other",cell:.init(column:2,row:0),value:3)],board:7),sourceMathRandom:.init(draw:draw))
        e.stagedOrdinaryMoves=true;e.stagedOrdinaryAssignments=true;e.sourceOrdinaryEndgameCoroutineEnabled=endgame
        XCTAssertTrue(e.beginDrag(tileID:"s"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
        let plan=try XCTUnwrap(e.pendingOrdinarySix)
        XCTAssertTrue(e.commitOrdinarySix(receiptID:plan.id,generation:plan.generation).accepted)
        XCTAssertTrue(e.prepareOrdinarySpawns(receiptID:plan.id,generation:plan.generation).accepted)
        return(e,plan,try XCTUnwrap(e.pendingOrdinaryAssignments.first))
    }
    func testActualZeroHolderConstructorDrawPrecedesFaceAndKeepsNativeIdentity()throws {
        var draws=0,armed=false
        let(e,plan,slot)=try prepared {draws+=1;return armed ? (draws==1 ? 0.9:0.1):0.2}
        draws=0;armed=true;e.sourceOrdinaryFreshConstructorEnabled=true;e.sourceOrdinaryFreshConstructorCurrent={e.sourceOrdinaryFreshConstructorIsCurrent($0)}
        var receipt:NativeSourceOrdinaryFreshConstructorReceipt?
        e.sourceOrdinaryFreshConstructor={r in
            receipt=r;XCTAssertTrue(e.sourceOrdinaryFreshConstructorIsCurrent(r))
            let tile=e.state.tiles.first{$0.id==r.tileID};XCTAssertEqual(tile?.value,0);XCTAssertEqual(tile?.locked,true)
            XCTAssertEqual(e.sourceMathRandom?.next(),0.9);return true
        }
        let result=e.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:slot.id)
        XCTAssertTrue(result.accepted);XCTAssertEqual(draws,2)
        let r=try XCTUnwrap(receipt),tile=try XCTUnwrap(e.state.tiles.first{$0.id==r.tileID})
        XCTAssertEqual(tile.value,1);XCTAssertFalse(tile.locked);XCTAssertFalse(e.sourceOrdinaryFreshConstructorIsCurrent(r))
        XCTAssertTrue(result.events.contains{$0.kind == .spawned && $0.tileIDs==[r.tileID]})
    }
    func testRefusedConstructorCannotDrawFaceOrFallBackToRaw()throws {
        var draws=0
        let(e,plan,slot)=try prepared {draws+=1;return 0.2};draws=0
        e.sourceOrdinaryFreshConstructorEnabled=true;e.sourceOrdinaryFreshConstructorCurrent={e.sourceOrdinaryFreshConstructorIsCurrent($0)};e.sourceOrdinaryFreshConstructor={_ in false}
        let result=e.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:slot.id)
        XCTAssertFalse(result.accepted);XCTAssertEqual(draws,0);XCTAssertNil(e.pendingOrdinaryPrimaryArrival)
        XCTAssertFalse(e.state.tiles.contains{$0.id.hasPrefix("native:")})
    }
    func testConstructorRestartCannotAssignFaceOrRemoveSuccessor()throws {
        var draws=0
        let(e,plan,slot)=try prepared {draws+=1;return 0.2};draws=0
        e.sourceOrdinaryFreshConstructorEnabled=true;e.sourceOrdinaryFreshConstructorCurrent={e.sourceOrdinaryFreshConstructorIsCurrent($0)}
        e.sourceOrdinaryFreshConstructor={r in
            e.restart(state:.init(tiles:[.init(id:"successor",cell:r.cell,value:4)]));return true
        }
        let result=e.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:slot.id)
        XCTAssertFalse(result.accepted);XCTAssertEqual(draws,0);XCTAssertEqual(e.state.tiles.map(\.id),["successor"])
    }
    func testFaceDrawRestartAfterRealConstructorCannotMutateSuccessor()throws {
        var e:NativeGameplayEngine!,armed=false,draws=0
        let prepared=try prepared {
            draws+=1
            if armed {armed=false;e.restart(state:.init(tiles:[.init(id:"next",cell:.init(column:1,row:0),value:5)]))}
            return 0.2
        }
        e=prepared.0;let plan=prepared.1,slot=prepared.2;draws=0
        e.sourceOrdinaryFreshConstructorEnabled=true;e.sourceOrdinaryFreshConstructorCurrent={e.sourceOrdinaryFreshConstructorIsCurrent($0)};e.sourceOrdinaryFreshConstructor={_ in armed=true;return true}
        XCTAssertFalse(e.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:slot.id).accepted)
        XCTAssertEqual(draws,1);XCTAssertEqual(e.state.tiles.map(\.id),["next"]);XCTAssertEqual(e.state.tiles.first?.value,5)
    }

    func testNoLockedActualBounceRequiresPhysicalVerificationBeforeSettlement()throws {
        let(e,plan,slot)=try prepared(endgame:true){0.2}
        e.sourceOrdinaryFreshConstructorEnabled=true;e.sourceOrdinaryFreshConstructorCurrent={e.sourceOrdinaryFreshConstructorIsCurrent($0)};e.sourceOrdinaryFreshConstructor={_ in true}
        XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:slot.id).accepted)
        XCTAssertNil(e.pendingSourceOrdinaryEndgameVerification)
        XCTAssertFalse(e.releaseOrdinarySixHandoff(receiptID:plan.id,generation:plan.generation).accepted)
        let arrival=e.finishOrdinaryPrimarySpawn(receiptID:plan.id,generation:plan.generation,assignmentID:slot.id)
        let receipt=try XCTUnwrap(e.pendingSourceOrdinaryEndgameVerification)
        XCTAssertTrue(arrival.events.contains{$0.kind == .sourceOrdinaryEndgameVerificationPrepared})
        XCTAssertFalse(e.verifySourceOrdinaryEndgamePrimary(receipt).accepted)
        e.sourceOrdinaryMinimumTileAuthority = .init(isCurrent:{true},capture:{
            guard let paint=NativeSourceNoMovesRuntimeSnapshot.PaintedStateReceipt(canonicalState:e.state,paintedState:e.state) else{return nil}
            return .init(paint:paint,tiles:Dictionary(uniqueKeysWithValues:e.state.tiles.map{($0.id,NativeNoMovesTileRuntime())}))
        })
        let settled=e.verifySourceOrdinaryEndgamePrimary(receipt)
        XCTAssertTrue(settled.accepted);XCTAssertTrue(settled.events.contains{$0.kind == .sourceOrdinaryEndgameCoroutineSettled})
        XCTAssertNil(e.pendingSourceOrdinaryMinimumPhase)
        XCTAssertFalse(e.verifySourceOrdinaryEndgamePrimary(receipt).accepted)
    }
    func testNoLockedRefusalRetriesTwiceThenPublishesActualHardBeforeVerification()throws {
        let(e,plan,_)=try prepared(endgame:true){0.2}
        e.sourceOrdinaryFreshConstructorEnabled=true;e.sourceOrdinaryFreshConstructorCurrent={e.sourceOrdinaryFreshConstructorIsCurrent($0)};var kinds:[NativeOrdinaryAssignment.Kind]=[]
        e.sourceOrdinaryFreshConstructor={r in kinds.append(r.kind);return r.kind == .endgameHardPrimary}
        var published=0
        e.sourceOrdinaryHardPrimaryPublish={result,_,slot in
            published+=1;XCTAssertEqual(slot.kind,.endgameHardPrimary)
            XCTAssertNil(e.pendingSourceOrdinaryEndgameVerification)
            XCTAssertTrue(result.events.contains{$0.kind == .spawned});return true
        }
        for _ in 0..<3 {
            if let resume=e.pendingSourceOrdinaryEndgameResume {
                XCTAssertTrue(e.pendingOrdinaryAssignments.isEmpty,"Awaited false cannot select retry outside the actual caller FIFO")
                XCTAssertTrue(e.resumeSourceOrdinaryEndgame(resume).accepted)
                XCTAssertFalse(e.resumeSourceOrdinaryEndgame(resume).accepted)
            }
            let slot=try XCTUnwrap(e.pendingOrdinaryAssignments.first)
            XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:slot.id).accepted)
        }
        XCTAssertEqual(kinds,[.endgamePrimary,.endgamePrimary,.endgameHardPrimary]);XCTAssertEqual(published,1)
        XCTAssertNotNil(e.pendingSourceOrdinaryEndgameVerification);XCTAssertNil(e.pendingOrdinaryPrimaryArrival)
        XCTAssertEqual(e.state.moves,49)
    }

    func testScopeRetirementDuringFaceDrawRejectsEvenWhenCanonicalStateUnchanged()throws {
        var e:NativeGameplayEngine!,armed=false,draws=0,current=true
        let setup=try prepared {draws+=1;if armed {current=false};return 0.2}
        e=setup.0;let plan=setup.1,slot=setup.2;draws=0
        e.sourceOrdinaryFreshConstructorEnabled=true
        e.sourceOrdinaryFreshConstructor={_ in armed=true;return true}
        e.sourceOrdinaryFreshConstructorCurrent={_ in current}
        XCTAssertFalse(e.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:slot.id).accepted)
        XCTAssertEqual(draws,1);XCTAssertNil(e.pendingOrdinaryPrimaryArrival)
        XCTAssertFalse(e.state.tiles.contains{$0.id.hasPrefix("native:")})
    }

}
