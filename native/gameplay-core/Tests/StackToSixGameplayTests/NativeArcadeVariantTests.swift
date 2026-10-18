import XCTest
@testable import StackToSixGameplay

final class NativeArcadeVariantTests: XCTestCase {
    private func make(_ variant: NativeArcadeVariant, meter: Double = 0, final: Bool = false) -> NativeGameplayEngine {
        let tiles: [NativeTile] = [.init(id:"a",cell:.init(column:0,row:0),value:final ? 3:1), .init(id:"b",cell:.init(column:1,row:0),value:final ? 3:2)]
        return NativeGameplayEngine(state:.init(tiles:tiles,mode:.arcade,wildMeter:meter,arcadeVariant:variant),rewardPicker:{_,_ in .init(.tnt)})
    }
    func testOrdinaryMergeUsesVariantChargeAndJourneyIgnoresVariant() {
        for variant in NativeArcadeVariant.allCases {
            let engine=make(variant)
            XCTAssertTrue(engine.beginDrag(tileID:"a"))
            XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
            XCTAssertEqual(engine.state.wildMeter,0.115 * variant.meterMultiplier,accuracy:0.000001)
        }
        var journey=make(.slowBurn).state;journey.mode = .journey
        XCTAssertEqual(journey.effectiveArcadeVariant,.endurance)
    }
    func testLuckyDropConsumesOnceAndSurvivesRestore() throws {
        let engine=make(.pureDice,meter:1.4)
        XCTAssertTrue(engine.claimMeterReward().accepted)
        XCTAssertTrue(engine.state.luckyDropUsed)
        XCTAssertEqual(engine.state.wildMeter,0)
        var saved=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(engine.state))
        XCTAssertTrue(saved.luckyDropUsed)
        // Even stale surplus cannot admit a second reward after restore.
        saved.wildMeter=1
        let restored=NativeGameplayEngine(state:saved,rewardPicker:{_,_ in .init(.tnt)})
        XCTAssertFalse(restored.claimMeterReward().accepted)
        XCTAssertEqual(restored.state.wildSpawnCount,1)
    }
    func testLuckyDropStagedChargeIsSpentBeforeLanding() {
        let engine=make(.pureDice,meter:1)
        engine.stagedMeterDrops=true
        XCTAssertTrue(engine.claimMeterReward().accepted)
        XCTAssertTrue(engine.state.luckyDropUsed)
        XCTAssertEqual(engine.state.wildMeter,0)
        XCTAssertEqual(engine.meterDropReservations.count,1)
        XCTAssertFalse(engine.claimMeterReward().accepted)
    }
    func testLuckyDropStopsChargingAfterConsumption() {
        var state=make(.pureDice).state;state.luckyDropUsed=true
        let engine=NativeGameplayEngine(state:state,rewardPicker:{_,_ in .init(.tnt)})
        XCTAssertTrue(engine.beginDrag(tileID:"a"))
        XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
        XCTAssertEqual(engine.state.wildMeter,0)
    }
    func testLuckyDropChargeKeepsItsPaceInLaterRounds() {
        for round in [1,2,4,8,30] {
            var state=make(.pureDice).state;state.board=round;state.stage=round
            let engine=NativeGameplayEngine(state:state,rewardPicker:{_,_ in .init(.tnt)})
            XCTAssertTrue(engine.beginDrag(tileID:"a"))
            XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
            XCTAssertEqual(engine.state.wildMeter,0.046,accuracy:0.000001)
        }
    }
    func testSlowBurnCompletionKeepsEarnedChargeWithoutFinalReward() {
        for variant in NativeArcadeVariant.allCases {
            let engine=make(variant,meter:0.7,final:true)
            XCTAssertTrue(engine.beginDrag(tileID:"a"))
            let result=engine.drop(target:.init(column:1,row:0))
            XCTAssertEqual(result.resolution.kind,.complete)
            XCTAssertEqual(result.state.wildMeter,variant == .slowBurn ? 0.7:0)
            XCTAssertFalse(result.events.contains{$0.kind == .spawned})
        }
    }
    func testVariantRoundTripsWithoutLosingRules() throws {
        for variant in NativeArcadeVariant.allCases {
            let original=make(variant).state
            XCTAssertEqual(try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(original)),original)
        }
    }
    func testLegacyBoardWithoutVariantDecodesAsEndurance() throws {
        let data=try JSONEncoder().encode(make(.endurance).state)
        var json=try XCTUnwrap(JSONSerialization.jsonObject(with:data) as? [String:Any]);json.removeValue(forKey:"arcadeVariant")
        let decoded=try JSONDecoder().decode(NativeBoardState.self,from:JSONSerialization.data(withJSONObject:json))
        XCTAssertNil(decoded.arcadeVariant);XCTAssertEqual(decoded.effectiveArcadeVariant,.endurance)
    }
}
