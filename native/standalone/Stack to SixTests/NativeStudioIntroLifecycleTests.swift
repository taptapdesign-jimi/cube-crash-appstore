import XCTest
import UIKit
import QuartzCore
import AVFoundation
@testable import Stack_to_Six

@MainActor final class NativeStudioIntroLifecycleTests:XCTestCase {
    private func intro(_ preparation:NativeStudioIntroView.MediaPreparation = .manualReadiness,timeout:Double=1.8)->NativeStudioIntroView {
        let view=NativeStudioIntroView(root:NativeTestResources.root,character:.init("lik-nogomet",1.1),mediaPreparation:preparation,readinessTimeout:timeout)
        view.frame = .init(x:0,y:0,width:390,height:844);view.layoutIfNeeded();return view
    }
    private func wait(timeout:Double=5,_ condition:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(timeout)
        while !condition(){guard Date()<deadline else{XCTFail("Selected authored intro proxy did not become ready");throw CancellationError()};try await Task.sleep(for:.milliseconds(10))}
    }
    func testLateReadinessCannotFlashTerminalModelOrRepeatHomepageHandoff()throws {
        let view=intro();var cues=0,handoffs=0
        let carrier=UIView();carrier.addSubview(view)
        view.onCharacterCue={_ in cues+=1}
        view.start{handoffs+=1;XCTAssertTrue(view.terminalCompositionHidden);XCTAssertNil(view.superview)}
        XCTAssertFalse(view.timelineStarted);XCTAssertEqual(cues,0)
        XCTAssertTrue(view.subviews.allSatisfy{$0.layer.opacity==0},"Readiness preparation must not display a full static intro before its authored entrance")
        view.receiveVideoReadiness(false);XCTAssertFalse(view.timelineStarted)
        view.receiveVideoReadiness(true);XCTAssertTrue(view.timelineStarted);XCTAssertEqual(cues,1)
        let unit=try XCTUnwrap(view.subviews.first)
        XCTAssertEqual(unit.layer.transform.m11,0,"Removing presentation animations must expose the terminal model, never a full logo")
        let sheen=try XCTUnwrap(unit.subviews.compactMap{$0 as? UIImageView}.first{$0.layer.mask != nil})
        let animation=try XCTUnwrap(sheen.layer.animation(forKey:"native-studio-sheen") as? CAKeyframeAnimation)
        XCTAssertEqual(animation.duration,6);XCTAssertEqual(animation.keyTimes,[0,0.04,0.10,0.31,0.37,1])
        view.animationDidStop(CAAnimation(),finished:true)
        XCTAssertEqual(handoffs,1);XCTAssertTrue(view.isRetired)
        view.receiveVideoReadiness(true);view.animationDidStop(CAAnimation(),finished:true)
        XCTAssertEqual(cues,1);XCTAssertEqual(handoffs,1);XCTAssertTrue(view.terminalCompositionHidden)
    }
    func testBoundedVideoReadinessFailureUsesOriginalAnimatedFootballAndDisposalRejectsLateFrames()async throws {
        let view=intro(timeout:0.01);defer{view.dispose()}
        var cues=0;view.onCharacterCue={_ in cues+=1};view.start{}
        try await wait{view.fallbackFramesPresented>0}
        XCTAssertEqual(view.selectedMotionSource,"animated-webp");XCTAssertTrue(view.timelineStarted);XCTAssertEqual(cues,1)
        let first=try XCTUnwrap(view.displayedFallbackImage?.pngData()),initial=view.fallbackFramesPresented
        try await wait{view.fallbackFramesPresented>=initial+8}
        XCTAssertNotEqual(try XCTUnwrap(view.displayedFallbackImage?.pngData()),first,"Authored football frames must move rather than retaining a static PNG")
        view.receiveVideoReadiness(true);XCTAssertEqual(view.selectedMotionSource,"animated-webp","Late video readiness cannot replace the admitted authored fallback")
        view.dispose();let retiredCount=view.fallbackFramesPresented
        try await Task.sleep(for:.milliseconds(150))
        XCTAssertEqual(view.fallbackFramesPresented,retiredCount);XCTAssertTrue(view.terminalCompositionHidden)
    }
    func testDisposalBeforeReadinessCancelsDeadlineAndBackgroundDefersVisibleTimeline()async throws {
        let retired=intro(timeout:0.02);retired.start{XCTFail("Disposed intro cannot reveal Home")};retired.dispose()
        retired.receiveVideoReadiness(true);try await Task.sleep(for:.milliseconds(80))
        XCTAssertFalse(retired.timelineStarted);XCTAssertEqual(retired.fallbackFramesPresented,0)
        let view=intro();defer{view.dispose()};view.start{}
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        view.receiveVideoReadiness(true);XCTAssertFalse(view.timelineStarted)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertTrue(view.timelineStarted);XCTAssertEqual(view.selectedMotionSource,"hevc-alpha")
    }
    func testMountedOriginalMediaCompletesNaturalExitOnceBeforeHomepageEnters()async throws {
        let prior=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let controller=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        window.rootViewController=controller;window.makeKeyAndVisible();controller.loadViewIfNeeded()
        let view=intro(.automatic),homepage=UIView();homepage.accessibilityIdentifier="intro-test-homepage"
        controller.view.addSubview(view)
        defer{view.dispose();window.isHidden=true;prior?.makeKeyAndVisible()}
        var handoffs=0
        view.start{
            handoffs+=1
            XCTAssertTrue(view.terminalCompositionHidden);XCTAssertNil(view.superview)
            homepage.frame=controller.view.bounds;controller.view.addSubview(homepage)
        }
        try await wait{view.timelineStarted}
        try await wait{
            view.selectedMotionSource=="hevc-alpha" ? view.mediaPlaybackSeconds>0.25:view.fallbackFramesPresented>8
        }
        XCTAssertTrue(["hevc-alpha","animated-webp"].contains(view.selectedMotionSource),"The mounted selected original media must move, not admit the static emergency image")
        XCTAssertEqual(handoffs,0);XCTAssertNil(homepage.superview)
        try await wait(timeout:7){handoffs==1}
        XCTAssertTrue(view.isRetired);XCTAssertTrue(view.terminalCompositionHidden)
        XCTAssertTrue(homepage.superview === controller.view)
        try await Task.sleep(for:.milliseconds(100));XCTAssertEqual(handoffs,1)
    }
    func testAllElevenOriginalFallbacksPresentChangingPixelsAndRetireSelectedWork()async throws {
        XCTAssertEqual(NativeStudioIntroView.characters.count,11)
        for character in NativeStudioIntroView.characters {
            let view=NativeStudioIntroView(root:NativeTestResources.root,character:character,mediaPreparation:.animatedFallback)
            view.frame = .init(x:0,y:0,width:390,height:844);view.layoutIfNeeded()
            var cues=0;view.onCharacterCue={_ in cues+=1};view.start{}
            try await wait{view.fallbackFramesPresented>0}
            let first=try XCTUnwrap(view.displayedFallbackImage?.pngData(),character.key)
            try await wait(timeout:2){view.fallbackFramesPresented>1 && view.displayedFallbackImage?.pngData() != first}
            XCTAssertEqual(view.selectedMotionSource,"animated-webp",character.key);XCTAssertEqual(cues,1)
            view.dispose();let count=view.fallbackFramesPresented
            try await Task.sleep(for:.milliseconds(60))
            XCTAssertEqual(view.fallbackFramesPresented,count,character.key);XCTAssertTrue(view.terminalCompositionHidden)
        }
    }
    func testAllElevenMountedAutomaticSelectionsAdvanceOriginalMedia()async throws {
        let prior=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let controller=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        window.rootViewController=controller;window.makeKeyAndVisible();controller.loadViewIfNeeded()
        defer{window.isHidden=true;prior?.makeKeyAndVisible()}
        for character in NativeStudioIntroView.characters {
            let view=NativeStudioIntroView(root:NativeTestResources.root,character:character)
            view.frame=controller.view.bounds;controller.view.addSubview(view);view.layoutIfNeeded();view.start{}
            try await wait{view.timelineStarted}
            if view.selectedMotionSource=="hevc-alpha" {
                try await wait{view.mediaPlaybackSeconds>0.25 || view.selectedMotionSource=="animated-webp"}
            }
            if view.selectedMotionSource=="animated-webp" {
                let first=try XCTUnwrap(view.displayedFallbackImage?.pngData(),character.key)
                try await wait(timeout:2){view.displayedFallbackImage?.pngData() != first}
            }
            XCTAssertTrue(["hevc-alpha","animated-webp"].contains(view.selectedMotionSource),character.key)
            print("[NativeStudioIntroProof] character=\(character.key) motion=\(view.selectedMotionSource) seconds=\(view.mediaPlaybackSeconds) frames=\(view.fallbackFramesPresented)")
            view.dispose();XCTAssertTrue(view.terminalCompositionHidden)
        }
    }
    func testOriginalElevenHEVCAssetsContainChangingFrames()async throws {
        for character in NativeStudioIntroView.characters {
            let url=NativeTestResources.root.appendingPathComponent("assets/logo addons/optimized/\(character.key)-mobile-hevc.mov")
            let generator=AVAssetImageGenerator(asset:AVURLAsset(url:url));generator.appliesPreferredTrackTransform=true
            generator.requestedTimeToleranceBefore = .zero;generator.requestedTimeToleranceAfter = .zero
            let first=try await generator.image(at:.zero).image
            let later=try await generator.image(at:CMTime(seconds:0.35,preferredTimescale:600)).image
            XCTAssertEqual(first.width,later.width,character.key);XCTAssertEqual(first.height,later.height,character.key)
            XCTAssertNotEqual(UIImage(cgImage:first).pngData(),UIImage(cgImage:later).pngData(),"Original HEVC must contain actual character motion: \(character.key)")
        }
    }
    func testReadyFirstFrameWithoutPlaybackFallsBackOnceAndPauseDisposeRejectStaleWork()async throws {
        let view=NativeStudioIntroView(root:NativeTestResources.root,character:.init("pas-novine",1.1),videoProgressProbe:{0})
        view.frame = .init(x:0,y:0,width:390,height:844);view.layoutIfNeeded()
        var cues=0;view.onCharacterCue={_ in cues+=1};view.start{}
        view.receiveVideoReadiness(true)
        XCTAssertEqual(view.selectedMotionSource,"hevc-alpha");XCTAssertEqual(cues,1)
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        try await Task.sleep(for:.milliseconds(1100))
        XCTAssertEqual(view.videoProgressCheckCount,0);XCTAssertEqual(view.fallbackFramesPresented,0)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        try await wait(timeout:3){view.selectedMotionSource=="animated-webp" && view.fallbackFramesPresented>1}
        XCTAssertEqual(cues,1,"A playback failure replaces only media, never the intro timeline/cue")
        view.receiveVideoReadiness(true);XCTAssertEqual(view.selectedMotionSource,"animated-webp")
        view.dispose();let frames=view.fallbackFramesPresented,checks=view.videoProgressCheckCount
        try await Task.sleep(for:.milliseconds(400))
        XCTAssertEqual(view.fallbackFramesPresented,frames);XCTAssertEqual(view.videoProgressCheckCount,checks)
        XCTAssertTrue(view.terminalCompositionHidden)
    }
    func testBackgroundDuringSelectedFallbackDecodeRetriesIntentAndRejectsOldPublication()async throws {
        var publications:[()->Void]=[]
        let view=NativeStudioIntroView(root:NativeTestResources.root,character:.init("pas-novine",1.1),
            videoProgressProbe:{0},decodedPublicationGate:{publications.append($0)})
        defer{view.dispose()}
        var cues=0;view.onCharacterCue={_ in cues+=1};view.start{};view.receiveVideoReadiness(true)
        try await wait(timeout:3){publications.count==1}
        XCTAssertEqual(view.selectedMotionSource,"fallback-loading");XCTAssertEqual(cues,1)
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        try await wait{publications.count==2}
        publications.removeFirst()()
        XCTAssertEqual(view.fallbackFramesPresented,0,"The pre-background decoded image belongs to the retired media epoch")
        publications.removeFirst()()
        XCTAssertEqual(view.selectedMotionSource,"animated-webp");XCTAssertEqual(view.fallbackFramesPresented,1)
        XCTAssertEqual(cues,1);XCTAssertLessThanOrEqual(view.videoProgressCheckCount,13)
    }
    func testRapidBackgroundResumeRejectsInFlightFallbackFrameAndKeepsOneChain()async throws {
        var publications:[()->Void]=[]
        let view=NativeStudioIntroView(root:NativeTestResources.root,character:.init("lik-cvijet",1.08),
            mediaPreparation:.animatedFallback,decodedPublicationGate:{publications.append($0)})
        defer{view.dispose()};view.start{}
        try await wait{publications.count==1};publications.removeFirst()()
        try await wait{publications.count==1}
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        try await wait{publications.count==2}
        publications.removeFirst()()
        XCTAssertEqual(view.fallbackFramesPresented,1,"An in-flight prior epoch cannot paint or create a second timer chain")
        publications.removeFirst()();XCTAssertEqual(view.fallbackFramesPresented,2)
        try await wait{publications.count==1}
        try await Task.sleep(for:.milliseconds(150))
        XCTAssertEqual(publications.count,1,"Only the resumed chain may request its next selected frame")
        view.dispose();publications.removeFirst()();XCTAssertEqual(view.fallbackFramesPresented,2)
    }
}
