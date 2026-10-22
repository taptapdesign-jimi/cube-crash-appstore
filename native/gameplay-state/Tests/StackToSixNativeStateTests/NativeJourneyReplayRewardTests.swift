import XCTest
import StackToSixGameplay
@testable import StackToSixNativeState

final class NativeJourneyReplayRewardTests:XCTestCase {
    private func id(_ choice:NativeWildRewardChoice?)->String? {
        guard let choice else{return nil}
        return choice.variant ?? (choice.archetype == .star ? "wild-star":choice.archetype == .juice ? "wild-juice":choice.archetype.rawValue)
    }
    private func choose(_ state:NativeBoardState,_ roll:Double,_ unlocked:Set<String>)->NativeWildRewardChoice? {
        NativeWildRewardPolicy.choose(state:state,roll:roll,plainStarUnlocked:true,unlockedJourneyDice:unlocked,nextRoll:{XCTFail("No extra random draw");return 0})
    }
    func testEveryWorldReplayIncludesAllDiscoveredDiceWithoutLeakingWorldsOrFutureLockedDice() {
        let all=Set((1...30).flatMap{NativeJourneyContent.rewardPool(board:$0)})
        for board in 1...30 {
            let world=Set(NativeJourneyContent.worldRewardPool(board:board))
            XCTAssertEqual(Set(NativeJourneyContent.availableRewardPool(board:board,unlockedDice:all)),world)
            XCTAssertEqual(Set(NativeJourneyContent.availableRewardPool(board:board,unlockedDice:[])),Set(NativeJourneyContent.rewardPool(board:board)))
            var state=NativeBoardState(tiles:[],mode:.journey,board:board,wildSpawnCount:8)
            state.forestMushroomIntroduced=true;state.earnedJourneyDice=world
            let selected=Set((0..<1000).compactMap{id(choose(state,(Double($0)+0.5)/1000,all))})
            XCTAssertEqual(selected,world,"World pool at Unit \(board)")
        }
        XCTAssertTrue(NativeJourneyContent.availableRewardPool(board:1,unlockedDice:["barell"]).contains("barell"))
        XCTAssertFalse(NativeJourneyContent.availableRewardPool(board:1,unlockedDice:["bottle"]).contains("bottle"))
        var progression=NativeProgressionState()
        XCTAssertTrue(progression.announceJourneyDie("barell",board:1))
        XCTAssertFalse(progression.announceJourneyDie("bottle",board:1))
    }
    func testEveryNonMushroomIntroductionArrivesWithinThreeActualDropsOnFreshAndReplayRuns() throws {
        for board in 1...30 {
            guard let expected=NativeJourneyContent.introductionID(board:board),expected != "mushroom" else{continue}
            for replay in [false,true] {for staged in [false,true] {for roll in [0.0,0.3,0.7,0.99999] {
                let unlocked=replay ? Set(NativeJourneyContent.worldRewardPool(board:board)):[]
                var state=NativeBoardState(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1),.init(id:"b",cell:.init(column:1,row:0),value:2)],mode:.journey,board:board)
                for ordinal in 1...3 {
                    state.wildMeter=1.25
                    state=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(state))
                    let engine=NativeGameplayEngine(state:state,recordedRandomChoices:Array(repeating:0.5,count:100),rewardPicker:{state,_ in self.choose(state,roll,unlocked)})
                    engine.stagedMeterDrops=staged
                    XCTAssertTrue(engine.claimMeterReward().accepted)
                    if staged {
                        let drop=try XCTUnwrap(engine.meterDropReservations.values.first)
                        XCTAssertEqual(engine.state.earnedJourneyDice,state.earnedJourneyDice,"Reservation cannot consume guarantee")
                        for receipt in [NativeMeterDropReceipt.assetsPrepared,.revealed,.impact,.boardFallbackRestored,.dropPromiseCompleted,.selectedWarmupCompleted,.wallHandoffUnlocked] {
                            XCTAssertTrue(engine.applyMeterDropReceipt(id:drop.id,generation:drop.generation,receipt:receipt).accepted)
                        }
                    }
                    state=engine.state
                    XCTAssertEqual(state.wildSpawnCount,ordinal)
                    // The receipt must survive consumption of visible Special dice.
                    state.tiles.removeAll{$0.isWild};state.lastWildDropType=nil
                }
                XCTAssertTrue(try XCTUnwrap(state.earnedJourneyDice).contains(expected),"Unit \(board), replay \(replay), staged \(staged), roll \(roll)")
            }}}
        }
    }
    func testEarlyDropsAreRandomAndThirdGuaranteeDoesNotRepeatAfterReceiptOrLegacyResume() throws {
        var state=NativeBoardState(tiles:[],mode:.journey,board:7)
        XCTAssertNotEqual(id(choose(state,0.1,[])),"barell")
        state.wildSpawnCount=1;state.earnedJourneyDice=["bee"]
        XCTAssertNotEqual(id(choose(state,0.1,[])),"barell")
        state.wildSpawnCount=2
        XCTAssertEqual(id(choose(state,0.1,[])),"barell")
        state.earnedJourneyDice=["barell"]
        XCTAssertNotEqual(id(choose(state,0.1,[])),"barell")
        state.earnedJourneyDice=nil
        let legacy=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(state))
        XCTAssertNotEqual(id(choose(legacy,0.1,[])),"barell","Old runs already guaranteed first drop; no replay of that guarantee")
    }
    func testCanceledThirdDropKeepsGuaranteeAndArcadeNeverUsesJourneyDiscoveries() throws {
        var state=NativeBoardState(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1)],mode:.journey,board:24,wildMeter:1.25,wildSpawnCount:2)
        state.earnedJourneyDice=["kanta"]
        let engine=NativeGameplayEngine(state:state,recordedRandomChoices:[0,0,0],rewardPicker:{state,_ in self.choose(state,0,[])})
        engine.stagedMeterDrops=true
        XCTAssertTrue(engine.claimMeterReward().accepted)
        let drop=try XCTUnwrap(engine.meterDropReservations.values.first)
        XCTAssertEqual(drop.variant,"laser-gun")
        for receipt in [NativeMeterDropReceipt.assetsPrepared,.revealed] {XCTAssertTrue(engine.applyMeterDropReceipt(id:drop.id,generation:drop.generation,receipt:receipt).accepted)}
        XCTAssertTrue(engine.requestMeterDropCancellation(id:drop.id,generation:drop.generation,reason:.busyEndingOrLastMerge).accepted)
        for receipt in [NativeMeterDropReceipt.boardFallbackRestored,.dropPromiseCompleted] {XCTAssertTrue(engine.applyMeterDropReceipt(id:drop.id,generation:drop.generation,receipt:receipt).accepted)}
        let resumed=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(engine.state))
        XCTAssertEqual(resumed.wildSpawnCount,2);XCTAssertEqual(resumed.earnedJourneyDice,["kanta"])
        XCTAssertEqual(id(choose(resumed,0,[])),"laser-gun")
        for variant in NativeArcadeVariant.allCases {for i in 0..<100 {
            let arcade=NativeBoardState(tiles:[],mode:.arcade,board:2,arcadeVariant:variant)
            XCTAssertEqual(choose(arcade,Double(i)/100,[]),choose(arcade,Double(i)/100,["bee","laser-gun","flower"]))
        }}
    }
}
