import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class NativeBootstrapTests:XCTestCase {
    func testNativeFailExitPreparesAndConsumesTheSameWorldUnderItsResultCover() async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-bootstrap-fail-return-\(UUID().uuidString)")
        defer {try? FileManager.default.removeItem(at:directory)}
        let store=NativeSaveStore(directory:directory)
        let tiles=[NativeTile(id:"left",cell:.init(column:0,row:0),value:2),NativeTile(id:"right",cell:.init(column:1,row:0),value:3),NativeTile(id:"other",cell:.init(column:2,row:0),value:5)]
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false),journeyRuns:[1:NativeBoardState(tiles:tiles,mode:.journey,board:1,moves:1,score:123)])
        seed.progression.firstPlayTutorialComplete=true;seed.journeyRunSavedAt[1]=Date().timeIntervalSince1970;try store.save(seed)
        let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store)
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let previousWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
        defer {bootstrap.dispose();window.isHidden=true;previousWindow?.makeKeyAndVisible()}
        let app=try XCTUnwrap(host.children.first as? NativeAppController)
        app.navigate(.world(1),interrupt:true);try await waitUntil {app.world?.isReadyForInput == true}
        let retainedWorld=try XCTUnwrap(app.world)
        retainedWorld.onRequest?("continue",1);try await waitUntil {app.route == .gameplay}
        let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController)
        try await waitUntil(timeout:12) {game.boardScene?.boardGeometry != nil}
        let scene=try XCTUnwrap(game.boardScene),geometry=try XCTUnwrap(scene.boardGeometry)
        try await waitUntil {scene.beginDrag(at:geometry.center(row:0,column:0))}
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:geometry.center(row:0,column:1),now:100)).accepted)
        try await waitUntil(timeout:12) {game.presentedViewController is NativeResultController}
        let result=try XCTUnwrap(game.presentedViewController as? NativeResultController)
        XCTAssertFalse(result.clean)
        let exit=try XCTUnwrap(button(in:result.view,id:"native.result.exit"))
        try await waitUntil {exit.isUserInteractionEnabled}
        exit.sendActions(for:.touchUpInside);exit.sendActions(for:.touchUpInside)
        try await waitUntil {app.hasPreparedGameplayReturn}
        XCTAssertEqual(app.route,.gameplay);XCTAssertTrue(app.world === retainedWorld)
        XCTAssertEqual(game.view.alpha,0);XCTAssertGreaterThan(result.view.alpha,0)
        try await waitUntil {app.route == .world(1) && retainedWorld.isReadyForInput}
        XCTAssertTrue(app.world === retainedWorld);XCTAssertFalse(app.hasPreparedGameplayReturn)
        XCTAssertFalse(app.children.contains{$0 is NativeGameplayViewController})
        XCTAssertFalse(containsWeb(app.view));XCTAssertFalse(try XCTUnwrap(store.load()).progression.completedJourneyBoards.contains(1))
    }
    func testFreshJourneyUsesEachAuthoredNativeTransitionBeforeBoardEntry() async throws {
        for (board,completed) in [(1,false),(11,false),(21,false),(1,true)] {
            let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-bootstrap-themed-\(UUID().uuidString)")
            defer {try? FileManager.default.removeItem(at:directory)}
            let store=NativeSaveStore(directory:directory)
            var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
            seed.progression.firstPlayTutorialComplete=true
            if completed {seed.progression.completedJourneyBoards=[board]}
            try store.save(seed)
            let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store)
            let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
            let previousWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
            window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
            defer {bootstrap.dispose();window.isHidden=true;previousWindow?.makeKeyAndVisible()}
            let app=try XCTUnwrap(host.children.first as? NativeAppController)
            app.navigate(.world((board-1)/10+1),interrupt:true)
            try await waitUntil {app.world?.isReadyForInput == true}
            app.world?.onRequest?("play",board);try await waitUntil {app.route == .gameplay}
            let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController)
            try await waitUntil {game.children.contains{$0 is NativeThemedBoardTransitionController}}
            let transition=try XCTUnwrap(game.children.first{$0 is NativeThemedBoardTransitionController} as? NativeThemedBoardTransitionController)
            let renderer=try XCTUnwrap(game.view.subviews.first{$0 is SKView} as? SKView)
            XCTAssertEqual(transition.board,board);XCTAssertNil(renderer.scene);XCTAssertTrue(renderer.isHidden)
            let before=try XCTUnwrap(store.load()?.journeyRuns[board])
            try await waitUntil {transition.assetsReady}
            try await Task.sleep(for:.milliseconds(800))
            let screenshot=UIGraphicsImageRenderer(bounds:game.view.bounds).image{_ in game.view.drawHierarchy(in:game.view.bounds,afterScreenUpdates:true)}
            let attachment=XCTAttachment(image:screenshot);attachment.name="Native authored board transition \(board), completed=\(completed)";attachment.lifetime = .keepAlways;add(attachment)
            try await waitUntil(timeout:12) {renderer.scene != nil && !game.children.contains{$0 is NativeThemedBoardTransitionController}}
            XCTAssertFalse(renderer.isHidden);XCTAssertFalse(transition.hasActiveClock);XCTAssertFalse(transition.retainsOpaqueCover)
            XCTAssertEqual(try XCTUnwrap(store.load()?.journeyRuns[board]),before)
            XCTAssertFalse(containsWeb(game.view))
        }
    }
    func testTutorialCompletionContinueCommitsOnceAndStartsFreshNativeArcadeRoundOne() async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-bootstrap-tutorial-end-\(UUID().uuidString)")
        defer {try? FileManager.default.removeItem(at:directory)}
        let store=NativeSaveStore(directory:directory)
        var tutorial=NativeTutorialState();tutorial.active=false;tutorial.guideCompleted=true;tutorial.completionAssist=true;tutorial.step = .special
        let tiles=[NativeTile(id:"tutorial-left",cell:.init(column:0,row:0),value:3),NativeTile(id:"tutorial-right",cell:.init(column:1,row:0),value:3)]
        let state=NativeBoardState(tiles:tiles,mode:.arcade,score:123,tutorial:tutorial)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false),arcadeRun:state)
        seed.arcadeRunSavedAt=Date().timeIntervalSince1970;seed.progression.arcadeStats.highScore=777;seed.progression.arcadeStats.longestCombo=8
        try store.save(seed)
        let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store)
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let previousWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
        defer {bootstrap.dispose();window.isHidden=true;previousWindow?.makeKeyAndVisible()}
        let app=try XCTUnwrap(host.children.first as? NativeAppController)
        app.navigate(.gameplay,interrupt:true);try await waitUntil {app.route == .gameplay}
        let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController)
        try await waitUntil(timeout:12) {game.boardScene?.boardGeometry != nil}
        let scene=try XCTUnwrap(game.boardScene),geometry=try XCTUnwrap(scene.boardGeometry)
        let from=geometry.center(row:0,column:0),to=geometry.center(row:0,column:1)
        try await waitUntil {scene.beginDrag(at:from)}
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:100)).accepted)
        try await waitUntil {app.children.contains{$0 is NativeTutorialCompleteController}}
        let cover=try XCTUnwrap(app.children.first{$0 is NativeTutorialCompleteController} as? NativeTutorialCompleteController)
        XCTAssertFalse(try XCTUnwrap(store.load()).progression.firstPlayTutorialComplete)
        XCTAssertNil(game.presentedViewController,"Tutorial must not open Clean Board/New Reward")
        try await waitUntil {cover.phase == .ready};cover.requestContinue();cover.requestContinue()
        try await waitUntil {(try? store.load()?.progression.firstPlayTutorialComplete) == true}
        XCTAssertEqual(game.engine.state.board,1);XCTAssertNil(game.engine.state.tutorial)
        XCTAssertEqual(game.engine.state.score,0);XCTAssertEqual(game.engine.state.wildMeter,0)
        let saved=try XCTUnwrap(store.load())
        XCTAssertEqual(saved.progression.arcadeStats.highScore,0);XCTAssertEqual(saved.progression.arcadeStats.longestCombo,0)
        XCTAssertNil(saved.pendingArcadeRound);XCTAssertNil(saved.arcadeRun?.tutorial)
        XCTAssertFalse(containsWeb(app.view))
    }
    func testJourneyTutorialCompletionReturnsToNativeHomeWithoutRewardOrProgression() async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-bootstrap-tutorial-end-\(UUID().uuidString)")
        defer {try? FileManager.default.removeItem(at:directory)}
        let store=NativeSaveStore(directory:directory)
        var tutorial=NativeTutorialState();tutorial.active=false;tutorial.guideCompleted=true;tutorial.completionAssist=true;tutorial.step = .special
        let tiles=[NativeTile(id:"tutorial-left",cell:.init(column:0,row:0),value:3),NativeTile(id:"tutorial-right",cell:.init(column:1,row:0),value:3)]
        let state=NativeBoardState(tiles:tiles,mode:.journey,score:123,tutorial:tutorial)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false),journeyRuns:[1:state])
        seed.journeyRunSavedAt[1]=Date().timeIntervalSince1970;seed.progression.arcadeStats.highScore=777;seed.progression.arcadeStats.longestCombo=8
        try store.save(seed)
        let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store)
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let previousWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
        defer {bootstrap.dispose();window.isHidden=true;previousWindow?.makeKeyAndVisible()}
        let app=try XCTUnwrap(host.children.first as? NativeAppController)
        app.home.onActivate?(0);try await waitUntil {app.route == .gameplay}
        let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController)
        try await waitUntil(timeout:12) {game.boardScene?.boardGeometry != nil}
        let scene=try XCTUnwrap(game.boardScene),geometry=try XCTUnwrap(scene.boardGeometry)
        let from=geometry.center(row:0,column:0),to=geometry.center(row:0,column:1)
        try await waitUntil {scene.beginDrag(at:from)}
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:100)).accepted)
        try await waitUntil {app.children.contains{$0 is NativeTutorialCompleteController}}
        let cover=try XCTUnwrap(app.children.first{$0 is NativeTutorialCompleteController} as? NativeTutorialCompleteController)
        XCTAssertFalse(try XCTUnwrap(store.load()).progression.firstPlayTutorialComplete)
        XCTAssertNil(game.presentedViewController,"Tutorial must not open Clean Board/New Reward")
        try await waitUntil {cover.phase == .ready};cover.requestContinue();cover.requestContinue()
        try await waitUntil {(try? store.load()?.progression.firstPlayTutorialComplete) == true}
        try await waitUntil {app.route == .home && !app.children.contains{$0 is NativeTutorialCompleteController}}
        XCTAssertEqual(app.home.selectedSlide,0)
        XCTAssertFalse(app.home.isHidden);XCTAssertTrue(app.hub.isHidden)
        XCTAssertFalse(app.children.contains{$0 is NativeGameplayViewController})
        let saved=try XCTUnwrap(store.load())
        XCTAssertNil(saved.journeyRuns[1]);XCTAssertNil(saved.progression.boardStats[1])
        XCTAssertTrue(saved.progression.completedJourneyBoards.isEmpty)
        XCTAssertEqual(saved.progression.arcadeStats.highScore,0)
        XCTAssertFalse(containsWeb(app.view))
    }
    func testFreshArcadeRoundCueFinishesBeforeNativeBoardEntryWithoutChangingSave() async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-bootstrap-round-one-\(UUID().uuidString)")
        defer {try? FileManager.default.removeItem(at:directory)}
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true;try store.save(seed)
        let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store)
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let previousWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
        defer {bootstrap.dispose();window.isHidden=true;previousWindow?.makeKeyAndVisible()}
        let app=try XCTUnwrap(host.children.first as? NativeAppController)
        app.navigate(.gameplay,interrupt:true);try await waitUntil {app.route == .gameplay}
        let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController)
        let renderer=try XCTUnwrap(game.view.subviews.first{$0 is SKView} as? SKView)
        XCTAssertTrue(game.view.subviews.contains{$0 is NativeArcadeRoundPresentation})
        XCTAssertNil(renderer.scene);XCTAssertTrue(renderer.isHidden)
        let before=try XCTUnwrap(store.load()?.arcadeRun)
        try await waitUntil {renderer.scene != nil}
        XCTAssertFalse(renderer.isHidden)
        XCTAssertFalse(game.view.subviews.contains{$0 is NativeArcadeRoundPresentation})
        XCTAssertEqual(try XCTUnwrap(store.load()?.arcadeRun),before)
        XCTAssertFalse(containsWeb(game.view))
    }
    func testInterimJourneyRewardThenFlowerUnlockCommitsBeforeCleanBoard() async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-bootstrap-reward-unlock-\(UUID().uuidString)")
        defer {try? FileManager.default.removeItem(at:directory)}
        let store=NativeSaveStore(directory:directory)
        let tiles=[NativeTile(id:"left",cell:.init(column:0,row:0),value:3),NativeTile(id:"right",cell:.init(column:1,row:0),value:3)]
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false),journeyRuns:[2:NativeBoardState(tiles:tiles,mode:.journey,board:2,score:123)])
        seed.progression.firstPlayTutorialComplete=true;seed.progression.completedJourneyBoards=[1]
        seed.journeyRunSavedAt[2]=Date().timeIntervalSince1970;try store.save(seed)
        let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store)
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let previousWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
        defer {bootstrap.dispose();window.isHidden=true;previousWindow?.makeKeyAndVisible()}
        let app=try XCTUnwrap(host.children.first as? NativeAppController)
        app.navigate(.world(1),interrupt:true)
        do {try await waitUntil {
            app.world?.isReadyForInput == true
        }} catch {
            func labels(_ view:UIView)->[String] {(view as? UILabel)?.text.map{[$0]} ?? view.subviews.flatMap(labels)}
            XCTFail("Native world admission route=\(app.route) text=\(labels(app.view))");throw error
        }
        XCTAssertEqual(app.route,.world(1))
        app.world?.onRequest?("play",2);try await waitUntil {app.route == .gameplay}
        let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController)
        try await waitUntil(timeout:12) {game.boardScene?.boardGeometry != nil}
        let scene=try XCTUnwrap(game.boardScene),geometry=try XCTUnwrap(scene.boardGeometry)
        try await waitUntil {scene.beginDrag(at:geometry.center(row:0,column:0))}
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:geometry.center(row:0,column:1),now:100)).accepted)
        try await waitUntil {game.presentedViewController is NativeJourneyRewardController}
        let reward=try XCTUnwrap(game.presentedViewController as? NativeJourneyRewardController)
        var saved=try XCTUnwrap(store.load())
        XCTAssertTrue(saved.progression.completedJourneyBoards.contains(2));XCTAssertNil(saved.journeyRuns[2])
        XCTAssertFalse(saved.progression.unlockedSpecialDice.contains("flower"))
        try await waitUntil {reward.phase == "interim"};reward.activate();reward.activate()
        try await waitUntil {game.presentedViewController is NativeSpecialDiceUnlockController}
        let unlock=try XCTUnwrap(game.presentedViewController as? NativeSpecialDiceUnlockController)
        XCTAssertFalse(try XCTUnwrap(store.load()).progression.unlockedSpecialDice.contains("flower"))
        try await waitUntil {unlock.phase == "ready"};unlock.activateHero()
        try await waitUntil {unlock.phase == "unlocked"}
        saved=try XCTUnwrap(store.load());XCTAssertTrue(saved.progression.unlockedSpecialDice.contains("flower"))
        XCTAssertFalse(game.presentedViewController is NativeResultController)
        unlock.activateContinue();unlock.activateContinue()
        try await waitUntil {game.presentedViewController is NativeResultController}
        XCTAssertEqual(try XCTUnwrap(store.load()).progression.unlockedSpecialDice,["flower"])
        XCTAssertEqual(try XCTUnwrap(store.load()).progression.boardStats[2],saved.progression.boardStats[2])
        XCTAssertFalse(containsWeb(app.view))
        let result=try XCTUnwrap(game.presentedViewController as? NativeResultController)
        let carriedScore=result.finalScore,previousGeneration=game.engine.state.generation
        try await waitUntil(timeout:12) {self.button(in:result.view,id:"native.result.play-again")?.isUserInteractionEnabled == true}
        let next=try XCTUnwrap(button(in:result.view,id:"native.result.play-again"));next.sendActions(for:.touchUpInside);next.sendActions(for:.touchUpInside)
        try await waitUntil {game.children.contains{$0 is NativeThemedBoardTransitionController}}
        let transition=try XCTUnwrap(game.children.first{$0 is NativeThemedBoardTransitionController} as? NativeThemedBoardTransitionController)
        XCTAssertEqual(transition.board,3);XCTAssertEqual(game.engine.state.generation,previousGeneration+1)
        XCTAssertEqual(game.engine.state.score,carriedScore);XCTAssertEqual(try XCTUnwrap(store.load()?.journeyRuns[3]).score,carriedScore)
        let firstCell=try XCTUnwrap(game.engine.state.tiles.first?.cell)
        let nextGeometry=try XCTUnwrap(scene.boardGeometry)
        XCTAssertFalse(scene.beginDrag(at:nextGeometry.center(row:firstCell.row,column:firstCell.column)))
        try await waitUntil(timeout:12) {!game.children.contains{$0 is NativeThemedBoardTransitionController}}
        XCTAssertFalse(transition.hasActiveClock);XCTAssertEqual(game.engine.state.score,carriedScore)
        XCTAssertEqual(try XCTUnwrap(store.load()).progression.boardStats[2],saved.progression.boardStats[2])
    }
    func testForcedFirstPlayIgnoresOldArcadeAndPreservesTutorialUntilAcknowledged() async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-bootstrap-tutorial-\(UUID().uuidString)")
        defer {try? FileManager.default.removeItem(at:directory)}
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false),arcadeRun:NativeBoardFactory.make(mode:.arcade,board:8))
        seed.pendingArcadeRound = .init(round:9,score:999,ownerID:"old-round")
        try store.save(seed)
        let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store)
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let previousWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
        defer {bootstrap.dispose();window.isHidden=true;previousWindow?.makeKeyAndVisible()}
        let app=try XCTUnwrap(host.children.first as? NativeAppController)
        app.navigate(.gameplay,interrupt:true);try await waitUntil {app.route == .gameplay}
        let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController)
        XCTAssertEqual(game.engine.state.board,1);XCTAssertEqual(game.engine.state.tutorial?.step,.stack)
        let saved=try XCTUnwrap(store.load())
        XCTAssertFalse(saved.progression.firstPlayTutorialComplete)
        XCTAssertEqual(saved.pendingArcadeRound?.round,9)
        XCTAssertEqual(saved.arcadeRun?.tutorial?.step,.stack)
    }
    func testFreshNativeProfileStartsWithoutWebAndArcadeSaveRemainsModeScoped() async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-bootstrap-\(UUID().uuidString)")
        defer {try? FileManager.default.removeItem(at:directory)}
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        try store.save(seed)
        let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store)
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let previousWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
        defer {bootstrap.dispose();window.isHidden=true;previousWindow?.makeKeyAndVisible()}
        let app=try XCTUnwrap(host.children.first as? NativeAppController)
        XCTAssertFalse(containsWeb(app.view));XCTAssertEqual(app.route,.home)
        app.navigate(.gameplay,interrupt:true)
        try await waitUntil {app.route == .gameplay}
        let gameplay=try XCTUnwrap(app.children.first as? NativeGameplayViewController)
        XCTAssertEqual(gameplay.engine.state.mode,.arcade)
        XCTAssertFalse(containsWeb(gameplay.view))
        let saved=try XCTUnwrap(store.load())
        XCTAssertNotNil(saved.arcadeRun);XCTAssertTrue(saved.journeyRuns.isEmpty)
        XCTAssertTrue(saved.progression.completedJourneyBoards.isEmpty)
        XCTAssertEqual(saved.arcadeRun?.signature,gameplay.engine.state.signature)
    }
    func testPendingArcadeReceiptSupersedesOlderSavedRoundOnNativeEntry() async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-bootstrap-pending-\(UUID().uuidString)")
        defer {try? FileManager.default.removeItem(at:directory)}
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false),arcadeRun:NativeBoardFactory.make(mode:.arcade,board:1))
        seed.progression.firstPlayTutorialComplete=true
        seed.pendingArcadeRound = .init(round:3,score:345,ownerID:"accepted-round")
        try store.save(seed)
        let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store)
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let previousWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
        defer {bootstrap.dispose();window.isHidden=true;previousWindow?.makeKeyAndVisible()}
        let app=try XCTUnwrap(host.children.first as? NativeAppController)
        app.navigate(.gameplay,interrupt:true);try await waitUntil {app.route == .gameplay}
        let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController)
        XCTAssertEqual(game.engine.state.board,3);XCTAssertEqual(game.engine.state.score,345)
        XCTAssertEqual(game.engine.state.wildMeter,0.25)
        let saved=try XCTUnwrap(store.load());XCTAssertNil(saved.pendingArcadeRound)
        XCTAssertEqual(saved.arcadeRun?.board,3);XCTAssertEqual(saved.arcadeRun?.score,345)
        XCTAssertEqual(saved.progression.arcadeStats.highestStageOpened,3)
    }
    func testLifecyclePauseRetainsLastSafeSaveAndResumesCapturedWildTransaction() async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-source-pause-save-\(UUID().uuidString)")
        defer {try? FileManager.default.removeItem(at:directory)}
        let store=NativeSaveStore(directory:directory)
        let tiles=[NativeTile(id:"star",cell:.init(column:0,row:0),value:6,archetype:.star),NativeTile(id:"five",cell:.init(column:1,row:0),value:5),NativeTile(id:"one-a",cell:.init(column:2,row:0),value:1),NativeTile(id:"one-b",cell:.init(column:3,row:0),value:1),NativeTile(id:"survivor",cell:.init(column:4,row:0),value:2)]
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false),arcadeRun:NativeBoardState(tiles:tiles,mode:.arcade,board:1,score:37,rngState:12345))
        seed.progression.firstPlayTutorialComplete=true;seed.arcadeRunSavedAt=Date().timeIntervalSince1970;try store.save(seed)
        let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store)
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let previousWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
        defer {bootstrap.dispose();window.isHidden=true;previousWindow?.makeKeyAndVisible()}
        let app=try XCTUnwrap(host.children.first as? NativeAppController)
        app.navigate(.gameplay,interrupt:true)
        try await waitUntil {app.children.contains {$0 is NativeGameplayViewController}}
        let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController)
        try await waitUntil(timeout:12) {game.boardScene?.boardGeometry != nil}
        let scene=try XCTUnwrap(game.boardScene),geometry=try XCTUnwrap(scene.boardGeometry)
        try await waitUntil {scene.beginDrag(at:geometry.center(row:0,column:0))}
        let durable=try XCTUnwrap(store.load()?.arcadeRun)
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:geometry.center(row:0,column:1),now:100)).accepted)
        let captured=try XCTUnwrap(game.engine.pendingDirectWild)
        game.setSuspended(true)
        let paused=game.engine.state
        XCTAssertTrue(game.engine.hasUnsavableSourceGameplayState)
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        try await Task.sleep(for:.milliseconds(200))
        XCTAssertEqual(game.engine.state,paused)
        XCTAssertEqual(game.engine.pendingDirectWild?.id,captured.id)
        XCTAssertEqual(try XCTUnwrap(store.load()?.arcadeRun),durable)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        game.setSuspended(false)
        do {try await waitUntil(timeout:12) {!game.engine.hasUnsavableSourceGameplayState && game.engine.state.moves == paused.moves-1}}
        catch {
            print("[SOURCE_PAUSE_SAVE_DIAGNOSTIC] scenePaused=\(scene.isPaused) viewPaused=\(String(describing:scene.view?.isPaused)) moves=\(game.engine.state.moves) pausedMoves=\(paused.moves) flags=\(game.engine.flags) direct=\(String(describing:game.engine.pendingDirectWild)) presentations=\(game.engine.pendingWildSpawnPresentations) runtime=\(game.engine.sourceSaveRuntime) tiles=\(game.engine.state.tiles)")
            throw error
        }
        game.setSuspended(true)
        let settled=game.engine.state
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        try await Task.sleep(for:.milliseconds(100))
        XCTAssertEqual(game.engine.state,settled)
        XCTAssertEqual(try XCTUnwrap(store.load()?.arcadeRun),settled)
    }
    private func waitUntil(file:StaticString=#filePath,line:UInt=#line,timeout:TimeInterval=5,_ predicate:()->Bool) async throws {
        let deadline=Date().addingTimeInterval(timeout)
        while Date()<deadline {if predicate(){return};try await Task.sleep(for:.milliseconds(50))}
        XCTFail("Native route did not become ready within its bounded resource window",file:file,line:line)
        throw NSError(domain:"NativeQARouteTimeout",code:1)
    }
    private func containsWeb(_ view:UIView)->Bool {
        NSStringFromClass(type(of:view)).contains("WKWebView") || view.subviews.contains(where:self.containsWeb)
    }
    private func button(in view:UIView,id:String)->UIButton? {
        if let button=view as? UIButton,button.accessibilityIdentifier==id {return button}
        return view.subviews.lazy.compactMap{self.button(in:$0,id:id)}.first
    }
}
