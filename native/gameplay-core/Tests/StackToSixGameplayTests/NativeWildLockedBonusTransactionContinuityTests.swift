import XCTest
@testable import StackToSixGameplay

final class NativeWildLockedBonusTransactionContinuityTests: XCTestCase {
    private func drainSpawn(_ engine: NativeGameplayEngine, plan: NativeSpecialMovePlan) throws {
        for _ in 0..<100 {
            if let action = engine.pendingWildSpawnActions.first {
                XCTAssertTrue(engine.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:action.id).accepted)
            } else if let arrival = engine.pendingWildSpawnArrivals.first {
                XCTAssertTrue(engine.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id).accepted)
            } else { return }
        }
        XCTFail("Wild spawn did not settle within its bounded commands")
    }

    private func exercise(firstVariant: String?) throws {
        let first = NativeTile(id:"first",cell:.init(column:0,row:0),value:6,archetype:.tnt,variant:firstVariant)
        let second = NativeTile(id:"second-laser",cell:.init(column:1,row:0),value:6,archetype:.tnt,variant:"laser-gun")
        let ordinary = (2...8).map { index in
            NativeTile(id:"ordinary-\(index)",cell:.init(column:index%5,row:index/5),value:(index-2)%5+1)
        }
        let engine = NativeGameplayEngine(state:.init(tiles:[first,second]+ordinary,moves:7),recordedRandomChoices:Array(repeating:0.23,count:2000))
        engine.stagedTntActivation = true
        engine.stagedTntWildSpawnAssignments = true
        engine.laserViewportWidth = 390
        engine.laserTargetX = { Double($0.cell.column)*65+65 }

        XCTAssertTrue(engine.beginDrag(tileID:first.id))
        XCTAssertTrue(engine.drop(target:ordinary[0].cell,now:1).accepted)
        let firstPlan = try XCTUnwrap(engine.pendingSpecial)
        let firstActivation = engine.commitSpecialActivation(transactionID:firstPlan.id)
        XCTAssertTrue(firstActivation.accepted)
        try drainSpawn(engine,plan:firstPlan)
        XCTAssertTrue(engine.reserveTntTargets(transactionID:firstPlan.id).accepted)
        XCTAssertTrue(engine.releaseTntReservation(transactionID:firstPlan.id).accepted)
        for target in try XCTUnwrap(engine.pendingSpecial).targets {
            XCTAssertTrue(engine.commitSpecialImpact(transactionID:firstPlan.id,tileID:target.id).accepted)
        }
        XCTAssertTrue(engine.commitSpecialBoard(transactionID:firstPlan.id).accepted)
        let oldReceipts = engine.pendingWildLockedBonusPresentations.filter{$0.transactionID==firstPlan.id}
        XCTAssertEqual(oldReceipts.count,9)
        let oldIDs = Set(oldReceipts.map(\.tileID))

        // A genuine intervening ordinary-six opens some prior bonus holders.
        // Others remain locked; both cohorts must stay out of the next pop event.
        let playable = engine.state.tiles.filter{!$0.isWild && $0.isPlayable}
        let pair = try XCTUnwrap(playable.enumerated().compactMap { index,a in
            playable.dropFirst(index+1).first(where:{$0.value+a.value==6}).map{(a,$0)}
        }.first)
        engine.stagedOrdinaryMoves = true
        engine.stagedOrdinaryAssignments = true
        XCTAssertTrue(engine.beginDrag(tileID:pair.0.id))
        XCTAssertTrue(engine.drop(target:pair.1.cell,now:2).accepted)
        let ordinaryPlan = try XCTUnwrap(engine.pendingOrdinarySix)
        XCTAssertTrue(engine.commitOrdinarySix(receiptID:ordinaryPlan.id,generation:ordinaryPlan.generation).accepted)
        XCTAssertTrue(engine.prepareOrdinarySpawns(receiptID:ordinaryPlan.id,generation:ordinaryPlan.generation).accepted)
        for assignment in engine.pendingOrdinaryAssignments {
            XCTAssertTrue(engine.commitOrdinaryAssignment(receiptID:ordinaryPlan.id,generation:ordinaryPlan.generation,assignmentID:assignment.id).accepted)
        }
        XCTAssertTrue(engine.releaseOrdinarySixHandoff(receiptID:ordinaryPlan.id,generation:ordinaryPlan.generation).accepted)
        let oldLocked = engine.state.tiles.filter{oldIDs.contains($0.id) && $0.locked}
        let oldOpened = engine.state.tiles.filter{oldIDs.contains($0.id) && !$0.locked}
        XCTAssertFalse(oldLocked.isEmpty)
        XCTAssertFalse(oldOpened.isEmpty)

        let destination = try XCTUnwrap(engine.state.tiles.first{!$0.isWild && $0.isPlayable && !oldIDs.contains($0.id)})
        XCTAssertTrue(engine.beginDrag(tileID:second.id))
        XCTAssertTrue(engine.drop(target:destination.cell,now:3).accepted)
        let secondPlan = try XCTUnwrap(engine.pendingSpecial)
        XCTAssertEqual(secondPlan.generation,firstPlan.generation)
        let before = engine.state
        let secondActivation = engine.commitSpecialActivation(transactionID:secondPlan.id)
        XCTAssertTrue(secondActivation.accepted)
        let newReceipts = engine.pendingWildLockedBonusPresentations.filter{$0.transactionID==secondPlan.id}
        XCTAssertEqual(newReceipts.count,9)
        let emitted = secondActivation.events.filter{$0.kind == .wildLockedBonusPrepared}
        XCTAssertEqual(emitted.count,1)
        XCTAssertEqual(emitted.first?.reason,secondPlan.id)
        XCTAssertEqual(Set(emitted.flatMap(\.tileIDs)),Set(newReceipts.map(\.tileID)))
        XCTAssertTrue(oldIDs.isDisjoint(with:Set(emitted.flatMap(\.tileIDs))),"A new bonus allocation must not replay earlier locked or opened dice")
        XCTAssertTrue(oldIDs.isSubset(of:Set(engine.pendingWildLockedBonusPresentations.map(\.tileID))),"Older independent presentation receipts may remain retained")
        for tile in before.tiles where oldIDs.contains(tile.id) {
            XCTAssertEqual(engine.state.tiles.first(where:{$0.id==tile.id}),tile,"Old bonus die mutated by the next allocation: \(tile.id)")
        }
    }

    func testTntThenLaserPublishesOnlyNewBonusIDsAfterOldBonusesOpen() throws {
        try exercise(firstVariant:nil)
    }

    func testRepeatedLaserPublishesOnlyNewBonusIDsAfterOldBonusesOpen() throws {
        try exercise(firstVariant:"laser-gun")
    }
}
