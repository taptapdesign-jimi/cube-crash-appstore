import XCTest
import UIKit
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
    func testRequiredTutorialUsesCanonicalJourneyForNewVariants() async throws {
        for variant in NativeArcadeVariant.allCases {
            let expectedBoard: Int? = variant == .endurance ? nil : 1
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
    func testArcadeArtAndModalPaperArePackaged() {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        for path in ["assets/arcade/endourance.png","assets/arcade/pure dice.png","assets/arcade/slow burn.png","assets/modals/paper.png","assets/close-icon.png"] {
            XCTAssertNotNil(assets.image(path),path)
        }
    }
}
