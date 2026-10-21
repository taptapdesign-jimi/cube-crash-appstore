import XCTest
import UIKit
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativeArcadeCrateNavigationTests:XCTestCase {
    private func wait(_ label:String,_ predicate:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(12)
        while !predicate(){guard Date()<deadline else{XCTFail(label);throw CancellationError()};try await Task.sleep(for:.milliseconds(20))}
    }
    private func labels(_ view:UIView)->[String] {
        (view as? UILabel).flatMap{$0.text}.map{[$0]} ?? view.subviews.flatMap{labels($0)}
    }
    func testJourneyBackpackWaitsForHubAndAllWorldEntryAdmission()async throws {
        let layouts=try NativeWorldLayouts()
        var progress=NativeProgressionState();progress.firstPlayTutorialComplete=true
        var services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{id,size,generation in
            try layouts.snapshot(world:id,width:size.width,height:size.height,generation:generation,progression:progress)
        },markViewed:{_ in},makeGameplay:{_,_ in UIViewController()},flush:{})
        services.journeyProgression={progress}
        let app=NativeAppController(resourceRoot:NativeTestResources.root,services:services)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=app;window.makeKeyAndVisible()
        defer{app.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
        try await wait("Home admitted"){app.home.isUserInteractionEnabled}
        app.navigate(.hub)
        try await wait("Journey Hub entering"){app.route == .hub}
        XCTAssertFalse(app.hub.scrollView.isUserInteractionEnabled)
        app.hub.backpackButton.sendActions(for:.touchUpInside)
        XCTAssertEqual(app.route,.hub)
        try await wait("Journey Hub admitted"){app.hub.scrollView.isUserInteractionEnabled}
        app.hub.backpackButton.sendActions(for:.touchUpInside)
        try await wait("Hub Backpack opens"){app.route == .backpack && app.backpackView?.isUserInteractionEnabled==true}
        app.backpackView?.close.sendActions(for:.touchUpInside)
        try await wait("Back to Hub"){app.route == .hub && app.hub.scrollView.isUserInteractionEnabled}
        for id in 1...3 {
            app.navigate(.world(id))
            try await wait("World entering"){app.route == .world(id) && app.world != nil}
            let world=try XCTUnwrap(app.world)
            XCTAssertFalse(world.isReadyForInput)
            world.backpackButton.sendActions(for:.touchUpInside)
            app.navigate(.backpack,interrupt:true)
            XCTAssertEqual(app.route,.world(id),"Even interrupt cannot bypass Backpack source admission")
            try await wait("World admitted"){world.isReadyForInput}
            NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
            world.backpackButton.sendActions(for:.touchUpInside)
            app.navigate(.backpack)
            XCTAssertEqual(app.route,.world(id))
            NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
            try await wait("World foreground"){world.isReadyForInput}
            world.backpackButton.sendActions(for:.touchUpInside)
            try await wait("World Backpack opens"){app.route == .backpack && app.backpackView?.isUserInteractionEnabled==true}
            app.backpackView?.close.sendActions(for:.touchUpInside)
            try await wait("Backpack returns to same World"){app.route == .world(id) && app.world?.isReadyForInput==true}
            app.navigate(.hub)
            try await wait("Hub after World"){app.route == .hub && app.hub.scrollView.isUserInteractionEnabled}
        }
    }
    func testEarlyCrateTapCannotPoisonArcadeNavigation()async throws {
        let services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw CancellationError()},markViewed:{_ in},makeGameplay:{_,_ in UIViewController()},flush:{})
        let app=NativeAppController(resourceRoot:NativeTestResources.root,services:services)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=app;window.makeKeyAndVisible()
        defer{app.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
        try await wait("Home admitted"){app.home.isUserInteractionEnabled}
        app.navigate(.arcadeHub)
        try await wait("Arcade entering"){app.route == .arcadeHub}
        XCTAssertFalse(app.arcadeHub.hub.scrollView.isUserInteractionEnabled,"Reproduce the phone tap before route admission")
        let closed=app.arcadeHub.hub.backpackButton.image(for:.normal)
        app.arcadeHub.hub.backpackButton.sendActions(for:.touchUpInside)
        XCTAssertEqual(app.route,.arcadeHub)
        XCTAssertTrue(app.arcadeHub.hub.backpackButton.image(for:.normal) === closed)
        try await wait("Arcade admitted"){app.arcadeHub.hub.scrollView.isUserInteractionEnabled}
        app.arcadeHub.hub.worldUnits[0].sendActions(for:.touchUpInside)
        try await wait("World modal opens after rejected early crate tap"){
            app.arcadeHub.subviews.contains{$0.accessibilityIdentifier=="native.arcade-world-modal"}
        }
        func button(_ root:UIView,_ id:String)->UIButton? {
            if root.accessibilityIdentifier==id{return root as? UIButton}
            return root.subviews.lazy.compactMap{button($0,id)}.first
        }
        let close=try XCTUnwrap(button(app.arcadeHub,"native.arcade-world-modal.close"))
        try await Task.sleep(for:.milliseconds(800))
        close.sendActions(for:.touchUpInside)
        try await wait("World modal closed"){
            !app.arcadeHub.subviews.contains{$0.accessibilityIdentifier=="native.arcade-world-modal"}
        }
        app.arcadeHub.hub.backpackButton.sendActions(for:.touchUpInside)
        try await wait("Crate still opens after admission"){app.route == .backpack && app.backpackView?.isUserInteractionEnabled==true}
        app.backpackView?.close.sendActions(for:.touchUpInside)
        try await wait("Crate returned to Arcade"){app.route == .arcadeHub && app.arcadeHub.hub.scrollView.isUserInteractionEnabled}
        app.arcadeHub.hub.backButton.sendActions(for:.touchUpInside)
        try await wait("Back remains usable"){app.route == .home && app.home.isUserInteractionEnabled}
    }
    func testJourneyVisitAcknowledgesOnlySeenCardsAfterExit() async throws {
        var progress=NativeProgressionState();progress.announceJourneyDie("bee",board:1);progress.announceJourneyDie("fish",board:12)
        var services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw CancellationError()},markViewed:{_ in},makeGameplay:{_,_ in UIViewController()},flush:{})
        services.journeyProgression={progress}
        services.readJourneyDie={id in progress.readJourneyDie(id);return true}
        let app=NativeAppController(resourceRoot:NativeTestResources.root,services:services)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=app;window.makeKeyAndVisible()
        defer{app.dispose();window.isHidden=true}
        try await wait("Home"){app.home.isUserInteractionEnabled};app.navigate(.hub)
        try await wait("Hub"){app.route == .hub && app.hub.scrollView.isUserInteractionEnabled}
        app.navigate(.backpack)
        try await wait("Backpack"){app.route == .backpack && app.backpackView?.isUserInteractionEnabled == true}
        XCTAssertEqual(app.backpackView?.seenUnreadDice,["bee"])
        app.backpackView?.close.sendActions(for:.touchUpInside)
        try await wait("Return"){app.route == .hub}
        XCTAssertEqual(progress.unreadJourneyDice,["fish"])
        try await wait("Hub admitted"){app.hub.scrollView.isUserInteractionEnabled};app.navigate(.backpack)
        try await wait("Second visit"){app.route == .backpack && app.backpackView?.isUserInteractionEnabled == true}
        let screen=try XCTUnwrap(app.backpackView)
        let section=try XCTUnwrap(screen.sections.firstIndex{$0.dice.contains{$0.id=="fish"}})
        let item=try XCTUnwrap(screen.sections[section].dice.firstIndex{$0.id=="fish"})
        screen.grid.scrollToItem(at:IndexPath(item:item,section:section),at:.centeredVertically,animated:false);screen.grid.layoutIfNeeded();screen.scrollViewDidScroll(screen.grid)
        XCTAssertTrue(screen.seenUnreadDice.contains("fish"));XCTAssertEqual(progress.unreadJourneyDice,["fish"])
        screen.close.sendActions(for:.touchUpInside)
        XCTAssertEqual(progress.unreadJourneyDice,["fish"],"Exit has not completed")
        try await wait("Second return"){app.route == .hub}
        XCTAssertTrue(progress.unreadJourneyDice.isEmpty)
    }
    func testMountedCrateEntryDetailBackgroundReturnAndJourneyIsolation()async throws {
        let services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw CancellationError()},markViewed:{_ in},makeGameplay:{_,_ in UIViewController()},flush:{})
        let app=NativeAppController(resourceRoot:NativeTestResources.root,services:services)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=app;window.makeKeyAndVisible()
        defer{app.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
        try await wait("Home admitted"){app.home.isUserInteractionEnabled}
        app.navigate(.arcadeHub)
        try await wait("Arcade Hub admitted"){app.route == .arcadeHub && app.arcadeHub.hub.scrollView.isUserInteractionEnabled}
        let closedCrate=app.arcadeHub.hub.backpackButton.image(for:.normal)
        app.arcadeHub.hub.backpackButton.sendActions(for:.touchUpInside)
        XCTAssertNotNil(app.arcadeHub.hub.backpackButton.imageView?.layer.animation(forKey:NativeHubBackpackFeedback.switchKey))
        XCTAssertFalse(app.arcadeHub.hub.backpackButton.image(for:.normal) === closedCrate)
        app.arcadeHub.hub.backpackButton.sendActions(for:.touchUpInside)
        try await wait("Crate admitted"){app.route == .backpack && app.backpackView?.isUserInteractionEnabled==true}
        let crate=try XCTUnwrap(app.backpackView)
        XCTAssertTrue(crate.arcadeCrate);XCTAssertEqual(crate.accessibilityIdentifier,"native.arcade.crate")
        XCTAssertTrue(labels(crate).contains("Box"))
        XCTAssertEqual(crate.numberOfSections(in:crate.grid),1)
        XCTAssertEqual(crate.collectionView(crate.grid,numberOfItemsInSection:0),3)
        crate.grid.layoutIfNeeded()
        let first=try XCTUnwrap(crate.grid.layoutAttributesForItem(at:.init(item:0,section:0)))
        let second=try XCTUnwrap(crate.grid.layoutAttributesForItem(at:.init(item:1,section:0)))
        let third=try XCTUnwrap(crate.grid.layoutAttributesForItem(at:.init(item:2,section:0)))
        XCTAssertEqual(first.frame.minY,second.frame.minY,accuracy:0.5)
        XCTAssertGreaterThan(second.frame.minX,first.frame.minX)
        XCTAssertGreaterThan(third.frame.minY,first.frame.minY)

        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        XCTAssertFalse(crate.isUserInteractionEnabled)
        crate.onDie?(NativeBackpackCatalog.arcade[0]);crate.onClose?()
        XCTAssertNil(app.presentedViewController);XCTAssertEqual(app.route,.backpack)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        try await wait("Crate foreground restored"){crate.isUserInteractionEnabled}
        crate.onDie?(NativeBackpackCatalog.arcade[0])
        try await wait("Shared detail mounted"){app.presentedViewController is NativeBackpackDetail}
        let detail=try XCTUnwrap(app.presentedViewController as? NativeBackpackDetail)
        XCTAssertFalse(crate.isUserInteractionEnabled)
        try await wait("Detail entered"){detail.card.isUserInteractionEnabled}
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        detail.closeTapped()
        XCTAssertTrue(app.presentedViewController === detail)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        detail.closeTapped()
        try await wait("Detail closed into Crate"){app.presentedViewController==nil && crate.isUserInteractionEnabled}
        XCTAssertEqual(app.route,.backpack);XCTAssertTrue(app.backpackView === crate)
        crate.close.sendActions(for:.touchUpInside)
        try await wait("Crate returned to Arcade"){app.route == .arcadeHub && app.arcadeHub.hub.scrollView.isUserInteractionEnabled}
        XCTAssertTrue(app.arcadeHub.hub.backpackButton.image(for:.normal) === closedCrate)
        app.navigate(.hub)
        try await wait("Journey Hub admitted"){app.route == .hub && app.hub.scrollView.isUserInteractionEnabled}
        let journeyClosed=app.hub.backpackButton.image(for:.normal)
        app.hub.backpackButton.sendActions(for:.touchUpInside)
        XCTAssertNotNil(app.hub.backpackButton.imageView?.layer.animation(forKey:NativeHubBackpackFeedback.switchKey))
        XCTAssertFalse(app.hub.backpackButton.image(for:.normal) === journeyClosed)

        try await wait("Journey Backpack admitted"){app.route == .backpack && app.backpackView?.isUserInteractionEnabled==true}
        let journey=try XCTUnwrap(app.backpackView)
        XCTAssertFalse(journey === crate);XCTAssertFalse(journey.arcadeCrate)
        XCTAssertTrue(labels(journey).contains("Backpack"));XCTAssertFalse(journey.sections.isEmpty)
        XCTAssertNil(crate.onClose);XCTAssertNil(crate.onDie)
        XCTAssertFalse(app.hub.backpackButton.image(for:.normal) === journeyClosed,"Retained Journey icon stays open throughout Backpack")
        journey.close.sendActions(for:.touchUpInside)
        try await wait("Journey Backpack returned to Journey Hub"){app.route == .hub && app.hub.scrollView.isUserInteractionEnabled}
        XCTAssertTrue(app.hub.backpackButton.image(for:.normal) === journeyClosed)
        try await wait("Delayed Journey backpack close settled"){app.hub.backpackButton.imageView?.layer.animation(forKey:NativeHubBackpackFeedback.switchKey) == nil}

    }
}
