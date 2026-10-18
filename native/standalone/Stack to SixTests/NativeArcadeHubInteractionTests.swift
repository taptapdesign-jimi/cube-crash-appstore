import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor final class NativeArcadeHubInteractionTests:XCTestCase {
    private func modal(_ hub:NativeArcadeHubView)->UIView? {hub.subviews.first{$0.accessibilityIdentifier=="native.arcade-world-modal"}}
    func testJourneyAndArcadeWorldArtworkUseGentleScaleUp() async throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Reduced Motion intentionally skips contact motion")}
        func animatedArtwork(_ view:UIView)->UIView? {
            if view.layer.animation(forKey:JimiV9HubView.worldTapAnimationKey) != nil{return view}
            return view.subviews.lazy.compactMap{animatedArtwork($0)}.first
        }
        for arcade in [false,true] {
            let host=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
            window.rootViewController=host;window.makeKeyAndVisible()
            let hub=JimiV9HubView(frame:window.bounds,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root),arcade:arcade)
            host.view.addSubview(hub);hub.layoutIfNeeded()
            defer{hub.stopIdle();hub.removeFromSuperview();window.isHidden=true}
            var completions=0
            hub.playWorldTap(try XCTUnwrap(hub.worldIDs.first)){completions+=1}
            let art=try XCTUnwrap(animatedArtwork(hub))
            let animation=try XCTUnwrap(art.layer.animation(forKey:JimiV9HubView.worldTapAnimationKey) as? CAKeyframeAnimation)
            XCTAssertEqual(animation.keyPath,"transform.scale")
            XCTAssertEqual((animation.values as? [NSNumber])?.map(\.doubleValue),[1,1.12,1])
            XCTAssertEqual(animation.duration,0.25)
            XCTAssertNil(art.layer.animation(forKey:NativeHubBackpackFeedback.animationKey))
            XCTAssertEqual(completions,0)
            try await Task.sleep(for:.milliseconds(75))
            let painted=try XCTUnwrap(art.layer.presentation()).transform.m11
            XCTAssertGreaterThan(painted,1)
            XCTAssertLessThanOrEqual(painted,1.12)
            try await Task.sleep(for:.milliseconds(500))
            XCTAssertEqual(completions,1)
            XCTAssertNil(art.layer.animation(forKey:JimiV9HubView.worldTapAnimationKey))
            XCTAssertTrue(CATransform3DIsIdentity(art.layer.transform))
        }
    }
    func testMountedWorldTapCancellationCannotOpenModalAfterHideBackgroundOrDetach()async throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Reduced Motion intentionally has no deferred artwork tap")}
        let host=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        window.rootViewController=host;window.makeKeyAndVisible()
        let hub=NativeArcadeHubView(frame:window.bounds,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        host.view.addSubview(hub)
        defer{hub.hide();hub.removeFromSuperview();window.isHidden=true;previous?.makeKeyAndVisible()}
        for action in 0..<3 {
            if hub.superview==nil{host.view.addSubview(hub)}
            hub.present();hub.resume();hub.layoutIfNeeded()
            hub.hub.onWorld?(hub.hub.worldIDs[0])
            XCTAssertNil(modal(hub),"Mounted art contact must precede modal")
            if action==0{hub.hide()}else if action==1{hub.suspend()}else{hub.removeFromSuperview()}
            try await Task.sleep(for:.milliseconds(450))
            XCTAssertNil(modal(hub),"Canceled contact cannot publish a stale modal")
            hub.hide()
        }
        host.view.addSubview(hub);hub.present();hub.resume();hub.layoutIfNeeded()
        hub.hub.onWorld?(hub.hub.worldIDs[1]);hub.hub.onWorld?(hub.hub.worldIDs[2])
        let deadline=Date().addingTimeInterval(3)
        while modal(hub)==nil,Date()<deadline{try await Task.sleep(for:.milliseconds(10))}
        let sheet=try XCTUnwrap(modal(hub))
        XCTAssertEqual(hub.subviews.filter{$0.accessibilityIdentifier=="native.arcade-world-modal"}.count,1)
        func texts(_ root:UIView)->[String]{(root as? UILabel).flatMap{$0.text}.map{[$0]} ?? root.subviews.flatMap{texts($0)}}
        XCTAssertTrue(texts(sheet).contains("One Lucky Drop"),"Duplicate tap cannot replace the captured world")
    }
}
