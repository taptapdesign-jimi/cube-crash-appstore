import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeRouteMotionTests:XCTestCase {
    func testInterruptedHubExitStartsAtFrozenEnterPoseAndKeepsPendingIslandsHidden() throws {
        let motion=owner(),hub=motion.hub
        hub.frame=CGRect(x:0,y:0,width:390,height:844);hub.layoutIfNeeded()
        let selected=try XCTUnwrap(hub.worldUnits.first{$0.tag==2})
        selected.layer.transform=CATransform3DMakeScale(0.78,0.78,1)
        selected.layer.opacity=0.45
        let pending=try XCTUnwrap(hub.worldUnits.first{$0.tag==3});pending.layer.opacity=0
        let tracks=motion.hubTracks(enter:false,selectedWorldID:2,fromPaintedPose:true)
        let chosen=try XCTUnwrap(tracks.first{$0.0===selected}?.1.tweens.first)
        XCTAssertEqual(chosen.from.scaleX,0.78,accuracy:0.001)
        XCTAssertEqual(chosen.from.opacity,0.45,accuracy:0.001)
        let hidden=try XCTUnwrap(tracks.first{$0.0===pending}?.1)
        for sample in 0...40 {XCTAssertEqual(hidden.pose(at:hidden.duration*Double(sample)/40).opacity,0)}
    }

    func testHomePanoramaUsesContinuousOffsetsOppositeTheIllustration() {
        for width in [390.0,820.0] {
            for foreground in [false,true] {
                let limit=min(foreground ? 50.0:32.0,width*(foreground ? 0.12:0.08))*1.20*1.60*1.60*1.60
                for page in [0.0,0.25,0.5,1.0,1.5,2.0] {
                    let offset=JimiV9Motion.homeCloudPanoramaOffset(slideX:width*(1.5-page),width:width,foreground:foreground)
                    XCTAssertEqual(offset,(page-1)*limit,accuracy:0.000001)
                }
                XCTAssertLessThanOrEqual(2*limit,(foreground ? 491.52:314.5728)+0.000001)
            }
        }
    }

    func testCloudSettlingVariesApexAndReturnButKeepsCanonicalLanding() {
        var durations=Set<Double>(),apexes=Set<Double>()
        for index in 0..<6 {
            let profile=JimiV9Motion.homeCloudSettlingProfile(index:index)
            let curve=JimiV9Motion.HomeCloudCurve(start:0,end:100,initialVelocity:35,duration:0.60,delay:0,
                followThrough:true,coastScale:profile.coast,returnScale:profile.settle,extraDistance:profile.extra)
            let turn=curve.totalDuration-1.8*1.40/4.20*profile.settle
            XCTAssertEqual(curve.position(at:turn),100*(1+profile.extra),accuracy:0.000001)
            XCTAssertEqual(curve.velocity(at:turn),0,accuracy:0.000001)
            XCTAssertEqual(curve.position(at:curve.totalDuration),100)
            durations.insert(curve.totalDuration);apexes.insert(curve.position(at:turn))
        }
        XCTAssertEqual(durations.count,6);XCTAssertEqual(apexes.count,6)
    }

    func testCloudReleaseRejectsOppositeCarryAndBoundsFastRetarget() {
        let opposite=JimiV9Motion.HomeCloudCurve(start:0,end:100,initialVelocity:-900,duration:0.9,delay:0,followThrough:true)
        XCTAssertEqual(opposite.velocity(at:0),0)
        XCTAssertGreaterThan(opposite.position(at:0.2),0)
        let fast=JimiV9Motion.HomeCloudCurve(start:0,end:100,initialVelocity:9000,duration:0.9,delay:0,followThrough:true)
        XCTAssertEqual(fast.velocity(at:0),75,accuracy:0.000001)
        for step in 0...100 {
            let t=fast.totalDuration*Double(step)/100
            XCTAssertGreaterThanOrEqual(fast.position(at:t),-0.000001)
            XCTAssertLessThanOrEqual(fast.position(at:t),170.000001)
        }
    }

    func testCloudReleaseNeverRestartsOrReversesBeforeItsSingleApex() {
        let curve=JimiV9Motion.HomeCloudCurve(start:0,end:100,initialVelocity:500,duration:0.9,delay:0.2,staggered:true,followThrough:true)
        let apexTime=curve.totalDuration-1.8*1.40/4.20
        XCTAssertEqual(curve.velocity(at:0),75,accuracy:0.000001)
        var previous=curve.position(at:0)
        for step in 1...120 {
            let t=apexTime*Double(step)/120
            XCTAssertGreaterThanOrEqual(curve.velocity(at:t),-0.000001)
            let position=curve.position(at:t)
            XCTAssertGreaterThanOrEqual(position,previous-0.000001);previous=position
        }
        XCTAssertLessThan(curve.velocity(at:apexTime+0.3),0)
        XCTAssertEqual(curve.position(at:curve.totalDuration),100)
    }

    func testCloudSwipeGlidesPastTargetThenReturnsWithContinuousVelocity() {
        for staggered in [false,true] {
            let curve=JimiV9Motion.HomeCloudCurve(start:0,end:100,initialVelocity:40,duration:0.48,delay:staggered ? 0.1:0,staggered:staggered,followThrough:true)
            let mainEnd=curve.delay+curve.duration,coastEnd=mainEnd+1.5*1.40/4.20
            XCTAssertGreaterThan(curve.velocity(at:mainEnd),0)
            XCTAssertEqual(curve.position(at:coastEnd),170,accuracy:0.000001)
            XCTAssertEqual(curve.velocity(at:coastEnd),0,accuracy:0.000001)
            for boundary in [mainEnd,coastEnd] {
                XCTAssertEqual(curve.position(at:boundary-0.000001),curve.position(at:boundary+0.000001),accuracy:0.001)
                XCTAssertEqual(curve.velocity(at:boundary-0.000001),curve.velocity(at:boundary+0.000001),accuracy:0.01)
            }
            XCTAssertEqual(curve.position(at:curve.totalDuration),100)
            XCTAssertEqual(curve.velocity(at:curve.totalDuration),0)
        }
    }

    func testCloudCascadeCoastsThroughDelayAndSettlesWithoutVelocityJump() {
        let curve=JimiV9Motion.HomeCloudCurve(start:20,end:-100,initialVelocity:80,duration:0.48,delay:0.14,staggered:true)
        XCTAssertEqual(curve.position(at:0),20,accuracy:0.000001)
        XCTAssertEqual(curve.velocity(at:0),80,accuracy:0.000001)
        XCTAssertGreaterThan(curve.position(at:0.07),20)
        XCTAssertEqual(curve.position(at:0.14),25.6,accuracy:0.000001)
        XCTAssertEqual(curve.velocity(at:0.14),0,accuracy:0.000001)
        for t in [0.139999,0.140001] {
            XCTAssertEqual(curve.position(at:t),25.6,accuracy:0.001)
            XCTAssertEqual(curve.velocity(at:t),0,accuracy:0.1)
        }
        XCTAssertEqual(curve.position(at:curve.totalDuration),-100)
        XCTAssertEqual(curve.velocity(at:curve.totalDuration),0)
        let reversed=JimiV9Motion.HomeCloudCurve(start:curve.position(at:0.3),end:90,initialVelocity:curve.velocity(at:0.3),duration:0.45,delay:0.1,staggered:true)
        XCTAssertEqual(reversed.velocity(at:0),curve.velocity(at:0.3),accuracy:0.000001)
    }

    func testCloudHermiteRetargetPreservesVelocityAndStopsSoftly() {
        let first=JimiV9Motion.HomeCloudCurve(start:0,end:120,initialVelocity:0,duration:0.8,delay:0)
        XCTAssertEqual(first.velocity(at:0),0)
        let t=0.24,start=first.position(at:t),speed=first.velocity(at:t)
        let reversed=JimiV9Motion.HomeCloudCurve(start:start,end:-70,initialVelocity:speed,duration:0.6,delay:0)
        XCTAssertEqual(reversed.position(at:0),start,accuracy:0.000001)
        XCTAssertEqual(reversed.velocity(at:0),speed,accuracy:0.000001)
        XCTAssertEqual(reversed.position(at:0.6),-70,accuracy:0.000001)
        XCTAssertEqual(reversed.velocity(at:0.6),0)
        XCTAssertEqual(reversed.position(at:4),-70)
        for i in 0...60 {
            let p=reversed.position(at:Double(i)/100)
            XCTAssertTrue(p.isFinite);XCTAssertLessThan(abs(p),150)
        }
        let stagger=JimiV9Motion.HomeCloudCurve(start:5,end:70,initialVelocity:0,duration:0.5,delay:0.12)
        XCTAssertEqual(stagger.position(at:0.1),5)
        XCTAssertEqual(stagger.velocity(at:0.12),0)
        XCTAssertEqual(stagger.velocity(at:stagger.totalDuration),0)
    }

    func testHomeCTAFiveSecondIdleCartoonPausesAndRetires() throws {
        guard !UIAccessibility.isReduceMotionEnabled,UIApplication.shared.applicationState == .active else{throw XCTSkip("Active motion required")}
        let home=JimiV9HomeView(frame:CGRect(x:0,y:0,width:390,height:844),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        let host=UIViewController(),window=UIWindow(frame:home.bounds);window.rootViewController=host;window.makeKeyAndVisible();host.view.addSubview(home)
        defer{home.stopHeroIdle();home.removeFromSuperview();window.isHidden=true;window.rootViewController=nil}
        for index in 0..<3 {
            home.selectSlide(index,animated:false);home.startHeroIdle()
            let layer=home.ctaIdleBounceView.layer
            let bounce=try XCTUnwrap(layer.animation(forKey:JimiV9HomeView.ctaIdleBounceKey) as? CAKeyframeAnimation)
            XCTAssertEqual(bounce.duration,5);XCTAssertEqual(bounce.repeatCount,.infinity)
            XCTAssertEqual(bounce.values?.count,NativeHUDTapMotion.poses.count+1)
            home.pauseHeroIdle();XCTAssertEqual(layer.speed,0)
            home.startHeroIdle();XCTAssertEqual(layer.speed,1)
            home.stopHeroIdle();home.stopHeroIdle()
            XCTAssertNil(layer.animation(forKey:JimiV9HomeView.ctaIdleBounceKey))
        }
    }

    func testHomePanoramaRetainsCloudIdentityAcrossSlidesAndCleansMotion() throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Reduced Motion")}
        let motion=owner(),home=motion.home
        home.frame=CGRect(x:0,y:0,width:390,height:844);home.layoutIfNeeded()
        let clouds=home.cloudRenderViews
        XCTAssertEqual(clouds.count,30)
        XCTAssertEqual(home.cloudPanoramaLayers.count,30)
        for destination in [2,0,1,2,0] {
            motion.selectSlide(destination){}
            XCTAssertEqual(home.cloudRenderViews.map{ObjectIdentifier($0)},clouds.map{ObjectIdentifier($0)})
            for cloud in clouds {
                XCTAssertFalse(cloud.isDescendant(of:home.sliderTrack))
                XCTAssertEqual(cloud.layer.opacity,1)
            }
            for layer in home.cloudPanoramaLayers {
                let animation=try XCTUnwrap(layer.animation(forKey:"native-slide-selection") as? CAKeyframeAnimation)
                XCTAssertGreaterThanOrEqual(animation.duration,0.32)
                XCTAssertLessThanOrEqual(animation.duration,1.04)
                let values=try XCTUnwrap(animation.values as? [NSNumber])
                XCTAssertEqual(values.last!.doubleValue,Double(layer.position.x),accuracy:0.001)
            }
            let durations=home.cloudPanoramaLayers.compactMap{$0.animation(forKey:"native-slide-selection")?.duration}
            XCTAssertGreaterThan(Set(durations).count,4)
            motion.suspend()
            for layer in home.cloudPanoramaLayers {XCTAssertEqual(layer.speed,0)}
            motion.resume()
            for layer in home.cloudPanoramaLayers {XCTAssertEqual(layer.speed,1)}
        }
        motion.cancel();home.stopHeroIdle();home.stopHeroIdle()
        for layer in home.cloudPanoramaLayers {
            XCTAssertNil(layer.animation(forKey:"native-slide-selection"))
            XCTAssertNil(layer.animation(forKey:"native-home-cloud-drag"))
        }
    }

    func testHomePanoramaHasNoRetainedCompletionOwner() {
        weak var releasedHome:JimiV9HomeView?
        weak var releasedCloud:UIView?
        autoreleasepool {
            let home=JimiV9HomeView(frame:CGRect(x:0,y:0,width:390,height:844),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
            home.layoutIfNeeded();releasedHome=home;releasedCloud=home.cloudRenderViews.first
            let start=home.cloudPanoramaSnapshot
            home.selectSlide(2,animated:false);home.installCloudPanorama(from:start)
            home.stopHeroIdle()
        }
        XCTAssertNil(releasedHome);XCTAssertNil(releasedCloud)
    }

    func testArcadeEnterCloudCadenceIsFortyPercentFasterWithoutShorteningScale() throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Reduced Motion")}
        let hub=JimiV9HubView(frame:CGRect(x:0,y:0,width:820,height:1180),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root),arcade:true)
        hub.layoutIfNeeded()
        let base=JimiV9Motion.homeEnter(.hero)
        let clouds=hub.includingCloudTracks(hub.worldUnits.map{($0,base)}).filter{
            $0.0.accessibilityIdentifier?.hasPrefix("native.arcade.cloud-route.")==true
        }
        XCTAssertEqual(clouds.count,15)
        for (index,item) in clouds.enumerated() {
            XCTAssertEqual(try XCTUnwrap(item.1.tweens.first).begin,0.145+Double(index)*0.010,accuracy:0.000001)
            XCTAssertEqual(item.1.tweens.map{$0.duration},base.tweens.map{$0.duration})
        }
    }

    func testHomeCloudCascadeHasIndependentShellsAndSharesRoutePauseAndCancel() throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Reduced Motion")}
        let motion=owner(),host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.windowScene=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first
        window.rootViewController=host;window.makeKeyAndVisible()
        host.view.addSubview(motion.home);motion.home.frame=window.bounds;motion.home.layoutIfNeeded()
        defer{motion.cancel();motion.home.stopHeroIdle();window.isHidden=true}
        let incoming=motion.home.cloudRouteTracks(enter:true)
        XCTAssertEqual(incoming.count,30)
        for (index,item) in incoming.enumerated() {
            XCTAssertFalse(item.0.isDescendant(of:motion.home.heroView))
            XCTAssertEqual(try XCTUnwrap(item.1.tweens.first).begin,0.145+Double(index)*0.014,accuracy:0.000001)
        }
        motion.animate(motion.homeTracks(enter:true)){}
        CATransaction.flush();motion.suspend()
        for (shell,_) in incoming {XCTAssertEqual(shell.layer.speed,0)}
        motion.resume()
        for (shell,_) in incoming {XCTAssertEqual(shell.layer.speed,1)}
        motion.cancel();motion.cancel()
        for (shell,_) in incoming {XCTAssertNil(shell.layer.animation(forKey:"native-route"))}
    }

    func testHiddenPendingCloudNeverInflatesDuringInterruptedExit() {
        let shell=UIView(frame:CGRect(x:0,y:0,width:180,height:100))
        shell.layer.transform=CATransform3DMakeScale(0,0,1);shell.layer.opacity=0
        let track=JimiV9Motion.cloudCascade(on:shell,base:JimiV9Motion.homeExit(.hero),enter:false,index:7)
        for step in 0...100 {XCTAssertEqual(track.pose(at:track.duration*Double(step)/100).opacity,0)}
    }

    func testArcadeCloudExitHasFifteenSeparateQuicklyStaggeredTargets() throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Reduced Motion")}
        let hub=JimiV9HubView(frame:CGRect(x:0,y:0,width:820,height:1180),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root),arcade:true)
        hub.layoutIfNeeded()
        let base=JimiV9Motion.homeExit(.hero)
        let tracks=hub.includingCloudTracks(hub.worldUnits.map{($0,base)})
        let clouds=tracks.filter{$0.0.accessibilityIdentifier?.hasPrefix("native.arcade.cloud-route.")==true}
        XCTAssertEqual(clouds.count,15)
        XCTAssertEqual(Set(clouds.map{ObjectIdentifier($0.0)}).count,15)
        for (index,item) in clouds.enumerated() {
            XCTAssertEqual(try XCTUnwrap(item.1.tweens.first).begin,0.100+Double(index)*0.014,accuracy:0.000001)
            XCTAssertFalse(hub.worldUnits.contains{$0 === item.0.superview})
            XCTAssertEqual(item.1.tweens.map{$0.duration},base.tweens.map{$0.duration})
        }
    }

    func testWorldSelectionCloudsUseIndependentRoutesOnPhoneAndTablet() throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Reduced Motion")}
        for size in [CGSize(width:390,height:844),CGSize(width:820,height:1180)] {
            let hub=JimiV9HubView(frame:CGRect(origin:.zero,size:size),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
            hub.layoutIfNeeded()
            let base=JimiV9Motion.homeExit(.hero)
            let entries=hub.includingCloudTracks(hub.worldUnits.map{($0,base)})
            let clouds=entries.filter{$0.0.accessibilityIdentifier?.hasPrefix("native.hub.cloud-route.")==true}
            XCTAssertEqual(clouds.count,size.width>500 ? 16:13)
            XCTAssertEqual(Set(clouds.map{ObjectIdentifier($0.0)}).count,clouds.count)
            for (index,item) in clouds.enumerated() {
                XCTAssertEqual(try XCTUnwrap(item.1.tweens.first).begin,0.100+Double(index)*0.014,accuracy:0.000001)
                XCTAssertFalse(hub.worldUnits.contains{$0 === item.0.superview})
            }
        }
    }

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
