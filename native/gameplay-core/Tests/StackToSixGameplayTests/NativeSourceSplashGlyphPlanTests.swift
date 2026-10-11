import XCTest
@testable import StackToSixGameplay

final class NativeSourceSplashGlyphPlanTests:XCTestCase {
    private struct Oracle:Decodable {let revision:String,rows:[Row]}
    private struct Row:Decodable {let seed,state:UInt32,draws:Int,tilt:Double,sizes,opacities,bounces:[Double]}
    func testCtorMatchesActualImmutableSourceFunctionsAndDrawOrder()throws {
        let url=try XCTUnwrap(Bundle.module.url(forResource:"SourceTntGlyphConstructorOracle",withExtension:"json"))
        let oracle=try JSONDecoder().decode(Oracle.self,from:Data(contentsOf:url))
        XCTAssertEqual(oracle.revision,"8e4364e8ee571f16c6322727a9ae79fee5a982eb")
        for row in oracle.rows {
            var state=row.seed,draws=0
            let plan=try XCTUnwrap(NativeSourceSplashGlyphPlan.capture(text:"BOOM",random:{
                draws+=1;state=state &* 1664525 &+ 1013904223;return Double(state)/4294967296
            },current:{true}))
            XCTAssertEqual(draws,row.draws);XCTAssertEqual(state,row.state)
            XCTAssertEqual(plan.containerTiltRadians,row.tilt,accuracy:1e-14)
            XCTAssertEqual(plan.sizes,row.sizes);XCTAssertEqual(plan.opacities,row.opacities)
            for (actual,expected) in zip(plan.bounces,row.bounces){XCTAssertEqual(actual,expected,accuracy:1e-14)}
        }
    }
    func testRetirementAfterFirstRealDrawStopsWithoutPublishingPartialGlyphPlan() {
        var current=true,draws=0
        XCTAssertNil(NativeSourceSplashGlyphPlan.capture(text:"BOOM",random:{draws+=1;current=false;return 0.2},current:{current}))
        XCTAssertEqual(draws,1)
    }
    func testIneligibleCallerDoesNoEntropyWorkAndInvalidDrawDoesNotFallBack() {
        var draws=0
        XCTAssertNil(NativeSourceSplashGlyphPlan.capture(text:"BOOM",random:{draws+=1;return 0.2},current:{false}))
        XCTAssertEqual(draws,0)
        XCTAssertNil(NativeSourceSplashGlyphPlan.capture(text:"BOOM",random:{draws+=1;return .nan},current:{true}))
        XCTAssertEqual(draws,1)
    }
}
