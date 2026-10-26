import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeRouteMotionTests:XCTestCase {
    func testRapidMountedSliderSelectionNeverCommitsIconContactSquashIntoLayout()async throws {
        let motion=owner(),host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.windowScene=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first
        window.rootViewController=host;window.makeKeyAndVisible()
        host.view.addSubview(motion.home);motion.home.frame=window.bounds;motion.home.layoutIfNeeded()
        CATransaction.flush();try await Task.sleep(for:.milliseconds(100))
        defer{motion.cancel();motion.home.stopHeroIdle();window.isHidden=true}
        for i in 0..<18 {
            motion.selectSlide(i%3){}
            try await Task.sleep(for:.milliseconds(25))
            for icon in motion.home.navigationIconViews {
                XCTAssertTrue(CATransform3DEqualToTransform(icon.layer.transform,CATransform3DIdentity),"Contact paint is never a layout/model transform")
            }
        }
        motion.suspend();motion.resume();motion.cancel()
        try await Task.sleep(for:.milliseconds(450))
        for icon in motion.home.navigationIconViews {
            XCTAssertTrue(CATransform3DEqualToTransform(icon.layer.transform,CATransform3DIdentity))
            let painted=icon.layer.presentation()?.transform ?? icon.layer.transform
            XCTAssertEqual(painted.m11,1,accuracy:0.001);XCTAssertEqual(painted.m22,1,accuracy:0.001)
            XCTAssertEqual(painted.m42,0,accuracy:0.001,"Settled artwork must not retain a visual squash or offset")
        }
    }
    func testNavigationShadowWaits200msThenFadesAndRestoresAfterCancellation() async throws {
        let motion=owner(),host=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        window.windowScene=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first
        window.rootViewController=host;window.makeKeyAndVisible()
        let header=JimiV9NavigationHeader(frame:.init(x:0,y:0,width:390,height:110))
        header.backgroundColor=NativeAppPaperSurface.base;host.view.addSubview(header);header.layoutIfNeeded()
        defer {motion.cancel();window.isHidden=true}
        CATransaction.flush();try await Task.sleep(for:.milliseconds(40))
        motion.animate([(header,JimiV9Motion.journeyNavigationExit())]){}
        let group=try XCTUnwrap(header.layer.animation(forKey:"native-route") as? CAAnimationGroup)
        let fade=try XCTUnwrap(group.animations?.compactMap{$0 as? CABasicAnimation}.first{$0.keyPath=="shadowOpacity"})
        XCTAssertEqual(fade.beginTime,0.2);XCTAssertEqual(fade.duration,0.16)
        XCTAssertEqual((fade.fromValue as? NSNumber)?.doubleValue ?? -1,0.16,accuracy:0.001)
        XCTAssertEqual((fade.toValue as? NSNumber)?.doubleValue,0)
        CATransaction.flush();try await Task.sleep(for:.milliseconds(80))
        XCTAssertEqual(try XCTUnwrap(header.layer.presentation()).shadowOpacity,0.16,accuracy:0.001,"Shadow holds through the200ms delay")
        try await Task.sleep(for:.milliseconds(200))
        let partial=try XCTUnwrap(header.layer.presentation()).shadowOpacity
        XCTAssertGreaterThan(partial,0);XCTAssertLessThan(partial,0.14,"Shadow fades after its200ms delay")
        try await Task.sleep(for:.milliseconds(110))
        XCTAssertLessThan(try XCTUnwrap(header.layer.presentation()).shadowOpacity,0.001,"Shadow is gone before rectangle collapse finishes")
        motion.cancel()
        XCTAssertEqual(header.layer.shadowOpacity,0.16,accuracy:0.001)
        XCTAssertNil(header.layer.animation(forKey:"native-route"))
        motion.animate([(header,JimiV9Motion.homeEnter(.navigation))]){}
        XCTAssertEqual(header.layer.shadowOpacity,0.16,accuracy:0.001)
    }
    private final class WeakLayer {weak var value:CALayer?;init(_ value:CALayer){self.value=value}}
    private func owner()->NativeRouteMotion {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        return NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets))
    }
    func testCancellationKeepsPaintedModelAndOriginalLiveLayerBaseAcrossHiddenReentry() {
        let motion=owner(),target=UIView(frame:CGRect(x:20,y:30,width:100,height:80))
        let anchor=CGPoint(x:0.3,y:0.7)
        target.layer.anchorPoint=anchor;target.layer.opacity=0.42
        let exit=JimiV9Motion.Track(tweens:[.init(begin:0,duration:0.2,from:.scale(1),to:.scale(0,y:18,opacity:0),ease:.powerIn(2))],anchorX:0.5,anchorY:0.54)
        motion.animate([(target,exit)]){}
        // An unmounted layer has no presentation tree, so its authored model
        // endpoint is the deterministic painted-pose fallback for cancellation.
        let painted=target.layer.transform
        motion.cancel()
        XCTAssertTrue(CATransform3DEqualToTransform(target.layer.transform,painted))
        XCTAssertEqual(target.layer.opacity,0)
        XCTAssertEqual(target.layer.anchorPoint,anchor)
        XCTAssertEqual(motion.retainedLayerMetadataCount,1)
        let enter=JimiV9Motion.Track(tweens:[.init(begin:0,duration:0.2,from:.scale(0,opacity:0),to:.scale(1),ease:.powerOut(2))])
        motion.animate([(target,enter)]){}
        XCTAssertEqual(target.layer.opacity,0.42,accuracy:0.00001,"A surviving hidden target keeps its original alpha, not its collapsed zero")
        motion.cancel()
        XCTAssertEqual(target.layer.anchorPoint,anchor)
        XCTAssertEqual(motion.retainedLayerMetadataCount,1)
    }
    func testRetiredDynamicLayersReleaseAndMetadataStaysBoundedAcrossChurn() async {
        let motion=owner()
        let track=JimiV9Motion.Track(tweens:[.init(begin:0,duration:0.01,from:.scale(1),to:.scale(0,opacity:0),ease:.powerIn(2))])
        for _ in 0..<6 {
            var retired:[WeakLayer]=[]
            autoreleasepool {
                for _ in 0..<16 {
                    let target=UIView(frame:CGRect(x:0,y:0,width:80,height:80))
                    retired.append(WeakLayer(target.layer))
                    motion.animate([(target,track)]){}
                    motion.cancel()
                }
                CATransaction.flush()
            }
            // Cancelled Core Animation completion blocks release their captured
            // route targets on the main run loop, without a persistent ticker.
            let deadline=Date().addingTimeInterval(2)
            while retired.contains(where:{$0.value != nil}),Date()<deadline {
                try? await Task.sleep(for:.milliseconds(10))
            }
            XCTAssertTrue(retired.allSatisfy{$0.value == nil},"Route ownership must not retain retired cells/layers")
            motion.cancel()
            XCTAssertEqual(motion.retainedLayerMetadataCount,0,"Dead metadata is pruned at an existing cancellation boundary")
        }
    }
}
