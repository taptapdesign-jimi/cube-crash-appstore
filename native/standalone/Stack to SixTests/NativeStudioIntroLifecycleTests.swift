import XCTest
import UIKit
import QuartzCore
@testable import Stack_to_Six

@MainActor final class NativeStudioIntroLifecycleTests:XCTestCase {
    private func intro(gate:((@escaping ()->Void)->Void)?=nil)->NativeStudioIntroView {
        let view=NativeStudioIntroView(root:NativeTestResources.root,character:.init("lik-nogomet",1.1),decodedPublicationGate:gate)
        view.frame = .init(x:0,y:0,width:390,height:844);view.layoutIfNeeded();return view
    }
    private func wait(timeout:Double=5,_ condition:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(timeout)
        while !condition(){guard Date()<deadline else{XCTFail("Selected authored intro frames did not become ready");throw CancellationError()};try await Task.sleep(for:.milliseconds(10))}
    }
    func testDecodedReadinessStartsOnceAndTerminalModelCannotFlashAfterHandoff()async throws {
        let prior=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let controller=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        window.rootViewController=controller;window.makeKeyAndVisible();controller.loadViewIfNeeded()
        let view=intro();var cues=0,handoffs=0
        controller.view.addSubview(view)
        defer{view.dispose();window.isHidden=true;prior?.makeKeyAndVisible()}
        view.onCharacterCue={_ in cues+=1}
        view.start{handoffs+=1;XCTAssertTrue(view.terminalCompositionHidden);XCTAssertNil(view.superview)}
        XCTAssertFalse(view.timelineStarted);XCTAssertEqual(cues,0)
        XCTAssertTrue(view.subviews.allSatisfy{$0.layer.opacity==0},"Media preparation stays invisible until its first decoded image")
        try await wait{view.timelineStarted}
        XCTAssertEqual(view.selectedMotionSource,"animated-webp");XCTAssertEqual(cues,1)
        let unit=try XCTUnwrap(view.subviews.first)
        XCTAssertEqual(unit.layer.transform.m11,0,"Removing presentation animations exposes the terminal model")
        let sheen=try XCTUnwrap(unit.subviews.compactMap{$0 as? UIImageView}.first{$0.layer.mask != nil})
        let animation=try XCTUnwrap(sheen.layer.animation(forKey:"native-studio-sheen") as? CAKeyframeAnimation)
        XCTAssertEqual(animation.duration,6);XCTAssertEqual(animation.keyTimes,[0,0.04,0.10,0.31,0.37,1])
        view.start{XCTFail("A repeated start cannot replace the original handoff")}
        view.animationDidStop(CAAnimation(),finished:true)
        XCTAssertEqual(handoffs,1);XCTAssertTrue(view.isRetired)
        view.animationDidStop(CAAnimation(),finished:true)
        XCTAssertEqual(cues,1);XCTAssertEqual(handoffs,1);XCTAssertTrue(view.terminalCompositionHidden)
    }
    func testProductionFootballPaintsChangingImagesAndDisposalRejectsLateFrames()async throws {
        let view=intro();defer{view.dispose()}
        view.start{}
        try await wait{view.fallbackFramesPresented>0}
        let first=try XCTUnwrap(view.displayedFallbackImage?.pngData()),initial=view.fallbackFramesPresented
        try await wait{view.fallbackFramesPresented>=initial+8}
        XCTAssertNotEqual(try XCTUnwrap(view.displayedFallbackImage?.pngData()),first)
        XCTAssertEqual(view.selectedMotionSource,"animated-webp")
        view.dispose();let retiredCount=view.fallbackFramesPresented
        try await Task.sleep(for:.milliseconds(150))
        XCTAssertEqual(view.fallbackFramesPresented,retiredCount);XCTAssertTrue(view.terminalCompositionHidden)
    }
    func testDisposalBeforeInitialDecodeRejectsPublicationAndHomepageHandoff()async throws {
        var publications:[()->Void]=[]
        let view=intro(gate:{publications.append($0)})
        view.start{XCTFail("Disposed intro cannot reveal Home")}
        try await wait{publications.count==1};view.dispose();publications.removeFirst()()
        XCTAssertFalse(view.timelineStarted);XCTAssertEqual(view.fallbackFramesPresented,0)
        XCTAssertTrue(view.terminalCompositionHidden)
    }
    func testMountedOriginalMediaCompletesNaturalExitOnceBeforeHomepageEnters()async throws {
        let prior=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let controller=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        window.rootViewController=controller;window.makeKeyAndVisible();controller.loadViewIfNeeded()
        let view=intro(),homepage=UIView();homepage.accessibilityIdentifier="intro-test-homepage"
        controller.view.addSubview(view)
        defer{view.dispose();window.isHidden=true;prior?.makeKeyAndVisible()}
        var handoffs=0
        view.start{
            handoffs+=1
            XCTAssertTrue(view.terminalCompositionHidden);XCTAssertNil(view.superview)
            homepage.frame=controller.view.bounds;controller.view.addSubview(homepage)
        }
        try await wait{view.timelineStarted}
        try await wait{view.fallbackFramesPresented>8}
        XCTAssertEqual(view.selectedMotionSource,"animated-webp")
        XCTAssertEqual(handoffs,0);XCTAssertNil(homepage.superview)
        try await wait(timeout:7){handoffs==1}
        XCTAssertTrue(view.isRetired);XCTAssertTrue(view.terminalCompositionHidden)
        XCTAssertTrue(homepage.superview === controller.view)
        try await Task.sleep(for:.milliseconds(100));XCTAssertEqual(handoffs,1)
    }
    func testAllElevenMountedProductionSelectionsPaintChangingPixelsAndRetire()async throws {
        XCTAssertEqual(NativeStudioIntroView.characters.count,11)
        let prior=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let controller=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        window.rootViewController=controller;window.makeKeyAndVisible();controller.loadViewIfNeeded()
        defer{window.isHidden=true;prior?.makeKeyAndVisible()}
        for character in NativeStudioIntroView.characters {
            // Use the exact initializer called by NativeAppController, never an alternate test media path.
            let view=NativeStudioIntroView(root:NativeTestResources.root,character:character)
            view.frame=controller.view.bounds;controller.view.addSubview(view);view.layoutIfNeeded()
            var cues=0;view.onCharacterCue={_ in cues+=1};view.start{}
            try await wait{view.fallbackFramesPresented>0}
            let first=try XCTUnwrap(view.displayedFallbackImage?.pngData(),character.key)
            try await wait(timeout:2){view.fallbackFramesPresented>1 && view.displayedFallbackImage?.pngData() != first}
            XCTAssertEqual(view.selectedMotionSource,"animated-webp",character.key);XCTAssertEqual(cues,1)
            let imageView=try XCTUnwrap(view.subviews.last?.subviews.first as? UIImageView)
            XCTAssertNotNil(imageView.layer.contents,"The changed frame must reach the mounted image layer: \(character.key)")
            print("[NativeStudioIntroProof] character=\(character.key) motion=\(view.selectedMotionSource) frames=\(view.fallbackFramesPresented)")
            view.dispose();let count=view.fallbackFramesPresented
            try await Task.sleep(for:.milliseconds(60))
            XCTAssertEqual(view.fallbackFramesPresented,count,character.key);XCTAssertTrue(view.terminalCompositionHidden)
        }
    }
    func testBackgroundDuringInitialDecodeRetriesAndRejectsOldPublication()async throws {
        var publications:[()->Void]=[]
        let view=NativeStudioIntroView(root:NativeTestResources.root,character:.init("pas-novine",1.1),
            decodedPublicationGate:{publications.append($0)})
        defer{view.dispose()};var cues=0;view.onCharacterCue={_ in cues+=1};view.start{}
        try await wait{publications.count==1}
        XCTAssertFalse(view.timelineStarted);XCTAssertEqual(cues,0)
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        publications.removeFirst()()
        XCTAssertEqual(view.fallbackFramesPresented,0);XCTAssertFalse(view.timelineStarted)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        try await wait{publications.count==1};publications.removeFirst()()
        XCTAssertEqual(view.selectedMotionSource,"animated-webp");XCTAssertEqual(view.fallbackFramesPresented,1)
        XCTAssertTrue(view.timelineStarted);XCTAssertEqual(cues,1)
    }
    func testRapidBackgroundResumeRejectsInFlightFrameAndKeepsOneChain()async throws {
        var publications:[()->Void]=[]
        let view=NativeStudioIntroView(root:NativeTestResources.root,character:.init("lik-cvijet",1.08),
            decodedPublicationGate:{publications.append($0)})
        defer{view.dispose()};view.start{}
        try await wait{publications.count==1};publications.removeFirst()()
        try await wait{publications.count==1}
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        try await Task.sleep(for:.milliseconds(100));XCTAssertEqual(publications.count,1)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        try await wait{publications.count==2}
        publications.removeFirst()()
        XCTAssertEqual(view.fallbackFramesPresented,1)
        publications.removeFirst()();XCTAssertEqual(view.fallbackFramesPresented,2)
        try await wait{publications.count==1}
        try await Task.sleep(for:.milliseconds(150));XCTAssertEqual(publications.count,1)
        view.dispose();publications.removeFirst()();XCTAssertEqual(view.fallbackFramesPresented,2)
    }
}
