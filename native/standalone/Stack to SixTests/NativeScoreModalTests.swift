import XCTest
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class NativeScoreModalTests:XCTestCase {
    func testCommittedStatisticsStayScopedToModeAndBoard() {
        var progression=NativeProgressionState(),board=NativeBoardStats()
        board.highScore=1234;board.longestCombo=7;progression.boardStats[11]=board
        progression.arcadeStats.highScore=9999;progression.arcadeStats.longestCombo=12;progression.arcadeStats.highestStageOpened=4
        let journey=NativeBoardFactory.make(mode:.journey,board:11)
        XCTAssertEqual(NativeScoreModalModel(state:journey,progression:progression,combo:true).stats.first?.value,7.formatted())
        XCTAssertEqual(NativeScoreModalModel(state:journey,progression:progression,combo:false).stats.count,1)
        let arcade=NativeScoreModalModel(state:NativeBoardFactory.make(mode:.arcade,board:1),progression:progression,combo:false)
        XCTAssertEqual(arcade.stats.map(\.label),["High score","Rounds cleared"])
        XCTAssertEqual(arcade.stats.last?.value,"04")
        XCTAssertEqual(arcade.stats.first?.value,9999.formatted())
    }
    func testTutorialHudCannotPresentOrMutateTheLiveRun() throws {
        let state=NativeBoardFactory.make(mode:.arcade,board:1,tutorial:true)
        let engine=NativeGameplayEngine(state:state);XCTAssertTrue(engine.startTutorial().accepted)
        let game=NativeGameplayViewController(engine:engine,resourceRoot:NativeTestResources.root)
        game.loadViewIfNeeded()
        let snapshot=engine.state,owner=NativeScoreOwner(gameplay:game,root:NativeTestResources.root,progression:{NativeProgressionState()})
        owner.present(combo:false);owner.present(combo:true)
        XCTAssertNil(game.presentedViewController);XCTAssertEqual(engine.state,snapshot)
        owner.dispose();game.dispose()
    }
}
