import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class NativeArcadeNavigationTests: XCTestCase {
    private enum Unused:Error { case unavailable }
    private func services(make:@escaping(Int?,@escaping()->Void)throws->UIViewController)->NativeAppServices {
        NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw Unused.unavailable},markViewed:{_ in},makeGameplay:make,flush:{})
    }
    private func mount(_ services:NativeAppServices)->(NativeAppController,UIWindow) {
        let root=NativeAppController(resourceRoot:NativeTestResources.root,services:services)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=root;window.makeKeyAndVisible()
        return(root,window)
    }
    private func waitFor(_ predicate:()->Bool)async throws {
        let end=Date().addingTimeInterval(6)
        while !predicate(),Date()<end {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(predicate())
    }
    func testVariantSelectedBeforePreparationAndGameplayReturnsToArcadeHub()async throws {
        for variant in NativeArcadeVariant.allCases {
            var events:[String]=[],returnToHub:(()->Void)?
            var source=services { board,finished in
                XCTAssertNil(board);events.append("make");returnToHub=finished;return UIViewController()
            }
            source.selectArcadeVariant={selected in XCTAssertEqual(selected,variant);events.append("select")}
            source.prepareGameplayEntry={board,ready in XCTAssertNil(board);events.append("prepare");ready(true)}
            let(root,window)=mount(source)
            defer{root.dispose();window.isHidden=true}
            root.navigate(.arcadeHub,interrupt:true)
            try await waitFor{root.route == .arcadeHub && root.arcadeHub.hub.scrollView.isUserInteractionEnabled}
            root.arcadeHub.onPlay?(variant.rawValue)
            try await waitFor{root.route == .gameplay}
            XCTAssertEqual(events,["select","prepare","make"])
            returnToHub?()
            try await waitFor{root.route == .arcadeHub && root.arcadeHub.hub.scrollView.isUserInteractionEnabled}
            XCTAssertFalse(root.arcadeHub.isHidden)
        }
    }
    func testRequiredTutorialRetainsSelectedArcadeMode() async throws {
        for variant in NativeArcadeVariant.allCases {
            let expectedBoard: Int? = nil
            var events: [String] = []
            var selectedVariant: NativeArcadeVariant?
            var source = services { board, _ in
                XCTAssertEqual(board, expectedBoard)
                XCTAssertEqual(selectedVariant, variant)
                events.append("make")
                return UIViewController()
            }
            source.requiresTutorial = { true }
            source.selectArcadeVariant = { selectedVariant = $0; events.append("select") }
            source.prepareGameplayEntry = { board, ready in
                XCTAssertEqual(board, expectedBoard)
                events.append("prepare"); ready(true)
            }
            let (root, window) = mount(source)
            defer { root.dispose(); window.isHidden = true }
            root.navigate(.arcadeHub, interrupt: true)
            try await waitFor { root.route == .arcadeHub && root.arcadeHub.hub.scrollView.isUserInteractionEnabled }
            root.arcadeHub.onPlay?(variant.rawValue)
            try await waitFor { root.route == .gameplay }
            XCTAssertEqual(events, ["select", "prepare", "make"])
            XCTAssertEqual(selectedVariant, variant)
        }
    }
    func testBackgroundRejectsLateArcadePreparationAndRestoresHub()async throws {
        var replies:[(Bool)->Void]=[],made=0,selected=0
        var source=services{_,_ in made += 1;return UIViewController()}
        source.selectArcadeVariant={_ in selected += 1}
        source.prepareGameplayEntry={_,ready in replies.append(ready)}
        let(root,window)=mount(source)
        defer{root.dispose();window.isHidden=true}
        root.navigate(.arcadeHub,interrupt:true)
        try await waitFor{root.route == .arcadeHub && root.arcadeHub.hub.scrollView.isUserInteractionEnabled}
        root.arcadeHub.onPlay?(NativeArcadeVariant.slowBurn.rawValue)
        try await waitFor{replies.count==1}
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        replies[0](true)
        root.arcadeHub.onPlay?(NativeArcadeVariant.pureDice.rawValue)
        XCTAssertEqual(selected,1);XCTAssertEqual(made,0)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        try await waitFor{root.route == .arcadeHub && root.arcadeHub.hub.scrollView.isUserInteractionEnabled}
        replies[0](true);XCTAssertEqual(made,0)
    }
    func testActiveGuideResumeRetainsSelectedWorldRewardAndBoard()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("contextual-resume-\(UUID())")
        let store=NativeSaveStore(directory:directory)
        let engine=NativeGameplayEngine(state:NativeBoardFactory.make(mode:.journey,board:11,tutorial:true))
        XCTAssertTrue(engine.startTutorial().accepted);engine.configureTutorialReward(.init(.juice))
        var envelope=NativeSaveEnvelope();envelope.firstPlayRun=engine.state;try store.save(envelope)
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=tasks
        let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,sourceMicrotaskTasks:tasks)
        var wall=0.0
        func waitActive(_ predicate:()->Bool)async throws {
            let deadline=Date().addingTimeInterval(10)
            var accepted=predicate()
            while !accepted,Date()<deadline {wall+=16;service.deliver(wallMilliseconds:wall);try await Task.sleep(for:.milliseconds(20));accepted=predicate()}
            XCTAssertTrue(accepted)
        }
        let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false,sourceContext:context)
        bootstrap.sourceInitialFreshStartupEnabled=true;bootstrap.sourceBoardEntryEnabled=true
        bootstrap.sourceInitialRegularResumeEnabled=true;bootstrap.sourceInitialWildResumeEnabled=true
        bootstrap.sourceOrdinaryPresentationEnabled=true;bootstrap.sourceFreshOrdinaryPresentationEnabled=true
        bootstrap.sourceRestoredOrdinaryPresentationEnabled=true;bootstrap.sourceDirectPresentationEnabled=true
        bootstrap.sourceSpecialIdlePresentationEnabled=true;bootstrap.sourceLogicalMathRandomEnabled=true
        bootstrap.sourceTutorialEarnedMeterEnabled=true;bootstrap.sourceMagnetPresentationEnabled=true
        bootstrap.sourceOrdinaryEndgamePresentationEnabled=true;bootstrap.sourceTntPresentationEnabled=true
        bootstrap.completeNativeGameplayEnabled=true;bootstrap.sourceCanonicalGameplaySaveEnabled=true
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
        defer{bootstrap.dispose();context.dispose();service.dispose();window.isHidden=true;try? FileManager.default.removeItem(at:directory)}
        let app=try XCTUnwrap(host.children.first as? NativeAppController)
        // Even another entry point returns to the saved first-play destination.
        app.navigate(.gameplay,interrupt:true)
        try await waitActive{app.children.contains{$0 is NativeGameplayViewController}}
        let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController)
        XCTAssertEqual(game.engine.state.board,11);XCTAssertEqual(game.engine.state.mode,.journey)
        XCTAssertEqual(game.engine.state.tutorial?.reward,.init(.juice))
        XCTAssertEqual(game.engine.state.tiles,engine.state.tiles)
        try await waitActive{game.sourceInitialConstruction?.pendingFaceCount==0 && game.boardScene?.isBoardEntryComplete==true}
        XCTAssertNil(game.sourcePresentationFailure)
        let pair=try XCTUnwrap(game.engine.state.tutorial?.guidedPair)
        let scene=try XCTUnwrap(game.boardScene),source=try XCTUnwrap(scene.sourceNativeTileNode(pair[0]))
        try await waitActive{guard let parent=source.parent else{return false};return scene.beginDrag(at:scene.convert(source.position,from:parent))}
        scene.cancelDrag()
        XCTAssertFalse(try XCTUnwrap(store.load()).progression.firstPlayTutorialComplete)
    }
    func testFirstPlayHomeJourneyOpensWorldSelectionInsteadOfTutorial()async throws {
        var made=0
        var source=services{_,_ in made+=1;return UIViewController()};source.requiresTutorial={true}
        let(root,window)=mount(source);defer{root.dispose();window.isHidden=true}
        root.home.onActivate?(0)
        try await waitFor{root.route == .hub}
        XCTAssertEqual(made,0)
    }
    func testPostSpecialEncouragementOwnsInputUntilContinueAndDoesNotRepeat()async throws {
        var state=NativeBoardFactory.make(mode:.journey,board:1)
        var tutorial=NativeTutorialState();tutorial.active=false;tutorial.guideCompleted=true;tutorial.completionAssist=true
        state.tutorial=tutorial
        let game=NativeGameplayViewController(engine:NativeGameplayEngine(state:state),resourceRoot:NativeTestResources.root)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=game;window.makeKeyAndVisible()
        let owner=NativeTutorialOwner(gameplay:game,root:NativeTestResources.root)
        defer{owner.dispose();game.dispose();window.isHidden=true}
        owner.refresh(game.engine.state)
        let overlay=try XCTUnwrap(game.view.subviews.first{$0 is NativeTutorialOverlay} as? NativeTutorialOverlay)
        let labels=overlay.subviews.flatMap{$0.subviews}.compactMap{$0 as? UILabel}
        XCTAssertTrue(labels.contains{$0.text=="Great merge!"})
        func findButton(_ v:UIView)->UIButton? {if let b=v as? UIButton,b.accessibilityIdentifier=="native.tutorial.got-it" {return b};return v.subviews.lazy.compactMap{findButton($0)}.first}
        let button=try XCTUnwrap(findButton(overlay))
        XCTAssertEqual(button.currentTitle,"Continue")
        let target=try XCTUnwrap(state.activeTiles.first)
        XCTAssertFalse(game.engine.canBeginDrag(tileID:target.id))
        button.sendActions(for:.touchUpInside)
        try await waitFor{game.engine.state.tutorial?.encouragementAcknowledged==true}
        XCTAssertNil(overlay.superview)
        let again=NativeTutorialOwner(gameplay:game,root:NativeTestResources.root);again.refresh(game.engine.state)
        XCTAssertFalse(game.view.subviews.contains{$0 is NativeTutorialOverlay});again.dispose()
    }
    func testJourneyTutorialCommitsOnlySelectedWorldAndArcadePracticeCommitsNoStage()async throws {
        for board in [1,11,21,0] {
            let directory=FileManager.default.temporaryDirectory.appendingPathComponent("contextual-flow-\(UUID())")
            let store=NativeSaveStore(directory:directory)
            try store.save(NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false)))
            let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false)
            let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
            window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
            defer{bootstrap.dispose();window.isHidden=true;try? FileManager.default.removeItem(at:directory)}
            let app=try XCTUnwrap(host.children.first as? NativeAppController)
            if board==0 {app.navigate(.gameplay,interrupt:true)} else {
                app.navigate(.world((board-1)/10+1),interrupt:true)
                try await waitFor{app.world?.isHidden==false && app.world?.scrollView.isUserInteractionEnabled==true && !app.transitioning}
                app.world?.onRequest?("play",board)
            }
            try await waitFor{app.children.contains{$0 is NativeGameplayViewController}}
            let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController)
            XCTAssertEqual(game.engine.state.mode,board==0 ? .arcade:.journey)
            XCTAssertEqual(game.engine.state.board,board==0 ? 1:board)
            if board>0 {
                let reward=try XCTUnwrap(NativeJourneyContent.unlockReward(board:board))
                XCTAssertEqual(game.engine.state.tutorial?.reward,.init(reward.archetype,variant:reward.variant))
            }
            // Exercise the real app terminal/atomic reward owner with a coherent completed guide.
            var end=game.engine.state;end.tiles=[.init(id:"a",cell:.init(column:0,row:0),value:3),.init(id:"b",cell:.init(column:1,row:0),value:3)]
            end.tutorial?.active=false;end.tutorial?.guideCompleted=true;end.tutorial?.encouragementAcknowledged=true
            let terminal=NativeResolution(.complete,reason:"contextual-completed-guide-fixture")
            end.terminal=terminal;game.engine.restart(state:end)
            game.onTerminal?(terminal)
            let saved=try XCTUnwrap(store.load())
            XCTAssertTrue(saved.progression.firstPlayTutorialComplete)
            XCTAssertNil(saved.firstPlayRun)
            if board==0 {
                XCTAssertTrue(saved.progression.completedJourneyBoards.isEmpty);XCTAssertNil(saved.pendingArcadeRound)
                XCTAssertNotNil(app.children.first{$0 is NativeTutorialCompleteController})
                XCTAssertEqual(saved.progression.arcadeStats,NativeArcadeStats())
                let completed=try XCTUnwrap(app.children.first{$0 is NativeTutorialCompleteController} as? NativeTutorialCompleteController)
                completed.sampleEnter(seconds:1);completed.requestContinue()
                try await waitFor{completed.parent==nil && game.engine.state.tutorial==nil}
                XCTAssertEqual(game.engine.state.board,1);XCTAssertEqual(game.engine.state.score,0)
                XCTAssertTrue(try XCTUnwrap(store.load()).progression.firstPlayTutorialComplete)
            } else {
                XCTAssertEqual(saved.progression.completedJourneyBoards,[board])
                XCTAssertTrue(saved.progression.isPlayable(board:board+1))
                XCTAssertNil(app.children.first{$0 is NativeTutorialCompleteController})
            }
        }
    }
    func testArcadeArtAndModalPaperArePackaged() {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        for path in ["assets/arcade/endourance.png","assets/arcade/pure dice.png","assets/arcade/slow burn.png","assets/modals/paper.png","assets/close-icon.png"] {
            XCTAssertNotNil(assets.image(path),path)
        }
    }
}
