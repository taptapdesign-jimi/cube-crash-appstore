import XCTest
@testable import StackToSixGameplay

final class NativeSourceTutorialRepairTests:XCTestCase {
    func testExactComplementUsesActualRowMajorCellMathAndDoesNotDebitMoves(){
        var state=NativeBoardState(tiles:[NativeTile(id:"target",cell:.init(column:0,row:0),value:5)],moves:7)
        var tutorial=NativeTutorialState();tutorial.active=false;tutorial.completionAssist=true;tutorial.guideCompleted=true;state.tutorial=tutorial
        let engine=NativeGameplayEngine(state:state,recordedRandomChoices:[0])
        let result=engine.beginSourceTutorialRepair(physical:state,singleOnly:true,blocked:false)
        XCTAssertEqual(result?.accepted,true);XCTAssertEqual(engine.state.moves,7)
        XCTAssertEqual(engine.state.tiles.filter{!state.tiles.map(\.id).contains($0.id)}.first?.value,1)
        XCTAssertEqual(engine.state.tutorial?.finalChanceSpawnCount,1)
    }
    func testBlockedAndMultipleSingleRegularPolicyNeverConsumesMath(){
        var state=NativeBoardState(tiles:[NativeTile(id:"a",cell:.init(column:0,row:0),value:4),NativeTile(id:"b",cell:.init(column:1,row:0),value:5)],moves:7)
        var tutorial=NativeTutorialState();tutorial.active=false;tutorial.completionAssist=true;state.tutorial=tutorial
        let engine=NativeGameplayEngine(state:state,recordedRandomChoices:[0])
        XCTAssertNil(engine.beginSourceTutorialRepair(physical:state,singleOnly:true,blocked:false))
        XCTAssertNil(engine.beginSourceTutorialRepair(physical:state,singleOnly:false,blocked:true))
        XCTAssertEqual(engine.state,state)
    }
}
