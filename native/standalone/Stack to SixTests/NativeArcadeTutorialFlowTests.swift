import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativeArcadeTutorialFlowTests:XCTestCase {
    private func wait(_ label:String,_ condition:()->Bool)async throws {
        let end=Date().addingTimeInterval(35)
        while !condition() {
            guard Date()<end else{XCTFail(label);throw CancellationError()}
            try await Task.sleep(for:.milliseconds(10))
        }
    }
    private func all(_ view:UIView)->[UIView]{[view]+view.subviews.flatMap(all)}
    private func completedGuide()->NativeTutorialState {
        var t=NativeTutorialState();t.active=false;t.guideCompleted=true;t.completionAssist=true;t.step = .freePlay
        t.objectiveAcknowledged=true;t.encouragementAcknowledged=true;t.collectionLessonAcknowledged=true
        t.comboLessonAcknowledged=true;t.completionLessonAcknowledged=true;t.comboHUDRevealed=true
        return t
    }
    func testRestoredRoundIndicatorWaitsForGlobalTutorialCompletion()async throws {
        for globallyComplete in [false,true] {for boardDone in [false,true] {
            let directory=FileManager.default.temporaryDirectory.appendingPathComponent("tutorial-round-gate-"+UUID().uuidString)
            let store=NativeSaveStore(directory:directory)
            var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
            seed.progression.firstPlayTutorialComplete=globallyComplete
            var tutorial=completedGuide();tutorial.done=boardDone
            var checkpoint=NativeBoardFactory.make(mode:.arcade,board:1,generation:8,seed:4)
            checkpoint.tutorial=tutorial;checkpoint.score=123
            if globallyComplete {seed.arcadeRun=checkpoint;seed.arcadeRunSavedAt=Date().timeIntervalSince1970}
            else {seed.firstPlayRun=checkpoint}
            try store.save(seed)
            let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false)
            let host=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
            let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
            window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
            defer{bootstrap.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
            let app=try XCTUnwrap(host.children.first as? NativeAppController)
            app.navigate(.gameplay,interrupt:true)
            try await wait("Restored Arcade entry"){app.children.compactMap{$0 as? NativeGameplayViewController}.first?.boardScene?.isBoardEntryComplete==true}
            let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController),scene=try XCTUnwrap(game.boardScene)
            let indicator=try XCTUnwrap(scene.childNode(withName:"//native-game-round-indicator"))
            XCTAssertEqual(game.engine.state.score,123,"Resume preserves the checkpoint")
            scene.synchronize();scene.didFinishUpdate()
            XCTAssertEqual(indicator.isHidden,!globallyComplete || game.engine.state.tutorial?.shouldLockHUD == true,"Global completion \(globallyComplete), local done \(boardDone)")
            NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
            NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
            scene.didFinishUpdate()
            XCTAssertEqual(indicator.isHidden,!globallyComplete || game.engine.state.tutorial?.shouldLockHUD == true,"Foreground cannot reveal a tutorial round")
        }}
    }
    func testNormalArcadeClearKeepsAutomaticRoundEvenWithLegacyTutorialMetadata() {
        let state=NativeBoardState(tiles:[],mode:.arcade,tutorial:completedGuide())
        let ordinary=NativeResultController(root:NativeTestResources.root,state:state,clean:true,combo:0,efficiency:0,finalScore:123)
        ordinary.loadViewIfNeeded()
        XCTAssertTrue(ordinary.view.subviews.contains{$0 is NativeArcadeRoundPresentation})
        ordinary.dispose()
        let practice=NativeResultController(root:NativeTestResources.root,state:state,clean:true,combo:0,efficiency:0,finalScore:123,tutorialArcadeCompletion:true)
        practice.loadViewIfNeeded()
        XCTAssertFalse(practice.view.subviews.contains{$0 is NativeArcadeRoundPresentation})
        XCTAssertTrue(all(practice.view).compactMap{$0 as? UIButton}.contains{$0.title(for:.normal)=="Continue"})
        practice.dispose()
    }
    func testOrdinaryArcadeClearedContactKeepsCelebrationAfterTutorialCompletion()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("normal-arcade-clear-audio-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:true,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        var run=NativeBoardFactory.make(mode:.arcade,board:2,generation:8,seed:4)
        run.tutorial=completedGuide() // Legacy metadata cannot suppress a real round.
        seed.arcadeRun=run;seed.arcadeRunSavedAt=Date().timeIntervalSince1970
        try store.save(seed)
        let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let host=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
        defer{bootstrap.dispose();window.rootViewController=nil;window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        let app=try XCTUnwrap(host.children.first as? NativeAppController)
        app.navigate(.gameplay,interrupt:true)
        try await wait("Ordinary Arcade ready"){app.children.compactMap{$0 as? NativeGameplayViewController}.first?.boardScene?.isBoardEntryComplete==true}
        let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController)
        let audio=try XCTUnwrap(Mirror(reflecting:bootstrap).descendant("audio") as? NativeGameplayAudioOwner)
        try XCTUnwrap(game.onRoundWon)(game.engine.state.generation)
        XCTAssertEqual(audio.activeRoundWonTailCount,1)
        XCTAssertEqual(audio.activeArcadeCelebrationCount,1,"Ordinary rounds retain their authored victory package")
    }
    func testEverySelectionUsesEnduranceForFreshAndLegacyPracticeButKeepsNormalRules()async throws {
        for variant in NativeArcadeVariant.allCases {for scenario in ["fresh","legacy","normal"] {
            let directory=FileManager.default.temporaryDirectory.appendingPathComponent("tutorial-arcade-rules-"+UUID().uuidString)
            let store=NativeSaveStore(directory:directory)
            var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
            seed.activeArcadeVariant=variant
            var real=NativeBoardFactory.make(mode:.arcade,board:3,generation:12,seed:17,arcadeVariant:variant)
            real.moves=37;real.score=777;seed.arcadeRun=real;seed.arcadeRunSavedAt=Date().timeIntervalSince1970
            if scenario=="normal" {seed.progression.firstPlayTutorialComplete=true}
            if scenario=="legacy" {
                var practice=NativeBoardFactory.make(mode:.arcade,board:1,generation:8,seed:4,arcadeVariant:variant)
                practice.tutorial=completedGuide();practice.moves=36;practice.score=123;seed.firstPlayRun=practice
            }
            try store.save(seed)
            let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false)
            let host=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
            let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
            window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
            defer{bootstrap.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
            let app=try XCTUnwrap(host.children.first as? NativeAppController)
            app.navigate(.gameplay,interrupt:true)
            try await wait("Arcade \(variant) \(scenario)"){app.route == .gameplay && app.children.contains{$0 is NativeGameplayViewController}}
            let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController)
            XCTAssertEqual(game.engine.state.effectiveArcadeVariant,scenario=="normal" ? variant:.endurance)
            XCTAssertEqual(game.engine.state.tutorial == nil,scenario=="normal")
            let saved=try XCTUnwrap(store.load())
            XCTAssertEqual(saved.activeArcadeVariant,variant,"Practice cannot change the selected real variant")
            if scenario != "normal" {XCTAssertEqual(saved.arcadeRun,real,"Practice cannot replace an existing real run: \(variant) \(scenario)")}
            else {XCTAssertEqual(game.engine.state.board,3);XCTAssertEqual(game.engine.state.score,777)}
            XCTAssertEqual(saved.progression.arcadeStats,seed.progression.arcadeStats)
            XCTAssertEqual(saved.progression.arcadeVariantStats,seed.progression.arcadeVariantStats)
            if scenario=="legacy" {XCTAssertEqual(game.engine.state.score,123);XCTAssertEqual(game.engine.state.moves,36)}
            if scenario != "normal" {XCTAssertEqual(saved.firstPlayRun?.effectiveArcadeVariant,.endurance)}
        }}
    }
    func testActualSourceTutorialCleanBoardContinueReturnsToArcadeAndFarewell()async throws {try await sourceCleanBoard(buttonID:"native.result.play-again",variant:.pureDice)}
    func testActualSourceTutorialCleanBoardExitReturnsToArcadeAndFarewell()async throws {try await sourceCleanBoard(buttonID:"native.result.exit",variant:.slowBurn)}
    func testArcadeExitBeforeCleanBoardKeepsGuideWithoutFarewell()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("tutorial-arcade-early-exit-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.activeArcadeVariant = .pureDice
        seed.firstPlayRun = .init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1),.init(id:"b",cell:.init(column:1,row:0),value:2)],mode:.arcade,tutorial:completedGuide(),arcadeVariant:.pureDice)
        try store.save(seed)
        let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false)
        let host=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
        defer{bootstrap.dispose();window.rootViewController=nil;window.isHidden=true;try? FileManager.default.removeItem(at:directory)}
        let app=try XCTUnwrap(host.children.first as? NativeAppController)
        app.navigate(.gameplay,interrupt:true)
        try await wait("Practice restored"){app.children.compactMap{$0 as? NativeGameplayViewController}.first?.boardScene?.isBoardEntryComplete==true}
        let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController)
        game.onExit?()
        try await wait("Exit menu"){game.presentedViewController is JimiNativeEndRunModal}
        let modal=try XCTUnwrap(game.presentedViewController as? JimiNativeEndRunModal)
        try await wait("Exit ready"){modal.view.isUserInteractionEnabled && modal.buttons[1].isUserInteractionEnabled}
        XCTAssertTrue(all(modal.view).compactMap{$0 as? UILabel}.contains{$0.text?.contains("Tutorial progress saved")==true})
        XCTAssertFalse(all(modal.view).compactMap{$0 as? UILabel}.contains{$0.text?.contains("Round ")==true})
        modal.buttons[1].sendActions(for:.touchUpInside)
        try await wait("Arcade selection"){app.route == .arcadeHub && !app.transitioning}
        XCTAssertNil(app.tutorialFarewell)
        let saved=try XCTUnwrap(store.load())
        XCTAssertFalse(saved.progression.firstPlayTutorialComplete);XCTAssertFalse(saved.progression.tutorialFarewellPending)
        XCTAssertNotNil(saved.firstPlayRun);XCTAssertEqual(saved.activeArcadeVariant,.pureDice)
        XCTAssertNil(saved.arcadeRun);XCTAssertNil(saved.pendingArcadeRound)
    }
    private func sourceCleanBoard(buttonID:String,variant:NativeArcadeVariant)async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("tutorial-arcade-clean-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.activeArcadeVariant=variant
        var practice=NativeBoardState(tiles:[.init(id:"five",cell:.init(column:0,row:0),value:5),.init(id:"one",cell:.init(column:1,row:0),value:1)],mode:.arcade,score:123,tutorial:completedGuide(),arcadeVariant:variant)
        practice.moves=37;seed.firstPlayRun=practice
        // Existing real slots and a different pending round must survive practice.
        var real=NativeBoardFactory.make(mode:.arcade,board:4,generation:12,seed:11,arcadeVariant:variant)
        real.moves=37;real.score=777;seed.arcadeRun=real;seed.arcadeRunSavedAt=Date().timeIntervalSince1970
        seed.arcadeVariantPendingRounds[(variant == .pureDice ? NativeArcadeVariant.slowBurn: .pureDice).rawValue] = .init(round:8,score:333)
        try store.save(seed)
        var host:NativeStandaloneViewController?=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host?.dispose();window.rootViewController=nil;window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host?.loadViewIfNeeded();let app=try XCTUnwrap(host?.children.first as? NativeAppController)
        try await wait("Home ready"){!app.home.isHidden && app.home.isUserInteractionEnabled}
        app.navigate(.gameplay,interrupt:true)
        var sawNumberedEntry=false
        try await wait("Practice Source restored"){
            let entering=app.children.compactMap{$0 as? NativeGameplayViewController}.first
            if entering?.view.subviews.contains(where:{$0 is NativeArcadeRoundPresentation})==true {sawNumberedEntry=true}
            return entering?.boardScene?.isBoardEntryComplete==true
        }
        XCTAssertFalse(sawNumberedEntry,"Restored tutorial cannot announce Round01 before global completion")
        let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController),scene=try XCTUnwrap(game.boardScene)
        let bootstrap=try XCTUnwrap(Mirror(reflecting:try XCTUnwrap(host)).descendant("bootstrap") as? NativeBootstrap)
        let audio=try XCTUnwrap(Mirror(reflecting:bootstrap).descendant("audio") as? NativeGameplayAudioOwner)
        audio.setEnabled(true)
        let clearedContact=game.onRoundWon
        var clearedContacts=0
        game.onRoundWon={generation in
            clearedContact?(generation);clearedContacts += 1
            XCTAssertEqual(audio.activeRoundWonTailCount,1,"Tutorial keeps Journey's spoken CLEARED line")
            XCTAssertEqual(audio.activeArcadeCelebrationCount,0,"Only the Arcade tutorial skips the victory music/applause package")
        }
        XCTAssertNotNil(game.sourceInitialConstruction);XCTAssertEqual(game.engine.state.effectiveArcadeVariant,.endurance)
        let a=try XCTUnwrap(scene.sourceNativeTileNode("five")),b=try XCTUnwrap(scene.sourceNativeTileNode("one"))
        let from=scene.convert(a.position,from:try XCTUnwrap(a.parent)),to=scene.convert(b.position,from:try XCTUnwrap(b.parent))
        try await wait("Practice drag admitted"){scene.beginDrag(at:from)}
        scene.moveDrag(to:to,now:CACurrentMediaTime())
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        try await wait("Practice CLEARED before result"){game.view.subviews.contains{$0 is NativeArcadeRoundPresentation}}
        XCTAssertNil(game.presentedViewController,"CLEARED leads into Clean Board")
        XCTAssertTrue(game.hasPresentedBoardCleared)
        let celebration=try XCTUnwrap(game.view.subviews.compactMap{$0 as? NativeArcadeRoundPresentation}.first)
        XCTAssertTrue(["assets/puppy thumbs up@2x.png","assets/thumbs-up@2x.png"].contains(celebration.thumbAssetPath))
        try await wait("CLEARED painted"){celebration.elapsed>=1.2}
        XCTAssertEqual(clearedContacts,1)
        let preview=UIGraphicsImageRenderer(bounds:window.bounds).image{_ in window.drawHierarchy(in:window.bounds,afterScreenUpdates:true)}
        try preview.pngData()?.write(to:URL(fileURLWithPath:"/tmp/tutorial-arcade-cleared-\(variant.rawValue).png"))
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        let paused=celebration.elapsed
        try await Task.sleep(for:.milliseconds(80))
        XCTAssertEqual(celebration.elapsed,paused,"Background pauses the same finite celebration")
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)

        var sawHUDExit=false
        try await wait("Actual practice Clean Board: "+scene.sourceLevelEndDiagnostic()){
            if scene.childNode(withName:"//native-game-hud")?.action(forKey:"hud-exit") != nil {sawHUDExit=true}
            return game.presentedViewController is NativeResultController
        }
        XCTAssertTrue(sawHUDExit,"Tutorial reuses the finite Journey HUD animation while CLEARED is painted")
        let result=try XCTUnwrap(game.presentedViewController as? NativeResultController)
        let hud=try XCTUnwrap(scene.childNode(withName:"//native-game-hud"))
        XCTAssertNil(hud.action(forKey:"hud-exit"),"Clean Board waits for the same finite Journey HUD exit")
        let hudGroups=hud.children.filter{$0.name?.hasPrefix("preload-navigation-hud-")==true}
        if hudGroups.isEmpty {XCTAssertEqual(hud.alpha,0,accuracy:0.001)}
        else {for group in hudGroups {XCTAssertEqual(group.alpha,0,accuracy:0.001,"Tutorial HUD groups must leave before Clean Board")}}
        XCTAssertTrue(result.clean);XCTAssertEqual(game.engine.state.terminal?.kind,.complete)
        XCTAssertTrue(all(result.view).compactMap{$0 as? UILabel}.contains{$0.text=="Tutorial cleared"})
        XCTAssertFalse(all(result.view).compactMap{$0 as? UILabel}.contains{$0.text?.contains("Round ")==true})
        XCTAssertTrue(all(result.view).compactMap{$0 as? UILabel}.contains{$0.text=="Your score"})
        XCTAssertFalse(result.view.subviews.contains{$0 is NativeArcadeRoundPresentation})
        XCTAssertNil(app.tutorialFarewell,"Farewell belongs to selection after the result action")
        XCTAssertFalse(app.children.contains{$0 is NativeTutorialCompleteController})
        for frame in 0...660 {result.tick(Double(frame)/60)}
        let button=try XCTUnwrap(all(result.view).compactMap{$0 as? UIButton}.first{$0.accessibilityIdentifier==buttonID})
        XCTAssertEqual(button.title(for:.normal),buttonID.hasSuffix("exit") ? "Exit":"Continue")
        let cleanShot=UIGraphicsImageRenderer(bounds:result.view.bounds).image{_ in result.view.drawHierarchy(in:result.view.bounds,afterScreenUpdates:true)}
        try cleanShot.pngData()?.write(to:URL(fileURLWithPath:"/tmp/arcade-tutorial-clean-\(variant.rawValue).png"))
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        button.sendActions(for:.touchUpInside)
        XCTAssertEqual(app.route,.gameplay,"A background result cannot act")
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        button.sendActions(for:.touchUpInside);button.sendActions(for:.touchUpInside)
        try await wait("Arcade selection then high-five"){app.route == .arcadeHub && app.tutorialFarewell != nil}
        XCTAssertNil(game.parent);XCTAssertEqual(game.engine.state.board,1)
        let saved=try XCTUnwrap(store.load())
        XCTAssertTrue(saved.progression.firstPlayTutorialComplete);XCTAssertNil(saved.firstPlayRun)
        XCTAssertEqual(saved.activeArcadeVariant,variant);XCTAssertEqual(saved.arcadeRun,real)
        XCTAssertEqual(saved.pendingArcadeRound,seed.pendingArcadeRound)
        XCTAssertEqual(saved.arcadeVariantPendingRounds,seed.arcadeVariantPendingRounds)
        XCTAssertEqual(saved.progression.arcadeStats,seed.progression.arcadeStats)
        XCTAssertEqual(saved.progression.arcadeVariantStats,seed.progression.arcadeVariantStats)
        let farewell=try XCTUnwrap(app.tutorialFarewell)
        farewell.onGotIt?();farewell.onGotIt?()
        try await wait("Acknowledged high-five closes"){app.tutorialFarewell==nil}
        XCTAssertFalse(try XCTUnwrap(store.load()).progression.tutorialFarewellPending)
        XCTAssertEqual(app.route,.arcadeHub)
        // The next deliberate entry resumes the selected real rules and run.
        app.navigate(.gameplay,interrupt:true)
        try await wait("Normal selected variant after practice"){
            app.children.compactMap{$0 as? NativeGameplayViewController}.first?.boardScene?.isBoardEntryComplete==true
        }
        let normal=try XCTUnwrap(app.children.first as? NativeGameplayViewController)
        XCTAssertNil(normal.engine.state.tutorial)
        XCTAssertEqual(normal.engine.state.effectiveArcadeVariant,variant)
        XCTAssertEqual(normal.engine.state.board,4);XCTAssertEqual(normal.engine.state.score,777)
        XCTAssertNil(app.tutorialFarewell)
        host?.dispose();window.rootViewController=nil;host=nil
    }
}
