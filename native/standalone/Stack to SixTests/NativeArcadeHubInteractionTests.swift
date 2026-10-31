import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor final class NativeArcadeHubInteractionTests:XCTestCase {
    private func modal(_ hub:NativeArcadeHubView)->UIView? {hub.subviews.first{$0.accessibilityIdentifier=="native.arcade-world-modal"}}
    private func animatedView(_ root:UIView,key:String)->UIView? {
        if root.layer.animation(forKey:key) != nil{return root}
        return root.subviews.lazy.compactMap{animatedView($0,key:key)}.first
    }
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
            let epoch=CACurrentMediaTime()
            hub.playWorldTap(try XCTUnwrap(hub.worldIDs.first),beginTime:epoch){completions+=1}
            let art=try XCTUnwrap(animatedArtwork(hub))
            let animation=try XCTUnwrap(art.layer.animation(forKey:JimiV9HubView.worldTapAnimationKey) as? CAKeyframeAnimation)
            XCTAssertEqual(animation.keyPath,"transform.scale")
            XCTAssertEqual((animation.values as? [NSNumber])?.map(\.doubleValue),[1,1.12,1])
            XCTAssertEqual(animation.duration,0.25)
            XCTAssertNil(art.layer.animation(forKey:NativeHubBackpackFeedback.animationKey))
            if arcade {
                let shell=try XCTUnwrap(art.superview)
                let bounce=try XCTUnwrap(shell.layer.animation(forKey:NativeHubBackpackFeedback.animationKey))
                XCTAssertEqual(bounce.duration,0.4)
                XCTAssertEqual(shell.layer.convertTime(bounce.beginTime,to:nil),epoch,accuracy:0.001)
                XCTAssertNil(shell.layer.animation(forKey:"native.hub.world-tap-midpoint"),"Modal timing must not depend on a deferred no-op animation delegate")
            }
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
    func testMountedSelectedIslandBouncesStronglyThenModalCoversRetainedHub()async throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Reduced Motion skips contact")}
        let host=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible()
        let hub=NativeArcadeHubView(frame:window.bounds,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        host.view.addSubview(hub);hub.present();hub.resume();hub.layoutIfNeeded()
        defer{hub.hide();window.isHidden=true}
        XCTAssertFalse(hub.hub.scrollView.delaysContentTouches)
        XCTAssertTrue(hub.hub.scrollView.canCancelContentTouches)
        hub.hub.onWorld?(hub.hub.worldIDs[0])
        let sheet=try XCTUnwrap(modal(hub))
        let card=try XCTUnwrap(animatedView(sheet,key:"arcade.modal.enter"))
        XCTAssertTrue((sheet as? NativeArcadeWorldModal)?.isWaitingForEntry == true)
        let shell=try XCTUnwrap(animatedView(hub.hub,key:NativeHubBackpackFeedback.animationKey))
        let bounce=try XCTUnwrap(shell.layer.animation(forKey:NativeHubBackpackFeedback.animationKey) as? CAKeyframeAnimation)
        XCTAssertEqual(bounce.duration,0.48)
        let entry=try XCTUnwrap(card.layer.animation(forKey:"arcade.modal.enter"))
        let contactStart=shell.layer.convertTime(bounce.beginTime,to:nil)
        XCTAssertEqual(card.layer.convertTime(entry.beginTime,to:nil)-contactStart,0.20,accuracy:0.02)
        let poses=try XCTUnwrap(bounce.values as? [NSValue]).map{ $0.caTransform3DValue }
        XCTAssertGreaterThan(poses[1].m11,1.22)
        XCTAssertLessThan(poses[1].m22,0.75)
        XCTAssertGreaterThan(abs(poses[2].m42),10)
        for unit in hub.hub.worldUnits {
            XCTAssertNil(unit.layer.animation(forKey:"native-route"))
            XCTAssertTrue(CATransform3DIsIdentity(unit.layer.transform))
            XCTAssertEqual(unit.layer.opacity,1)
        }
        try await Task.sleep(for:.milliseconds(100))
        XCTAssertLessThan(try XCTUnwrap(card.layer.presentation()).opacity,0.01,"Contact remains visible before the scheduled overlap")
        let deadline=Date().addingTimeInterval(4)
        while sheet.accessibilityValue != "ready",Date()<deadline {try await Task.sleep(for:.milliseconds(10))}
        XCTAssertEqual(sheet.accessibilityValue,"ready")
        XCTAssertNil(shell.layer.animation(forKey:NativeHubBackpackFeedback.animationKey))
        for unit in hub.hub.worldUnits {XCTAssertTrue(CATransform3DIsIdentity(unit.layer.transform))}
        func close(_ root:UIView)->UIButton? {
            if root.accessibilityIdentifier == "native.arcade-world-modal.close" {return root as? UIButton}
            return root.subviews.lazy.compactMap{close($0)}.first
        }
        try XCTUnwrap(close(sheet)).sendActions(for:.touchUpInside)
        let returned=Date().addingTimeInterval(4)
        while modal(hub) != nil,Date()<returned {try await Task.sleep(for:.milliseconds(10))}
        XCTAssertNil(modal(hub));XCTAssertTrue(hub.hub.scrollView.isUserInteractionEnabled)
        for unit in hub.hub.worldUnits {XCTAssertNil(unit.layer.animation(forKey:"native-route"))}
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
            let pending=try XCTUnwrap(modal(hub),"Modal enter is scheduled when contact is accepted")
            XCTAssertEqual(pending.accessibilityValue,"entering")
            if action==0{hub.hide()}else if action==1{hub.suspend()}else{hub.removeFromSuperview()}
            XCTAssertNil(modal(hub),"Canceling before reveal must dispose the mounted pending modal")
            XCTAssertNil(pending.superview)
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
