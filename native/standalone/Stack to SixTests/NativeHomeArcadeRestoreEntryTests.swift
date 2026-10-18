import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativeHomeArcadeRestoreEntryTests:XCTestCase {
    func testActualHomeArcadeExitAndReentryRepeatRoundOneCueAndCapturedDiceWave()async throws {
        try await exercise(round:1)
    }
    func testLaterSavedRoundReentryPreservesItsRoundScoreMovesAndDice()async throws {
        try await exercise(round:4)
    }
    func testModalCTAUsesEachProfileFreshSavedPendingExpiredAndTutorialState()async throws {
        for scenario in 0..<3 {
            let directory=FileManager.default.temporaryDirectory.appendingPathComponent("arcade-cta-profile-"+UUID().uuidString)
            let store=NativeSaveStore(directory:directory)
            var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
            envelope.progression.firstPlayTutorialComplete=scenario != 2
            envelope.arcadeVariantRuns[NativeArcadeVariant.pureDice.rawValue]=NativeBoardFactory.make(mode:.arcade,board:1,generation:1,seed:17,arcadeVariant:.pureDice)
            envelope.arcadeVariantPendingRounds[NativeArcadeVariant.slowBurn.rawValue] = .init(round:2,score:100)
            if scenario==1 {envelope.arcadeVariantRunSavedAt[NativeArcadeVariant.pureDice.rawValue]=Date().timeIntervalSince1970-8*24*60*60}
            try store.save(envelope)
            let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
            let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
            defer{host.dispose();window.isHidden=true;try? FileManager.default.removeItem(at:directory)}
            host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
            try await wait("Home ready, scenario \(scenario)"){app.route == .home && !app.home.isHidden && app.home.isUserInteractionEnabled}
            app.home.onActivate?(1)
            try await wait("Hub ready"){app.route == .arcadeHub && app.arcadeHub.hub.scrollView.isUserInteractionEnabled}
            for (index,id) in app.arcadeHub.hub.worldIDs.enumerated() {
                app.arcadeHub.hub.onWorld?(id)
                try await wait("Modal ready"){self.button(app.view,id:"native.arcade-world-modal.play")?.isEnabled == true}
                let play=try XCTUnwrap(button(app.view,id:"native.arcade-world-modal.play"))
                let expected=scenario==2 || index==0 || scenario==1 && index==1 ? "Play":"Continue"
                XCTAssertEqual(play.title(for:.normal),expected,"scenario \(scenario), profile \(index)")
                XCTAssertEqual(try store.load()?.activeArcadeVariant,.endurance,"Opening a modal must not change the selected save profile")
                try XCTUnwrap(button(app.view,id:"native.arcade-world-modal.close")).sendActions(for:.touchUpInside)
                try await wait("Modal closed"){self.button(app.view,id:"native.arcade-world-modal.play")==nil}
            }
        }
    }
    private func wait(_ label:String,_ predicate:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(40)
        while !predicate(){guard Date()<deadline else{XCTFail(label);throw CancellationError()};try await Task.sleep(for:.milliseconds(10))}
    }
    private func button(_ view:UIView,id:String)->UIButton? {
        if let button=view as? UIButton,button.accessibilityIdentifier==id{return button}
        return view.subviews.lazy.compactMap{self.button($0,id:id)}.first
    }
    private func exercise(round:Int)async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-home-arcade-entry-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var saved=NativeBoardFactory.make(mode:.arcade,board:round,generation:9,seed:17)
        saved.score=123;saved.moves=23
        var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        envelope.progression.firstPlayTutorialComplete=true;envelope.arcadeRun=saved;try store.save(envelope)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        try await wait("Home CTA ready"){app.route == .home && !app.home.isHidden && app.home.isUserInteractionEnabled}
        let first=try await enterFromActualHome(app,expected:saved)
        let beforeExit=first.engine.state
        first.onExit?()
        let modal=try XCTUnwrap(first.presentedViewController as? JimiNativeEndRunModal)
        let exit=try XCTUnwrap(button(modal.view,id:"native.end-run.exit"))
        try await wait("Exit modal ready"){modal.view.isUserInteractionEnabled && exit.isUserInteractionEnabled}
        exit.sendActions(for:.touchUpInside)
        try await wait("Authored return to Arcade hub"){app.route == .arcadeHub && !app.arcadeHub.isHidden && app.arcadeHub.hub.scrollView.isUserInteractionEnabled && first.parent == nil}
        XCTAssertNil(first.sourceScope)
        let durable=try XCTUnwrap(store.load()?.arcadeRun)
        assertGameplay(durable,matches:beforeExit)
        let second=try await enterFromActualHome(app,expected:durable)
        XCTAssertFalse(second === first)
        assertGameplay(second.engine.state,matches:beforeExit)
        assertGameplay(try XCTUnwrap(store.load()?.arcadeRun),matches:beforeExit)
    }
    private func enterFromActualHome(_ app:NativeAppController,expected:NativeBoardState)async throws->NativeGameplayViewController {
        // First entry follows the actual Home CTA; return reuses the hub.
        if app.route == .home {
            if app.home.selectedSlide != 1 {
                app.home.navigationButtonViews[1].sendActions(for:.touchUpInside)
                try await wait("Arcade slide ready"){
                    app.home.selectedSlide == 1 && app.home.sliderTrack.layer.animation(forKey:"native-slide-selection") == nil
                }
            }
            XCTAssertTrue(app.home.ctaView.isEnabled)
            XCTAssertTrue(app.home.ctaView.isUserInteractionEnabled)
            app.home.ctaView.sendActions(for:.touchUpInside)
        }
        try await wait("Arcade hub ready") {
            app.route == .arcadeHub && !app.arcadeHub.isHidden && app.arcadeHub.hub.scrollView.isUserInteractionEnabled
        }
        let endurance = try XCTUnwrap(app.arcadeHub.hub.worldUnits.first { $0.tag == 1 })
        endurance.sendActions(for:.touchUpInside)
        try await wait("World bounce reaches modal") { self.button(app.arcadeHub,id:"native.arcade-world-modal.play") != nil }
        let play = try XCTUnwrap(button(app.arcadeHub,id:"native.arcade-world-modal.play"))
        try await wait("Endurance modal ready") { play.isEnabled }
        XCTAssertEqual(play.title(for:.normal),"Continue","Existing Round1 is still a saved run, not a fresh start")
        play.sendActions(for:.touchUpInside)
        try await wait("Home Arcade controller mounted"){app.children.contains{$0 is NativeGameplayViewController}}
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        try await wait("Authored round cue"){game.view.subviews.contains{$0 is NativeArcadeRoundPresentation}}
        XCTAssertEqual(game.engine.state.board,expected.board)
        // The existing restore constructor advances its generation/revision;
        // replaying entry motion must not introduce a second reconstruction.
        XCTAssertEqual(game.engine.state.generation,expected.generation+1)
        XCTAssertEqual(game.engine.state.revision,expected.revision+1)
        let scene=try XCTUnwrap(game.boardScene)
        XCTAssertTrue(game.sourceBoardEntryEnabled)
        try await wait("Captured dice wave begins"){
            game.engine.state.tiles.contains{scene.sourceNativeTileNode($0.id)?.sourceBoardEntryBinding != nil}
        }
        XCTAssertFalse(scene.isBoardEntryComplete)
        let holders=try XCTUnwrap(game.sourceInitialConstruction).nodes
        XCTAssertTrue(holders.values.allSatisfy{$0.sourceBoardEntryBinding != nil && !$0.isHidden})
        XCTAssertTrue(holders.values.contains{abs($0.sourceLocalScale.x-1)>0.01},"Restored dice must actually paint the authored appearance")
        try await wait("Real dice wave and gameplay admission complete"){
            scene.completedSourceBoardEntry != nil && scene.isBoardEntryComplete && game.beforeSourceGameplayAdmission == nil
        }
        XCTAssertTrue(holders.values.allSatisfy{$0.sourceBoardEntryBinding == nil})
        XCTAssertFalse(game.view.subviews.contains{$0 is NativeArcadeRoundPresentation})
        assertGameplay(game.engine.state,matches:expected)
        return game
    }
    private func assertGameplay(_ actual:NativeBoardState,matches expected:NativeBoardState,file:StaticString=#filePath,line:UInt=#line) {
        XCTAssertEqual(actual.board,expected.board,file:file,line:line)
        XCTAssertEqual(actual.stage,expected.stage,file:file,line:line)
        XCTAssertEqual(actual.moves,expected.moves,file:file,line:line)
        XCTAssertEqual(actual.score,expected.score,file:file,line:line)
        let tiles:(NativeBoardState)->[String]={state in state.tiles.map{"\($0.id):\($0.cell.column):\($0.cell.row):\($0.value):\($0.stackDepth):\($0.locked):\(String(describing:$0.archetype)):\($0.variant ?? "")"}.sorted()}
        XCTAssertEqual(tiles(actual),tiles(expected),file:file,line:line)
    }
}
