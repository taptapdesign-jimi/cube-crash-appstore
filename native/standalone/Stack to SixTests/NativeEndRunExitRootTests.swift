import XCTest
import UIKit
import SpriteKit
import StackToSixNativeState
import StackToSixGameplay
@testable import Stack_to_Six

/// Actual Exit modal action must await existing board/HUD/footer owners before
/// Bootstrap returns to World/Home; no synthetic completion or clock delivery.
@MainActor final class NativeEndRunExitRootTests:XCTestCase {
    private func wait(_ label:String,_ predicate:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(40)
        while !predicate(){guard Date()<deadline else{XCTFail(label);throw CancellationError()};try await Task.sleep(for:.milliseconds(10))}
    }
    private func button(_ view:UIView,id:String)->UIButton? {
        if let button=view as? UIButton,button.accessibilityIdentifier==id{return button}
        return view.subviews.lazy.compactMap{self.button($0,id:id)}.first
    }
    func testActualJourneyExitStageKeepsGameplayMountedThroughDiceTopHUDAndFooterExit()async throws {
        try await exercise(board:21)
    }
    func testActualArcadeExitGameKeepsGameplayMountedThroughDiceAndTopHUDExit()async throws {
        try await exercise(board:nil)
    }
    func testDisposalDuringActualExitCannotPublishLateWorldReturn()async throws {
        try await exercise(board:21,disposeDuringExit:true)
    }
    private func exercise(board:Int?,disposeDuringExit:Bool=false)async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-endrun-exit-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        envelope.progression.firstPlayTutorialComplete=true;envelope.progression.completedJourneyBoards=Set(1...20)
        let saved=NativeBoardFactory.make(mode:board==nil ? .arcade:.journey,board:board ?? 1,generation:9,seed:17)
        if let board {envelope.journeyRuns[board]=saved}else{envelope.arcadeRun=saved}
        try store.save(envelope)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let prior=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;prior?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        try await wait("Home"){!app.home.isHidden}
        if let board {
            app.navigate(.world((board-1)/10+1),interrupt:true)
            try await wait("Journey"){
                if app.children.contains(where:{$0 is NativeGameplayViewController}){return true}
                app.world?.onRequest?("continue",board);return false
            }
        }else{app.navigate(.gameplay,interrupt:true)}
        try await wait("Actual gameplay admission"){
            app.children.compactMap{$0 as? NativeGameplayViewController}.first.map{
                $0.boardScene?.view?.window != nil && $0.boardScene?.isBoardEntryComplete==true &&
                $0.beforeSourceGameplayAdmission==nil && !$0.engine.hasUnsavableSourceGameplayState
            }==true
        }
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        let scene=try XCTUnwrap(game.boardScene),scope=try XCTUnwrap(game.sourceScope)
        let tile=try XCTUnwrap(scene.sourceNativeTileNode(try XCTUnwrap(game.engine.state.activeTiles.first).id))
        let hud=try XCTUnwrap(scene.childNode(withName:"//native-game-hud"))
        let footer=game.view.subviews.compactMap{$0 as? NativeJourneyBottomDecorOwner}.first
        if board != nil {XCTAssertNotNil(footer);try await wait("Visible footer"){footer?.phase == .visible}}
        game.onExit?()
        let modal=try XCTUnwrap(game.presentedViewController as? JimiNativeEndRunModal)
        let exit=try XCTUnwrap(button(modal.view,id:"native.end-run.exit"))
        try await wait("Modal admission"){modal.view.isUserInteractionEnabled && exit.isUserInteractionEnabled}
        exit.sendActions(for:.touchUpInside)
        try await wait("Existing authored exit owners"){
            tile.action(forKey:"board-exit") != nil && hud.action(forKey:"hud-exit") != nil &&
            (board==nil || footer?.phase == .exiting)
        }
        XCTAssertEqual(app.route,.gameplay);XCTAssertTrue(game.parent === app)
        XCTAssertTrue(scene.navigationLocked);XCTAssertFalse(scene.beginDrag(at:.zero))
        if disposeDuringExit {
            host.dispose();try await Task.sleep(for:.milliseconds(1200))
            XCTAssertTrue(host.children.isEmpty);XCTAssertFalse(scope.current);return
        }
        try await wait("Return only after authored exit"){app.route != .gameplay}
        XCTAssertNil(game.parent);XCTAssertFalse(scope.current)
        XCTAssertEqual(app.route,board==nil ? .home:.world((board!-1)/10+1))
        let durable=try XCTUnwrap(store.load())
        XCTAssertEqual(board==nil ? durable.arcadeRun?.score:durable.journeyRuns[board!]?.score,saved.score)
        let savedRun=try XCTUnwrap(board==nil ? durable.arcadeRun:durable.journeyRuns[board!])
        XCTAssertTrue(savedRun.validationIssues().isEmpty)
        XCTAssertFalse(savedRun.activeTiles.isEmpty)
        XCTAssertTrue(savedRun.activeTiles.allSatisfy{$0.alpha>0.01},"Exit must retain the pre-animation playable save, never collapsed visual state")
    }
}
