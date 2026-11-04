import XCTest
@testable import StackToSixGameplay

final class NativeDeviceMeterChargeTests:XCTestCase {
    private func state(mode:NativeRunMode = .journey,variant:NativeArcadeVariant = .endurance,meter:Double=0)->NativeBoardState {
        let tiles=[1,2,1].enumerated().map {NativeTile(id:"t\($0.offset)",cell:.init(column:$0.offset,row:0),value:$0.element)}
        return NativeBoardState(tiles:tiles,mode:mode,wildMeter:meter,arcadeVariant:mode == .arcade ? variant:nil)
    }
    private func move(_ engine:NativeGameplayEngine)->NativeMoveResult {
        XCTAssertTrue(engine.beginDrag(tileID:"t0"))
        return engine.drop(target:.init(column:1,row:0),now:0)
    }
    func testDeviceFactorMultipliesJourneyAndEachArcadeVariantOnce() {
        for mode in [NativeRunMode.journey,.arcade] {
            for variant in NativeArcadeVariant.allCases {
                let initial=state(mode:mode,variant:variant)
                let phone=move(NativeGameplayEngine(state:initial))
                let pad=move(NativeGameplayEngine(state:initial,wildMeterChargeScale:0.7))
                XCTAssertTrue(phone.accepted);XCTAssertTrue(pad.accepted)
                XCTAssertEqual(pad.state.wildMeter,phone.state.wildMeter*0.7,accuracy:0.0000001)
                XCTAssertEqual(pad.state.score,phone.state.score)
                XCTAssertEqual(pad.state.moves,phone.state.moves)
            }
        }
    }
    func testSavedChargeIsNotRescaledAndNearFullPredictionUsesAdjustedCredit() {
        let pad=NativeGameplayEngine(state:state(meter:0.91),wildMeterChargeScale:0.7)
        XCTAssertEqual(pad.state.wildMeter,0.91)
        let result=move(pad)
        XCTAssertTrue(result.accepted)
        XCTAssertEqual(result.state.wildMeter,0.98,accuracy:0.0000001)
        let phone=move(NativeGameplayEngine(state:state(meter:0.91)))
        XCTAssertFalse(phone.accepted)
        XCTAssertEqual(phone.resolution.reason,"native_wild_meter_spawn_pending")
    }
}
