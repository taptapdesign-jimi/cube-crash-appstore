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
            try await waitFor{root.route == .arcadeHub && !root.transitioning && root.arcadeHub.hub.scrollView.isUserInteractionEnabled}
            root.arcadeHub.onPlay?(variant.rawValue)
            try await waitFor{root.route == .gameplay}
            XCTAssertEqual(events,["select","prepare","make"])
            returnToHub?()
            try await waitFor{root.route == .arcadeHub && !root.transitioning && root.arcadeHub.hub.scrollView.isUserInteractionEnabled}
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
            try await waitFor { root.route == .arcadeHub && !root.transitioning && root.arcadeHub.hub.scrollView.isUserInteractionEnabled }
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
        try await waitFor{root.route == .arcadeHub && !root.transitioning && root.arcadeHub.hub.scrollView.isUserInteractionEnabled}
        root.arcadeHub.onPlay?(NativeArcadeVariant.slowBurn.rawValue)
        try await waitFor{replies.count==1}
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        replies[0](true)
        root.arcadeHub.onPlay?(NativeArcadeVariant.pureDice.rawValue)
        XCTAssertEqual(selected,1);XCTAssertEqual(made,0)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        try await waitFor{root.route == .arcadeHub && !root.transitioning && root.arcadeHub.hub.scrollView.isUserInteractionEnabled}
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
    func testRestoredTutorialWaitsForFullMeterThenOpensRealBackpack()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("contextual-resume-\(UUID())")
        let store=NativeSaveStore(directory:directory)
        let engine=NativeGameplayEngine(state:NativeBoardFactory.make(mode:.journey,board:11,tutorial:true))
        XCTAssertTrue(engine.startTutorial().accepted);engine.configureTutorialReward(.init(.juice))
        var saved=engine.state
        saved.tutorial?.step = .freePlay;saved.tutorial?.guidedPair=[]
        saved.tutorial?.specialBarSuccessfulActions=2;saved.tutorial?.specialBarAcknowledged=true
        saved.tutorial?.waitingForWild=true // previously saved by the premature fallback CTA
        saved.tutorial?.objectiveAcknowledged=true;saved.wildMeter=0.99
        var envelope=NativeSaveEnvelope();envelope.firstPlayRun=saved;envelope.progression.highestUnlockedJourneyBoard=11;try store.save(envelope)
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
        // Current mode-selection policy resumes a Journey checkpoint through
        // its selected World; direct .gameplay is the Arcade entry point.
        try await waitActive{!app.home.isHidden && app.home.isUserInteractionEnabled && !app.transitioning}
        app.navigate(.world(2),interrupt:true)
        try await waitActive{app.world?.isReadyForInput==true && !app.transitioning}
        app.world?.onRequest?("continue",11)
        try await waitActive{app.children.contains{$0 is NativeGameplayViewController}}
        let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController)
        XCTAssertEqual(game.engine.state.board,11);XCTAssertEqual(game.engine.state.mode,.journey)
        XCTAssertEqual(game.engine.state.tutorial?.reward,.init(.juice))
        XCTAssertEqual(game.engine.state.tiles,saved.tiles)
        try await waitActive{game.sourceInitialConstruction?.pendingFaceCount==0 && game.boardScene?.isBoardEntryComplete==true}
        XCTAssertNil(game.sourcePresentationFailure)
        XCTAssertEqual(game.engine.state.tutorial?.waitingForWild,false)
        XCTAssertEqual(game.engine.state.wildMeter,0.99,accuracy:0.000001)
        XCTAssertFalse(game.view.subviews.compactMap{$0 as? NativeTutorialOverlay}.contains{!$0.isHidden && $0.backpackPromptVisible})
        let scene=try XCTUnwrap(game.boardScene)
        let tiles=game.engine.state.activeTiles
        let a=try XCTUnwrap(tiles.first{$0.value==1}),b=try XCTUnwrap(tiles.first{$0.value==2})
        let source=try XCTUnwrap(scene.sourceNativeTileNode(a.id)),target=try XCTUnwrap(scene.sourceNativeTileNode(b.id))
        try await waitActive{guard let parent=source.parent else{return false};return scene.beginDrag(at:scene.convert(source.position,from:parent))}
        let destination=scene.convert(target.position,from:try XCTUnwrap(target.parent))
        scene.moveDrag(to:destination,now:1)
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:destination,now:1.2)).accepted)
        try await waitActive{scene.heldTutorialBackpackCarrier != nil}
        XCTAssertNil(game.sourcePresentationFailure)
        let overlay=try XCTUnwrap(game.view.subviews.compactMap{$0 as? NativeTutorialOverlay}.first)
        XCTAssertTrue(overlay.backpackPromptVisible);XCTAssertFalse(overlay.isHidden)
        let carrier=try XCTUnwrap(scene.heldTutorialBackpackCarrier)
        let anchor=carrier.position
        for _ in 0..<45{wall+=16;service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(carrier.position,anchor)
        XCTAssertTrue(overlay.subviews.contains{$0.accessibilityIdentifier=="native.tutorial.open-backpack" && !$0.isHidden})
        func descendants(_ view:UIView)->[UIView]{[view]+view.subviews.flatMap(descendants)}
        let tap=try XCTUnwrap(descendants(overlay).first{$0.accessibilityIdentifier=="native.tutorial.got-it"} as? UIButton)
        XCTAssertEqual(tap.title(for:.normal),"Got it")
        let artwork=try XCTUnwrap(overlay.subviews.flatMap{$0.subviews}.first{$0.accessibilityIdentifier=="assets/tutorial/ekipa backpack.png"} as? UIImageView)
        XCTAssertNotNil(artwork.image);XCTAssertFalse(artwork.isHidden)
        XCTAssertLessThan(artwork.frame.minY,0);XCTAssertGreaterThan(artwork.frame.maxY,0)
        let preview=UIGraphicsImageRenderer(bounds:game.view.bounds).image{_ in game.view.drawHierarchy(in:game.view.bounds,afterScreenUpdates:true)}
        try preview.pngData()?.write(to:URL(fileURLWithPath:"/tmp/tutorial-backpack-spacing-preview.png"))
        XCTAssertFalse(tap.isHidden);tap.sendActions(for:.touchUpInside)
        try await waitActive{game.engine.state.tutorial?.step == .special && game.engine.state.wildSpawnCount==1}
        XCTAssertFalse(overlay.backpackPromptVisible)
        XCTAssertNil(scene.heldTutorialBackpackCarrier)
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
    func testPostSpecialResumesWithoutSheetAndRevealsFullOpacityHUD()async throws {
        var state=NativeBoardFactory.make(mode:.journey,board:1)
        var tutorial=NativeTutorialState();tutorial.active=false;tutorial.guideCompleted=true;tutorial.completionAssist=true
        tutorial.comboLessonAcknowledged=false;tutorial.comboHUDRevealed=false
        state.tutorial=tutorial
        let game=NativeGameplayViewController(engine:NativeGameplayEngine(state:state),resourceRoot:NativeTestResources.root)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=game;window.makeKeyAndVisible()
        let owner=NativeTutorialOwner(gameplay:game,root:NativeTestResources.root)
        defer{owner.dispose();game.dispose();window.isHidden=true}
        owner.refresh(game.engine.state)
        try await waitFor{game.engine.state.tutorial?.encouragementAcknowledged==true}
        let scene=try XCTUnwrap(game.boardScene)
        try await Task.sleep(for:.milliseconds(1200))
        scene.synchronize()
        try await Task.sleep(for:.milliseconds(100))
        XCTAssertFalse(game.view.subviews.contains{($0 is NativeTutorialOverlay) && !$0.isHidden})
        XCTAssertEqual(game.engine.state.tutorial?.comboHUDRevealed,false,"HUD enters before the later combo lesson")
        for name in ["native-game-score-art","native-game-score-value","native-game-combo-art","native-game-combo-value","native-game-help"] {
            let node=try XCTUnwrap(scene.childNode(withName:"//"+name))
            XCTAssertFalse(node.isHidden,name)
            var alpha=node.alpha,parent=node.parent
            while let ancestor=parent {alpha *= ancestor.alpha;parent=ancestor.parent}
            XCTAssertEqual(alpha,1,accuracy:0.001,name)
        }
        var opened:[String]=[]
        scene.onScoreRequest={opened.append("score")};scene.onComboRequest={opened.append("combo")}
        scene.onHelpRequest={opened.append("backpack")};scene.onExitRequest={opened.append("close")}
        for name in ["native-game-score-art","native-game-combo-art","native-game-help"] {
            let node=try XCTUnwrap(scene.childNode(withName:"//"+name))
            XCTAssertTrue(scene.handleHUDContact(at:node.convert(.zero,to:scene)))
        }
        XCTAssertEqual(opened,["score","combo","backpack"])
        XCTAssertTrue(game.engine.state.tutorial?.shouldLockHUD == true,"Close remains locked until tutorial result")
        let target=try XCTUnwrap(game.engine.state.activeTiles.first{game.engine.canBeginDrag(tileID:$0.id)})
        XCTAssertTrue(game.engine.canBeginDrag(tileID:target.id))
    }
    func testJourneyCueInheritsOriginalCardMotionAndRetires() async throws {
        let card=UIView(frame:CGRect(x:60,y:300,width:150,height:200))
        card.transform=CGAffineTransform(rotationAngle:-0.09)
        let host=UIView(frame:CGRect(x:0,y:0,width:820,height:1180));host.addSubview(card)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:host.bounds),controller=UIViewController();controller.view=host
        window.rootViewController=controller;window.makeKeyAndVisible()
        defer{window.isHidden=true;window.rootViewController=nil;previous?.makeKeyAndVisible()}

        let overlay=NativeTutorialOverlay(resourceRoot:NativeTestResources.root);overlay.frame=host.bounds;host.addSubview(overlay)
        overlay.showWorldIntro(card:card,target:{card.convert(card.bounds,to:host)})
        let paper=try XCTUnwrap(card.subviews.first{$0.accessibilityIdentifier=="native.tutorial.card-cue-paper"})
        let title=try XCTUnwrap(card.subviews.first{$0.accessibilityIdentifier=="native.tutorial.card-cue-title"})
        XCTAssertEqual(title.frame.maxY,-8)
        XCTAssertEqual(title.frame.midX,card.bounds.midX)
        XCTAssertTrue(title.superview === card);XCTAssertTrue(paper.superview === card)
        let hand=try XCTUnwrap(host.subviews.first{$0.accessibilityIdentifier=="native.tutorial.world-hand-carrier"})
        let pointer=try XCTUnwrap(hand.subviews.first)
        XCTAssertNil(pointer.layer.animation(forKey:"tutorial.world-tap"),"Only the actual card supplies idle motion")
        let motion=JimiNativeInterimEffect(card:card,scale:1)
        defer{motion.setMotionFollower(nil);motion.stop();overlay.dispose()}
        motion.start();motion.setMotionFollower(hand.layer)
        let source=try XCTUnwrap(card.layer.animation(forKey:"world.interim") as? CAKeyframeAnimation)
        let follower=try XCTUnwrap(hand.layer.animation(forKey:"world.interim.follower") as? CAKeyframeAnimation)
        XCTAssertEqual(hand.layer.convertTime(follower.beginTime,to:nil)-card.layer.convertTime(source.beginTime,to:nil),0.15,accuracy:0.000001)
        XCTAssertEqual(follower.duration,source.duration)
        XCTAssertEqual(follower.values as? [NSValue],source.values as? [NSValue])
        XCTAssertEqual(hand.layer.anchorPoint,card.layer.anchorPoint)
        XCTAssertEqual(hand.layer.position,card.layer.position)
        try await waitFor{card.layer.animation(forKey:"world.interim")?.beginTime != source.beginTime}
        let next=try XCTUnwrap(card.layer.animation(forKey:"world.interim") as? CAKeyframeAnimation)
        let nextFollower=try XCTUnwrap(hand.layer.animation(forKey:"world.interim.follower") as? CAKeyframeAnimation)
        XCTAssertEqual(hand.layer.convertTime(nextFollower.beginTime,to:nil)-card.layer.convertTime(next.beginTime,to:nil),0.15,accuracy:0.000001)
        XCTAssertEqual(nextFollower.values as? [NSValue],next.values as? [NSValue],"Every randomized cycle must share the exact selected card track")

        overlay.setSuspended(true);XCTAssertEqual(hand.layer.speed,0)
        overlay.setSuspended(false);XCTAssertEqual(hand.layer.speed,1)

        let surface=try XCTUnwrap(paper.subviews.compactMap{$0 as? NativeSettingsPaperSurface}.first)
        XCTAssertEqual(surface.cornerRadius,12);XCTAssertEqual(surface.edgeDetailScale,0.4)
        XCTAssertEqual(paper.layer.borderWidth,0);XCTAssertNotNil(paper.layer.shadowPath)
        let size=CGSize(width:paper.bounds.width+24,height:paper.bounds.height+24)
        let preview=UIGraphicsImageRenderer(size:size).image{context in
            UIColor(red:243/255,green:238/255,blue:232/255,alpha:1).setFill();context.fill(CGRect(origin:.zero,size:size))
            context.cgContext.translateBy(x:12,y:12)
            let paperAlpha=paper.alpha,titleAlpha=title.alpha
            paper.alpha=1;title.alpha=1;paper.layer.render(in:context.cgContext);title.layer.render(in:context.cgContext)
            paper.alpha=paperAlpha;title.alpha=titleAlpha
        }
        try preview.pngData()?.write(to:URL(fileURLWithPath:"/tmp/journey-cue-paper-preview.png"))
        XCTAssertTrue(title.transform.isIdentity,"Original parent owns all tilt/bounce, without a second motion clock")
        motion.stop();XCTAssertNil(hand.layer.animation(forKey:"world.interim.follower"))
        motion.setMotionFollower(nil)
        overlay.dispose()
        XCTAssertNil(title.superview);XCTAssertNil(paper.superview);XCTAssertNil(hand.superview);XCTAssertNil(pointer.superview)
    }
    func testComboLessonShowsHandAtLiveComboHUD()async throws {
        var state=NativeBoardFactory.make(mode:.journey,board:1)
        var tutorial=NativeTutorialState();tutorial.active=false;tutorial.guideCompleted=true;tutorial.completionAssist=true
        tutorial.encouragementAcknowledged=true;tutorial.comboLessonAcknowledged=false;tutorial.comboHUDRevealed=true
        state.tutorial=tutorial
        let game=NativeGameplayViewController(engine:NativeGameplayEngine(state:state),resourceRoot:NativeTestResources.root)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=game;window.makeKeyAndVisible()
        let owner=NativeTutorialOwner(gameplay:game,root:NativeTestResources.root)
        defer{owner.dispose();game.dispose();window.isHidden=true}
        owner.refresh(game.engine.state)
        let overlay=try XCTUnwrap(game.view.subviews.compactMap{$0 as? NativeTutorialOverlay}.first)
        try await waitFor{overlay.sourcePointerVisible}
        XCTAssertNotNil(game.boardScene?.tutorialComboTargetScreen)
        let preview=UIGraphicsImageRenderer(bounds:game.view.bounds).image{_ in game.view.drawHierarchy(in:game.view.bounds,afterScreenUpdates:true)}
        try preview.pngData()?.write(to:URL(fileURLWithPath:"/tmp/tutorial-combo-hand.png"))
        owner.dispose()
        XCTAssertNil(overlay.superview)
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
                let result=try XCTUnwrap(game.presentedViewController as? NativeResultController)
                XCTAssertTrue(result.clean)
                XCTAssertNil(app.children.first{$0 is NativeTutorialCompleteController})
                XCTAssertEqual(saved.progression.arcadeStats,NativeArcadeStats())
                for frame in 0...660 {result.tick(Double(frame)/60)}
                func all(_ view:UIView)->[UIView]{[view]+view.subviews.flatMap(all)}
                let button=try XCTUnwrap(all(result.view).compactMap{$0 as? UIButton}.first{$0.accessibilityIdentifier=="native.result.play-again"})
                XCTAssertEqual(button.title(for:.normal),"Continue");button.sendActions(for:.touchUpInside)
                try await waitFor{app.route == .arcadeHub && app.tutorialFarewell != nil}
                XCTAssertNil(game.parent)
                XCTAssertNil(try XCTUnwrap(store.load()).arcadeRun)
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
