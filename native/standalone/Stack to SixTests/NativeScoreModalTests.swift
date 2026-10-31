import XCTest
import UIKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class NativeScoreModalTests:XCTestCase {
    func testJourneyHistoryProjectsTopThreeAndNeverInventsLegacyDate() {
        var stats=NativeBoardStats();stats.highScore=400
        let legacy=NativeScoreModalModel(boardStats:stats,combo:false)
        XCTAssertEqual(legacy.title,"Best scores");XCTAssertEqual(legacy.history,[.init(value:400,date:nil)])
        stats.comboHistory=[.init(value:2,date:10),.init(value:8,date:12),.init(value:8,date:11),.init(value:4,date:1)]
        let top=NativeScoreModalModel(boardStats:stats,combo:true)
        XCTAssertEqual(top.title,"Best combo");XCTAssertEqual(top.history?.map(\.value),[8,8,4]);XCTAssertEqual(top.history?.first?.date,12)
    }
    func testHistoryModalHasBoundedRowsAndSharedModalIdle()async throws {
        var stats=NativeBoardStats();stats.scoreHistory=(1...10).map{.init(value:$0*100,date:Double($0))}
        let modal=NativeScoreModal(model:.init(boardStats:stats,combo:false),root:NativeTestResources.root)
        let window=UIWindow(frame:.init(x:0,y:0,width:320,height:568));window.rootViewController=modal;window.makeKeyAndVisible()
        defer{modal.dispose();window.isHidden=true}
        try await Task.sleep(for:.milliseconds(800))
        func all(_ v:UIView)->[UIView]{[v]+v.subviews.flatMap(all)}
        let views=all(modal.view)
        XCTAssertEqual(views.filter{$0.accessibilityIdentifier?.hasPrefix("native.score-history.row.")==true}.count,3)
        XCTAssertEqual(views.contains{$0.layer.animation(forKey:"score.idle") != nil},!UIAccessibility.isReduceMotionEnabled)
        modal.setSuspended(true);XCTAssertEqual(modal.view.layer.speed,0)
        modal.setSuspended(false);XCTAssertEqual(modal.view.layer.speed,1)
        modal.dispose();modal.dispose();XCTAssertNil(modal.onClosed)
    }
    func testActualHighScoreAndComboModalAdmissionSpeaksOnceAndRejectedRepeatIsSilent() async throws {
        enum Unused:Error {case unavailable}
        for mode in [NativeRunMode.journey,.arcade] {for combo in [false,true] {
            let services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw Unused.unavailable},markViewed:{_ in},makeGameplay:{_,_ in throw Unused.unavailable},flush:{})
            let root=NativeAppController(resourceRoot:NativeTestResources.root,services:services)
            let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=root;window.makeKeyAndVisible()
            let game=NativeGameplayViewController(engine:NativeGameplayEngine(state:NativeBoardFactory.make(mode:mode,board:1)),resourceRoot:NativeTestResources.root)
            root.addChild(game);game.view.frame=root.view.bounds;root.view.addSubview(game.view);game.didMove(toParent:root)
            game.boardScene?.layout(size:game.view.bounds.size,insets:.zero,animateEntry:false)
            let owner=NativeScoreOwner(gameplay:game,root:NativeTestResources.root,progression:{NativeProgressionState()})
            defer{owner.dispose();game.dispose();root.dispose();window.isHidden=true}
            var cues:[String]=[];owner.onFeedback={cues.append($0)}
            owner.present(combo:combo);owner.present(combo:!combo)
            XCTAssertNotNil(game.presentedViewController)
            XCTAssertEqual(cues,["hud-modal-open",combo ? "combo-modal-speech":"high-score-modal-speech"])
            try await Task.sleep(for:.milliseconds(100))
        }}
    }
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
        var cues:[String]=[];owner.onFeedback={cues.append($0)}
        owner.present(combo:false);owner.present(combo:true)
        XCTAssertTrue(cues.isEmpty)
        XCTAssertNil(game.presentedViewController);XCTAssertEqual(engine.state,snapshot)
        owner.dispose();game.dispose()
    }
}
