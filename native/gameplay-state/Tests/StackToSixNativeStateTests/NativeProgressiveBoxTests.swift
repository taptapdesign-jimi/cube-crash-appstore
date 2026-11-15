import XCTest
import StackToSixGameplay
@testable import StackToSixNativeState

final class NativeProgressiveBoxTests:XCTestCase {
    private func identity(_ reward:NativeWildRewardChoice)->String {
        reward.variant ?? (reward.archetype == .star ? "wild-star":reward.archetype == .tnt ? "tnt":reward.archetype.rawValue)
    }
    func testDiscoveryOrderPersistsWithoutDuplicatesAndDeveloperHideRearmsOnlyThatDie()throws {
        var profile=NativeSaveEnvelope()
        for (board,id) in [(21,"robo-cube"),(1,"bee"),(14,"bottle"),(4,"honey")] {
            XCTAssertTrue(profile.progression.announceJourneyDie(id,board:board))
        }
        XCTAssertFalse(profile.progression.announceJourneyDie("bee",board:1))
        profile.progression.readJourneyDie("bee")
        let order=["robo-cube","bee","bottle","honey"]
        XCTAssertEqual(profile.progression.journeyDiceUnlockOrder,order)
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer{try? FileManager.default.removeItem(at:directory)}
        let store=NativeSaveStore(directory:directory)
        try store.save(profile);profile=try XCTUnwrap(store.load())
        XCTAssertEqual(NativeArcadeBoxContent.orderedIDs(profile.progression),NativeArcadeBoxContent.baseIDs+order)
        XCTAssertTrue(profile.progression.completedJourneyBoards.isEmpty)
        XCTAssertTrue(profile.progression.boardStats.isEmpty)
        profile.progression.resetDeveloperJourneyDieAnnouncement(board:1)
        XCTAssertEqual(profile.progression.journeyDiceUnlockOrder,["robo-cube","bottle","honey"])
        XCTAssertTrue(profile.progression.announceJourneyDie("bee",board:1))
        XCTAssertEqual(profile.progression.journeyDiceUnlockOrder,["robo-cube","bottle","honey","bee"])
        try profile.validate()
    }
    func testLegacyOrderUsesAvailableDatesThenStableFallbackWithoutInventingDiscoveries()throws {
        var state=NativeProgressionState()
        for (board,id) in [(1,"bee"),(21,"robo-cube"),(4,"honey")] {_=state.announceJourneyDie(id,board:board)}
        var first=NativeBoardStats();first.lastPlayed=10
        var second=NativeBoardStats();second.lastPlayed=20
        state.boardStats[21]=first;state.boardStats[4]=second
        var json=try XCTUnwrap(JSONSerialization.jsonObject(with:JSONEncoder().encode(state)) as? [String:Any])
        json.removeValue(forKey:"journeyDiceUnlockOrder")
        let migrated=try JSONDecoder().decode(NativeProgressionState.self,from:JSONSerialization.data(withJSONObject:json))
        XCTAssertEqual(migrated.journeyDiceUnlockOrder,["robo-cube","honey","bee"])
        let fresh=NativeSaveEnvelope()
        XCTAssertEqual(NativeArcadeBoxContent.orderedIDs(fresh.progression),NativeArcadeBoxContent.baseIDs)
        for order in [["bee","bee"],["bee","bottle"],[]] {
            var profile=NativeSaveEnvelope(progression:state)
            var raw=try XCTUnwrap(JSONSerialization.jsonObject(with:JSONEncoder().encode(profile)) as? [String:Any])
            var progression=try XCTUnwrap(raw["progression"] as? [String:Any]);progression["journeyDiceUnlockOrder"]=order;raw["progression"]=progression
            profile=try JSONDecoder().decode(NativeSaveEnvelope.self,from:JSONSerialization.data(withJSONObject:raw))
            XCTAssertThrowsError(try profile.validate())
        }
    }
    func testEveryArcadePoolStartsWithFourAndAddsOnlyActualJourneyDiscoveries()throws {
        var progression=NativeProgressionState()
        let discoveries=NativeArcadeBoxContent.journeyIDs
        for count in 0...discoveries.count {
            if count>0 {
                let id=discoveries[count-1]
                let board=try XCTUnwrap((1...30).first{NativeJourneyContent.introductionID(board:$0)==id})
                XCTAssertTrue(progression.announceJourneyDie(id,board:board))
            }
            let expected=Set(NativeArcadeBoxContent.orderedIDs(progression))
            for variant in NativeArcadeVariant.allCases {
                var state=NativeBoardState(tiles:[],mode:.arcade,board:1,arcadeVariant:variant);state.wildSpawnCount=1
                let found=Set((0..<1000).compactMap{roll in
                    NativeWildRewardPolicy.choose(state:state,roll:(Double(roll)+0.5)/1000,plainStarUnlocked:true,mushroomUnlocked:true,unlockedJourneyDice:progression.announcedJourneyDice,nextRoll:{XCTFail("No reroll");return 0}).map(identity)
                })
                XCTAssertEqual(found,expected,"variant \(variant), discoveries \(count)")
            }
        }
    }
    func testEveryUnlockedBoxIdentityCanActuallySpawnInAllThreeArcadeModes()throws {
        let known=Set(NativeArcadeBoxContent.journeyIDs)
        let rewards=NativeArcadeBoxContent.rewards(unlockedJourneyDice:known)
        XCTAssertEqual(rewards.count,22)
        for variant in NativeArcadeVariant.allCases {for staged in [false,true] {for reward in rewards {
            let state=NativeBoardState(tiles:[.init(id:"ordinary",cell:.init(column:0,row:0),value:2)],mode:.arcade,wildMeter:1,wildSpawnCount:1,arcadeVariant:variant)
            let engine=NativeGameplayEngine(state:state,recordedRandomChoices:Array(repeating:0.5,count:100),rewardPicker:{_,_ in reward})
            engine.stagedMeterDrops=staged;engine.stagedMeterOpen=staged
            XCTAssertTrue(engine.claimMeterReward().accepted,"\(variant) \(identity(reward))")
            let tile=try XCTUnwrap(staged ? engine.pendingMeterOpen?.tile:engine.state.activeTiles.first{$0.isWild})
            XCTAssertEqual(tile.archetype,reward.archetype);XCTAssertEqual(tile.variant,reward.variant)
        }}}
    }
}
