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
    func testMountedCrateEntryDetailBackgroundReturnAndJourneyIsolation()async throws {
        let services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw CancellationError()},markViewed:{_ in},makeGameplay:{_,_ in UIViewController()},flush:{})
        let app=NativeAppController(resourceRoot:NativeTestResources.root,services:services)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=app;window.makeKeyAndVisible()
        defer{app.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
        try await wait("Home admitted"){app.home.isUserInteractionEnabled}
        app.navigate(.arcadeHub)
        try await wait("Arcade Hub admitted"){app.route == .arcadeHub && app.arcadeHub.hub.scrollView.isUserInteractionEnabled}
        app.arcadeHub.hub.backpackButton.sendActions(for:.touchUpInside)
        app.arcadeHub.hub.backpackButton.sendActions(for:.touchUpInside)
        try await wait("Crate admitted"){app.route == .backpack && app.backpackView?.isUserInteractionEnabled==true}
        let crate=try XCTUnwrap(app.backpackView)
        XCTAssertTrue(crate.arcadeCrate);XCTAssertEqual(crate.accessibilityIdentifier,"native.arcade.crate")
        XCTAssertTrue(labels(crate).contains("Dice Box"))
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
        app.navigate(.hub)
        try await wait("Journey Hub admitted"){app.route == .hub && app.hub.scrollView.isUserInteractionEnabled}
        app.hub.backpackButton.sendActions(for:.touchUpInside)
        try await wait("Journey Backpack admitted"){app.route == .backpack && app.backpackView?.isUserInteractionEnabled==true}
        let journey=try XCTUnwrap(app.backpackView)
        XCTAssertFalse(journey === crate);XCTAssertFalse(journey.arcadeCrate)
        XCTAssertTrue(labels(journey).contains("Backpack"));XCTAssertFalse(journey.sections.isEmpty)
        XCTAssertNil(crate.onClose);XCTAssertNil(crate.onDie)
        journey.close.sendActions(for:.touchUpInside)
        try await wait("Journey Backpack returned to Journey Hub"){app.route == .hub && app.hub.scrollView.isUserInteractionEnabled}
    }
}
