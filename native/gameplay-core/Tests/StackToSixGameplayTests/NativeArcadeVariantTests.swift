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
    func testPureDiceRefusesBothImmediateAndStagedDropsEvenWithFullSavedMeter() {
        for staged in [false,true] {
            let engine=make(.pureDice,meter:1)
            engine.stagedMeterDrops=staged;engine.stagedMeterOpen=staged
            XCTAssertFalse(engine.claimMeterReward().accepted)
            XCTAssertNil(engine.pendingMeterOpen)
            XCTAssertFalse(engine.state.tiles.contains(where: \.isWild))
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
