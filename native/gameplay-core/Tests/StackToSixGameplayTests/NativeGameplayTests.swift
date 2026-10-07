import XCTest
@testable import StackToSixGameplay
final class NativeGameplayTests: XCTestCase {
    func tile(_ id: String, _ value: Int, _ x: Int, _ y: Int = 0, depth: Int = 1, wild: NativeWildArchetype? = nil, variant: String? = nil, locked: Bool = false) -> NativeTile { NativeTile(id: id, cell: NativeCell(column: x, row: y), value: value, stackDepth: depth, archetype: wild, variant: variant, locked: locked) }
    func move(_ engine: NativeGameplayEngine, _ source: String, _ target: NativeTile, now: Double = 0) -> NativeMoveResult { XCTAssertTrue(engine.beginDrag(tileID: source)); return engine.drop(target: target.cell, now: now) }
    func testEveryRegularPairLegality() {
        for a in 1...6 { for b in 1...6 {
            let expected = a == b ? a + b <= 6 : a == 6 || b == 6 || a + b <= 6
            XCTAssertEqual(NativeGameplayResolver.canDrop(tile("a", a, 0), onto: tile("b", b, 1)), expected, "\(a)+\(b)")
        } }
    }
    func testFinalStackedRegularPairMatchesPhysicalSnapshotAndDoesNotSpawn() {
        let a = tile("a", 4, 0, depth: 3), b = tile("b", 2, 1, depth: 2)
        let final = NativeGameplayResolver.finalMerge([a,b], source: a, destination: b, effectiveSum: 6)
        XCTAssertEqual(final.activePhysicalTileCount, 5); XCTAssertEqual(final.mergePhysicalTileCount, 5); XCTAssertTrue(final.isFinalRegularMerge6)
        let engine = NativeGameplayEngine(state: NativeBoardState(tiles: [a,b]))
        let result = move(engine, "a", b)
        XCTAssertTrue(result.accepted); XCTAssertEqual(result.resolution.reason,"final_regular_merge6"); XCTAssertTrue(result.state.tiles.isEmpty)
        XCTAssertFalse(result.events.contains { $0.kind == .spawned }); XCTAssertFalse(engine.beginDrag(tileID: "b"))
        XCTAssertEqual(result.state.score, 30) // physical multiplier5 × combo1 ×6; no stack score on merge6
    }
    func testFinalPairForAllFourWildArchetypesAndEveryVariant() {
        for wild in NativeWildArchetype.allCases {
            let a = tile("a",6,0,wild:wild), b = tile("b",5,1,depth:4)
            let engine = NativeGameplayEngine(state: NativeBoardState(tiles:[a,b]))
            let result = move(engine,"a",b)
            XCTAssertEqual(result.resolution.reason,"final_wild_merge6",wild.rawValue); XCTAssertTrue(result.state.tiles.isEmpty); XCTAssertEqual(result.state.wildMeter,0)
        }
        XCTAssertEqual(NativeSpecialDiceRegistry.variants.count,13)
        for variant in NativeSpecialDiceRegistry.variants.values {
            let a = tile("a",6,0,wild:variant.archetype,variant:variant.id), b = tile("b",1,1)
            let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[a,b]))
            let result = move(engine,"a",b)
            XCTAssertEqual(result.resolution.kind,.complete,variant.id)
            XCTAssertEqual(result.events.first?.variant,variant.id)
        }
    }
    func testBeachBallGameplayRemainsTntAndVisualJuiceAcrossLegacySaves() {
        for legacy in [NativeWildArchetype.juice,.magnet,.tnt] {
            XCTAssertNotNil(NativeSpecialDiceRegistry.compatibleVariant("beach-ball",core:legacy))
            let ball = tile("ball",6,0,wild:legacy,variant:"beach-ball")
            XCTAssertEqual(ball.gameplayArchetype,.tnt)
            XCTAssertEqual(NativeSpecialDiceRegistry.finale(source:ball,destination:tile("r",1,1)),.juice)
            XCTAssertEqual(NativeSpecialDiceRegistry.finale(source:ball,destination:tile("r",1,1),gameplay:true),.tnt)
        }
    }
    func testHiddenResidueAndFaintLockedPlaceholdersDoNotBlockFinality() {
        let a = tile("a",3,0), b = tile("b",3,1)
        var hidden = tile("hidden",4,2); hidden.visible = false
        let placeholder = tile("placeholder",0,3,locked:true)
        var pending = tile("pending",5,4); pending.pendingRemoval = true
        XCTAssertTrue(NativeGameplayResolver.finalMerge([a,b,hidden,placeholder,pending],source:a,destination:b,effectiveSum:6).isFinalMerge)
        let lockedWild = tile("lockedWild",6,2,wild:.juice,locked:true)
        XCTAssertFalse(NativeGameplayResolver.finalMerge([a,b,lockedWild],source:a,destination:b,effectiveSum:6).isFinalMerge)
    }
    func testResolverWaitPrecedenceAndInvalidOwnershipFailClosed() {
        let a = tile("a",3,0), b = tile("b",3,1)
        let final = NativeGameplayResolver.finalMerge([a,b],source:a,destination:b,effectiveSum:6)
        var flags = NativeGameplayRuntimeFlags(); flags.pendingSpecialMutation = true
        XCTAssertEqual(NativeGameplayResolver.resolve(state:NativeBoardState(tiles:[a,b]),flags:flags,finalMerge:final).kind,.wait)
        XCTAssertEqual(NativeGameplayResolver.resolve(state:NativeBoardState(tiles:[a,a]),finalMerge:final).kind,.wait)
    }
    func testStackCommitsOnceAndRapidSubsequentDragWorks() {
        let a = tile("a",1,0), b = tile("b",2,1), c = tile("c",2,2)
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[a,b,c]))
        let first = move(engine,"a",b,now:0)
        XCTAssertEqual(first.state.tile(at:b.cell)?.value,3); XCTAssertEqual(first.state.moves,49); XCTAssertEqual(first.state.score,3)
        let second = move(engine,"b",c,now:0.1)
        XCTAssertEqual(second.state.tile(at:c.cell)?.value,5); XCTAssertEqual(second.state.score,8); XCTAssertEqual(second.state.combo,2)
        let duplicate = engine.drop(target:c.cell)
        XCTAssertFalse(duplicate.accepted); XCTAssertEqual(duplicate.state.revision,2)
    }
    func testIllegalDropPreservesAllBoardState() {
        let a = tile("a",4,0), b = tile("b",3,1)
        let initial = NativeBoardState(tiles:[a,b])
        let engine = NativeGameplayEngine(state:initial)
        let result = move(engine,"a",b)
        XCTAssertFalse(result.accepted); XCTAssertEqual(result.state,initial)
        XCTAssertTrue(engine.beginDrag(tileID:"a"))
    }
    func testNoMovesCandidateKeepsDragPlayableAndRevalidatesAtomicCommit() {
        let a = tile("a",4,0), b = tile("b",3,1)
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[a,b]))
        let signature = engine.beginNoMovesConfirmation()!
        XCTAssertTrue(engine.navigationLocked); XCTAssertTrue(engine.beginDrag(tileID:"a"))
        XCTAssertFalse(engine.confirmNoMoves(signature:signature,generation:1).accepted)
        XCTAssertNil(engine.state.terminal); engine.cancelDrag()
        let fresh = engine.beginNoMovesConfirmation()!
        XCTAssertTrue(engine.confirmNoMoves(signature:fresh,generation:1).accepted)
        XCTAssertEqual(engine.state.terminal?.kind,.fail); XCTAssertFalse(engine.beginDrag(tileID:"a"))
    }
    func testRestartCancelsOldDragTerminalAndSignature() {
        let a = tile("a",4,0), b = tile("b",3,1)
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[a,b]))
        let signature = engine.beginNoMovesConfirmation()!; XCTAssertTrue(engine.beginDrag(tileID:"a"))
        engine.restart(state:NativeBoardState(tiles:[tile("c",1,0),tile("d",2,1)]))
        XCTAssertEqual(engine.state.generation,2); XCTAssertFalse(engine.confirmNoMoves(signature:signature,generation:1).accepted)
        XCTAssertFalse(engine.drop(target:b.cell).accepted); XCTAssertTrue(engine.beginDrag(tileID:"c"))
    }
    func testMagnetTransactionOwnsOnlyCapturedDiceAndReleasesAfterAtomicSurvivor() {
        let a = tile("a",6,0,wild:.magnet), b = tile("b",2,1), c = tile("c",3,2), d = tile("d",1,3)
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[a,b,c,d]),recordedRandomChoices:Array(repeating:0,count:200))
        let staged = move(engine,"a",b)
        XCTAssertTrue(staged.accepted); XCTAssertEqual(staged.resolution.kind,.wait)
        let plan = engine.pendingSpecial!
        XCTAssertEqual(plan.targets.map(\.id),["c","d"])
        XCTAssertFalse(engine.beginDrag(tileID:"c")); XCTAssertFalse(engine.beginNoMovesConfirmation() != nil)
        let receipt = engine.commitSpecialBoard(transactionID:plan.id)
        XCTAssertTrue(receipt.accepted); XCTAssertNil(engine.pendingSpecial)
        XCTAssertEqual(receipt.state.activeTiles.count,3); XCTAssertEqual(receipt.state.combo,3); XCTAssertEqual(receipt.state.score,24)
        XCTAssertEqual(receipt.state.cubesCracked,2); XCTAssertEqual(receipt.state.earnedComboBonus,150)
        XCTAssertFalse(receipt.state.tiles.contains { ["a","b","c","d"].contains($0.id) })
        let survivor = receipt.state.tile(at:b.cell)!
        XCTAssertFalse(survivor.isWild); XCTAssertEqual(survivor.stackDepth,1); XCTAssertTrue(engine.beginDrag(tileID:survivor.id))
        XCTAssertFalse(engine.commitSpecialBoard(transactionID:plan.id).accepted)
    }
    func testTntImpactCommitUsesCapturedTargetOrderAndRejectsDuplicates() {
        let a = tile("a",6,0,wild:.tnt), b = tile("b",2,1), c = tile("c",3,2), d = tile("d",1,3)
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[a,b,c,d]),recordedRandomChoices:Array(repeating:0,count:200))
        let staged = move(engine,"a",b)
        XCTAssertTrue(staged.accepted); let plan = engine.pendingSpecial!
        XCTAssertFalse(engine.commitSpecialBoard(transactionID:plan.id).accepted)
        for target in plan.targets {
            let receipt = engine.commitSpecialImpact(transactionID:plan.id,tileID:target.id)
            XCTAssertTrue(receipt.accepted)
            XCTAssertNotEqual(receipt.state.tile(at:target.cell)?.value,target.value)
            XCTAssertFalse(engine.commitSpecialImpact(transactionID:plan.id,tileID:target.id).accepted)
        }
        let receipt = engine.commitSpecialBoard(transactionID:plan.id)
        XCTAssertTrue(receipt.accepted); XCTAssertNil(engine.pendingSpecial); XCTAssertNil(receipt.state.terminal)
        XCTAssertEqual(receipt.state.moves,49); XCTAssertEqual(receipt.state.score,12)
        XCTAssertEqual(receipt.state.wildMeter,0.32,accuracy:0.000001)
    }
    func testSpecialStaleCallbacksAfterRestartCannotTouchNewGeneration() {
        let a = tile("a",6,0,wild:.tnt), b = tile("b",2,1), c = tile("c",3,2)
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[a,b,c]))
        _ = move(engine,"a",b); let plan = engine.pendingSpecial!
        engine.restart(state:NativeBoardState(tiles:[tile("new",1,0)]))
        let before = engine.state
        XCTAssertFalse(engine.commitSpecialImpact(transactionID:plan.id,tileID:plan.targets[0].id).accepted)
        XCTAssertFalse(engine.commitSpecialBoard(transactionID:plan.id).accepted)
        XCTAssertEqual(engine.state,before)
    }
    func testBackgroundSettlesCapturedSpecialWithoutOldVisualCallbacks() {
        let a = tile("a",6,0,wild:.tnt), b = tile("b",2,1), c = tile("c",3,2)
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[a,b,c]))
        _ = move(engine,"a",b); let plan = engine.pendingSpecial!
        engine.cancelForBackground()
        XCTAssertNil(engine.pendingSpecial); XCTAssertTrue(engine.state.validationIssues().isEmpty)
        XCTAssertEqual(engine.state.moves,49)
        XCTAssertFalse(engine.commitSpecialBoard(transactionID:plan.id).accepted)
    }
    func testNonFinalStarAndJuiceSpawnPrimaryBonusAndContinuation() {
        for wild in [NativeWildArchetype.star,.juice] {
            let a = tile("a",6,0,wild:wild), b = tile("b",2,1), c = tile("c",3,2)
            let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[a,b,c]),recordedRandomChoices:Array(repeating:0,count:200))
            let result = move(engine,"a",b)
            XCTAssertTrue(result.accepted); XCTAssertNil(result.state.terminal)
            XCTAssertEqual(result.state.activeTiles.count,wild == .star ? 5 : 4)
            XCTAssertEqual(result.state.tiles.filter(\.locked).count,wild == .star ? 6 : 2)
            XCTAssertFalse(result.state.tiles.contains { $0.id == "a" || $0.id == "b" })
            XCTAssertNotEqual(result.state.tile(at:b.cell)?.value,2)
        }
    }
    func testArcadeDirectWildCreatesOnePrimaryAndNoJourneyBonus() {
        let a = tile("a",6,0,wild:.juice), b = tile("b",2,1), c = tile("c",3,2)
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[a,b,c],mode:.arcade))
        let result = move(engine,"a",b)
        XCTAssertTrue(result.accepted); XCTAssertEqual(result.state.activeTiles.count,2)
        XCTAssertTrue(result.state.tiles.filter(\.locked).isEmpty)
    }
    func testMeterRewardChoiceIsInjectedAndSurplusChargePreserved() {
        let a = tile("a",1,0), b = tile("b",1,1), c = tile("c",2,2)
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[a,b,c],wildMeter:0.95),recordedRandomChoices:[0,0],rewardPicker:{_,_ in NativeWildRewardChoice(.star,variant:"bee")})
        let result = move(engine,"a",b)
        XCTAssertTrue(result.accepted); XCTAssertEqual(result.state.wildSpawnCount,1)
        XCTAssertEqual(result.state.wildMeter,0.05,accuracy:0.00001)
        XCTAssertEqual(result.state.tiles.first(where: { $0.isWild })?.variant,"bee")
        XCTAssertEqual(result.state.lastWildDropType,.star); XCTAssertEqual(result.state.wildDropTypeStreak,1)
    }
    func testRejectedRewardPolicyRollsBackEntireMutationAndRng() {
        let a = tile("a",1,0), b = tile("b",1,1), c = tile("c",2,2)
        let initial = NativeBoardState(tiles:[a,b,c],wildMeter:0.95)
        let engine = NativeGameplayEngine(state:initial,rewardPicker:{_,_ in nil})
        let result = move(engine,"a",b)
        XCTAssertFalse(result.accepted); XCTAssertEqual(result.state,initial)
    }
    func testOrdinaryNonfinalSixSpawnsAtDestinationWithNoLockedSlots() {
        let a = tile("a",4,0), b = tile("b",2,1), c = tile("c",1,2)
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[a,b,c]),recordedRandomChoices:[0,0])
        let result = move(engine,"a",b)
        XCTAssertEqual(result.state.tile(at:b.cell)?.value,1); XCTAssertEqual(result.state.activeTiles.count,2)
        XCTAssertEqual(result.events.filter { $0.kind == .spawned }.count,1)
        XCTAssertEqual(result.state.score,12); XCTAssertEqual(result.state.wildMeter,0.22,accuracy:0.00001)
    }
    func testOrdinarySixOpensTwoLockedDiceAndLargeStackThree() {
        for depth in [1,3] {
            let a = tile("a",3,0,depth:depth), b = tile("b",3,1,depth:depth), c = tile("c",2,2)
            let locked = [tile("p1",0,0,1,locked:true),tile("p2",0,1,1,locked:true),tile("p3",0,2,1,locked:true)]
            let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[a,b,c]+locked),recordedRandomChoices:Array(repeating:0,count:15))
            let result = move(engine,"a",b)
            XCTAssertEqual(result.events.filter { $0.kind == .spawned }.count,depth == 1 ? 2 : 3)
            XCTAssertNil(result.state.tile(at:b.cell))
        }
    }
    func testComboCreditDecayAndCaps() {
        XCTAssertEqual(NativeRewardMath.streakBonus(2),0); XCTAssertEqual(NativeRewardMath.streakBonus(3),150); XCTAssertEqual(NativeRewardMath.streakBonus(4),225); XCTAssertEqual(NativeRewardMath.streakBonus(5),325)
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[tile("a",1,0),tile("b",1,1),tile("c",1,2),tile("d",1,3)]))
        _ = move(engine,"a",tile("b",1,1),now:0); _ = move(engine,"b",tile("c",1,2),now:0.2); _ = move(engine,"c",tile("d",1,3),now:0.4)
        XCTAssertEqual(engine.state.earnedComboBonus,150); engine.expireCombo(now:2.5)
        XCTAssertEqual(engine.state.combo,0); XCTAssertEqual(engine.state.earnedComboBonus,150)
    }
    func testWildTailLockScopePermitsOrdinaryAndBlocksWild() {
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[tile("r",1,0),tile("wild",6,1,wild:.star)]))
        engine.setInputLock("tail",active:true,wildOnly:true)
        XCTAssertTrue(engine.beginDrag(tileID:"r")); engine.cancelDrag(); XCTAssertFalse(engine.beginDrag(tileID:"wild"))
    }
    func testSpawnDecisionPorts() {
        XCTAssertEqual((0...8).map(NativeSpawnRules.regularMerge6SpawnCount),[2,2,2,2,3,3,3,3,3])
        XCTAssertEqual(NativeSpawnRules.wildEndgameMultiplier(4,isWild:true,lockedEmptyCount:0,isLastMerge:false),1)
        XCTAssertEqual(NativeSpawnRules.wildBonus(archetype:.star,isLastMerge:false,isArcadeSimpleWild:false,isFinalWildSnapshot:false,starOrbitCount:2).locked,7)
        XCTAssertEqual(NativeSpawnRules.wildBonus(archetype:.tnt,isLastMerge:true,isArcadeSimpleWild:false,isFinalWildSnapshot:true).locked,0)
    }
    func testBoardCodableRoundTrip() throws {
        let state = NativeBoardState(tiles:[tile("r",2,0),tile("ball",6,1,wild:.tnt,variant:"beach-ball")],mode:.arcade,board:12,earnedComboBonus:325,wildSpawnCount:2)
        XCTAssertEqual(try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(state)),state)
    }
}
