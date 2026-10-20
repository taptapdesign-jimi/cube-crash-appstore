import XCTest
import UIKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class NativeScoreModalTests:XCTestCase {
    func testScoreCloseRequestFeedbackPrecedesExitAndCannotRepeat() async throws {
        let state=NativeBoardFactory.make(mode:.journey,board:1)
        let modal=NativeScoreModal(model:NativeScoreModalModel(state:state,progression:NativeProgressionState(),combo:false),root:NativeTestResources.root)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=modal;window.makeKeyAndVisible()
        defer{modal.dispose();window.isHidden=true;window.rootViewController=nil}
        try await Task.sleep(for:.milliseconds(850))
        var requested=0,closed=0
        modal.onCloseRequested={requested += 1};modal.onClosed={closed += 1}
        modal.requestClose();modal.requestClose()
        XCTAssertEqual(requested,1);XCTAssertEqual(closed,0)
        modal.dispose();modal.requestClose();XCTAssertEqual(requested,1)
    }
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
    func testArcadeModalReadsItsExactVariantRecord() {
        var progression = NativeProgressionState()
        for (index, variant) in NativeArcadeVariant.allCases.enumerated() {
            progression.finishAttempt(mode: .arcade, board: index + 2, score: (index + 1) * 1234, longestCombo: index + 3, cubesCracked: 0, clean: true, arcadeVariant: variant)
        }
        for (index, variant) in NativeArcadeVariant.allCases.enumerated() {
            let state = NativeBoardFactory.make(mode: .arcade, board: 1, arcadeVariant: variant)
            let score = NativeScoreModalModel(state: state, progression: progression, combo: false)
            XCTAssertEqual(score.stats.first?.value, ((index + 1) * 1234).formatted())
            XCTAssertEqual(score.stats.last?.value, String(format: "%02d", index + 3))
            XCTAssertEqual(NativeScoreModalModel(state: state, progression: progression, combo: true).stats.first?.value, (index + 3).formatted())
        }
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
