import XCTest
import StackToSixGameplay
@testable import StackToSixNativeState

final class NativeJourneyUnlockAppearanceTests: XCTestCase {
    func testExactUnlockUnitsUseSameCumulativeWorldPool() {
        let expected:[Int:NativeWildReward] = [
            1:.init(.star,variant:"bee"),2:.init(.star),3:.init(.tnt,variant:"flower"),
            4:.init(.magnet,variant:"honey"),6:.init(.juice,variant:"mushroom"),7:.init(.tnt,variant:"barell"),
            11:.init(.juice),12:.init(.star,variant:"fish"),13:.init(.tnt,variant:"beach-ball"),14:.init(.magnet,variant:"bottle"),
            21:.init(.juice,variant:"robo-cube"),22:.init(.star,variant:"kanta"),23:.init(.magnet,variant:"spaceship"),24:.init(.tnt,variant:"laser-gun")]
        for board in 0...31 {
            XCTAssertEqual(NativeJourneyContent.unlockReward(board:board),expected[board],"Unit \(board)")
        }
    }
    func testAllFreshBoardsAndRestartsBeginWithOnlyOrdinaryDice() throws {
        for board in 1...30 {
            for seed in UInt64(1)...64 {
                for columns in [5,7] {
                    let state=NativeBoardFactory.make(mode:.journey,board:board,columns:columns,seed:seed)
                    XCTAssertFalse(state.tiles.contains(where: \.isWild))
                    XCTAssertEqual(state.tiles.filter{!$0.locked}.count,columns == 5 ? 14:19)
                    XCTAssertEqual(state.wildSpawnCount,0);XCTAssertEqual(state.wildMeter,0)
                    XCTAssertEqual(state,NativeBoardFactory.make(mode:.journey,board:board,columns:columns,seed:seed))
                    let restarted=NativeBoardFactory.make(mode:.journey,board:board,columns:columns,generation:2,seed:seed)
                    XCTAssertFalse(restarted.tiles.contains(where: \.isWild))
                }
            }
        }
    }
    func testFirstEarnedDropIntroducesExactUnitDieAcrossRandomDrawsAndSaveResume() throws {
        for board in 1...30 {
            guard let expected=NativeJourneyContent.unlockReward(board:board) else{continue}
            for roll in [0.0,0.2,0.5,0.999999] {
                var state=NativeBoardFactory.make(mode:.journey,board:board,seed:18)
                state.moves=49;state.wildMeter=0.9
                let resumed=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(state))
                let choice=try XCTUnwrap(NativeWildRewardPolicy.choose(state:resumed,roll:roll,plainStarUnlocked:false,nextRoll:{XCTFail("No reroll");return 0}))
                XCTAssertEqual(choice.archetype,expected.archetype);XCTAssertEqual(choice.variant,expected.variant)
                state.wildSpawnCount=1
                let afterDrop=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(state))
                XCTAssertEqual(afterDrop.wildSpawnCount,1)
                XCTAssertEqual(NativeWildRewardPolicy.choose(state:afterDrop,roll:roll,plainStarUnlocked:false,nextRoll:{0}),NativeWildRewardPolicy.choose(state:state,roll:roll,plainStarUnlocked:false,nextRoll:{0}))
            }
        }
    }
    func testEarnedDropArrivalCommitsIntroductionOnceAndCancellationPreservesEligibility() throws {
        for board in 1...30 {
            guard let expected=NativeJourneyContent.unlockReward(board:board) else{continue}
            for cancel in [false,true] {
                let tiles=[NativeTile(id:"a",cell:.init(column:0,row:0),value:2),NativeTile(id:"b",cell:.init(column:1,row:0),value:3),NativeTile(id:"c",cell:.init(column:2,row:0),value:1)]
                let engine=NativeGameplayEngine(state:.init(tiles:tiles,mode:.journey,board:board,wildMeter:1.25),recordedRandomChoices:[0,0,0],rewardPicker:{state,roll in
                    NativeWildRewardPolicy.choose(state:state,roll:roll,plainStarUnlocked:false,nextRoll:{0})
                })
                engine.stagedMeterDrops=true
                XCTAssertFalse(engine.state.tiles.contains(where: \.isWild))
                XCTAssertTrue(engine.claimMeterReward().accepted)
                let drop=try XCTUnwrap(engine.meterDropReservations.values.first)
                XCTAssertEqual(drop.archetype,expected.archetype);XCTAssertEqual(drop.variant,expected.variant)
                XCTAssertEqual(engine.state.wildSpawnCount,0)
                XCTAssertFalse(try XCTUnwrap(engine.state.tiles.first{$0.id==drop.tileID}).visible)
                func receipt(_ receipt:NativeMeterDropReceipt) {
                    XCTAssertTrue(engine.applyMeterDropReceipt(id:drop.id,generation:drop.generation,receipt:receipt).accepted)
                }
                receipt(.assetsPrepared);receipt(.revealed)
                if cancel {
                    XCTAssertTrue(engine.requestMeterDropCancellation(id:drop.id,generation:drop.generation,reason:.busyEndingOrLastMerge).accepted)
                    receipt(.boardFallbackRestored);receipt(.dropPromiseCompleted)
                    XCTAssertEqual(engine.state.wildSpawnCount,0)
                    XCTAssertFalse(engine.state.tiles.contains(where: \.isWild))
                } else {
                    receipt(.impact);receipt(.boardFallbackRestored);receipt(.dropPromiseCompleted)
                    XCTAssertEqual(engine.state.wildSpawnCount,0,"Warmup still owns completion")
                    receipt(.selectedWarmupCompleted);receipt(.wallHandoffUnlocked)
                    XCTAssertEqual(engine.state.wildSpawnCount,1)
                    XCTAssertFalse(engine.applyMeterDropReceipt(id:drop.id,generation:drop.generation,receipt:.selectedWarmupCompleted).accepted)
                }
                XCTAssertTrue(engine.meterDropReservations.isEmpty)
                let resumed=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(engine.state))
                XCTAssertEqual(resumed.wildSpawnCount,cancel ? 0:1)
                if cancel {
                    let next=NativeWildRewardPolicy.choose(state:resumed,roll:0.99,plainStarUnlocked:false,nextRoll:{0})
                    XCTAssertEqual(next?.archetype,expected.archetype);XCTAssertEqual(next?.variant,expected.variant)
                }
            }
        }
    }
    func testArcadeAndScriptedTutorialHaveNoOpeningSpecial() {
        let tutorial=NativeBoardFactory.make(mode:.journey,board:1,seed:42,tutorial:true)
        for board in 1...30 {
            for variant in NativeArcadeVariant.allCases {
                XCTAssertFalse(NativeBoardFactory.make(mode:.arcade,board:board,seed:42,arcadeVariant:variant).tiles.contains(where: \.isWild))
            }
            let scripted=NativeBoardFactory.make(mode:.journey,board:board,seed:42,tutorial:true)
            XCTAssertEqual(scripted.tiles,tutorial.tiles);XCTAssertEqual(scripted.rngState,tutorial.rngState)
        }
    }
}
