import XCTest
import JavaScriptCore
@testable import StackToSixGameplay
@testable import Stack_to_Six

final class NativeSourceMandatoryRepairValueOracleTests:XCTestCase {
    struct Reference:Decodable {let gitTag:String,commit:String,sourcePath:String,script:String}
    func testMandatoryRepairValueAndDrawCountMatchImmutableV9AcrossAllBalanceModes()throws {
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"NativeSourceRegularValueV9Reference",withExtension:"json"))
        let reference=try JSONDecoder().decode(Reference.self,from:Data(contentsOf:url));XCTAssertEqual(reference.gitTag,"production-benchmark-v9")
        for mode in [NativeRunMode.arcade,.journey] {
            for stage in [1,3,4,6,7,10,11,21] {
                for tutorialMode in [false,true] {
                    for rolls in [[0.0,0.0],[0.4,0.8],[0.74,0.99],[0.99,0.35]] {
                        let context=try XCTUnwrap(JSContext())
                        let json=String(data:try JSONEncoder().encode(rolls),encoding:.utf8)!
                        context.evaluateScript("var window={STATE:{boardNumber:\(stage)},__ccFirstPlayTutorialActive:false,__ccFirstPlayTutorialSlowWildMeter:\(tutorialMode)}; var __rolls=\(json),__index=0; Math.random=function(){return __rolls[__index++];}; var RUN_MODE_JOURNEY='journey';function getRunMode(){return '\(mode == .journey ? "journey":"arcade_home")';}function isArcadeHomeRunMode(){return getRunMode()==='arcade_home';}function isFirstPlayTutorialRunActive(){return window.__ccFirstPlayTutorialActive===true || window.__ccFirstPlayTutorialSlowWildMeter===true;}function getJourneySmallValueBias(board){var stage=((Math.max(1,board)-1)%10)+1;return stage<=3?0.75:stage<=6?0.4:0;}")
                        context.evaluateScript(reference.script);XCTAssertNil(context.exception)
                        let expected=context.evaluateScript("randomRegularTileValue()")?.toInt32(),expectedDraws=context.objectForKeyedSubscript("__index")?.toInt32()
                        var tutorial:NativeTutorialState?
                        if tutorialMode {var t=NativeTutorialState();t.active=false;t.completionAssist=true;tutorial=t}
                        var draws=0
                        let math=NativeSourceMathRandomStream(draw:{defer{draws+=1};return rolls[min(draws,rolls.count-1)]})
                        let state=NativeBoardState(tiles:[],mode:mode,board:stage,stage:stage,tutorial:tutorial)
                        let engine=NativeGameplayEngine(state:state,sourceMathRandom:math)
                        let begun=try XCTUnwrap(engine.beginSourceMandatoryCellRepair(cell:.init(column:0,row:0),generation:state.generation))
                        let holder=try XCTUnwrap(begun.state.tiles.first)
                        let opened=try XCTUnwrap(engine.openSourceLingeringSixRepair(tileID:holder.id,generation:state.generation))
                        XCTAssertEqual(opened.state.tiles.first?.value,expected.map(Int.init),"\(mode)/\(stage)/tutorial:\(tutorialMode)/\(rolls)")
                        XCTAssertEqual(draws,expectedDraws.map(Int.init))
                    }
                }
            }
        }
    }
}
