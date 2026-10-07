import XCTest
@testable import StackToSixGameplay
final class NativeGameplayPhaseTests: XCTestCase {
    func die(_ id: String,_ value: Int,_ x: Int,wild: NativeWildArchetype? = nil,variant: String? = nil) -> NativeTile { NativeTile(id:id,cell:NativeCell(column:x,row:0),value:value,archetype:wild,variant:variant) }
    func testDirectWildAbsorbOwnsGameplayAndVisualLeaseOnlyBlocksSpecials() {
        let initial = NativeBoardState(tiles:[die("s",6,0,wild:.star),die("d",2,1),die("a",1,2),die("b",2,3),die("other",6,4,wild:.juice)])
        let engine = NativeGameplayEngine(state:initial,recordedRandomChoices:Array(repeating:0,count:200))
        engine.stagedDirectWildMoves = true
        XCTAssertTrue(engine.beginDrag(tileID:"s",pointerID:7))
        let staged = engine.drop(target:NativeCell(column:1,row:0),pointerID:7,now:10)
        let plan = engine.pendingDirectWild!
        XCTAssertTrue(staged.accepted); XCTAssertEqual(staged.events.map(\.kind),[.directWildReserved])
        XCTAssertEqual(engine.state,initial); XCTAssertEqual(engine.resolve().kind,.wait)
        XCTAssertFalse(engine.beginDrag(tileID:"a")); XCTAssertFalse(engine.releaseDirectWildPresentation(transactionID:plan.id,generation:plan.generation).accepted)
        let committed = engine.commitDirectWildGameplay(transactionID:plan.id)
        XCTAssertTrue(committed.accepted); XCTAssertTrue(committed.events.contains(where:{$0.kind == .merged}))
        XCTAssertEqual(engine.state.moves,49); XCTAssertEqual(engine.state.score,12); XCTAssertFalse(engine.flags.isWaiting)
        XCTAssertFalse(engine.commitDirectWildGameplay(transactionID:plan.id).accepted)
        XCTAssertFalse(engine.beginDrag(tileID:"other"))
        XCTAssertTrue(engine.beginDrag(tileID:"a")); XCTAssertTrue(engine.drop(target:NativeCell(column:3,row:0),now:10.2).accepted)
        XCTAssertEqual(engine.state.moves,48); XCTAssertEqual(engine.state.score,15)
        XCTAssertFalse(engine.releaseDirectWildPresentation(transactionID:plan.id,generation:plan.generation+1).accepted)
        XCTAssertTrue(engine.releaseDirectWildPresentation(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertTrue(engine.beginDrag(tileID:"other")); engine.cancelDrag()
        XCTAssertFalse(engine.releaseDirectWildPresentation(transactionID:plan.id,generation:plan.generation).accepted)
    }
    func testDirectWildCommitPreservesPriorArrivalAndBackgroundSettlesOnce() {
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[die("first",6,0,wild:.star),die("d",2,1),die("second",6,2,wild:.juice),die("target",2,3),die("a",1,4)]),recordedRandomChoices:Array(repeating:0,count:300))
        XCTAssertTrue(engine.beginDrag(tileID:"first")); XCTAssertTrue(engine.drop(target:NativeCell(column:1,row:0)).accepted)
        let earned = engine.pendingHUDStars[0]
        engine.stagedDirectWildMoves = true
        XCTAssertTrue(engine.beginDrag(tileID:"second")); XCTAssertTrue(engine.drop(target:NativeCell(column:3,row:0),now:0.2).accepted)
        let plan = engine.pendingDirectWild!
        XCTAssertTrue(engine.commitHUDStarArrival(receiptID:earned.id,generation:earned.generation).accepted)
        XCTAssertEqual(engine.state.score,112)
        XCTAssertTrue(engine.commitDirectWildGameplay(transactionID:plan.id).accepted)
        XCTAssertEqual(engine.state.score,136)
        engine.cancelForBackground()
        XCTAssertNil(engine.pendingDirectWild); XCTAssertTrue(engine.pendingHUDStars.isEmpty)
        let saved = engine.state; engine.cancelForBackground(); XCTAssertEqual(engine.state,saved)
        XCTAssertFalse(engine.releaseDirectWildPresentation(transactionID:plan.id,generation:plan.generation).accepted)
    }
    func testDirectWildBackgroundCommitsPendingAbsorbAndRestartRevokesLease() {
        let initial = NativeBoardState(tiles:[die("j",6,0,wild:.juice),die("d",2,1),die("a",1,2)])
        let engine = NativeGameplayEngine(state:initial,recordedRandomChoices:Array(repeating:0,count:100)); engine.stagedDirectWildMoves = true
        XCTAssertTrue(engine.beginDrag(tileID:"j")); XCTAssertTrue(engine.drop(target:NativeCell(column:1,row:0)).accepted)
        let plan = engine.pendingDirectWild!; engine.cancelForBackground()
        XCTAssertNil(engine.pendingDirectWild); XCTAssertEqual(engine.state.moves,49); XCTAssertGreaterThanOrEqual(engine.state.score,112)
        engine.restart(state:initial)
        XCTAssertFalse(engine.commitDirectWildGameplay(transactionID:plan.id).accepted)
        XCTAssertTrue(engine.beginDrag(tileID:"j")); _ = engine.drop(target:NativeCell(column:1,row:0)); let stale = engine.pendingDirectWild!
        engine.restart(state:initial)
        XCTAssertFalse(engine.commitDirectWildGameplay(transactionID:stale.id).accepted)
        XCTAssertEqual(engine.state.moves,50); XCTAssertEqual(engine.state.score,0)
    }
    func testAllFinalWildArchetypesUseCaptured80msCommitAndBackgroundSaveSettlesOnce() throws {
        for archetype in [NativeWildArchetype.star,.juice,.magnet,.tnt] {
            let initial = NativeBoardState(tiles:[die("wild",6,0,wild:archetype),die("last",1,1)])
            let engine = NativeGameplayEngine(state:initial,recordedRandomChoices:Array(repeating:0,count:100)); engine.stagedDirectWildMoves = true
            engine.specialPresentationAdmitted = {_,_ in false}; engine.finalePresentationAdmitted = {_,_ in true}
            XCTAssertTrue(engine.beginDrag(tileID:"wild")); let result = engine.drop(target:.init(column:1,row:0))
            XCTAssertTrue(result.accepted); XCTAssertEqual(result.events.map(\.kind),[.directWildReserved])
            XCTAssertEqual(engine.state,initial); XCTAssertNil(engine.state.terminal)
            let receipt = engine.pendingDirectWild!; XCTAssertTrue(receipt.isFinal)
            let committed = engine.commitDirectWildGameplay(transactionID:receipt.id)
            XCTAssertTrue(committed.accepted); XCTAssertEqual(committed.resolution.kind,.complete)
            XCTAssertEqual(engine.state.moves,49); XCTAssertTrue(engine.state.tiles.isEmpty)
            XCTAssertFalse(engine.commitDirectWildGameplay(transactionID:receipt.id).accepted)
            engine.cancelForBackground(); XCTAssertNil(engine.pendingDirectWild)
            let persisted = try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(engine.state))
            XCTAssertEqual(persisted,engine.state); XCTAssertEqual(persisted.terminal?.kind,.complete)
            let saved = engine.state; engine.cancelForBackground(); XCTAssertEqual(engine.state,saved)
            engine.restart(state:initial)
            XCTAssertFalse(engine.releaseDirectWildPresentation(transactionID:receipt.id,generation:receipt.generation).accepted)
            XCTAssertTrue(engine.beginDrag(tileID:"wild")); _ = engine.drop(target:.init(column:1,row:0))
            engine.cancelForBackground(); XCTAssertEqual(engine.state.moves,49); XCTAssertEqual(engine.state.terminal?.kind,.complete)
        }
    }
    func testMagnetReplacementCascadePreservesCapturedCellsAndCommitOrder() {
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[die("m",6,0,wild:.magnet),die("d",2,1),die("a",1,2),die("b",3,3)]),recordedRandomChoices:Array(repeating:0,count:200))
        XCTAssertTrue(engine.beginDrag(tileID:"m")); XCTAssertTrue(engine.drop(target:NativeCell(column:1,row:0)).accepted)
        let plan = engine.pendingSpecial!
        XCTAssertTrue(engine.prepareMagnetRespawn(transactionID:plan.id).accepted)
        let respawn = engine.pendingMagnetRespawn!
        XCTAssertEqual(respawn.replacements.count,2); XCTAssertEqual(engine.pendingHUDStars.count,2)
        XCTAssertFalse(engine.commitSpecialBoard(transactionID:plan.id).accepted)
        XCTAssertFalse(engine.commitMagnetReplacement(transactionID:plan.id,index:1).accepted)
        XCTAssertTrue(engine.commitMagnetReplacement(transactionID:plan.id,index:0).accepted)
        XCTAssertFalse(engine.commitMagnetReplacement(transactionID:plan.id,index:0).accepted)
        XCTAssertTrue(engine.commitMagnetReplacement(transactionID:plan.id,index:1).accepted)
        let star = engine.pendingHUDStars[0]
        XCTAssertTrue(engine.commitHUDStarArrival(receiptID:star.id,generation:star.generation).accepted)
        XCTAssertTrue(engine.commitSpecialBoard(transactionID:plan.id).accepted)
        XCTAssertEqual(engine.state.score,124); XCTAssertEqual(engine.state.tile(at:plan.destination.cell)?.id,respawn.survivor.id)
        XCTAssertFalse(engine.flags.isWaiting)
    }
    func testFinalHudArrivalAwardsOnceAndRestartRevokesRemainingFlights() {
        var star = die("s",6,0,wild:.star); star.starOrbitCount = 2
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[star,die("r",1,1)]))
        XCTAssertTrue(engine.beginDrag(tileID:"s")); let result = engine.drop(target:NativeCell(column:1,row:0))
        XCTAssertEqual(result.resolution.kind,.complete); XCTAssertEqual(engine.pendingHUDStars.count,2)
        let receipt = engine.pendingHUDStars[0]
        XCTAssertEqual(receipt.origin,NativeCell(column:1,row:0))
        XCTAssertTrue(engine.commitHUDStarArrival(receiptID:receipt.id,generation:receipt.generation).accepted)
        XCTAssertEqual(engine.state.score,112); XCTAssertEqual(engine.state.starsCount,0)
        XCTAssertFalse(engine.commitHUDStarArrival(receiptID:receipt.id,generation:receipt.generation).accepted)
        let stale = engine.pendingHUDStars[0]; engine.restart(state:NativeBoardState(tiles:[die("new",2,0)]))
        XCTAssertFalse(engine.commitHUDStarArrival(receiptID:stale.id,generation:stale.generation).accepted)
        XCTAssertEqual(engine.state.score,0)
    }
    func testSpecialStarWithoutOrbitUsesSourceFallbackOneAndBackgroundPreservesScore() {
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[die("fish",6,0,wild:.star,variant:"fish"),die("r",2,1)]))
        XCTAssertTrue(engine.beginDrag(tileID:"fish")); _ = engine.drop(target:NativeCell(column:1,row:0))
        XCTAssertEqual(engine.pendingHUDStars.count,1); engine.cancelForBackground()
        XCTAssertEqual(engine.state.score,112); XCTAssertTrue(engine.pendingHUDStars.isEmpty)
    }
    func testTntRewardFacesAndStarReceiptsSettleWithoutDuplicateCredit() {
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[die("t",6,0,wild:.tnt),die("d",1,1),die("a",2,2),die("b",4,3),die("c",5,4)]),recordedRandomChoices:Array(repeating:0,count:200))
        XCTAssertTrue(engine.beginDrag(tileID:"t")); _ = engine.drop(target:NativeCell(column:1,row:0)); let plan = engine.pendingSpecial!
        for tile in plan.targets { XCTAssertTrue(engine.commitSpecialImpact(transactionID:plan.id,tileID:tile.id).accepted) }
        XCTAssertEqual(engine.pendingHUDStars.count,3); engine.cancelForBackground()
        XCTAssertEqual(engine.state.score,312); XCTAssertTrue(engine.pendingHUDStars.isEmpty)
        XCTAssertFalse(engine.commitSpecialImpact(transactionID:plan.id,tileID:plan.targets[0].id).accepted)
    }
    func testPresentationAdmissionRejectsBeforeRngOrReservation() {
        let initial = NativeBoardState(tiles:[die("t",6,0,wild:.tnt,variant:"laser-gun"),die("d",1,1),die("a",2,2)])
        let engine = NativeGameplayEngine(state:initial); engine.specialPresentationAdmitted = { _,_ in false }
        XCTAssertTrue(engine.beginDrag(tileID:"t")); XCTAssertFalse(engine.drop(target:NativeCell(column:1,row:0)).accepted)
        XCTAssertEqual(engine.state,initial); XCTAssertNil(engine.pendingSpecial)
    }
    func testBackwardNativeV1DefaultsPreserveCriticalIdentity() throws {
        let state = NativeBoardState(tiles:[die("old",2,0)],mode:.arcade,board:4,stage:4)
        var json = try JSONSerialization.jsonObject(with:JSONEncoder().encode(state)) as! [String:Any]
        for key in ["maxStackDepth","longestCombo","cubesCracked","lastWildDropType","wildDropTypeStreak","starsCount","bestScore","tutorial"] { json.removeValue(forKey:key) }
        var tiles = json["tiles"] as! [[String:Any]]; tiles[0].removeValue(forKey:"starOrbitCount"); json["tiles"] = tiles
        let decoded = try JSONDecoder().decode(NativeBoardState.self,from:JSONSerialization.data(withJSONObject:json))
        XCTAssertEqual(decoded.maxStackDepth,1); XCTAssertEqual(decoded.longestCombo,0); XCTAssertEqual(decoded.tiles[0].starOrbitCount,3); XCTAssertEqual(decoded.tiles[0].id,"old")
        json.removeValue(forKey:"columns")
        XCTAssertThrowsError(try JSONDecoder().decode(NativeBoardState.self,from:JSONSerialization.data(withJSONObject:json)))
        json["columns"] = 5; tiles[0].removeValue(forKey:"id"); json["tiles"] = tiles
        XCTAssertThrowsError(try JSONDecoder().decode(NativeBoardState.self,from:JSONSerialization.data(withJSONObject:json)))
    }
    func testLingeringSixRepairUsesStuckAdmissionAndPreservesRunCounters() {
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[die("s1",6,0),die("s2",6,1)],moves:17,score:25),recordedRandomChoices:[0,0])
        let repair = engine.repairLingeringRegularSix(tileID:"s1",generation:1,revision:0)
        XCTAssertTrue(repair.accepted); XCTAssertEqual(engine.state.moves,17); XCTAssertEqual(engine.state.score,25); XCTAssertNotEqual(engine.state.tiles.first?.id,"s1")
        XCTAssertFalse(engine.repairLingeringRegularSix(tileID:"s2",generation:1,revision:1).accepted) // Source continuation pair veto.
    }
    func testTntReservationAllowsOrdinaryStacksAndSixWithoutInvalidatingCapturedImpacts() {
        var tiles = [die("t",6,0,wild:.tnt),die("d",1,1),die("a",2,2),die("b",4,3),die("c",5,4),NativeTile(id:"e",cell:NativeCell(column:4,row:1),value:5)]
        tiles += [NativeTile(id:"p",cell:NativeCell(column:0,row:1),value:1),NativeTile(id:"q",cell:NativeCell(column:1,row:1),value:2),NativeTile(id:"r",cell:NativeCell(column:2,row:1),value:3),NativeTile(id:"s",cell:NativeCell(column:3,row:1),value:6,archetype:.star)]
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:tiles),recordedRandomChoices:Array(repeating:0.999999,count:200))
        XCTAssertTrue(engine.beginDrag(tileID:"t")); _ = engine.drop(target:NativeCell(column:1,row:0)); let plan = engine.pendingSpecial!
        XCTAssertEqual(engine.state.combo,0)
        XCTAssertFalse(engine.beginDrag(tileID:"p"))
        XCTAssertTrue(engine.releaseTntReservation(transactionID:plan.id).accepted)
        XCTAssertFalse(engine.releaseTntReservation(transactionID:plan.id).accepted)
        XCTAssertFalse(engine.beginDrag(tileID:plan.targets[0].id)); XCTAssertFalse(engine.beginDrag(tileID:"s"))
        XCTAssertTrue(engine.beginDrag(tileID:"p")); XCTAssertTrue(engine.drop(target:NativeCell(column:1,row:1),now:0.5).accepted)
        XCTAssertTrue(engine.beginDrag(tileID:"q")); XCTAssertTrue(engine.drop(target:NativeCell(column:2,row:1),now:0.6).accepted)
        XCTAssertGreaterThan(engine.state.revision,plan.revision)
        for target in plan.targets { XCTAssertTrue(engine.commitSpecialImpact(transactionID:plan.id,tileID:target.id).accepted) }
        XCTAssertTrue(engine.commitSpecialBoard(transactionID:plan.id).accepted)
        XCTAssertEqual(engine.state.moves,47); XCTAssertEqual(engine.state.combo,3)
        // TNT activating score12 precedes ordinary stack3 + three physical dice ×6×combo3.
        XCTAssertEqual(engine.state.cubesCracked,2); XCTAssertEqual(engine.state.score,69)
        XCTAssertNil(engine.state.terminal)
    }
    func testThirdAndFourthTntChargesRequireCaptured400And500msReceipts() {
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[die("t",6,0,wild:.tnt),die("d",1,1),die("a",2,2),die("b",4,3),die("c",5,4),NativeTile(id:"e",cell:NativeCell(column:0,row:1),value:3)]),recordedRandomChoices:Array(repeating:0,count:200))
        XCTAssertTrue(engine.beginDrag(tileID:"t")); _ = engine.drop(target:NativeCell(column:1,row:0)); let plan = engine.pendingSpecial!
        for target in plan.targets { XCTAssertTrue(engine.commitSpecialImpact(transactionID:plan.id,tileID:target.id).accepted) }
        XCTAssertEqual(engine.state.wildMeter,0.10,accuracy:1e-9)
        XCTAssertEqual(engine.pendingMeterRewards.map(\.delay),[0.4,0.5])
        XCTAssertEqual(engine.pendingMeterRewards.map(\.impactIndex),[2,3])
        let receipts = engine.pendingMeterRewards
        XCTAssertTrue(engine.commitSpecialBoard(transactionID:plan.id).accepted)
        XCTAssertEqual(engine.resolve().kind,.wait)
        XCTAssertTrue(engine.commitMeterReward(receiptID:receipts[0].id,generation:receipts[0].generation).accepted)
        XCTAssertFalse(engine.commitMeterReward(receiptID:receipts[0].id,generation:receipts[0].generation).accepted)
        XCTAssertEqual(engine.state.wildMeter,0.37,accuracy:1e-9)
        engine.cancelForBackground(); XCTAssertTrue(engine.pendingMeterRewards.isEmpty)
        XCTAssertEqual(engine.state.wildMeter,0.42,accuracy:1e-9)
        engine.restart(state:NativeBoardState(tiles:[die("new",2,0)]))
        XCTAssertFalse(engine.commitMeterReward(receiptID:receipts[1].id,generation:receipts[1].generation).accepted)
        XCTAssertEqual(engine.state.wildMeter,0)
    }

    func testFinaleAdmissionUsesIndependentRosterBeforeRngOrMutation() {
        let state = NativeBoardState(tiles:[die("k",6,0,wild:.star,variant:"kanta"),die("d",2,1)])
        let engine = NativeGameplayEngine(state:state,recordedRandomChoices:[0.75])
        engine.specialPresentationAdmitted = { _,_ in true }
        engine.finalePresentationAdmitted = { _,variant in variant != "kanta" }
        XCTAssertTrue(engine.beginDrag(tileID:"k")); XCTAssertFalse(engine.drop(target:NativeCell(column:1,row:0)).accepted)
        XCTAssertEqual(engine.state,state); XCTAssertTrue(engine.pendingHUDStars.isEmpty)
        engine.finalePresentationAdmitted = { _,_ in true }
        XCTAssertTrue(engine.beginDrag(tileID:"k")); XCTAssertTrue(engine.drop(target:NativeCell(column:1,row:0)).accepted)
        XCTAssertEqual(engine.state.terminal?.kind,.complete)
    }

    func testPhasedTntMainCommitPrecedesReservationAndSettledBonusCannotDebitAgain() {
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[die("t",6,0,wild:.tnt),die("d",1,1),die("a",2,2),die("b",4,3)]),recordedRandomChoices:Array(repeating:0.999999,count:200))
        engine.stagedTntActivation = true
        XCTAssertTrue(engine.beginDrag(tileID:"t")); XCTAssertTrue(engine.drop(target:NativeCell(column:1,row:0)).accepted)
        let initial = engine.pendingSpecial!
        XCTAssertTrue(initial.targets.isEmpty); XCTAssertEqual(engine.state.moves,50); XCTAssertEqual(engine.state.score,0)
        XCTAssertFalse(engine.reserveTntTargets(transactionID:initial.id).accepted)
        XCTAssertTrue(engine.commitSpecialActivation(transactionID:initial.id).accepted)
        XCTAssertEqual(engine.state.moves,49); XCTAssertEqual(engine.state.score,12); XCTAssertEqual(engine.state.wildMeter,0.22,accuracy:1e-9)
        XCTAssertFalse(engine.commitSpecialActivation(transactionID:initial.id).accepted)
        let primary = engine.state.tile(at:initial.destination.cell)!
        XCTAssertTrue(engine.reserveTntTargets(transactionID:initial.id).accepted)
        let plan = engine.pendingSpecial!
        XCTAssertEqual(plan.id,initial.id); XCTAssertEqual(plan.generation,initial.generation)
        XCTAssertTrue(plan.targets.contains { $0.id == primary.id }); XCTAssertEqual(plan.targets.count,3)
        XCTAssertFalse(engine.reserveTntTargets(transactionID:initial.id).accepted)
        XCTAssertTrue(engine.releaseTntReservation(transactionID:initial.id).accepted)
        for target in plan.targets { XCTAssertTrue(engine.commitSpecialImpact(transactionID:plan.id,tileID:target.id).accepted) }
        XCTAssertNotEqual(engine.state.tile(at:initial.destination.cell)?.id,primary.id)
        XCTAssertTrue(engine.commitSpecialBoard(transactionID:plan.id).accepted)
        XCTAssertEqual(engine.state.moves,49); XCTAssertEqual(engine.state.score,12); XCTAssertEqual(engine.state.cubesCracked,1)
        engine.cancelForBackground(); XCTAssertEqual(engine.state.wildMeter,0.37,accuracy:1e-9)
        XCTAssertTrue(engine.state.validationIssues().isEmpty)
    }

}
