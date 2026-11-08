import XCTest
import UIKit
import StackToSixNativeState
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeAppCoordinatorTests:XCTestCase {
    private func resources()->URL {
        Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle")!
    }
    func testArcadeCTAAndMainHeroShareExactlyOneAcceptedSpeechContact() async throws {
        for cta in [false,true] {
            let services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw FixtureError.unavailable},markViewed:{_ in},makeGameplay:{_,_ in throw FixtureError.unavailable},flush:{})
            let root=NativeAppController(resourceRoot:resources(),services:services)
            let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=root;window.makeKeyAndVisible()
            defer{root.dispose();window.isHidden=true}
            try await waitFor{(!root.home.isEntering && root.home.isUserInteractionEnabled)}
            root.home.selectSlide(1,animated:false)
            var cues:[String]=[];root.onFeedback={cues.append($0)}
            let hero=try XCTUnwrap(root.home.heroView as? UIButton)
            let button=cta ? root.home.ctaView:hero
            button.sendActions(for:.touchUpInside);button.sendActions(for:.touchUpInside)
            XCTAssertEqual(cues.filter{$0 == "home-arcade-character-tap"}.count,1)
            try await waitFor{root.route == .arcadeHub && !root.transitioning && root.arcadeHub.hub.scrollView.isUserInteractionEnabled}
            root.home.onHeroContact?()
            XCTAssertEqual(cues.filter{$0 == "home-arcade-character-tap"}.count,1,"Hidden Home cannot emit")
        }
    }
    func testHomeReturnFromJourneyArcadeAndSettingsAcceptsVisibleCTAImmediately() async throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Full entry window required")}
        let sources:[NativeAppController.Route]=[.hub,.arcadeHub,.settings]
        for (index,source) in sources.enumerated() {
            let (root,window)=try worldEntryFixture{_,ready in ready()}
            defer{root.dispose();window.isHidden=true}
            try await waitFor{!root.transitioning && root.home.isUserInteractionEnabled}
            root.home.selectSlide(index,animated:false);root.navigate(source)
            try await waitFor{root.route==source && !root.transitioning}
            root.navigate(.home)
            try await waitFor{root.home.isEntering && root.home.isPaintedControlVisible(root.home.ctaView)}
            XCTAssertTrue(root.transitioning);XCTAssertTrue(root.home.isUserInteractionEnabled)
            let button=try XCTUnwrap(root.home.ctaView as? UIButton)
            button.sendActions(for:.touchUpInside);button.sendActions(for:.touchUpInside)
            XCTAssertFalse(root.home.isEntering)
            try await waitFor{root.route==source && !root.transitioning}
        }
    }

    func testEarlyHomeReturnTabCanBeRetargetedWithoutFrozenEntry() async throws {
        let (root,window)=try worldEntryFixture{_,ready in ready()}
        defer{root.dispose();window.isHidden=true}
        try await waitFor{!root.transitioning && root.home.isUserInteractionEnabled}
        root.navigate(.settings);try await waitFor{root.route == .settings && !root.transitioning}
        root.navigate(.home)
        // The container paints before its staggered child buttons. Exercise
        // real visible input admission for each retarget, rather than tapping
        // still-hidden controls through sendActions.
        try await waitFor{root.home.isEntering && root.home.isPaintedControlVisible(root.home.navigationButtonViews[1])}
        root.home.navigationButtonViews[1].sendActions(for:.touchUpInside)
        try await waitFor{root.home.isEntering && root.home.isPaintedControlVisible(root.home.navigationButtonViews[2])}
        root.home.navigationButtonViews[2].sendActions(for:.touchUpInside)
        try await waitFor{!root.home.isEntering}
        XCTAssertEqual(root.home.selectedSlide,2);XCTAssertFalse(root.transitioning)
        XCTAssertNotNil(root.home.ctaIdleBounceView.layer.animation(forKey:JimiV9HomeView.ctaIdleBounceKey))
    }

    func testAllArcadeIslandsAcceptVisibleTapBeforeEntryAndKeepModalExclusive() async throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Full entry window required")}
        for (id,cue) in [(1,"endurance"),(3,"pureDice"),(2,"slowBurn")] {
            let (root,window)=try worldEntryFixture{_,ready in ready()}
            defer{root.dispose();window.isHidden=true}
            try await waitFor{(!root.home.isEntering && root.home.isUserInteractionEnabled)}
            root.navigate(.arcadeHub)
            try await waitFor{root.arcadeHub.isEntering && root.arcadeHub.hub.isWorldVisibleForSelection(id)}
            XCTAssertTrue(root.transitioning)
            var cues:[String]=[];root.onFeedback={cues.append($0)}
            let button=try XCTUnwrap(root.arcadeHub.hub.worldUnits.first{$0.tag==id})
            button.sendActions(for:.touchUpInside)
            XCTAssertFalse(root.transitioning,"Modal input must not wait for the full incoming cascade")
            XCTAssertEqual(cues.filter{$0.hasPrefix("arcade-island-")},["arcade-island-"+cue])
            let sheet=try XCTUnwrap(root.arcadeHub.subviews.first{$0.accessibilityIdentifier=="native.arcade-world-modal"})
            button.sendActions(for:.touchUpInside)
            XCTAssertEqual(root.arcadeHub.subviews.filter{$0.accessibilityIdentifier=="native.arcade-world-modal"}.count,1)
            try await waitFor{!root.arcadeHub.isEntering}
            XCTAssertTrue(sheet.superview === root.arcadeHub)
            XCTAssertFalse(root.arcadeHub.hub.scrollView.isUserInteractionEnabled,"Entry completion cannot unlock islands behind a modal")
            XCTAssertEqual(cues.filter{$0.hasPrefix("arcade-island-")}.count,1)
        }
    }

    func testAllThreeWorldsAcceptVisibleTapBeforeHubEnterFinishesOnce() async throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Full entry window required")}
        for id in [1,2,3] {
            var preparations=0
            let (root,window)=try worldEntryFixture { _,ready in preparations+=1;ready() }
            defer{root.dispose();window.isHidden=true}
            try await waitFor{(!root.home.isEntering && root.home.isUserInteractionEnabled)}
            root.navigate(.hub)
            try await waitFor{root.incomingHubEnter && root.hub.isWorldVisibleForSelection(id)}
            XCTAssertTrue(root.transitioning)
            XCTAssertTrue(root.hub.scrollView.isUserInteractionEnabled)
            let button=try XCTUnwrap(root.hub.worldUnits.first{$0.tag==id})
            button.sendActions(for:.touchUpInside)
            XCTAssertFalse(root.incomingHubEnter)
            XCTAssertTrue(root.transitioning)
            XCTAssertEqual(preparations,1)
            button.sendActions(for:.touchUpInside)
            XCTAssertEqual(preparations,1,"Repeated taps cannot replace the accepted outgoing selection")
            try await waitFor{root.route == .world(id) && root.world?.isReadyForInput==true}
            XCTAssertEqual(preparations,1)
        }
    }

    func testEarlyHubSelectionFailureRestoresEntryWithoutStaleWorldRoute() async throws {
        let services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw FixtureError.unavailable},markViewed:{_ in},makeGameplay:{_,_ in throw FixtureError.unavailable},flush:{})
        let root=NativeAppController(resourceRoot:resources(),services:services)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=root;window.makeKeyAndVisible()
        defer{root.dispose();window.isHidden=true}
        try await waitFor{(!root.home.isEntering && root.home.isUserInteractionEnabled)}
        root.navigate(.hub)
        try await waitFor{root.incomingHubEnter && root.hub.isWorldVisibleForSelection(1)}
        root.hub.onWorld?(1)
        XCTAssertEqual(root.route,.hub)
        try await waitFor{!root.transitioning}
        XCTAssertFalse(root.incomingHubEnter)
        for unit in root.hub.worldUnits {XCTAssertEqual(unit.layer.opacity,1)}
        XCTAssertTrue(root.hub.scrollView.isUserInteractionEnabled)
    }

    func testWorldHubSpeechOnlyFollowsAcceptedWorldButtonOnce() async throws {
        let (controller,window)=try worldEntryFixture(prepare:{_,ready in ready()})
        defer{controller.dispose();window.isHidden=true}
        var cues:[String]=[];controller.onFeedback={cues.append($0)}
        controller.hub.onWorld?(1)
        XCTAssertFalse(cues.contains{$0.hasPrefix("world-hub-")},"Hidden hub cannot speak")
        controller.navigate(.hub,interrupt:true)
        try await waitFor{controller.route == .hub && !controller.transitioning && controller.hub.scrollView.isUserInteractionEnabled}
        for (id,cue) in [(1,"world-hub-forest"),(3,"world-hub-space"),(2,"world-hub-beach")] {
            cues.removeAll();controller.hub.setContentInteractionEnabled(false);controller.hub.onWorld?(id)
            XCTAssertTrue(cues.isEmpty);controller.hub.setContentInteractionEnabled(true)
            controller.hub.onWorld?(99);XCTAssertTrue(cues.isEmpty)
            let button=try XCTUnwrap(controller.hub.worldUnits.first{$0.tag==id})
            button.sendActions(for:.touchUpInside)
            XCTAssertEqual(cues.filter{$0.hasPrefix("world-hub-")},[cue])
            button.sendActions(for:.touchUpInside)
            XCTAssertEqual(cues.filter{$0.hasPrefix("world-hub-")},[cue])
            try await waitFor{controller.route == .world(id) && controller.world?.isReadyForInput == true}
            button.sendActions(for:.touchUpInside)
            XCTAssertEqual(cues.filter{$0.hasPrefix("world-hub-")},[cue])
            controller.navigate(.hub)
            try await waitFor{controller.route == .hub && !controller.transitioning && controller.hub.scrollView.isUserInteractionEnabled}
        }
    }
    func testWorldHubSpeechDoesNotPlayOnFailedWorldPreparation() async throws {
        let services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw FixtureError.unavailable},markViewed:{_ in},makeGameplay:{_,_ in throw FixtureError.unavailable},flush:{})
        let controller=NativeAppController(resourceRoot:resources(),services:services)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible()
        defer{controller.dispose();window.isHidden=true}
        controller.navigate(.hub,interrupt:true)
        try await waitFor{controller.route == .hub && !controller.transitioning && controller.hub.scrollView.isUserInteractionEnabled}
        var cues:[String]=[];controller.onFeedback={cues.append($0)}
        controller.hub.worldUnits.first{$0.tag==1}?.sendActions(for:.touchUpInside)
        XCTAssertFalse(cues.contains{$0.hasPrefix("world-hub-")});XCTAssertEqual(controller.route,.hub)
    }
    func testHubFlagsReadCanonicalUniqueWinsAndRefreshWhenRetainedHubReturns() async throws {
        var progression=NativeProgressionState()
        func finish(_ board:Int,clean:Bool=true,mode:NativeRunMode = .journey) {
            progression.finishAttempt(mode:mode,board:board,score:100,longestCombo:0,cubesCracked:1,clean:clean)
        }
        finish(1);finish(2);finish(2);finish(3,clean:false)
        progression.markViewed(board:2)
        var services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw FixtureError.unavailable},markViewed:{_ in},makeGameplay:{_,_ in throw FixtureError.unavailable},flush:{})
        services.journeyProgression={progression}
        let controller=NativeAppController(resourceRoot:resources(),services:services)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible()
        defer{controller.dispose();window.isHidden=true}
        func label(_ view:UIView)->String? {
            if let label=view as? UILabel {return label.attributedText?.string ?? label.text}
            return view.subviews.lazy.compactMap{label($0)}.first
        }
        func count(_ id:Int)->String? {controller.hub.worldUnits.first{$0.tag==id}.flatMap{label($0)}}
        controller.navigate(.hub,interrupt:true)
        try await waitFor{controller.route == .hub && !controller.transitioning && controller.hub.scrollView.isUserInteractionEnabled}
        XCTAssertEqual(count(1),"2 / 10");XCTAssertEqual(count(2),"0 / 10");XCTAssertEqual(count(3),"0 / 10")
        controller.navigate(.settings)
        try await waitFor{controller.route == .settings && controller.settingsView.isUserInteractionEnabled}
        finish(3);finish(11);finish(21);finish(22);finish(1,mode:.arcade)
        controller.navigate(.hub)
        try await waitFor{controller.route == .hub && !controller.transitioning && controller.hub.scrollView.isUserInteractionEnabled}
        XCTAssertEqual(count(1),"3 / 10");XCTAssertEqual(count(2),"1 / 10");XCTAssertEqual(count(3),"2 / 10")
        XCTAssertEqual(progression.completedJourneyBoards,[1,2,3,11,21,22])
    }
    func testHomeInputWaitsForActualEnterCompletion()async throws {
        let services=NativeAppServices(settings:{["gameSoundsEnabled":false,"musicEnabled":false,"hapticsEnabled":false]},
            setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw FixtureError.unavailable},markViewed:{_ in},
            makeGameplay:{_,_ in throw FixtureError.unavailable},flush:{})
        let controller=NativeAppController(resourceRoot:resources(),services:services)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=controller;window.makeKeyAndVisible()
        defer{controller.dispose();window.isHidden=true}
        XCTAssertFalse(controller.home.isUserInteractionEnabled)
        let deadline=Date().addingTimeInterval(5)
        while !(!controller.home.isEntering && controller.home.isUserInteractionEnabled),Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(controller.home.isUserInteractionEnabled)
        XCTAssertEqual(controller.route,.home)
        var cues:[String]=[];controller.onFeedback={cues.append($0)}
        controller.home.navigationButtonViews[1].sendActions(for:.touchUpInside)
        XCTAssertEqual(controller.home.selectedSlide,1);XCTAssertEqual(cues,["tab","swipe"])
        cues=[];controller.home.navigationButtonViews[1].sendActions(for:.touchUpInside)
        XCTAssertEqual(cues,["tab"],"The selected icon has contact, but no slider whoosh")
        cues=[];controller.home.onHeroContact?()
        XCTAssertEqual(cues,["home-arcade-character-tap"])
    }
    func testStartupAppSwitchRecoversActualHomeAndAdmitsNavigation()async throws {
        let prior=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        var services=NativeAppServices(settings:{["gameSoundsEnabled":false,"musicEnabled":false,"hapticsEnabled":false]},
            setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw FixtureError.unavailable},markViewed:{_ in},
            makeGameplay:{_,_ in throw FixtureError.unavailable},flush:{})
        services.showsStudioIntro=true
        let controller=NativeAppController(resourceRoot:resources(),services:services)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible()
        defer{controller.dispose();window.isHidden=true;window.rootViewController=nil;prior?.makeKeyAndVisible()}
        func findIntro(_ view:UIView)->NativeStudioIntroView? {
            if let intro=view as? NativeStudioIntroView{return intro}
            return view.subviews.lazy.compactMap{findIntro($0)}.first
        }
        let intro=try XCTUnwrap(findIntro(controller.view))
        let deadline=Date().addingTimeInterval(20)
        while !intro.timelineStarted,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(intro.timelineStarted)
        XCTAssertTrue(controller.home.isHidden)
        controller.navigate(.arcadeHub)
        XCTAssertEqual(controller.route,.home,"Launch intro still owns route admission")
        try await Task.sleep(for:.seconds(1))
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        NotificationCenter.default.post(name:UIApplication.didEnterBackgroundNotification,object:nil)
        intro.subviews.forEach{$0.layer.removeAllAnimations()}
        intro.animationDidStop(CAAnimation(),finished:false)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        try await waitFor{controller.route == .home && (!controller.home.isEntering && controller.home.isUserInteractionEnabled)}
        XCTAssertTrue(intro.isRetired);XCTAssertNil(intro.superview)
        XCTAssertFalse(controller.home.isHidden)
        XCTAssertNil(findIntro(controller.view))
        var cues:[String]=[];controller.onFeedback={cues.append($0)}
        controller.home.navigationButtonViews[1].sendActions(for:.touchUpInside)
        XCTAssertEqual(controller.home.selectedSlide,1);XCTAssertEqual(cues,["tab","swipe"])
        // Route admission also proves the intro no longer blocks navigate().
        controller.navigate(.arcadeHub)
        try await waitFor{controller.route == .arcadeHub && !controller.transitioning && controller.arcadeHub.hub.scrollView.isUserInteractionEnabled}
        XCTAssertFalse(controller.arcadeHub.isHidden)
    }
    func testCommittedHomeSwipeEmitsNavigationContactButSnapBackDoesNot()async throws {
        let services=NativeAppServices(settings:{["gameSoundsEnabled":false,"musicEnabled":false,"hapticsEnabled":true]},
            setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw FixtureError.unavailable},markViewed:{_ in},
            makeGameplay:{_,_ in throw FixtureError.unavailable},flush:{})
        let controller=NativeAppController(resourceRoot:resources(),services:services)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible()
        defer{controller.dispose();window.isHidden=true;window.rootViewController=nil}
        try await waitFor{(!controller.home.isEntering && controller.home.isUserInteractionEnabled)}
        var cues:[String]=[];controller.onFeedback={cues.append($0)}
        controller.home.onPanEnded?(1,false)
        XCTAssertEqual(controller.home.selectedSlide,1);XCTAssertEqual(cues,["tab-swipe","swipe"])
        cues=[];controller.home.onPanEnded?(1,true)
        XCTAssertTrue(cues.isEmpty,"Cancelled/same-slide gestures do not claim a navigation haptic")
        controller.home.onPanEnded?(2,false)
        XCTAssertEqual(controller.home.selectedSlide,2);XCTAssertEqual(cues,["tab-swipe","swipe"])
    }
    func testNativeHomeNeverRequestsWebDataAndRetainsAuthoredViews() {
        var writes = 0
        let services = NativeAppServices(settings:{["gameSoundsEnabled":false,"musicEnabled":true,"hapticsEnabled":true]},
            setPreference:{_,_ in writes += 1},worldSnapshot:{_,_,_ in throw FixtureError.unavailable},markViewed:{_ in},
            makeGameplay:{_,_ in throw FixtureError.unavailable},flush:{})
        let controller = NativeAppController(resourceRoot:resources(),services:services)
        controller.loadViewIfNeeded()
        XCTAssertEqual(controller.route,.home)
        XCTAssertFalse(controller.home.isHidden)
        XCTAssertTrue(controller.hub.isHidden)
        XCTAssertEqual(writes,0)
        XCTAssertFalse(containsWebView(controller.view))
    }
    func testRapidJourneyBackIsAcceptedOnceWithoutRestartingExit() async throws {
        let (root,window)=try worldEntryFixture(prepare:{_,ready in ready()})
        defer {root.dispose();window.isHidden=true}
        root.navigate(.hub,interrupt:true)
        try await waitFor{root.route == .hub && !root.transitioning && root.hub.scrollView.isUserInteractionEnabled}
        var backs=0,homeArrivals=0
        root.onFeedback={if $0 == "back" {backs += 1}}
        root.onRoute={if $0 == .home {homeArrivals += 1}}
        root.hub.backButton.sendActions(for:.touchUpInside)
        for _ in 0..<12 {
            try await Task.sleep(for:.milliseconds(12))
            root.hub.backButton.sendActions(for:.touchUpInside)
        }
        XCTAssertEqual(backs,1,"Repeated back must not cancel and restart the outgoing Journey pose")
        try await waitFor{root.route == .home && (!root.home.isEntering && root.home.isUserInteractionEnabled)}
        XCTAssertEqual(homeArrivals,1)
    }
    func testLateNavigationCompletionCannotReplaceNewerDestination() async {
        let services = NativeAppServices(settings:{["gameSoundsEnabled":false,"musicEnabled":true,"hapticsEnabled":true]},
            setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw FixtureError.unavailable},markViewed:{_ in},
            makeGameplay:{_,_ in throw FixtureError.unavailable},flush:{})
        let controller = NativeAppController(resourceRoot:resources(),services:services)
        let window = UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController = controller;window.makeKeyAndVisible()
        controller.loadViewIfNeeded()
        controller.navigate(.hub,interrupt:true)
        controller.navigate(.settings,interrupt:true)
        try? await Task.sleep(for:.seconds(2))
        XCTAssertEqual(controller.route,.settings)
        XCTAssertFalse(controller.settingsView.isHidden)
        XCTAssertTrue(controller.hub.isHidden)
        window.isHidden = true
    }
    func testNativeAuthoredWorldSnapshotsAreAcceptedByActualUIKitConsumerAtPhoneAndTabletSizes() throws {
        let layouts=try NativeWorldLayouts()
        var progression=NativeProgressionState();progression.firstPlayTutorialComplete=true
        progression.completedJourneyBoards=[1,11,21]
        for size in [CGSize(width:320,height:568),CGSize(width:390,height:844),CGSize(width:768,height:1024)] {
            for world in 1...3 {
                let raw=try layouts.snapshot(world:world,width:size.width,height:size.height,generation:4,progression:progression)
                guard let snapshot=JimiNativeWorldSnapshot(raw) else {
                    let dump=FileManager.default.temporaryDirectory.appendingPathComponent("native-world-reject-\(world)-\(Int(size.width)).json")
                    try JSONSerialization.data(withJSONObject:raw,options:[.sortedKeys]).write(to:dump)
                    let invalidAmbient=(raw["ambientPlans"] as? [[String:Any]] ?? []).enumerated().filter{JimiNativeWorldAmbient.Plan.parse($0.element,worldID:world)==nil}.map(\.offset)
                    print("[NATIVE_WORLD_REJECT_DUMP] \(dump.path) ambient=\(invalidAmbient)")
                    XCTFail("Native world \(world) at \(size) must satisfy actual UIKit consumer");continue
                }
                XCTAssertEqual(snapshot.worldID,world);XCTAssertEqual(snapshot.generation,4)
                XCTAssertEqual(snapshot.units.count,10)
                XCTAssertEqual(snapshot.units.map(\.boardID),Array((world-1)*10+1...world*10))
                XCTAssertEqual(snapshot.units.first(where:{$0.interim})?.boardID,(world-1)*10+2)
            }
        }
    }
    func testHubWorldPreparationOverlapsExitAndReadinessCannotRevealEarly()async throws {
        var replies:[()->Void]=[]
        let (controller,window)=try worldEntryFixture{_,completion in replies.append(completion)}
        defer{controller.dispose();window.isHidden=true}
        controller.navigate(.hub,interrupt:true)
        try await waitFor{controller.route == .hub && !controller.transitioning && controller.hub.scrollView.isUserInteractionEnabled}
        let unit=try XCTUnwrap(controller.hub.worldUnits.first{$0.tag==1})
        func findArt(_ view:UIView)->UIView? {
            if view.accessibilityIdentifier=="native.hub.art.1" {return view}
            return view.subviews.lazy.compactMap{findArt($0)}.first
        }
        let art=try XCTUnwrap(findArt(unit))
        unit.sendActions(for:.touchUpInside)
        XCTAssertNil(art.layer.animation(forKey:JimiV9HubView.worldTapAnimationKey),"Journey retains its existing Unit exit without the Arcade pulse")
        if !UIAccessibility.isReduceMotionEnabled {
            let bounce=try XCTUnwrap(art.superview?.layer.animation(forKey:NativeHubBackpackFeedback.animationKey) as? CAKeyframeAnimation)
            XCTAssertEqual(bounce.duration,0.4,accuracy:0.0001)
            XCTAssertEqual(bounce.keyTimes,NativeHUDTapMotion.phases.map{NSNumber(value:$0)})
            try await Task.sleep(for:.milliseconds(100))
            XCTAssertGreaterThan(unit.layer.presentation()?.transform.m11 ?? 1,1,"The existing selected Unit scale still paints")
        }
        XCTAssertEqual(replies.count,1,"Destination work must start at the tap, while Hub exit still owns the screen")
        XCTAssertEqual(controller.route,.hub);XCTAssertFalse(controller.hub.isHidden)
        XCTAssertTrue(try XCTUnwrap(controller.world).isHidden)
        replies[0]()
        XCTAssertEqual(controller.route,.hub,"Resource completion cannot replace the actual exit completion")
        try await waitFor{controller.route == .world(1) && controller.world?.isReadyForInput==true}
        XCTAssertEqual(replies.count,1,"Reveal must consume the same prepared destination")
        XCTAssertNil(art.superview?.layer.animation(forKey:NativeHubBackpackFeedback.animationKey),"Hidden hub retires the finite contact")
    }
    func testCancelledHubWorldPreparationCannotRevealAndWarmWorldIsReused()async throws {
        var replies:[()->Void]=[]
        let (controller,window)=try worldEntryFixture{_,completion in replies.append(completion)}
        defer{controller.dispose();window.isHidden=true}
        controller.navigate(.hub,interrupt:true)
        try await waitFor{controller.route == .hub && !controller.transitioning && controller.hub.scrollView.isUserInteractionEnabled}
        controller.navigate(.world(1));let prepared=try XCTUnwrap(controller.world)
        controller.navigate(.home,interrupt:true);replies[0]()
        try await waitFor{controller.route == .home && (!controller.home.isEntering && controller.home.isUserInteractionEnabled)}
        XCTAssertTrue(prepared.isHidden)
        controller.navigate(.hub)
        try await waitFor{controller.route == .hub && !controller.transitioning && controller.hub.scrollView.isUserInteractionEnabled}
        controller.navigate(.world(1));XCTAssertEqual(replies.count,2)
        XCTAssertTrue(controller.world === prepared,"Cancellation must retain the same warm World")
        replies[0]();XCTAssertEqual(controller.route,.hub)
        replies[1]()
        try await waitFor{controller.route == .world(1) && controller.world?.isReadyForInput==true}
    }
    func testBackgroundRetiresPendingWorldPreparationAndResumeUsesFreshReceipt()async throws {
        var replies:[()->Void]=[]
        let (controller,window)=try worldEntryFixture{_,completion in replies.append(completion)}
        defer{controller.dispose();window.isHidden=true}
        controller.navigate(.hub,interrupt:true)
        try await waitFor{controller.route == .hub && !controller.transitioning && controller.hub.scrollView.isUserInteractionEnabled}
        controller.navigate(.world(1))
        try await waitFor{controller.route == .world(1)}
        let prepared=try XCTUnwrap(controller.world)
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        replies[0]();XCTAssertTrue(prepared.isHidden)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertEqual(replies.count,2);XCTAssertTrue(controller.world === prepared)
        replies[0]();XCTAssertTrue(prepared.isHidden)
        replies[1]()
        try await waitFor{controller.world?.isReadyForInput==true}
    }
    func testBackgroundDuringHubExitRestartsRetiredDestinationAfterActualExit()async throws {
        var replies:[()->Void]=[]
        let (controller,window)=try worldEntryFixture{_,completion in replies.append(completion)}
        defer{controller.dispose();window.isHidden=true}
        controller.navigate(.hub,interrupt:true)
        try await waitFor{controller.route == .hub && !controller.transitioning && controller.hub.scrollView.isUserInteractionEnabled}
        controller.navigate(.world(1));XCTAssertEqual(replies.count,1)
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        replies[0]();XCTAssertEqual(controller.route,.hub)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        try await waitFor{replies.count==2 && controller.route == .world(1)}
        replies[0]();XCTAssertTrue(try XCTUnwrap(controller.world).isHidden)
        replies[1]()
        try await waitFor{controller.world?.isReadyForInput==true}
    }
    func testNavigationHeadersShareForestRowCenterAndCloseArtwork() throws {
        let assets=JimiV9Artwork(resourceRoot:resources()),bounds=CGRect(x:0,y:0,width:390,height:844)
        let host=UIViewController(),window=UIWindow(frame:bounds)
        window.rootViewController=host;window.makeKeyAndVisible();host.view.backgroundColor=UIColor(red:243/255,green:238/255,blue:232/255,alpha:1)
        defer{window.isHidden=true}
        let hub=JimiV9HubView(frame:bounds,assets:assets)
        let settings=JimiNativeSettingsView(frame:bounds,assets:assets)
        let backpack=NativeBackpackView(frame:bounds,assets:assets)
        backpack.apply(NativeBackpackCatalog.sections(NativeProgressionState()))
        var entries:[(String,UIView,JimiV9NavigationHeader,[UIButton])]=[
            ("journey",hub,hub.header,[hub.backButton,hub.backpackButton]),
            ("settings",settings,settings.header,[settings.back,settings.developer]),
            ("backpack",backpack,backpack.header,[backpack.close])]
        let layouts=try NativeWorldLayouts()
        var progress=NativeProgressionState();progress.firstPlayTutorialComplete=true
        var worlds:[JimiNativeWorldView]=[]
        defer{worlds.forEach{$0.cleanup()}}
        for id in 1...3 {
            let raw=try layouts.snapshot(world:id,width:390,height:844,generation:10,progression:progress)
            let world=try XCTUnwrap(JimiNativeWorldView(snapshot:raw,assets:assets));worlds.append(world)
            entries.append(("world\(id)",world,world.header,[world.backButton,world.backpackButton]))
        }
        for (name,screen,header,buttons) in entries {
            screen.frame=host.view.bounds;screen.alpha=1;host.view.addSubview(screen)
            window.layoutIfNeeded();screen.setNeedsLayout();screen.layoutIfNeeded()
            let title=try XCTUnwrap(header.subviews.compactMap{$0 as? UILabel}.first)
            let top=max(0,screen.safeAreaInsets.top+screen.bounds.height*0.02-16)
            let expected=top+26-(top+66)*0.1+8
            XCTAssertEqual(JimiV9NavigationHeader.RowLayout.contentHeight,66)
            XCTAssertEqual(header.bounds.height,(top+66)*0.8,accuracy:0.001,name)
            XCTAssertEqual(title.frame.midY,expected,accuracy:0.001,name)
            for button in buttons {
                button.layoutIfNeeded()
                XCTAssertEqual(button.frame.midY,expected,accuracy:0.001,name)
                if let image=button.imageView,!image.bounds.isEmpty {
                    let x=button.center.x,inward:CGFloat=x<header.bounds.midX ? 1:-1
                    let shift=JimiV9NavigationHeader.dividerDrop(at:x/header.bounds.width)-JimiV9NavigationHeader.dividerArchDepth
                    let angle=JimiV9NavigationHeader.tangentAngle(at:x+inward*button.bounds.width/2,width:header.bounds.width)*1.8
                    let dy=(image.center.x-button.bounds.midX)*sin(angle)+(image.center.y-button.bounds.midY)*cos(angle)
                    XCTAssertEqual(button.layer.sublayerTransform.m42,shift,accuracy:0.001,name)
                    XCTAssertEqual(image.convert(image.bounds,to:header).midY,expected+shift+dy,accuracy:0.001,name)
                }
            }
            if let world=screen as? JimiNativeWorldView {
                let art=try XCTUnwrap(world.headerGeometrySnapshot()["backArtwork"])
                let x=world.backButton.center.x
                let shift=JimiV9NavigationHeader.dividerDrop(at:x/header.bounds.width)-JimiV9NavigationHeader.dividerArchDepth
                let angle=JimiV9NavigationHeader.tangentAngle(at:x+world.backButton.bounds.width/2,width:header.bounds.width)*1.8
                XCTAssertEqual(art.midY,expected+shift,accuracy:0.001)
                let extent=24*(abs(cos(angle))+abs(sin(angle)))
                XCTAssertEqual(art.width,extent,accuracy:0.001)
                XCTAssertEqual(art.height,extent,accuracy:0.001)
            }
            if screen === backpack {
                let image=try XCTUnwrap(backpack.close.imageView)
                XCTAssertEqual(image.bounds.width,24,accuracy:0.001)
                XCTAssertEqual(image.bounds.height,24,accuracy:0.001)
            }
            let clip=CGRect(x:0,y:0,width:bounds.width,height:header.bounds.height+8)
            let picture=UIGraphicsImageRenderer(bounds:clip).image{screen.layer.render(in:$0.cgContext)}
            try picture.pngData()?.write(to:URL(fileURLWithPath:"/tmp/nav-consistency-\(name).png"))
            screen.removeFromSuperview()
        }
    }
    func testEveryWorldBackpackButtonReturnsToSameWorldAndScroll() async throws {
        let (controller,window)=try worldEntryFixture{world,done in world.prepare(completion:done)}
        var cues:[String]=[];controller.onFeedback={cues.append($0)}
        defer{controller.dispose();window.isHidden=true}
        controller.navigate(.hub,interrupt:true)
        try await waitFor{controller.route == .hub && !controller.transitioning && controller.hub.scrollView.isUserInteractionEnabled}
        for id in 1...3 {
            controller.navigate(.world(id))
            try await waitFor{controller.route == .world(id) && controller.world?.isReadyForInput==true}
            let world=try XCTUnwrap(controller.world)
            world.scrollView.setContentOffset(CGPoint(x:0,y:150),animated:false)
            let offset=world.scrollView.contentOffset
            XCTAssertEqual(world.backpackButton.accessibilityIdentifier,"native.world.backpack")
            XCTAssertNotNil(world.backpackButton.image(for:.normal))
            XCTAssertTrue(world.hitTest(world.backpackButton.convert(CGPoint(x:20,y:24),to:world),with:nil)?.isDescendant(of:world.backpackButton)==true)
            cues.removeAll()
            world.backpackButton.sendActions(for:.touchUpInside)
            world.backpackButton.sendActions(for:.touchUpInside)
            XCTAssertEqual(cues.filter{$0 == "collection-icon-speech"}.count,1)
            try await waitFor{controller.route == .backpack && controller.backpackView?.isUserInteractionEnabled==true}
            let expectedOrder=id==2 ? ["Beach","Forest","Area 55"]:id==3 ? ["Area 55","Forest","Beach"]:["Forest","Area 55","Beach"]
            XCTAssertEqual(controller.backpackView?.sections.map(\.title),expectedOrder)
            let backpack=try XCTUnwrap(controller.backpackView)
            XCTAssertEqual(backpack.grid.contentOffset.y,-backpack.grid.contentInset.top,accuracy:0.5,"Each World visit starts at its first section")
            XCTAssertTrue(controller.world === world)
            XCTAssertFalse(world.isReadyForInput)
            XCTAssertTrue(world.isHidden)
            try await waitFor{controller.backpackView?.isClosePaintedVisible == true}
            cues.removeAll()
            controller.backpackView?.close.sendActions(for:.touchUpInside)
            XCTAssertEqual(cues.first,"back","World-origin Backpack close retains the existing back cue")
            try await waitFor{controller.route == .world(id) && world.isReadyForInput}
            XCTAssertTrue(controller.world === world)
            XCTAssertEqual(world.scrollView.contentOffset.y,offset.y,accuracy:0.5)
        }
        controller.world?.backButton.sendActions(for:.touchUpInside)
        try await waitFor{controller.route == .hub && !controller.transitioning && controller.hub.scrollView.isUserInteractionEnabled}
        controller.hub.backpackButton.sendActions(for:.touchUpInside)
        try await waitFor{controller.route == .backpack && controller.backpackView?.isUserInteractionEnabled==true}
        XCTAssertEqual(controller.backpackView?.sections.map(\.title),["Forest","Area 55","Beach"],"Hub entry must not retain the previous World priority")
        try await waitFor{controller.backpackView?.isClosePaintedVisible == true}
        controller.backpackView?.close.sendActions(for:.touchUpInside)
        try await waitFor{controller.route == .hub && !controller.transitioning && controller.hub.scrollView.isUserInteractionEnabled}
    }
    func testEveryGameplayReturnFlipsItsUnitOnceAndRetainsPendingExitAcrossBackground() async throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Reduced Motion preserves its no-flip policy")}
        func find(_ view:UIView,_ id:String)->UIView? {
            if view.accessibilityIdentifier==id {return view}
            for child in view.subviews {if let found=find(child,id){return found}}
            return nil
        }
        for path in ["manual-exit","clean-board","fail"] {
            let layouts=try NativeWorldLayouts()
            var progression=NativeProgressionState();progression.firstPlayTutorialComplete=true
            progression.completedJourneyBoards=Set(1...30);progression.viewedJourneyBoards=Set(1...30)
            var exit:(()->Void)?,returnBoard:Int?,holdEntry=false,held:[()->Void]=[],flips=0
            var services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{world,size,generation in
                try layouts.snapshot(world:world,width:size.width,height:size.height,generation:generation,progression:progression,returnBoard:returnBoard)
            },markViewed:{_ in},makeGameplay:{board,onExit in returnBoard=board;exit=onExit;return UIViewController()},flush:{})
            services.prepareWorldEntry={world,done in world.prepare{if holdEntry {held.append(done)}else{done()}}}
            let controller=NativeAppController(resourceRoot:resources(),services:services)
            let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible()
            defer{controller.dispose();window.isHidden=true}
            controller.onFeedback={if $0=="card-entry-flip" {flips+=1}}
            controller.navigate(.world(2),interrupt:true)
            try await waitFor{controller.world?.isReadyForInput==true}
            let world=try XCTUnwrap(controller.world)
            let unit=try XCTUnwrap(world.snapshot.units.first{$0.boardID==16})
            world.scrollView.setContentOffset(.init(x:0,y:unit.frame.minY-150),animated:false)
            let prepared=expectation(description:"Selected Beach06 artwork prepared")
            world.prepare{prepared.fulfill()};await fulfillment(of:[prepared],timeout:10)
            XCTAssertEqual(flips,0,"Ordinary World entry stays silent")
            world.onRequest?("play",16)
            try await waitFor{controller.route == .gameplay}
            let offset=world.scrollView.contentOffset
            if path != "manual-exit" {
                var ready=false;controller.prepareGameplayReturn{ready=$0}
                try await waitFor{ready}
            } else {holdEntry=true}
            try XCTUnwrap(exit)()
            if path == "manual-exit" {
                try await waitFor{held.count==1}
                NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
                NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
                try await waitFor{held.count==2}
                held[0]();XCTAssertEqual(flips,0,"A retired preparation cannot start the flip")
                holdEntry=false;held[1]()
            }
            try await waitFor{flips==1 && world.isReadyForInput}
            XCTAssertTrue(controller.world === world,path)
            XCTAssertEqual(world.snapshot.returnBoardID,16,path)
            XCTAssertNotNil(find(world,"native.world.return-reminder"),path)
            XCTAssertEqual(world.scrollView.contentOffset.y,offset.y,accuracy:0.5,path)
            let shifted=offset.y+12
            world.scrollView.setContentOffset(.init(x:0,y:shifted),animated:false)
            XCTAssertEqual(world.scrollView.contentOffset.y,shifted,accuracy:0.5,"Flip must retain user scroll")
            controller.navigate(.hub,interrupt:true)
            try await waitFor{controller.route == .hub && !controller.transitioning && controller.hub.scrollView.isUserInteractionEnabled}
            XCTAssertNil(find(world,"native.world.return-reminder"),"Back cancels the owned reminder")
            controller.navigate(.world(2))
            try await waitFor{controller.world?.isReadyForInput==true}
            XCTAssertEqual(flips,1,"Ordinary revisit must not replay the consumed gameplay return")
        }
    }
    func testPreparedWorldReturnReadsLatestUnreadDiscoveries() async throws {
        for (worldID,board,id) in [(1,6,"mushroom"),(1,7,"barell"),(2,12,"fish"),(3,23,"spaceship")] {
            let layouts=try NativeWorldLayouts()
            var progression=NativeProgressionState();progression.firstPlayTutorialComplete=true
            var exit:(()->Void)?
            var services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{world,size,generation in
                try layouts.snapshot(world:world,width:size.width,height:size.height,generation:generation,progression:progression)
            },markViewed:{_ in},makeGameplay:{_,onExit in exit=onExit;return UIViewController()},flush:{})
            services.journeyProgression={progression}
            services.prepareReturnWorld={_,done in done()}
            let controller=NativeAppController(resourceRoot:resources(),services:services)
            let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible()
            defer{controller.dispose();window.isHidden=true}
            controller.navigate(.world(worldID),interrupt:true)
            try await waitFor{controller.world?.isReadyForInput==true}
            let retained=try XCTUnwrap(controller.world)
            XCTAssertTrue(retained.backpackAlert.isHidden)
            retained.onRequest?("play",(worldID-1)*10+1)
            try await waitFor{controller.route == .gameplay}
            var ready=false;controller.prepareGameplayReturn{ready=$0}
            try await waitFor{ready}
            XCTAssertTrue(progression.announceJourneyDie(id,board:board))
            try XCTUnwrap(exit)()
            try await waitFor{controller.route == .world(worldID) && controller.world?.isReadyForInput==true}
            XCTAssertTrue(controller.world === retained)
            XCTAssertFalse(retained.backpackAlert.isHidden,id)
        }
    }
    func testBackpackReturnKeepsNavigationBackgroundUntilWorldActuallyEnters() async throws {
        for disposeWhileWaiting in [false,true] {
            var hold=false,pending:[()->Void]=[]
            let (controller,window)=try worldEntryFixture{world,done in
                world.prepare{if hold {pending.append(done)}else{done()}}
            }
            defer{controller.dispose();window.isHidden=true}
            controller.navigate(.world(1),interrupt:true)
            try await waitFor{controller.world?.isReadyForInput==true}
            controller.navigate(.backpack)
            try await waitFor{controller.route == .backpack && !controller.transitioning}
            hold=true;controller.backpackView?.close.sendActions(for:.touchUpInside)
            try await waitFor{controller.route == .world(1) && pending.count==1}
            let bridge=try XCTUnwrap(controller.view.layer.sublayers?.first{$0.name=="native.navigation.background-handoff"})
            XCTAssertTrue(controller.world?.isHidden==true)
            XCTAssertTrue(controller.transitioning,"Readiness remains authoritative")
            XCTAssertEqual(bridge.opacity,0,"Readiness preserves the shared clear fade gap")
            XCTAssertNil(bridge.animationKeys(),"The readiness bridge has no clock or flickering exit")
            XCTAssertFalse(bridge.sublayers?.isEmpty ?? true)
            if disposeWhileWaiting {
                controller.dispose();controller.dispose();pending.removeFirst()()
                XCTAssertNil(bridge.superlayer,"Dispose and stale preparation cannot leave retained chrome")
            } else {
                pending.removeFirst()()
                XCTAssertNil(bridge.superlayer,"Real entry replaces the static surface atomically")
                let header=try XCTUnwrap(controller.world?.header)
                let route=try XCTUnwrap(header.layer as? JimiV9NavigationRouteLayer)
                let decoration=try XCTUnwrap(route.decorationLayer)
                let group=try XCTUnwrap(decoration.animation(forKey:"world.enter") as? CAAnimationGroup)
                let motion=try XCTUnwrap(group.animations?.compactMap{$0 as? CAKeyframeAnimation}.first{$0.keyPath=="transform"})
                let values=try XCTUnwrap(motion.values as? [NSValue])
                let scales=values.map{hypot($0.caTransform3DValue.m11,$0.caTransform3DValue.m12)}
                XCTAssertEqual(scales.first!,1.025,accuracy:0.00001)
                XCTAssertEqual(scales.last!,1.025,accuracy:0.00001)
                XCTAssertEqual(scales.max()!,1.025*1.12,accuracy:0.00001,"Backpack return has the same12percent scale bounce as forward navigation")
                XCTAssertTrue(values.allSatisfy{$0.caTransform3DValue.m42==0},"Return bounce never resets the divider vertically")

                try await waitFor{controller.world?.isReadyForInput==true}
                XCTAssertFalse(controller.view.layer.sublayers?.contains{$0.name=="native.navigation.background-handoff"} ?? true)
            }
        }
    }

    func testHomeReturnCompletesContentAdmissionAfterNavigationTail() async throws {
        let (controller,window)=try worldEntryFixture{world,done in world.prepare(completion:done)}
        defer{controller.dispose();window.isHidden=true}
        try await waitFor{!controller.transitioning && controller.home.isUserInteractionEnabled}
        controller.navigate(.hub)
        try await waitFor{controller.route == .hub && !controller.transitioning}
        controller.navigate(.home)
        let deadline=Date().addingTimeInterval(5)
        while !(controller.route == .home && !controller.transitioning && !controller.home.isEntering),Date()<deadline {try await Task.sleep(for:.milliseconds(10))}
        if controller.route != .home || controller.transitioning || controller.home.isEntering {reportFixtureWindows(window,label:"minimal Home return timeout")}
        XCTAssertEqual(controller.route,.home);XCTAssertFalse(controller.transitioning);XCTAssertFalse(controller.home.isEntering)
    }

    func testEveryTopNavigationRouteUsesTheSameFasterInstalledRhythm() async throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Full navigation recipe required")}
        let (controller,window)=try worldEntryFixture{world,done in world.prepare(completion:done)}
        defer{controller.dispose();window.isHidden=true}
        let speed=1.3*1.2
        XCTAssertEqual(JimiV9ArchedNavigationTitle.navigationSpeed,speed,accuracy:0.000001)
        XCTAssertEqual(JimiV9NavigationHeader.RowLayout.contentHeight,66)
        func header(for route:NativeAppController.Route)->JimiV9NavigationHeader? {
            switch route {
            case .hub:return controller.hub.header
            case .world:return controller.world?.header
            case .arcadeHub:return controller.arcadeHub.hub.header
            case .settings:return controller.settingsView.header
            case .backpack:return controller.backpackView?.header
            default:return nil
            }
        }
        var routeEpoch:CFTimeInterval=0,incomingMinimumEpoch:CFTimeInterval?
        let minimumHandoff=(2*0.13+0.56)/speed+0.209262-0.10/speed
        func installed(_ header:JimiV9NavigationHeader,entering:Bool,label:String) throws {
            let key=header.layer.animation(forKey:entering ? "world.enter":"world.exit") != nil ? (entering ? "world.enter":"world.exit"):"native-route"
            let parent=try XCTUnwrap(header.layer.animation(forKey:key) as? CAAnimationGroup,label)
            let expectedDuration=(entering ? 0.10+2*0.13+0.56:3*0.13+0.56)/speed
            XCTAssertEqual(parent.duration,expectedDuration,accuracy:0.000001,label)
            let installedEpoch=header.layer.convertTime(parent.beginTime,to:nil)
            XCTAssertGreaterThanOrEqual(installedEpoch,routeEpoch-0.005,label)
            if entering,let minimum=incomingMinimumEpoch {
                XCTAssertGreaterThanOrEqual(installedEpoch,minimum-0.005,"Incoming navigation retains the Forest reference title gap: \(label)")
                XCTAssertLessThanOrEqual(installedEpoch,max(minimum,CACurrentMediaTime())+0.005,"Only the header waits for the shared handoff deadline: \(label)")
            } else {
                XCTAssertLessThanOrEqual(installedEpoch,CACurrentMediaTime()+0.005,"Outgoing and Home-origin navigation start on installation: \(label)")
            }
            let decorationLayer=try XCTUnwrap((header.layer as? JimiV9NavigationRouteLayer)?.decorationLayer,label)
            let decoration=try XCTUnwrap(decorationLayer.animation(forKey:key) as? CAAnimationGroup,label)
            XCTAssertEqual(decoration.duration,expectedDuration,accuracy:0.000001,label)
            let background=try XCTUnwrap(decoration.animations?.compactMap{$0 as? CAKeyframeAnimation}.first{$0.keyPath == "transform"},label)
            XCTAssertEqual(background.duration,0.56/speed,accuracy:0.000001,label)
            XCTAssertEqual(background.beginTime,0,accuracy:0.000001,label)
            let poses=try XCTUnwrap(background.values as? [NSValue],label).map{$0.caTransform3DValue}
            XCTAssertEqual(try XCTUnwrap(poses.last).m11,header.continuousBackground || entering ? 1.025:1,accuracy:0.000001,label)
            if header.continuousBackground {
                XCTAssertEqual(try XCTUnwrap(poses.first).m11,1.025,accuracy:0.000001,label)
                XCTAssertEqual(try XCTUnwrap(poses.map{$0.m11}.max()),entering ? 1.148:1.025,accuracy:0.000001,label)
                if entering {XCTAssertTrue(poses.allSatisfy{$0.m42 == 0},label)}
                else {XCTAssertEqual(try XCTUnwrap(poses.last).m42,-14.4,accuracy:0.001,label)}
            }
            let title=try XCTUnwrap(header.subviews.compactMap{$0 as? JimiV9ArchedNavigationTitle}.first,label)
            let targets:[UIView]=[title as UIView]+header.subviews.compactMap{$0 as? UIButton}.map{$0 as UIView}
            for (index,target) in targets.enumerated() {
                let content=try XCTUnwrap(target.layer.animation(forKey:"native.navigation.content.enter") as? CAAnimationGroup,label)
                XCTAssertEqual(content.duration,0.56/speed,accuracy:0.000001,label)
                let expectedDelay=(entering ? 0.10+Double(index)*0.13:Double(index == 0 ? 2:index-1)*0.13)/speed
                let epoch=target.layer.convertTime(parent.beginTime,from:header.layer)
                XCTAssertEqual(content.beginTime-epoch,expectedDelay,accuracy:0.00001,label)
            }
            print("NAVCONSISTENCY \(label) duration=\(parent.duration) backgroundDuration=\(background.duration) backgroundDelay=\(background.beginTime) contentCount=\(targets.count) continuous=\(header.continuousBackground)")
        }
        try await waitFor{!controller.transitioning && controller.home.isUserInteractionEnabled}
        // Every top route shares fade/scale, including Home destinations. Each header
        // still shares the same element duration, stagger and reversed ordering.
        let destinations:[NativeAppController.Route]=[
            .hub,.world(1),.backpack,.world(1),.backpack,.world(1),.hub,
            .world(2),.backpack,.world(2),.hub,.world(3),.backpack,.world(3),.hub,.home,
            .arcadeHub,.backpack,.arcadeHub,.home,.settings,.home
        ]
        for next in destinations {
            let previous=controller.route
            let outgoing=header(for:previous)
            routeEpoch=CACurrentMediaTime();incomingMinimumEpoch=nil
            controller.navigate(next)
            if let outgoing {
                try installed(outgoing,entering:false,label:"\(previous)->\(next) outgoing")
                let key=outgoing.layer.animation(forKey:"world.exit") != nil ? "world.exit":"native-route"
                let group=try XCTUnwrap(outgoing.layer.animation(forKey:key))
                incomingMinimumEpoch=outgoing.layer.convertTime(group.beginTime,to:nil)+minimumHandoff
            }
            if next != .home {
                try await waitFor{
                    guard controller.route == next,let incoming=header(for:next) else{return false}
                    return incoming.layer.animation(forKey:"world.enter") != nil || incoming.layer.animation(forKey:"native-route") != nil
                }
                try installed(try XCTUnwrap(header(for:next)),entering:true,label:"\(previous)->\(next) incoming")
            }
            let admissionDeadline=Date().addingTimeInterval(5)
            while !(controller.route == next && !controller.transitioning),Date()<admissionDeadline {try await Task.sleep(for:.milliseconds(10))}
            guard controller.route == next && !controller.transitioning else {
                let hero=controller.home.heroView.layer
                print("NAVCONSISTENCY admission-timeout expected=\(next) actual=\(controller.route) transitioning=\(controller.transitioning) homeEntering=\(controller.home.isEntering) homeInteractive=\(controller.home.isUserInteractionEnabled) heroKeys=\(hero.animationKeys() ?? []) heroSpeed=\(hero.speed) heroTime=\(hero.timeOffset) heroBegin=\(hero.beginTime)")
                reportFixtureWindows(window,label:"matrix \(previous)->\(next) admission timeout")
                XCTFail("Actual content admission failed for \(previous)->\(next)")
                return
            }
            XCTAssertFalse(controller.view.layer.sublayers?.contains{$0.name == "native.navigation.background-handoff"} ?? true)
        }
    }

    func testFastBackpackReturnsPreserveForestReferenceTitleGapWithoutHoldingScreenReveal() async throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Full title handoff required")}
        let (controller,window)=try worldEntryFixture{world,done in world.prepare(completion:done)}
        defer{controller.dispose();window.isHidden=true}
        try await waitFor{!controller.transitioning && controller.home.isUserInteractionEnabled}
        let referenceGap=0.209262,speed=1.3*1.2
        for origin:NativeAppController.Route in [.hub,.world(1)] {
            controller.navigate(origin)
            try await waitFor{controller.route == origin && !controller.transitioning}
            controller.navigate(.backpack)
            try await waitFor{controller.route == .backpack && !controller.transitioning}
            let backpack=try XCTUnwrap(controller.backpackView)
            let outgoingTitle=try XCTUnwrap(backpack.header.subviews.compactMap{$0 as? JimiV9ArchedNavigationTitle}.first)
            var revealedAt:CFTimeInterval?
            controller.onRoute={route in if route == origin {revealedAt=CACurrentMediaTime()}}
            backpack.close.sendActions(for:.touchUpInside)
            let outgoing=try XCTUnwrap(outgoingTitle.layer.animation(forKey:"native.navigation.content.enter"))
            let outgoingEnd=outgoingTitle.layer.convertTime(outgoing.beginTime+outgoing.duration,to:nil)
            let minimumParentEpoch=outgoingEnd+referenceGap-0.10/speed
            let deadline=Date().addingTimeInterval(5)
            while controller.route != origin,Date()<deadline {try await Task.sleep(for:.milliseconds(4))}
            let header=try XCTUnwrap(origin == .hub ? controller.hub.header:controller.world?.header)
            let key=origin == .hub ? "native-route":"world.enter"
            while header.layer.animation(forKey:key) == nil,Date()<deadline {try await Task.sleep(for:.milliseconds(4))}
            let parent=try XCTUnwrap(header.layer.animation(forKey:key))
            let title=try XCTUnwrap(header.subviews.compactMap{$0 as? JimiV9ArchedNavigationTitle}.first)
            let incoming=try XCTUnwrap(title.layer.animation(forKey:"native.navigation.content.enter"))
            let incomingStart=title.layer.convertTime(incoming.beginTime,to:nil)
            XCTAssertGreaterThanOrEqual(incomingStart-outgoingEnd,referenceGap-0.005,"Fast Backpack return preserves the observed Forest title gap")
            XCTAssertEqual(parent.duration,(0.10+2*0.13+0.56)/speed,accuracy:0.000001)
            XCTAssertEqual(incoming.duration,0.56/speed,accuracy:0.000001,"The gap schedules the same curve instead of slowing or compressing it")
            XCTAssertLessThan(try XCTUnwrap(revealedAt),minimumParentEpoch,"Actual Backpack content completion still reveals the destination before its header-only deadline")
            XCTAssertEqual(incoming.fillMode,.backwards,"Delayed incoming title holds its hidden first pose")
            print("NAVHANDOFF origin=\(origin) titleGap=\(incomingStart-outgoingEnd) headerEpoch=\(header.layer.convertTime(parent.beginTime,to:nil)) screenReveal=\(revealedAt ?? -1)")
            try await waitFor{!controller.transitioning}
            controller.onRoute=nil
        }
    }

    func testPendingNavigationHandoffDeadlinePausesAndRejectsStaleWorldReadiness() async throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Full header handoff required")}
        var hold=false,pending:[()->Void]=[]
        let (controller,window)=try worldEntryFixture{world,done in world.prepare{if hold {pending.append(done)}else{done()}}}
        defer{controller.dispose();window.isHidden=true}
        try await waitFor{!controller.transitioning && controller.home.isUserInteractionEnabled}
        controller.navigate(.world(1));try await waitFor{controller.world?.isReadyForInput == true}
        let referenceGap=0.209262,speed=1.3*1.2
        for suspendPending in [true,false] {
            pending.removeAll();hold=false
            controller.navigate(.backpack)
            try await waitFor{controller.route == .backpack && !controller.transitioning}
            let backpack=try XCTUnwrap(controller.backpackView)
            hold=true;backpack.close.sendActions(for:.touchUpInside)
            let title=try XCTUnwrap(backpack.header.subviews.compactMap{$0 as? JimiV9ArchedNavigationTitle}.first)
            let outgoing=try XCTUnwrap(title.layer.animation(forKey:"native.navigation.content.enter"))
            let titleEnd=title.layer.convertTime(outgoing.beginTime+outgoing.duration,to:nil)
            try await waitFor{controller.route == .world(1) && pending.count == 1}
            let world=try XCTUnwrap(controller.world)
            XCTAssertTrue(world.isHidden)
            var pausedFor:CFTimeInterval=0
            if suspendPending {
                let pausedAt=CACurrentMediaTime()
                NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
                try await Task.sleep(for:.milliseconds(200))
                pausedFor=CACurrentMediaTime()-pausedAt
                NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
                try await waitFor{pending.count == 2}
                pending[0]()
                XCTAssertTrue(world.isHidden,"Retired preparation cannot consume or install the pending header deadline")
                XCTAssertNil(world.header.layer.animation(forKey:"world.enter"))
            } else {
                try await Task.sleep(for:.milliseconds(800))
            }
            let releaseAt=CACurrentMediaTime();hold=false
            pending[suspendPending ? 1:0]()
            let group=try XCTUnwrap(world.header.layer.animation(forKey:"world.enter"))
            let epoch=world.header.layer.convertTime(group.beginTime,to:nil)
            let minimum=titleEnd+referenceGap-0.10/speed+pausedFor
            XCTAssertGreaterThanOrEqual(epoch,minimum-0.02,"A pending deadline shifts by the real background pause")
            XCTAssertGreaterThanOrEqual(epoch,releaseAt-0.005,"Readiness arriving after the gap starts a fresh complete curve")
            XCTAssertLessThanOrEqual(epoch,max(minimum,CACurrentMediaTime())+0.02,"Readiness cannot add a second handoff wait")
            XCTAssertEqual(group.duration,(0.10+2*0.13+0.56)/speed,accuracy:0.000001)
            if suspendPending {
                let installedEpoch=group.beginTime
                pending[0]()
                XCTAssertEqual(try XCTUnwrap(world.header.layer.animation(forKey:"world.enter")).beginTime,installedEpoch,accuracy:0.000001,"A stale replacement receipt cannot restart the admitted header")
            }
            try await waitFor{world.isReadyForInput && !controller.transitioning}
            XCTAssertFalse(controller.view.layer.sublayers?.contains{$0.name == "native.navigation.background-handoff"} ?? true)
        }
    }

    func testInstalledFutureWorldHeaderPausesWithoutCompressingOrRestartingEntry() async throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Full future World header required")}
        let (controller,window)=try worldEntryFixture{world,done in world.prepare(completion:done)}
        defer{controller.dispose();window.isHidden=true}
        try await waitFor{!controller.transitioning && controller.home.isUserInteractionEnabled}
        controller.navigate(.world(1));try await waitFor{controller.world?.isReadyForInput == true}
        controller.navigate(.backpack);try await waitFor{controller.route == .backpack && !controller.transitioning}
        controller.backpackView?.close.sendActions(for:.touchUpInside)
        let deadline=Date().addingTimeInterval(5)
        while !(controller.route == .world(1) && controller.world?.header.layer.animation(forKey:"world.enter") != nil),Date()<deadline {try await Task.sleep(for:.milliseconds(4))}
        let world=try XCTUnwrap(controller.world),header=try XCTUnwrap(controller.world?.header)
        let parent=try XCTUnwrap(header.layer.animation(forKey:"world.enter"))
        let title=try XCTUnwrap(header.subviews.compactMap{$0 as? JimiV9ArchedNavigationTitle}.first)
        let content=try XCTUnwrap(title.layer.animation(forKey:"native.navigation.content.enter"))
        let physicalEpoch=header.layer.convertTime(parent.beginTime,to:nil)
        XCTAssertLessThan(header.layer.convertTime(CACurrentMediaTime(),from:nil),parent.beginTime,"Suspend while the installed World header is still waiting for its reference boundary")
        let pausedAt=CACurrentMediaTime()
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        XCTAssertEqual(header.layer.speed,0)
        let frozen=header.layer.convertTime(CACurrentMediaTime(),from:nil)
        try await Task.sleep(for:.milliseconds(200))
        XCTAssertEqual(header.layer.convertTime(CACurrentMediaTime(),from:nil),frozen,accuracy:0.000001)
        let pausedFor=CACurrentMediaTime()-pausedAt
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertEqual(header.layer.speed,1)
        let resumed=try XCTUnwrap(header.layer.animation(forKey:"world.enter"))
        XCTAssertEqual(resumed.beginTime,parent.beginTime,accuracy:0.000001,"Installed entry resumes its exact local clock")
        XCTAssertEqual(resumed.duration,(0.10+2*0.13+0.56)/(1.3*1.2),accuracy:0.000001)
        XCTAssertEqual(try XCTUnwrap(title.layer.animation(forKey:"native.navigation.content.enter")).beginTime,content.beginTime,accuracy:0.000001,"Foreground cannot restart or compress title entry")
        XCTAssertEqual(header.layer.convertTime(resumed.beginTime,to:nil)-physicalEpoch,pausedFor,accuracy:0.02)
        try await waitFor{world.isReadyForInput && !controller.transitioning}
    }

    func testWorldContentAdmissionCannotTruncateIndependentHeaderEntry() async throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Full independent header entry required")}
        let (controller,window)=try worldEntryFixture{world,done in world.prepare(completion:done)}
        defer{controller.dispose();window.isHidden=true}
        try await waitFor{!controller.transitioning && controller.home.isUserInteractionEnabled}
        controller.navigate(.world(1))
        try await waitFor{controller.world?.isReadyForInput == true && !controller.transitioning}
        let world=try XCTUnwrap(controller.world),header=try XCTUnwrap(controller.world?.header)
        // Install the actual World caller's incoming group while the content is
        // already ready. A generic idle/admission refresh must not shorten this
        // separately owned canonical navigation lifetime.
        let transform=CAKeyframeAnimation(keyPath:"transform")
        transform.values=[NSValue(caTransform3D:CATransform3DMakeScale(0.65,0.65,1)),NSValue(caTransform3D:CATransform3DIdentity)];transform.duration=0.56
        let opacity=CAKeyframeAnimation(keyPath:"opacity");opacity.values=[0,1];opacity.duration=0.56
        let source=CAAnimationGroup();source.animations=[transform,opacity];source.duration=0.56;source.fillMode = .both;source.isRemovedOnCompletion=false
        header.layer.add(source,forKey:"world.enter")
        let installed=try XCTUnwrap(header.layer.animation(forKey:"world.enter"))
        let title=try XCTUnwrap(header.subviews.compactMap{$0 as? JimiV9ArchedNavigationTitle}.first)
        XCTAssertNotNil(title.layer.animation(forKey:"native.navigation.content.enter"))
        world.finishPresentationAdmission()
        let preserved=try XCTUnwrap(header.layer.animation(forKey:"world.enter"),"Content admission cannot retire independent navigation entry")
        XCTAssertEqual(preserved.beginTime,installed.beginTime,accuracy:0.000001)
        XCTAssertEqual(preserved.duration,(0.10+2*0.13+0.56)/(1.3*1.2),accuracy:0.000001)
        XCTAssertNotNil(title.layer.animation(forKey:"native.navigation.content.enter"),"Title/icon stagger remains under its existing finite navigation clock")
        try await Task.sleep(for:.seconds(preserved.duration+0.05))
        XCTAssertNotNil(header.layer.animation(forKey:"world.enter"),"The settled World group stays owned until normal route replacement/park")
        world.park()
        XCTAssertNil(header.layer.animation(forKey:"world.enter"))
        XCTAssertNil(title.layer.animation(forKey:"native.navigation.content.enter"))
        XCTAssertNil((header.layer as? JimiV9NavigationRouteLayer)?.decorationLayer?.animation(forKey:"world.enter"))
    }

    func testDelayedBackpackReturnsKeepCanonicalClockAfterForegroundResume() async throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Full navigation clocks required")}
        let (controller,window)=try worldEntryFixture{world,done in world.prepare(completion:done)}
        defer{controller.dispose();window.isHidden=true}
        try await waitFor{!controller.transitioning && controller.home.isUserInteractionEnabled}
        controller.navigate(.world(1))
        try await waitFor{controller.world?.isReadyForInput == true}
        let speed=1.3*1.2
        func assertFresh(_ header:JimiV9NavigationHeader,key:String,entering:Bool,minimumEpoch:CFTimeInterval?=nil) throws {
            let group=try XCTUnwrap(header.layer.animation(forKey:key) as? CAAnimationGroup)
            XCTAssertEqual(group.duration,(entering ? 0.10+2*0.13+0.56:3*0.13+0.56)/speed,accuracy:0.000001)
            let age=header.layer.convertTime(CACurrentMediaTime(),from:nil)-group.beginTime
            if let minimumEpoch {
                let epoch=header.layer.convertTime(group.beginTime,to:nil)
                XCTAssertGreaterThanOrEqual(epoch,minimumEpoch-0.005)
                XCTAssertLessThanOrEqual(epoch,max(minimumEpoch,CACurrentMediaTime())+0.005,"A new route preserves the handoff without compressing its curve")
            } else {
                XCTAssertGreaterThanOrEqual(age,-0.005)
                XCTAssertLessThan(age,0.06,"A new route starts at its first pose, even after old header clocks have resumed")
            }
            let title=try XCTUnwrap(header.subviews.compactMap{$0 as? JimiV9ArchedNavigationTitle}.first)
            let targets:[UIView]=[title as UIView]+header.subviews.compactMap{$0 as? UIButton}.map{$0 as UIView}
            for (index,target) in targets.enumerated() {
                let animation=try XCTUnwrap(target.layer.animation(forKey:"native.navigation.content.enter") as? CAAnimationGroup)
                XCTAssertEqual(animation.duration,0.56/speed,accuracy:0.000001,"Waiting cannot compress title/icon tracks")
                let delay=(entering ? 0.10+Double(index)*0.13:Double(index == 0 ? 2:index-1)*0.13)/speed
                let start=target.layer.convertTime(group.beginTime,from:header.layer)
                XCTAssertEqual(animation.beginTime-start,delay,accuracy:0.00001)
            }
            print("NAVCLOCK delayed-return entering=\(entering) age=\(age) duration=\(group.duration) layerBegin=\(header.layer.beginTime) layerOffset=\(header.layer.timeOffset)")
        }
        for suspendWhileOpen in [false,true] {
            controller.navigate(.backpack)
            try await waitFor{controller.route == .backpack && !controller.transitioning}
            let backpack=try XCTUnwrap(controller.backpackView)
            try await Task.sleep(for:.milliseconds(1200))
            if suspendWhileOpen {
                NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
                XCTAssertEqual(backpack.header.layer.speed,0)
                try await Task.sleep(for:.milliseconds(200))
                NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
                XCTAssertEqual(backpack.header.layer.speed,1)
                XCTAssertEqual(backpack.header.layer.timeOffset,0)
                XCTAssertNotEqual(backpack.header.layer.beginTime,0,"Use a genuinely resumed nonzero layer clock")
            }
            backpack.close.sendActions(for:.touchUpInside)
            try assertFresh(backpack.header,key:"native-route",entering:false)
            let outgoing=try XCTUnwrap(backpack.header.layer.animation(forKey:"native-route"))
            let minimum=backpack.header.layer.convertTime(outgoing.beginTime,to:nil)+(2*0.13+0.56)/speed+0.209262-0.10/speed
            let deadline=Date().addingTimeInterval(5)
            while !(controller.route == .world(1) && controller.world?.header.layer.animation(forKey:"world.enter") != nil),Date()<deadline {try await Task.sleep(for:.milliseconds(4))}
            let world=try XCTUnwrap(controller.world)
            XCTAssertEqual(controller.route,.world(1))
            try assertFresh(world.header,key:"world.enter",entering:true,minimumEpoch:minimum)
            try await waitFor{world.isReadyForInput && !controller.transitioning}
            XCTAssertFalse(controller.view.layer.sublayers?.contains{$0.name == "native.navigation.background-handoff"} ?? true)
        }
    }

    func testVisibleBackpackCloseInterruptsEntryWithoutAdmittingCollection() async throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Full entry window required")}
        for origin:NativeAppController.Route in [.hub,.world(1),.arcadeHub] {
            let (controller,window)=try worldEntryFixture{world,done in world.prepare(completion:done)}
            defer{controller.dispose();window.isHidden=true}
            try await waitFor{!controller.transitioning && controller.home.isUserInteractionEnabled}
            controller.navigate(origin)
            try await waitFor{controller.route == origin && !controller.transitioning}
            controller.navigate(.backpack)
            try await waitFor{
                guard controller.route == .backpack,controller.transitioning,
                      let backpack=controller.backpackView else{return false}
                return backpack.isClosePaintedVisible && (backpack.close.layer.presentation()?.opacity ?? 0)>0.05
            }
            let backpack=try XCTUnwrap(controller.backpackView)
            XCTAssertTrue(controller.transitioning,"Close is admitted before collection entry completes")
            XCTAssertTrue(backpack.isUserInteractionEnabled)
            XCTAssertTrue(backpack.header.isUserInteractionEnabled)
            XCTAssertFalse(backpack.grid.isUserInteractionEnabled,"Early Close cannot admit collection card taps")
            let painted=try XCTUnwrap(backpack.close.layer.presentation())
            let windowLayer=try XCTUnwrap(window.layer.presentation())
            let centre=CGPoint(x:painted.bounds.midX,y:painted.bounds.midY)
            let paintedWindowPoint=windowLayer.convert(centre,from:painted)
            let hit=try XCTUnwrap(window.hitTest(paintedWindowPoint,with:nil))
            XCTAssertTrue(hit === backpack.close || hit.isDescendant(of:backpack.close),"Actual painted X must receive a touch while its entry is still moving")
            var cues:[String]=[];controller.onFeedback={cues.append($0)}
            backpack.close.sendActions(for:.touchUpInside)
            XCTAssertTrue(controller.transitioning)
            XCTAssertFalse(backpack.isUserInteractionEnabled,"Accepted Close owns the exit immediately")
            XCTAssertFalse(backpack.grid.isUserInteractionEnabled)
            backpack.close.sendActions(for:.touchUpInside)
            XCTAssertEqual(cues.filter{$0 == "back"}.count,1,"Duplicate Close cannot restart the exit")
            try await waitFor{controller.route == origin && !controller.transitioning}
            try await Task.sleep(for:.milliseconds(700))
            XCTAssertEqual(controller.route,origin,"Old entry completion cannot replace the accepted return")
            XCTAssertFalse(controller.transitioning)
            XCTAssertTrue(backpack.isHidden)
            XCTAssertFalse(backpack.isUserInteractionEnabled)
            XCTAssertFalse(backpack.grid.isUserInteractionEnabled,"Cancelled entry completion cannot unlock hidden collection")
            XCTAssertFalse(controller.view.layer.sublayers?.contains{$0.name == "native.navigation.background-handoff"} ?? true)
        }
    }

    func testHubToWorldBackgroundClearsReadinessGapAndFadesWithTitle() async throws {
        var ready:(()->Void)?
        let (controller,window)=try worldEntryFixture{world,done in world.prepare{ready=done}}
        defer{controller.dispose();window.isHidden=true}
        func capture(_ name:String) {
            CATransaction.flush()
            let image=UIGraphicsImageRenderer(bounds:window.bounds).image{_ in window.drawHierarchy(in:window.bounds,afterScreenUpdates:true)}
            let attachment=XCTAttachment(image:image);attachment.name=name;attachment.lifetime = .keepAlways;add(attachment)
        }
        try await waitFor{!controller.transitioning && controller.home.isUserInteractionEnabled}
        controller.navigate(.hub)
        try await waitFor{controller.route == .hub && !controller.transitioning}
        controller.navigate(.world(1))
        XCTAssertTrue(controller.hub.header.fadeBackgroundDuringHandoff)
        let outgoing=try XCTUnwrap((controller.hub.header.layer as? JimiV9NavigationRouteLayer)?.decorationLayer)
        let exit=try XCTUnwrap(outgoing.animation(forKey:"native-route") as? CAAnimationGroup)
        let exitFade=try XCTUnwrap(exit.animations?.compactMap{$0 as? CAKeyframeAnimation}.first{$0.keyPath=="opacity"})
        let exitMotion=try XCTUnwrap(exit.animations?.compactMap{$0 as? CAKeyframeAnimation}.first{$0.keyPath=="transform"})
        XCTAssertEqual(exitFade.duration,JimiV9ArchedNavigationTitle.elementDuration,accuracy:0.000001)
        XCTAssertEqual(exitMotion.duration,exitFade.duration,accuracy:0.000001)
        XCTAssertEqual(exitFade.beginTime,0);XCTAssertEqual(exitMotion.beginTime,0)
        let positions=try XCTUnwrap(exitMotion.values as? [NSValue]).map{$0.caTransform3DValue.m42}
        XCTAssertGreaterThan(try XCTUnwrap(positions.max()),0,"Reverse spring anticipates before leaving upward")
        XCTAssertEqual(try XCTUnwrap(positions.last),-14.4,accuracy:0.001)
        let alphas=try XCTUnwrap(exitFade.values as? [NSNumber]).map{$0.doubleValue}
        XCTAssertEqual(try XCTUnwrap(alphas.first),1,accuracy:0.001)
        XCTAssertEqual(try XCTUnwrap(alphas.last),0,accuracy:0.001)
        try await waitFor{controller.route == .world(1) && ready != nil}
        let bridge=try XCTUnwrap(controller.view.layer.sublayers?.first{$0.name=="native.navigation.background-handoff"})
        XCTAssertEqual(bridge.opacity,0,accuracy:0.01,"Preparation must not leave an isolated navigation background")
        capture("Hub to World readiness gap")
        let done=try XCTUnwrap(ready);ready=nil;done()
        let header=try XCTUnwrap(controller.world?.header)
        let decoration=try XCTUnwrap((header.layer as? JimiV9NavigationRouteLayer)?.decorationLayer)
        let group=try XCTUnwrap(decoration.animation(forKey:"world.enter") as? CAAnimationGroup)
        let fade=try XCTUnwrap(group.animations?.compactMap{$0 as? CAKeyframeAnimation}.first{$0.keyPath=="opacity"})
        XCTAssertEqual(try XCTUnwrap(fade.values as? [NSNumber]).map{$0.doubleValue},[0,1])
        XCTAssertEqual(fade.beginTime,JimiV9ArchedNavigationTitle.contentDelay(index:0,entering:true),accuracy:0.000001)
        XCTAssertEqual(fade.duration,0.12,accuracy:0.000001)
        XCTAssertNil(bridge.superlayer)
        try await waitFor{controller.world?.isReadyForInput == true}
        CATransaction.flush()
        XCTAssertEqual(decoration.presentation()?.opacity ?? decoration.opacity,1,accuracy:0.01)
        capture("World navigation restored")
        controller.navigate(.backpack)
        XCTAssertTrue(header.fadeBackgroundDuringHandoff,"Backpack uses the same shared fade profile")
    }

    func testRepeatedBackpackReturnUsesSharedFadeAcrossPreparationAndCleanup() async throws {
        var hold=false,pending:(()->Void)?
        let (controller,window)=try worldEntryFixture{world,done in
            world.prepare {if hold {pending=done} else {done()}}
        }
        defer{controller.dispose();window.isHidden=true}
        try await waitFor{!controller.transitioning && controller.home.isUserInteractionEnabled}
        controller.navigate(.hub)
        try await waitFor{controller.route == .hub && !controller.transitioning}
        controller.navigate(.world(1))
        try await waitFor{controller.world?.isReadyForInput == true}
        for _ in 0..<2 {
            controller.navigate(.backpack)
            try await waitFor{controller.route == .backpack && !controller.transitioning}
            let header=try XCTUnwrap(controller.backpackView?.header)
            XCTAssertTrue(header.fadeBackgroundDuringHandoff)
            try await waitFor{controller.backpackView?.isClosePaintedVisible == true}
            hold=true;controller.backpackView?.close.sendActions(for:.touchUpInside)
            let decoration=try XCTUnwrap((header.layer as? JimiV9NavigationRouteLayer)?.decorationLayer)
            let exit=try XCTUnwrap(decoration.animation(forKey:"native-route") as? CAAnimationGroup)
            let fade=try XCTUnwrap(exit.animations?.compactMap{$0 as? CAKeyframeAnimation}.first{$0.keyPath=="opacity"})
            XCTAssertEqual(fade.beginTime,0)
            XCTAssertEqual(fade.duration,JimiV9ArchedNavigationTitle.elementDuration,accuracy:0.000001)
            XCTAssertEqual((fade.values as? [NSNumber])?.last?.doubleValue,0)
            try await waitFor{controller.route == .world(1) && pending != nil}
            let bridge=try XCTUnwrap(controller.view.layer.sublayers?.first{$0.name=="native.navigation.background-handoff"})
            XCTAssertEqual(bridge.opacity,0)
            XCTAssertTrue(controller.world?.isHidden == true)
            let done=try XCTUnwrap(pending);pending=nil;hold=false;done()
            XCTAssertNil(bridge.superlayer)
            XCTAssertTrue(controller.world?.header.fadeBackgroundDuringHandoff == true)
            try await waitFor{controller.world?.isReadyForInput == true}
        }
    }

    private func worldEntryFixture(prepare:@escaping(JimiNativeWorldView,@escaping()->Void)->Void)throws->(NativeAppController,UIWindow){
        // Hosted XCTest fixtures own their own real mounted app. Retire the
        // storyboard host's independent runtime before testing this owner, so
        // its late Home startup cannot overlap fixture route transactions.
        for scene in UIApplication.shared.connectedScenes.compactMap({$0 as? UIWindowScene}) {
            for hostWindow in scene.windows {
                if let host=hostWindow.rootViewController as? NativeStandaloneViewController {
                    print("NAVWINDOW retiring hosted runtime root=\(ObjectIdentifier(host)) alreadyDisposed=\(host.disposed) window=\(ObjectIdentifier(hostWindow))")
                    host.dispose()
                }
            }
        }
        let layouts=try NativeWorldLayouts()
        var progression=NativeProgressionState();progression.firstPlayTutorialComplete=true
        var services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},
            worldSnapshot:{world,size,generation in try layouts.snapshot(world:world,width:size.width,height:size.height,generation:generation,progression:progression)},
            markViewed:{_ in},makeGameplay:{_,_ in throw FixtureError.unavailable},flush:{})
        services.prepareWorldEntry=prepare
        let controller=NativeAppController(resourceRoot:resources(),services:services)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        // The hosted application can finish its own cold launch after this
        // fixture mounts. Keep the rendered test owner above that host window.
        window.windowLevel=UIWindow.Level(rawValue:UIWindow.Level.alert.rawValue+1)
        window.rootViewController=controller;window.makeKeyAndVisible()
        return (controller,window)
    }
    private func reportFixtureWindows(_ window:UIWindow,label:String) {
        print("NAVWINDOW \(label) fixture=\(ObjectIdentifier(window)) key=\(window.isKeyWindow) hidden=\(window.isHidden) level=\(window.windowLevel.rawValue) scene=\(String(describing:window.windowScene))")
        for scene in UIApplication.shared.connectedScenes.compactMap({$0 as? UIWindowScene}) {
            for candidate in scene.windows {
                let root=candidate.rootViewController.map{"\(type(of:$0)):\(ObjectIdentifier($0))"} ?? "nil"
                print("NAVWINDOW scene=\(scene.session.persistentIdentifier) window=\(ObjectIdentifier(candidate)) key=\(candidate.isKeyWindow) hidden=\(candidate.isHidden) level=\(candidate.windowLevel.rawValue) root=\(root)")
            }
        }
    }
    private func waitFor(_ condition:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(5)
        while !condition(),Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(condition())
    }
    func testSelectedGameplayPreparationOverlapsWorldExitAndJoinsBothReceipts()async throws {
        for resourcesFinishFirst in [true,false] {
            var replies:[(Bool)->Void]=[],made=0
            let layouts=try NativeWorldLayouts()
            var progression=NativeProgressionState();progression.firstPlayTutorialComplete=true
            var services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{world,size,generation in
                try layouts.snapshot(world:world,width:size.width,height:size.height,generation:generation,progression:progression)
            },markViewed:{_ in},makeGameplay:{_,_ in made+=1;return UIViewController()},flush:{})
            services.prepareGameplayEntry={_,completion in replies.append(completion)}
            let controller=NativeAppController(resourceRoot:resources(),services:services)
            let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible()
            defer{controller.dispose();window.isHidden=true}
            controller.navigate(.hub,interrupt:true)
            try await waitFor{controller.route == .hub && !controller.transitioning && controller.hub.scrollView.isUserInteractionEnabled}
            controller.navigate(.world(1))
            try await waitFor{controller.world?.isReadyForInput==true}
            controller.world?.onRequest?("play",1)
            XCTAssertEqual(replies.count,1,"Selected resources start at Play alongside the authored World exit")
            XCTAssertEqual(made,0);XCTAssertEqual(controller.route,.world(1))
            if resourcesFinishFirst {
                replies[0](true);XCTAssertEqual(made,0,"Ready textures cannot bypass actual World exit")
            }else{
                try await Task.sleep(for:.seconds(2))
                XCTAssertEqual(made,0,"Finished exit cannot bypass the real resource receipt")
                replies[0](true)
            }
            try await waitFor{controller.route == .gameplay}
            XCTAssertEqual(made,1);replies[0](true);XCTAssertEqual(made,1)
        }
    }
    func testBackgroundCancellationCannotLaunchFromLateSelectedEntryReceipt()async throws {
        var replies:[(Bool)->Void]=[],made=0,cancels=0
        var services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw FixtureError.unavailable},markViewed:{_ in},makeGameplay:{_,_ in made+=1;return UIViewController()},flush:{})
        services.prepareGameplayEntry={_,completion in replies.append(completion)}
        services.cancelGameplayEntry={cancels+=1}
        let controller=NativeAppController(resourceRoot:resources(),services:services)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible()
        defer{controller.dispose();window.isHidden=true}
        try await waitFor{(!controller.home.isEntering && controller.home.isUserInteractionEnabled)}
        controller.navigate(.arcadeHub)
        try await waitFor{controller.route == .arcadeHub && !controller.transitioning && controller.arcadeHub.hub.scrollView.isUserInteractionEnabled}
        controller.arcadeHub.onPlay?("endurance")
        try await waitFor{replies.count==1}
        let oldCancels=cancels
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        XCTAssertGreaterThan(cancels,oldCancels)
        replies[0](true);XCTAssertEqual(made,0)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        try await waitFor{controller.route == .arcadeHub && !controller.transitioning && controller.arcadeHub.hub.scrollView.isUserInteractionEnabled}
        replies[0](true);XCTAssertEqual(made,0)
    }
    func testRegularJourneyTapPreservesDurableViewedAndNEWAcrossReopening() async throws {
        // Isolated small profile: measure the actual save/snapshot path without
        // reading or mutating either canonical Simulator player save.
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("journey-card-response-\(UUID().uuidString)",isDirectory:true)
        defer{try? FileManager.default.removeItem(at:directory)}
        let store=NativeSaveStore(directory:directory),layouts=try NativeWorldLayouts()
        var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        envelope.progression.firstPlayTutorialComplete=true
        envelope.progression.completedJourneyBoards=Set(1...4)
        envelope.progression.viewedJourneyBoards=Set(1...3)
        try store.save(envelope)
        var savedBoards=[Int](),saveTimes=[Double](),snapshotTimes=[Double]()
        let services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{world,size,generation in
            let began=CACurrentMediaTime()
            defer{snapshotTimes.append(CACurrentMediaTime()-began)}
            return try layouts.snapshot(world:world,width:size.width,height:size.height,generation:generation,progression:envelope.progression)
        },markViewed:{board in
            let began=CACurrentMediaTime()
            defer{saveTimes.append(CACurrentMediaTime()-began)}
            envelope.progression.markViewed(board:board)
            try store.save(envelope);savedBoards.append(board)
        },makeGameplay:{_,_ in throw FixtureError.unavailable},flush:{})
        let controller=NativeAppController(resourceRoot:resources(),services:services)
        let size=UIDevice.current.userInterfaceIdiom == .pad ? CGSize(width:820,height:1180):CGSize(width:390,height:844)
        let window=UIWindow(frame:CGRect(origin:.zero,size:size))
        window.windowLevel=UIWindow.Level(rawValue:UIWindow.Level.alert.rawValue+1)
        window.rootViewController=controller;window.makeKeyAndVisible()
        defer{controller.dispose();window.isHidden=true;window.rootViewController=nil}
        func find(_ view:UIView,_ identifier:String)->UIView? {
            if view.accessibilityIdentifier==identifier{return view}
            return view.subviews.lazy.compactMap{find($0,identifier)}.first
        }
        controller.navigate(.world(1),interrupt:true)
        try await waitFor{controller.world?.isReadyForInput==true && !controller.transitioning}
        let world=try XCTUnwrap(controller.world)
        let button=try XCTUnwrap(find(world,"native.world.card.4") as? UIButton)
        world.scrollView.setContentOffset(.init(x:0,y:max(0,button.frame.minY-160)),animated:false)
        try await waitFor{find(world,"native.world.part.4.card") != nil}
        XCTAssertTrue(try XCTUnwrap(world.snapshot.units.first{$0.boardID==4}).newRibbon)
        for opening in 1...2 {
            let snapshotsBefore=snapshotTimes.count,savesBefore=savedBoards.count
            let began=CACurrentMediaTime()
            button.sendActions(for:.touchUpInside)
            let handlerTime=CACurrentMediaTime()-began
            button.sendActions(for:.touchUpInside)
            let modal=try XCTUnwrap(find(world,"native.world.card.modal") as? JimiNativeWorldCardView)
            XCTAssertEqual(modal.boardID,4)
            XCTAssertEqual(savedBoards.count,savesBefore+1,"Duplicate tap cannot repeat viewed persistence")
            XCTAssertEqual(snapshotTimes.count,snapshotsBefore+1,"One admitted opening refreshes one World snapshot")
            XCTAssertEqual(savedBoards.last,4)
            XCTAssertTrue(try XCTUnwrap(store.load()).progression.viewedJourneyBoards.contains(4),"Viewed state is durable before the handler returns")
            let retained=try XCTUnwrap(world.snapshot.units.first{$0.boardID==4})
            XCTAssertTrue(retained.viewed);XCTAssertFalse(retained.newRibbon)
            XCTAssertEqual(find(modal,"native.world.ribbon") != nil,opening==1,"Only the first presentation retains the captured NEW ribbon")
            print("JOURNEY_CARD_RESPONSE smallProfile opening=\(opening) saveMs=\((saveTimes.last ?? 0)*1000) snapshotMs=\((snapshotTimes.last ?? 0)*1000) handlerToInstalledModalMs=\(handlerTime*1000)")
            try await waitFor{modal.acceptsCardPan}
            let cta=try XCTUnwrap(find(modal,"native.world.card.play") as? JimiV9PlainButton)
            try await waitFor{cta.isSculptedFacePrepared && cta.isEnabled}
            XCTAssertEqual(cta.alpha,1,"The selected Journey button is painted before admitting Play")
            let closed=expectation(description:"Journey card \(opening) actual return and landing")
            world.closeCard{closed.fulfill()}
            await fulfillment(of:[closed],timeout:6)
            XCTAssertFalse(world.hasActiveCard);XCTAssertFalse(world.hasPendingCardLanding)
            XCTAssertNil(cta.sculptedFaceRasterForTesting(),"Completed return retires the selected face pixels")
            XCTAssertFalse(try XCTUnwrap(find(world,"native.world.part.4.card")).isHidden)
        }
    }
    private func containsWebView(_ view:UIView)->Bool {
        NSStringFromClass(type(of:view)).contains("WKWebView") || view.subviews.contains(where:containsWebView)
    }
}
private enum FixtureError:Error {case unavailable}
