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
            try await waitFor{root.home.isUserInteractionEnabled}
            root.home.selectSlide(1,animated:false)
            var cues:[String]=[];root.onFeedback={cues.append($0)}
            let hero=try XCTUnwrap(root.home.heroView as? UIButton)
            let button=cta ? root.home.ctaView:hero
            button.sendActions(for:.touchUpInside);button.sendActions(for:.touchUpInside)
            XCTAssertEqual(cues.filter{$0 == "home-arcade-character-tap"}.count,1)
            try await waitFor{root.route == .arcadeHub && root.arcadeHub.hub.scrollView.isUserInteractionEnabled}
            root.home.onHeroContact?()
            XCTAssertEqual(cues.filter{$0 == "home-arcade-character-tap"}.count,1,"Hidden Home cannot emit")
        }
    }
    func testWorldHubSpeechOnlyFollowsAcceptedWorldButtonOnce() async throws {
        let (controller,window)=try worldEntryFixture(prepare:{_,ready in ready()})
        defer{controller.dispose();window.isHidden=true}
        var cues:[String]=[];controller.onFeedback={cues.append($0)}
        controller.hub.onWorld?(1)
        XCTAssertFalse(cues.contains{$0.hasPrefix("world-hub-")},"Hidden hub cannot speak")
        controller.navigate(.hub,interrupt:true)
        try await waitFor{controller.route == .hub && controller.hub.scrollView.isUserInteractionEnabled}
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
            try await waitFor{controller.route == .hub && controller.hub.scrollView.isUserInteractionEnabled}
        }
    }
    func testWorldHubSpeechDoesNotPlayOnFailedWorldPreparation() async throws {
        let services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw FixtureError.unavailable},markViewed:{_ in},makeGameplay:{_,_ in throw FixtureError.unavailable},flush:{})
        let controller=NativeAppController(resourceRoot:resources(),services:services)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible()
        defer{controller.dispose();window.isHidden=true}
        controller.navigate(.hub,interrupt:true)
        try await waitFor{controller.route == .hub && controller.hub.scrollView.isUserInteractionEnabled}
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
        try await waitFor{controller.route == .hub && controller.hub.scrollView.isUserInteractionEnabled}
        XCTAssertEqual(count(1),"2 / 10");XCTAssertEqual(count(2),"0 / 10");XCTAssertEqual(count(3),"0 / 10")
        controller.navigate(.settings)
        try await waitFor{controller.route == .settings && controller.settingsView.isUserInteractionEnabled}
        finish(3);finish(11);finish(21);finish(22);finish(1,mode:.arcade)
        controller.navigate(.hub)
        try await waitFor{controller.route == .hub && controller.hub.scrollView.isUserInteractionEnabled}
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
        while !controller.home.isUserInteractionEnabled,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
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
        try await waitFor{controller.route == .hub && controller.hub.scrollView.isUserInteractionEnabled}
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
        try await waitFor{controller.route == .hub && controller.hub.scrollView.isUserInteractionEnabled}
        controller.navigate(.world(1));let prepared=try XCTUnwrap(controller.world)
        controller.navigate(.home,interrupt:true);replies[0]()
        try await waitFor{controller.route == .home && controller.home.isUserInteractionEnabled}
        XCTAssertTrue(prepared.isHidden)
        controller.navigate(.hub)
        try await waitFor{controller.route == .hub && controller.hub.scrollView.isUserInteractionEnabled}
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
        try await waitFor{controller.route == .hub && controller.hub.scrollView.isUserInteractionEnabled}
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
        try await waitFor{controller.route == .hub && controller.hub.scrollView.isUserInteractionEnabled}
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
            let expected=max(0,screen.safeAreaInsets.top+screen.bounds.height*0.02-16)+26
            XCTAssertEqual(title.frame.midY,expected,accuracy:0.001,name)
            for button in buttons {
                button.layoutIfNeeded()
                XCTAssertEqual(button.frame.midY,expected,accuracy:0.001,name)
                if let image=button.imageView,!image.bounds.isEmpty {
                    XCTAssertEqual(image.convert(image.bounds,to:header).midY,expected,accuracy:0.001,name)
                }
            }
            if let world=screen as? JimiNativeWorldView {
                let art=try XCTUnwrap(world.headerGeometrySnapshot()["backArtwork"])
                XCTAssertEqual(art.midY,expected,accuracy:0.001)
                XCTAssertEqual(art.size,CGSize(width:24,height:24))
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
        try await waitFor{controller.route == .hub && controller.hub.scrollView.isUserInteractionEnabled}
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
            XCTAssertTrue(controller.world === world)
            XCTAssertFalse(world.isReadyForInput)
            XCTAssertTrue(world.isHidden)
            cues.removeAll()
            controller.backpackView?.close.sendActions(for:.touchUpInside)
            XCTAssertEqual(cues.first,"back","World-origin Backpack close retains the existing back cue")
            try await waitFor{controller.route == .world(id) && world.isReadyForInput}
            XCTAssertTrue(controller.world === world)
            XCTAssertEqual(world.scrollView.contentOffset.y,offset.y,accuracy:0.5)
        }
        controller.world?.backButton.sendActions(for:.touchUpInside)
        try await waitFor{controller.route == .hub && controller.hub.scrollView.isUserInteractionEnabled}
        controller.hub.backpackButton.sendActions(for:.touchUpInside)
        try await waitFor{controller.route == .backpack && controller.backpackView?.isUserInteractionEnabled==true}
        controller.backpackView?.close.sendActions(for:.touchUpInside)
        try await waitFor{controller.route == .hub && controller.hub.scrollView.isUserInteractionEnabled}
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
    private func worldEntryFixture(prepare:@escaping(JimiNativeWorldView,@escaping()->Void)->Void)throws->(NativeAppController,UIWindow){
        let layouts=try NativeWorldLayouts()
        var progression=NativeProgressionState();progression.firstPlayTutorialComplete=true
        var services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},
            worldSnapshot:{world,size,generation in try layouts.snapshot(world:world,width:size.width,height:size.height,generation:generation,progression:progression)},
            markViewed:{_ in},makeGameplay:{_,_ in throw FixtureError.unavailable},flush:{})
        services.prepareWorldEntry=prepare
        let controller=NativeAppController(resourceRoot:resources(),services:services)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible()
        return (controller,window)
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
            try await waitFor{controller.route == .hub && controller.hub.scrollView.isUserInteractionEnabled}
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
        try await waitFor{controller.home.isUserInteractionEnabled}
        controller.navigate(.arcadeHub)
        try await waitFor{controller.route == .arcadeHub && controller.arcadeHub.hub.scrollView.isUserInteractionEnabled}
        controller.arcadeHub.onPlay?("endurance")
        try await waitFor{replies.count==1}
        let oldCancels=cancels
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        XCTAssertGreaterThan(cancels,oldCancels)
        replies[0](true);XCTAssertEqual(made,0)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        try await waitFor{controller.route == .arcadeHub && controller.arcadeHub.hub.scrollView.isUserInteractionEnabled}
        replies[0](true);XCTAssertEqual(made,0)
    }
    private func containsWebView(_ view:UIView)->Bool {
        NSStringFromClass(type(of:view)).contains("WKWebView") || view.subviews.contains(where:containsWebView)
    }
}
private enum FixtureError:Error {case unavailable}
