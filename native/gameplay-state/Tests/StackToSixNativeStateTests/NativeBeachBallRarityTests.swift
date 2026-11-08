import XCTest
import StackToSixGameplay
@testable import StackToSixNativeState

final class NativeBeachBallRarityTests:XCTestCase {
    private func choose(_ state:NativeBoardState,_ roll:Double,_ replay:Bool=false)->NativeWildRewardChoice? {
        NativeWildRewardPolicy.choose(state:state,roll:roll,plainStarUnlocked:true,
            unlockedJourneyDice:replay ? Set(NativeJourneyContent.worldRewardPool(board:13)):[],
            nextRoll:{XCTFail("One draw per reward");return 0})
    }
    func testExactProbabilitiesAndIntroductionForFreshAndReplayPools() {
        for replay in [false,true] {
            for (count,expected) in [(1,4000),(2,2000),(3,1000),(4,500),(5,200),(6,200),(100,200)] {
                var state=NativeBoardState(tiles:[],board:13,wildSpawnCount:count+8)
                state.beachBallDropCount=count;state.earnedJourneyDice=["beach-ball"]
                var hits=0
                for i in 0..<10000 {
                    let reward=choose(state,(Double(i)+0.5)/10000,replay)
                    XCTAssertNotNil(reward)
                    if reward?.variant=="beach-ball" {hits+=1}
                }
                XCTAssertEqual(hits,expected)
            }
            for (drops,expected) in [(0,200),(1,300),(2,600)] {
                var state=NativeBoardState(tiles:[],board:13,wildSpawnCount:drops)
                state.earnedJourneyDice=[];state.beachBallDropCount=0
                XCTAssertEqual((0..<600).filter{choose(state,(Double($0)+0.5)/600,replay)?.variant=="beach-ball"}.count,expected)
            }
        }
    }
    func testCompletedDropsPersistAndReservationCancellationDoesNotCount() throws {
        for staged in [false,true] {for open in [false,true] where staged || !open {
            var state=NativeBoardState(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1),.init(id:"b",cell:.init(column:1,row:0),value:2)],board:13)
            for count in 1...7 {
                state.wildMeter=1.25
                let e=NativeGameplayEngine(state:state,recordedRandomChoices:Array(repeating:0.5,count:100),rewardPicker:{state,_ in self.choose(state,0)})
                e.stagedMeterDrops=staged;e.stagedMeterOpen=open
                XCTAssertTrue(e.claimMeterReward().accepted)
                if open {
                    let request=try XCTUnwrap(e.pendingMeterOpen)
                    XCTAssertTrue(e.completeMeterOpen(id:request.id,generation:request.generation,receipt:.created(tileID:request.tile.id)).accepted)
                }
                if staged {
                    let drop=try XCTUnwrap(e.meterDropReservations.values.first)
                    XCTAssertEqual(e.state.beachBallDropCount,min(6,count-1))
                    for receipt in [NativeMeterDropReceipt.assetsPrepared,.revealed,.impact,.boardFallbackRestored,.dropPromiseCompleted,.selectedWarmupCompleted,.wallHandoffUnlocked] {
                        XCTAssertTrue(e.applyMeterDropReceipt(id:drop.id,generation:drop.generation,receipt:receipt).accepted)
                    }
                    XCTAssertFalse(e.applyMeterDropReceipt(id:drop.id,generation:drop.generation,receipt:.selectedWarmupCompleted).accepted)
                }
                state=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(e.state))
                XCTAssertEqual(state.beachBallDropCount,min(6,count))
                state.tiles.removeAll{$0.isWild}
            }
            state.wildMeter=1.25
            let e=NativeGameplayEngine(state:state,recordedRandomChoices:Array(repeating:0.5,count:100),rewardPicker:{_,_ in .init(.juice,variant:"beach-ball")})
            e.stagedMeterDrops=true
            XCTAssertTrue(e.claimMeterReward().accepted)
            let drop=try XCTUnwrap(e.meterDropReservations.values.first)
            XCTAssertTrue(e.requestMeterDropCancellation(id:drop.id,generation:drop.generation,reason:.explicitPendingContinuation).accepted)
            for receipt in [NativeMeterDropReceipt.assetsPrepared,.boardFallbackRestored,.dropPromiseCompleted] {
                XCTAssertTrue(e.applyMeterDropReceipt(id:drop.id,generation:drop.generation,receipt:receipt).accepted)
            }
            XCTAssertEqual(e.state.beachBallDropCount,6)
        }}
    }
    func testLegacyResumeAndOtherLevelsKeepTheirPolicy() throws {
        var legacy=NativeBoardState(tiles:[],board:13,wildSpawnCount:8)
        legacy=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(legacy))
        XCTAssertNil(legacy.beachBallDropCount);XCTAssertEqual(legacy.completedBeachBallDrops,1)
        XCTAssertEqual(choose(legacy,0.39999)?.variant,"beach-ball")
        XCTAssertNotEqual(choose(legacy,0.4)?.variant,"beach-ball")
        for board in [12,14,20] {
            var state=NativeBoardState(tiles:[],board:board,wildSpawnCount:8)
            let before=(0..<100).map{choose(state,Double($0)/100)}
            state.beachBallDropCount=6
            XCTAssertEqual((0..<100).map{choose(state,Double($0)/100)},before)
        }
        XCTAssertEqual(NativeBoardState(tiles:[],board:13).completedBeachBallDrops,0)
    }
    func testCancelledAndNonBallDropsRetainExactUnsaturatedCount() throws {
        for count in [0,2] {for cancel in [false,true] {
            var state=NativeBoardState(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1)],board:13,wildMeter:1.25)
            state.beachBallDropCount=count
            let e=NativeGameplayEngine(state:state,recordedRandomChoices:Array(repeating:0.5,count:30),rewardPicker:{_,_ in .init(.juice,variant:cancel ? "beach-ball":nil)})
            e.stagedMeterDrops=true
            XCTAssertTrue(e.claimMeterReward().accepted)
            let drop=try XCTUnwrap(e.meterDropReservations.values.first)
            if cancel {XCTAssertTrue(e.requestMeterDropCancellation(id:drop.id,generation:drop.generation,reason:.explicitPendingContinuation).accepted)}
            let receipts:[NativeMeterDropReceipt]=cancel ? [.assetsPrepared,.boardFallbackRestored,.dropPromiseCompleted]:[.assetsPrepared,.revealed,.impact,.boardFallbackRestored,.dropPromiseCompleted,.selectedWarmupCompleted,.wallHandoffUnlocked]
            for receipt in receipts {XCTAssertTrue(e.applyMeterDropReceipt(id:drop.id,generation:drop.generation,receipt:receipt).accepted)}
            XCTAssertEqual(e.state.beachBallDropCount,count)
        }}
    }
}
