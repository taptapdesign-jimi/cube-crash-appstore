import XCTest
@testable import StackToSixGameplay
final class NativeOrdinaryAssignmentTests:XCTestCase {
    func make(_ locked:Int=3,depth:Int=1)->NativeGameplayEngine {
        var tiles=[NativeTile(id:"a",cell:.init(column:0,row:0),value:1,stackDepth:depth),NativeTile(id:"b",cell:.init(column:1,row:0),value:5),NativeTile(id:"c",cell:.init(column:2,row:0),value:1),NativeTile(id:"d",cell:.init(column:3,row:0),value:1)]
        for i in 0..<locked {tiles.append(NativeTile(id:"l\(i)",cell:.init(column:i,row:1),value:0,locked:true))}
        let e=NativeGameplayEngine(state:NativeBoardState(tiles:tiles,board:10),recordedRandomChoices:Array(repeating:0,count:100));e.stagedOrdinaryMoves=true;e.stagedOrdinaryAssignments=true
        XCTAssertTrue(e.beginDrag(tileID:"a"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
        return e
    }
    func testMainThenOuterThenLockedAssignmentsMatchSourcePhaseAndPreservePlaceholderIdentity()throws {
        let e=make(),p=try XCTUnwrap(e.pendingOrdinarySix),rng=e.state.rngState
        let main=e.commitOrdinarySix(receiptID:p.id,generation:p.generation)
        XCTAssertEqual(main.events.first{$0.kind == .ordinarySpawnsPrepareRequested}?.value,50)
        XCTAssertFalse(main.events.contains{$0.kind == .spawned});XCTAssertEqual(e.state.rngState,rng)
        XCTAssertTrue(e.prepareOrdinarySpawns(receiptID:p.id,generation:p.generation).accepted)
        let slots=e.pendingOrdinaryAssignments;XCTAssertEqual(slots.map(\.delayMilliseconds),[50,150])
        for s in slots {XCTAssertEqual(e.state.tile(at:s.cell)?.value,0);XCTAssertTrue(e.state.tile(at:s.cell)!.locked)}
        XCTAssertFalse(e.commitOrdinaryAssignment(receiptID:p.id,generation:p.generation,assignmentID:slots[1].id).accepted)
        for slot in slots {
            let r=e.commitOrdinaryAssignment(receiptID:p.id,generation:p.generation,assignmentID:slot.id)
            XCTAssertTrue(r.accepted);XCTAssertEqual(r.events.first{$0.kind == .spawned}?.tileIDs,[slot.tileID!])
            XCTAssertTrue(e.beginDrag(tileID:slot.tileID!));e.cancelDrag()
            XCTAssertFalse(e.commitOrdinaryAssignment(receiptID:p.id,generation:p.generation,assignmentID:slot.id).accepted)
        }
        XCTAssertTrue(e.releaseOrdinarySixHandoff(receiptID:p.id,generation:p.generation).accepted)
    }
    func testRecycledLockedSpecialClearsRegistryAndMagnetIdentityAtActualOpening()throws {
        let tiles=[NativeTile(id:"a",cell:.init(column:0,row:0),value:1),NativeTile(id:"b",cell:.init(column:1,row:0),value:5),NativeTile(id:"c",cell:.init(column:2,row:0),value:1),NativeTile(id:"recycled",cell:.init(column:0,row:1),value:6,archetype:.magnet,variant:"honey",locked:true,magnetOwned:true,resolutionOwned:true)]
        let e=NativeGameplayEngine(state:NativeBoardState(tiles:tiles,board:10),recordedRandomChoices:Array(repeating:0,count:50));e.stagedOrdinaryMoves=true;e.stagedOrdinaryAssignments=true
        XCTAssertTrue(e.beginDrag(tileID:"a"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted);let p=try XCTUnwrap(e.pendingOrdinarySix)
        XCTAssertTrue(e.commitOrdinarySix(receiptID:p.id,generation:p.generation).accepted);XCTAssertTrue(e.prepareOrdinarySpawns(receiptID:p.id,generation:p.generation).accepted)
        let slot=try XCTUnwrap(e.pendingOrdinaryAssignments.first);XCTAssertEqual(slot.tileID,"recycled")
        XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:p.id,generation:p.generation,assignmentID:slot.id).accepted)
        let tile=try XCTUnwrap(e.state.tiles.first{$0.id=="recycled"});XCTAssertNil(tile.variant);XCTAssertNil(tile.archetype);XCTAssertFalse(tile.magnetOwned);XCTAssertFalse(tile.resolutionOwned);XCTAssertTrue(tile.isPlayable)
    }
    func testNewAcceptedStackBetweenAssignmentsRevokesRemainingValueDrawAndMutation()throws {
        let e=make(),p=try XCTUnwrap(e.pendingOrdinarySix)
        XCTAssertTrue(e.commitOrdinarySix(receiptID:p.id,generation:p.generation).accepted);XCTAssertTrue(e.prepareOrdinarySpawns(receiptID:p.id,generation:p.generation).accepted)
        let slots=e.pendingOrdinaryAssignments
        XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:p.id,generation:p.generation,assignmentID:slots[0].id).accepted)
        XCTAssertTrue(e.beginDrag(tileID:slots[0].tileID!));XCTAssertTrue(e.drop(target:.init(column:2,row:0)).accepted)
        let old=e.state
        XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:p.id,generation:p.generation,assignmentID:slots[1].id).accepted)
        XCTAssertEqual(e.state,old);XCTAssertEqual(e.state.tile(at:slots[1].cell)?.value,0)
        XCTAssertTrue(e.releaseOrdinarySixHandoff(receiptID:p.id,generation:p.generation).accepted)
    }
    func testEndgamePrimaryHasOuter50AssignmentAndSeparateActualBounceSettlement()throws {
        let e=make(0),p=try XCTUnwrap(e.pendingOrdinarySix)
        XCTAssertTrue(e.commitOrdinarySix(receiptID:p.id,generation:p.generation).accepted);XCTAssertTrue(e.prepareOrdinarySpawns(receiptID:p.id,generation:p.generation).accepted)
        let protected=try XCTUnwrap(e.state.tile(at:p.destination.cell));XCTAssertEqual(protected.id,p.destination.id);XCTAssertTrue(protected.merge6CleanupOwned);XCTAssertFalse(e.beginDrag(tileID:protected.id))
        let slot=try XCTUnwrap(e.pendingOrdinaryAssignments.first);XCTAssertEqual(slot.kind,.endgamePrimary);XCTAssertEqual(slot.delayMilliseconds,0)
        XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:p.id,generation:p.generation,assignmentID:slot.id).accepted)
        let tile=try XCTUnwrap(e.state.tile(at:p.destination.cell));XCTAssertTrue(e.beginDrag(tileID:tile.id));e.cancelDrag()
        XCTAssertFalse(e.releaseOrdinarySixHandoff(receiptID:p.id,generation:p.generation).accepted)
        if e.pendingOrdinaryDestinationCleanup != nil {XCTAssertTrue(e.commitOrdinaryDestinationCleanup(receiptID:p.id,generation:p.generation).accepted)}
        XCTAssertTrue(e.finishOrdinaryPrimarySpawn(receiptID:p.id,generation:p.generation,assignmentID:slot.id).accepted)
        XCTAssertFalse(e.finishOrdinaryPrimarySpawn(receiptID:p.id,generation:p.generation,assignmentID:slot.id).accepted)
        XCTAssertTrue(e.releaseOrdinarySixHandoff(receiptID:p.id,generation:p.generation).accepted)
    }
    func testEndgameCleanup100msCannotRemoveFreshCellAndOldEpochStillRetiresOnlyOwnedDestination()throws {
        for interleaved in [false,true] {
            let e=make(0),p=try XCTUnwrap(e.pendingOrdinarySix)
            XCTAssertTrue(e.commitOrdinarySix(receiptID:p.id,generation:p.generation).accepted)
            XCTAssertEqual(e.pendingOrdinaryDestinationCleanup?.delayMilliseconds,100)
            if interleaved {XCTAssertTrue(e.beginDrag(tileID:"c"));XCTAssertTrue(e.drop(target:.init(column:3,row:0)).accepted)}
            XCTAssertTrue(e.prepareOrdinarySpawns(receiptID:p.id,generation:p.generation).accepted)
            if let slot=e.pendingOrdinaryAssignments.first {XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:p.id,generation:p.generation,assignmentID:slot.id).accepted)}
            let freshID=e.state.tile(at:p.destination.cell)?.id
            XCTAssertTrue(e.commitOrdinaryDestinationCleanup(receiptID:p.id,generation:p.generation).accepted)
            XCTAssertFalse(e.commitOrdinaryDestinationCleanup(receiptID:p.id,generation:p.generation).accepted)
            if interleaved {XCTAssertNil(e.state.tile(at:p.destination.cell))}else{XCTAssertEqual(e.state.tile(at:p.destination.cell)?.id,freshID)}
        }
    }
    func testShortLockedBatchRefillsOnlyAfterLastLogicalAssignmentAndActualPrimaryCompletion()throws {
        let e=make(1),p=try XCTUnwrap(e.pendingOrdinarySix)
        XCTAssertTrue(e.commitOrdinarySix(receiptID:p.id,generation:p.generation).accepted);XCTAssertTrue(e.prepareOrdinarySpawns(receiptID:p.id,generation:p.generation).accepted)
        let locked=try XCTUnwrap(e.pendingOrdinaryAssignments.first)
        XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:p.id,generation:p.generation,assignmentID:locked.id).accepted)
        let next=try XCTUnwrap(e.pendingOrdinaryAssignments.first);XCTAssertEqual(next.kind,.remainderPrimary);XCTAssertNotEqual(next.cell,p.destination.cell);XCTAssertEqual(next.delayMilliseconds,0)
        XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:p.id,generation:p.generation,assignmentID:next.id).accepted)
        XCTAssertFalse(e.releaseOrdinarySixHandoff(receiptID:p.id,generation:p.generation).accepted)
        XCTAssertTrue(e.finishOrdinaryPrimarySpawn(receiptID:p.id,generation:p.generation,assignmentID:next.id).accepted)
        XCTAssertTrue(e.releaseOrdinarySixHandoff(receiptID:p.id,generation:p.generation).accepted)
        XCTAssertEqual(e.state.tiles.filter{!$0.locked}.count,4)
    }
    func testOrdinaryOpeningCannotReleaseIndependentStillPendingTntBonusOwnership()throws {
        var tiles=[NativeTile(id:"t",cell:.init(column:0,row:0),value:6,archetype:.tnt),NativeTile(id:"merge",cell:.init(column:1,row:0),value:2)]
        tiles += (0..<4).map{NativeTile(id:"l\($0)",cell:.init(column:$0,row:1),value:1,locked:true)}
        tiles += (0..<10).map{NativeTile(id:"o\($0)",cell:.init(column:$0%5,row:2+$0/5),value:$0%2 == 0 ? 1:5)}
        let e=NativeGameplayEngine(state:NativeBoardState(tiles:tiles,board:10),recordedRandomChoices:Array(repeating:0,count:200));e.stagedOrdinaryMoves=true;e.stagedOrdinaryAssignments=true
        XCTAssertTrue(e.beginDrag(tileID:"t"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
        let tnt=try XCTUnwrap(e.pendingSpecial);XCTAssertTrue(e.releaseTntReservation(transactionID:tnt.id).accepted)
        let ordinary=e.state.tiles.filter{$0.isPlayable && !$0.isWild}
        let pair=try XCTUnwrap(ordinary.compactMap{a in ordinary.first{$0.id != a.id && a.value+$0.value == 6}.map{(a,$0)}}.first)
        XCTAssertTrue(e.beginDrag(tileID:pair.0.id));XCTAssertTrue(e.drop(target:pair.1.cell).accepted);let p=try XCTUnwrap(e.pendingOrdinarySix)
        XCTAssertTrue(e.commitOrdinarySix(receiptID:p.id,generation:p.generation).accepted);XCTAssertTrue(e.prepareOrdinarySpawns(receiptID:p.id,generation:p.generation).accepted)
        let slots=e.pendingOrdinaryAssignments
        var reserved=0
        for slot in slots {
            XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:p.id,generation:p.generation,assignmentID:slot.id).accepted)
            if tnt.targets.contains(where:{$0.id==slot.tileID}) {reserved+=1;XCTAssertFalse(e.beginDrag(tileID:slot.tileID!));XCTAssertTrue(e.state.tiles.first{$0.id==slot.tileID}!.resolutionOwned)}
        }
        XCTAssertGreaterThan(reserved,0)
        for target in tnt.targets {XCTAssertTrue(e.commitSpecialImpact(transactionID:tnt.id,tileID:target.id).accepted)}
        XCTAssertTrue(e.commitSpecialBoard(transactionID:tnt.id).accepted)
    }
    func testRetiredCapturedLockedBatchRunsSourceStablePriorityForcedUnlockThenDebitsNoExtraMove()throws {
        var tiles=[NativeTile(id:"t",cell:.init(column:0,row:0),value:6,archetype:.tnt),NativeTile(id:"merge",cell:.init(column:1,row:0),value:2)]
        tiles += (0..<4).map{NativeTile(id:"l\($0)",cell:.init(column:$0,row:1),value:1,locked:true)}
        tiles += (0..<10).map{NativeTile(id:"o\($0)",cell:.init(column:$0%5,row:2+$0/5),value:$0%2 == 0 ? 1:5)}
        let e=NativeGameplayEngine(state:NativeBoardState(tiles:tiles,board:10),recordedRandomChoices:Array(repeating:0,count:200));e.stagedOrdinaryMoves=true;e.stagedOrdinaryAssignments=true
        XCTAssertTrue(e.beginDrag(tileID:"t"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
        let tnt=try XCTUnwrap(e.pendingSpecial);XCTAssertTrue(e.releaseTntReservation(transactionID:tnt.id).accepted)
        let ordinary=e.state.tiles.filter{$0.isPlayable && !$0.isWild}
        let pair=try XCTUnwrap(ordinary.compactMap{a in ordinary.first{$0.id != a.id && a.value+$0.value == 6}.map{(a,$0)}}.first)
        XCTAssertTrue(e.beginDrag(tileID:pair.0.id));XCTAssertTrue(e.drop(target:pair.1.cell).accepted);let p=try XCTUnwrap(e.pendingOrdinarySix)
        XCTAssertTrue(e.commitOrdinarySix(receiptID:p.id,generation:p.generation).accepted);XCTAssertTrue(e.prepareOrdinarySpawns(receiptID:p.id,generation:p.generation).accepted)
        let slots=e.pendingOrdinaryAssignments
        XCTAssertTrue(slots.allSatisfy{slot in tnt.targets.contains{$0.id==slot.tileID}})
        for target in tnt.targets {XCTAssertTrue(e.commitSpecialImpact(transactionID:tnt.id,tileID:target.id).accepted)}
        let moves=e.state.moves
        let candidates=e.state.tiles.filter(\.locked)
        let oracle=try JSONDecoder().decode(NativeOrdinaryAssignmentSourceTests.Oracle.self,from:NativeOrdinaryAssignmentOracle.data)
        let source=try XCTUnwrap(oracle.forced.first{$0.count==candidates.count && $0.k==2 && !$0.prefer && !$0.rejected})
        for slot in slots {XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:p.id,generation:p.generation,assignmentID:slot.id).accepted)}
        let sourceFirst=try XCTUnwrap(source.assignments.first),sourceSecond=try XCTUnwrap(source.assignments.dropFirst().first)
        let firstForced=try XCTUnwrap(e.pendingOrdinaryAssignments.first);XCTAssertEqual(firstForced.kind,.forcedLocked);XCTAssertEqual(firstForced.delayMilliseconds,sourceFirst.time)
        XCTAssertEqual(firstForced.tileID,candidates[try XCTUnwrap(Int(sourceFirst.id.dropFirst()))].id)
        XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:p.id,generation:p.generation,assignmentID:firstForced.id).accepted)
        let secondForced=try XCTUnwrap(e.pendingOrdinaryAssignments.first);XCTAssertEqual(secondForced.kind,.forcedLocked);XCTAssertEqual(secondForced.delayMilliseconds,sourceSecond.time-sourceFirst.time)
        XCTAssertEqual(secondForced.tileID,candidates[try XCTUnwrap(Int(sourceSecond.id.dropFirst()))].id)
        XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:p.id,generation:p.generation,assignmentID:secondForced.id).accepted)
        XCTAssertTrue(e.pendingOrdinaryAssignments.isEmpty);XCTAssertEqual(e.state.moves,moves)
        XCTAssertTrue(e.releaseOrdinarySixHandoff(receiptID:p.id,generation:p.generation).accepted)
    }
    func testBackgroundDuringAwaitedRemainderBounceSettlesSubsequentOpeningsBeforeSave()throws {
        let e=make(1,depth:3),p=try XCTUnwrap(e.pendingOrdinarySix)
        XCTAssertTrue(e.commitOrdinarySix(receiptID:p.id,generation:p.generation).accepted);XCTAssertTrue(e.prepareOrdinarySpawns(receiptID:p.id,generation:p.generation).accepted)
        let locked=try XCTUnwrap(e.pendingOrdinaryAssignments.first);XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:p.id,generation:p.generation,assignmentID:locked.id).accepted)
        let primary=try XCTUnwrap(e.pendingOrdinaryAssignments.first);XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:p.id,generation:p.generation,assignmentID:primary.id).accepted)
        XCTAssertNotNil(e.pendingOrdinaryPrimaryArrival);e.cancelForBackground();let saved=e.state
        XCTAssertNil(e.pendingOrdinaryPrimaryArrival);XCTAssertTrue(e.pendingOrdinaryAssignments.isEmpty);XCTAssertNil(e.pendingOrdinarySix)
        XCTAssertTrue(saved.validationIssues().isEmpty);XCTAssertEqual(saved.moves,49);XCTAssertEqual(saved.tiles.filter{!$0.locked}.count,5);e.cancelForBackground();XCTAssertEqual(e.state,saved)
        XCTAssertFalse(e.finishOrdinaryPrimarySpawn(receiptID:p.id,generation:p.generation,assignmentID:primary.id).accepted)
    }
    func testBackgroundSettlesAllCapturedAssignmentsOnceAndRestartRevokesLaterActions()throws {
        for locked in [0,1,3] {
            let e=make(locked),p=try XCTUnwrap(e.pendingOrdinarySix);e.cancelForBackground();let saved=e.state
            XCTAssertNil(e.pendingOrdinarySix);XCTAssertTrue(e.pendingOrdinaryAssignments.isEmpty);XCTAssertNil(e.pendingOrdinaryPrimaryArrival)
            XCTAssertEqual(saved.moves,49);XCTAssertTrue(saved.validationIssues().isEmpty)
            e.cancelForBackground();XCTAssertEqual(e.state,saved)
            XCTAssertFalse(e.prepareOrdinarySpawns(receiptID:p.id,generation:p.generation).accepted)
            XCTAssertEqual(try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(saved)),saved)
            e.restart(state:NativeBoardState(tiles:[]));let fresh=e.state
            XCTAssertFalse(e.commitOrdinaryAssignment(receiptID:p.id,generation:p.generation,assignmentID:"stale").accepted);XCTAssertEqual(e.state,fresh)
        }
    }
}
