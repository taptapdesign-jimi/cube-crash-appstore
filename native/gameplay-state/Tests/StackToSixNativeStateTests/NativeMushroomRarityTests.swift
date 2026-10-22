import XCTest
import StackToSixGameplay
@testable import StackToSixNativeState

final class NativeMushroomRarityTests:XCTestCase {
    func testArcadeFivePercentRequiresUnlockAndPreservesRestrictedPool() {
        for variant in NativeArcadeVariant.allCases {for unlocked in [false,true] {for star in [false,true] {
            let state=NativeBoardState(tiles:[],mode:.arcade,board:2,arcadeVariant:variant)
            var mushrooms=0
            for i in 0..<10000 {
                let choice=NativeWildRewardPolicy.choose(state:state,roll:(Double(i)+0.5)/10000,plainStarUnlocked:star,mushroomUnlocked:unlocked,nextRoll:{XCTFail("One reward draw only");return 0})
                if choice?.variant=="mushroom" {mushrooms+=1}
            }
            XCTAssertEqual(mushrooms,unlocked && variant != .pureDice ? 500:0)
        }}}
    }
    func testJourneyFivePercentOnlyInEligiblePoolsAndIntroductionIsPreserved() {
        for board in 1...30 {
            let pool=NativeJourneyContent.rewardPool(board:board)
            let count=(0..<10000).filter {
                NativeJourneyContent.reward(board:board,wildSpawnCount:1,roll:(Double($0)+0.5)/10000,mushroomIntroduced:true)?.variant=="mushroom"
            }.count
            XCTAssertEqual(count,pool.contains("mushroom") ? 500:0,"board \(board)")
        }
        let first=(0..<10000).filter {
            NativeJourneyContent.reward(board:6,wildSpawnCount:0,roll:(Double($0)+0.5)/10000)?.variant=="mushroom"
        }.count
        XCTAssertEqual(first,3333)
        XCTAssertNotEqual(NativeJourneyContent.reward(board:6,wildSpawnCount:0,roll:0.99)?.variant,"mushroom")
        XCTAssertEqual(NativeJourneyContent.reward(board:6,wildSpawnCount:1,roll:0.1)?.variant,"mushroom")
        XCTAssertNotEqual(NativeJourneyContent.reward(board:6,wildSpawnCount:1,roll:0.9)?.variant,"mushroom")
        for roll in [0.0,0.5,0.999999] {XCTAssertEqual(NativeJourneyContent.reward(board:6,wildSpawnCount:2,roll:roll)?.variant,"mushroom")}
    }
    func testUnitSixGuaranteeSurvivesSaveResumeAndCommitsOnlyOnRealDropCompletion() throws {
        var state=NativeBoardState(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1),.init(id:"b",cell:.init(column:1,row:0),value:2)],mode:.journey,board:6)
        for ordinal in 1...3 {
            state.wildMeter=1.25
            state=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(state))
            let engine=NativeGameplayEngine(state:state,recordedRandomChoices:Array(repeating:0.5,count:100),rewardPicker:{state,_ in
                NativeWildRewardPolicy.choose(state:state,roll:0.99,plainStarUnlocked:true,nextRoll:{0})
            })
            engine.stagedMeterDrops=true
            XCTAssertTrue(engine.claimMeterReward().accepted)
            let drop=try XCTUnwrap(engine.meterDropReservations.values.first)
            XCTAssertEqual(drop.variant=="mushroom",ordinal==3)
            XCTAssertEqual(engine.state.forestMushroomIntroduced,ordinal==1 ? nil:false)
            for receipt in [NativeMeterDropReceipt.assetsPrepared,.revealed,.impact,.boardFallbackRestored,.dropPromiseCompleted,.selectedWarmupCompleted,.wallHandoffUnlocked] {
                XCTAssertTrue(engine.applyMeterDropReceipt(id:drop.id,generation:drop.generation,receipt:receipt).accepted)
            }
            state=engine.state
            XCTAssertEqual(state.wildSpawnCount,ordinal)
            XCTAssertEqual(state.forestMushroomIntroduced,ordinal==3)
        }
        // A later different drop and consumption of the visible Mushroom must
        // not erase the committed per-run introduction receipt.
        state.tiles.removeAll{$0.variant=="mushroom"};state.lastWildDropType = .star
        let resumed=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(state))
        XCTAssertEqual(resumed.forestMushroomIntroduced,true)
        XCTAssertNotEqual(NativeWildRewardPolicy.choose(state:resumed,roll:0.99,plainStarUnlocked:true,nextRoll:{0})?.variant,"mushroom")
        var legacy=try XCTUnwrap(JSONSerialization.jsonObject(with:JSONEncoder().encode(resumed)) as? [String:Any])
        legacy.removeValue(forKey:"forestMushroomIntroduced")
        let legacyRun=try JSONDecoder().decode(NativeBoardState.self,from:JSONSerialization.data(withJSONObject:legacy))
        XCTAssertNil(legacyRun.forestMushroomIntroduced)
        XCTAssertNotEqual(NativeWildRewardPolicy.choose(state:legacyRun,roll:0.99,plainStarUnlocked:true,nextRoll:{0})?.variant,"mushroom","Legacy Unit6 already guaranteed its first Mushroom")
    }
}
