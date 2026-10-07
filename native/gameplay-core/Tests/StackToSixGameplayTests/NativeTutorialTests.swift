import XCTest
@testable import StackToSixGameplay
final class NativeTutorialTests: XCTestCase {
    func board() -> NativeBoardState {
        var tiles: [NativeTile] = []
        for row in 0..<9 { for column in 0..<5 {
            tiles.append(NativeTile(id:"\(column),\(row)",cell:NativeCell(column:column,row:row),value:column == 0 && row == 0 ? 2 : 0,locked:!(column == 0 && row == 0)))
        } }
        return NativeBoardState(tiles:tiles)
    }
    func testCanonicalGuidedCellsAndBidirectionalDropRestrictions() {
        let engine = NativeGameplayEngine(state:board(),recordedRandomChoices:Array(repeating:0,count:200))
        XCTAssertTrue(engine.startTutorial().accepted)
        let cells = NativeTutorialRules.guidedCells(columns:5,rows:9)
        XCTAssertEqual(cells.three,NativeCell(column:1,row:3)); XCTAssertEqual(cells.two,NativeCell(column:3,row:5)); XCTAssertEqual(cells.one,NativeCell(column:3,row:1))
        let three = engine.state.tile(at:cells.three)!, two = engine.state.tile(at:cells.two)!, one = engine.state.tile(at:cells.one)!
        XCTAssertFalse(engine.beginDrag(tileID:one.id)); XCTAssertTrue(engine.beginDrag(tileID:three.id))
        XCTAssertFalse(engine.drop(target:one.cell).accepted); XCTAssertEqual(engine.state.tutorial?.step,.stack)
        XCTAssertTrue(engine.beginDrag(tileID:three.id)); XCTAssertTrue(engine.drop(target:two.cell).accepted)
        XCTAssertEqual(engine.state.tutorial?.step,.mergeSix); XCTAssertEqual(engine.state.tutorial?.guidedPair,[two.id,one.id])
        XCTAssertTrue(engine.beginDrag(tileID:one.id)); XCTAssertTrue(engine.drop(target:two.cell).accepted)
        XCTAssertEqual(engine.state.tutorial?.step,.freePlay); XCTAssertTrue(engine.state.tutorial?.shouldLockHUD == true)
        XCTAssertFalse(engine.acknowledgeTutorialResult())
        XCTAssertTrue(engine.dismissTutorialFreePlayGuide().accepted); XCTAssertTrue(engine.state.tutorial?.waitingForWild == true)
    }
    func testForcedStarSpawnAndSpecialTargetAdmissionUseSourceTopRows() {
        var state = board(); var tutorial = NativeTutorialState(); tutorial.step = .freePlay; tutorial.waitingForWild = true
        state.tutorial = tutorial; state.wildMeter = 1
        let engine = NativeGameplayEngine(state:state,recordedRandomChoices:[0.8])
        let spawn = engine.claimMeterReward(); XCTAssertTrue(spawn.accepted)
        let wild = engine.state.activeTiles.first { $0.isWild }!
        XCTAssertEqual(wild.gameplayArchetype,.star); XCTAssertEqual(wild.cell,NativeCell(column:2,row:1)); XCTAssertEqual(wild.starOrbitCount,3)
        XCTAssertEqual(engine.state.tutorial?.step,.special)
        let target = engine.state.tile(at:NativeCell(column:0,row:0))!
        XCTAssertTrue(engine.beginDrag(tileID:wild.id)); let finish = engine.drop(target:target.cell)
        XCTAssertTrue(finish.accepted); XCTAssertEqual(engine.state.tutorial?.active,false); XCTAssertEqual(engine.state.tutorial?.guideCompleted,true)
        XCTAssertEqual(engine.state.tutorial?.completionAssist,true); XCTAssertTrue(engine.state.tutorial?.requiresResultCompletion == true)
        XCTAssertFalse(engine.state.tutorial?.shouldLockHUD == true); XCTAssertTrue(engine.acknowledgeTutorialResult())
        XCTAssertEqual(engine.state.tutorial?.done,true)
    }
    func testCompletionAssistWeightedValuesSlowMeterAndFailSuppression() {
        var tutorial = NativeTutorialState(); tutorial.active = false; tutorial.guideCompleted = true; tutorial.completionAssist = true
        let lone = NativeTile(id:"only",cell:NativeCell(column:0,row:0),value:5)
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[lone],tutorial:tutorial),recordedRandomChoices:[0])
        XCTAssertEqual(engine.resolve().reason,"tutorial_final_chance_pending"); XCTAssertNil(engine.beginNoMovesConfirmation())
        XCTAssertTrue(engine.claimTutorialFinalChance().accepted)
        XCTAssertEqual(engine.state.activeTiles.map(\.value).sorted(),[1,5]); XCTAssertEqual(engine.state.tutorial?.finalChanceSpawnCount,1)
        XCTAssertEqual(NativeTutorialRules.lowValue(excluding:1,roll:0),2); XCTAssertEqual(NativeTutorialRules.lowValue(roll:0.99),3)
        XCTAssertEqual(tutorial.meterMultiplier,0.05); XCTAssertFalse(tutorial.shouldLockHUD)
    }
    func testOrdinaryBoardCompletionNeverMarksTutorialDone() {
        let a = NativeTile(id:"a",cell:NativeCell(column:0,row:0),value:3), b = NativeTile(id:"b",cell:NativeCell(column:1,row:0),value:3)
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[a,b]))
        XCTAssertTrue(engine.beginDrag(tileID:a.id)); XCTAssertEqual(engine.drop(target:b.cell).resolution.kind,.complete)
        XCTAssertFalse(engine.acknowledgeTutorialResult()); XCTAssertNil(engine.state.tutorial)
    }
    func testTutorialPolicySurvivesSaveWithoutPresentationDimChangingClassification() throws {
        let engine = NativeGameplayEngine(state:board()); _ = engine.startTutorial()
        let decoded = try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(engine.state))
        XCTAssertEqual(decoded,engine.state); XCTAssertEqual(decoded.activeTiles.count,4)
        XCTAssertTrue(decoded.tiles.filter { decoded.tutorial!.guidedPair.contains($0.id) }.allSatisfy { $0.alpha == 1 && !$0.locked })
    }
}
