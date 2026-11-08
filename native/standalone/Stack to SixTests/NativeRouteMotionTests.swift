import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeRouteMotionTests:XCTestCase {
    func testInternalNavigationBackgroundGrowsTwelvePercentAndReturnsWithoutChangingRouteTiming() throws {
        let motion=owner(),host=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        window.windowScene=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first
        window.rootViewController=host;window.makeKeyAndVisible()
        defer {motion.cancel();window.isHidden=true}
        for width in [CGFloat(390),820] {
            for entering in [true,false] {
                let header=JimiV9NavigationHeader(frame:.init(x:0,y:0,width:width,height:110))
                host.view.addSubview(header);header.layoutIfNeeded();header.continuousBackground=true
                let decoration=try XCTUnwrap((header.layer as? JimiV9NavigationRouteLayer)?.decorationLayer)
                decoration.transform=CATransform3DMakeScale(1.025,1.025,1)
                motion.animate([(header,entering ? JimiV9Motion.homeEnter(.navigation):JimiV9Motion.journeyNavigationExit())]){}
                let group=try XCTUnwrap(decoration.animation(forKey:"native-route") as? CAAnimationGroup)
                let track=try XCTUnwrap(group.animations?.compactMap{$0 as? CAKeyframeAnimation}.first{$0.keyPath=="transform"})
                let poses=try XCTUnwrap(track.values as? [NSValue]).map{$0.caTransform3DValue}
                XCTAssertEqual(try XCTUnwrap(poses.first).m11,1.025,accuracy:0.000001)
                XCTAssertEqual(try XCTUnwrap(poses.last).m11,1.025,accuracy:0.000001)
                XCTAssertEqual(try XCTUnwrap(poses.map{$0.m11}.max()),1.025*(entering ? 1.12:1),accuracy:0.000001)
                XCTAssertTrue(poses.allSatisfy{$0.m11>=1.025 && $0.m42==0})
                XCTAssertEqual(track.duration,JimiV9ArchedNavigationTitle.elementDuration)
                XCTAssertEqual(track.beginTime,entering ? 0:JimiV9ArchedNavigationTitle.backgroundExitDelay)
                XCTAssertEqual(group.duration,JimiV9ArchedNavigationTitle.visualDuration(entering:entering))
                let opacity=try XCTUnwrap(group.animations?.compactMap{$0 as? CAKeyframeAnimation}.first{$0.keyPath=="opacity"})
                XCTAssertTrue(try XCTUnwrap(opacity.values as? [NSNumber]).allSatisfy{$0.doubleValue==1})
                motion.suspend();XCTAssertEqual(header.layer.speed,0)
                motion.resume();XCTAssertEqual(header.layer.speed,1)
                motion.cancel();motion.cancel()
                XCTAssertNil(decoration.animation(forKey:"native-route"))
                header.removeFromSuperview()
            }
        }
    }

    func testReducedTopNavigationRecipeNormalizesEverySourceWithoutBounceOrDelay() throws {
        let profiles:[(String,Double,Double)]=[("Hub",0.20,0),("World",0.20,0.08),("Backpack",0.16,0),("Box",0.16,0),("Settings",0.01,0.40)]
        for (name,oldDuration,oldDelay) in profiles {
            for entering in [true,false] {
                let transform=CAKeyframeAnimation(keyPath:"transform")
                transform.values=[NSValue(caTransform3D:CATransform3DMakeScale(0.96,0.96,1)),NSValue(caTransform3D:CATransform3DIdentity)]
                transform.duration=oldDuration;transform.beginTime=oldDelay
                let opacity=CAKeyframeAnimation(keyPath:"opacity");opacity.values=[0.3,0.8];opacity.duration=oldDuration
                let source=CAAnimationGroup();source.animations=[transform,opacity];source.duration=oldDelay+oldDuration;source.beginTime=123
                let group=JimiV9ArchedNavigationTitle.reducedNavigationGroup(source,entering:entering,rest:CATransform3DIdentity,initialOpacity:0.43)
                let expected=(entering ? 0.20:0.16)/1.2
                XCTAssertEqual(group.duration,expected,accuracy:0.000001,name)
                let hold=try XCTUnwrap(group.animations?.compactMap{$0 as? CAKeyframeAnimation}.first{$0.keyPath == "transform"})
                XCTAssertEqual(hold.beginTime,0,name);XCTAssertEqual(hold.duration,expected,accuracy:0.000001,name)
                let poses=try XCTUnwrap(hold.values as? [NSValue]).map{$0.caTransform3DValue}
                XCTAssertEqual(poses.count,2,name)
                XCTAssertTrue(poses.allSatisfy{CATransform3DEqualToTransform($0,CATransform3DIdentity)},"Reduced \(name) stays at its settled geometry, without pulse or drift")
                let fade=try XCTUnwrap(group.animations?.compactMap{$0 as? CAKeyframeAnimation}.first{$0.keyPath == "opacity"})
                XCTAssertEqual(fade.beginTime,0,name);XCTAssertEqual(fade.duration,expected,accuracy:0.000001,name)
                let alphas=try XCTUnwrap(fade.values as? [NSNumber]).map{$0.doubleValue}
                XCTAssertEqual(alphas.count,2,name)
                XCTAssertEqual(alphas[0],entering ? 0:Double(Float(0.43)),accuracy:0.000001,name)
                XCTAssertEqual(alphas[1],entering ? 1:0,accuracy:0.000001,name)
                XCTAssertEqual(source.duration,oldDelay+oldDuration,accuracy:0.000001,"Shared builder must not mutate a caller's content group")
                XCTAssertEqual(transform.beginTime,oldDelay,accuracy:0.000001,name)
            }
        }
    }

    func testScheduledEntryKeepsItsFutureClockAcrossPauseAndReducedMotionConsumesWithoutWaiting() async throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Normal scheduled clock required")}
        let motion=owner(),host=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        window.windowLevel=UIWindow.Level(rawValue:UIWindow.Level.alert.rawValue+1)
        window.rootViewController=host;window.makeKeyAndVisible()
        let hub=motion.hub;hub.frame=window.bounds;host.view.addSubview(hub);hub.layoutIfNeeded()
        defer{motion.cancel();window.isHidden=true}
        let header=hub.header,route=try XCTUnwrap(hub.header.layer as? JimiV9NavigationRouteLayer)
        let title=try XCTUnwrap(header.subviews.compactMap{$0 as? JimiV9ArchedNavigationTitle}.first)
        header.continuousBackground=true
        let requested=CACurrentMediaTime()+0.30;header.entryNotBefore=requested
        motion.animate([(header,JimiV9Motion.homeEnter(.navigation))]){}
        let parent=try XCTUnwrap(route.animation(forKey:"native-route"))
        let child=try XCTUnwrap(title.layer.animation(forKey:"native.navigation.content.enter"))
        XCTAssertNil(header.entryNotBefore,"The shared installer consumes the pending boundary exactly once")
        XCTAssertEqual(route.convertTime(parent.beginTime,to:nil),requested,accuracy:0.00001)
        XCTAssertEqual(child.fillMode,.backwards)
        CATransaction.flush();try await Task.sleep(for:.milliseconds(20))
        XCTAssertLessThan(try XCTUnwrap(title.layer.presentation()).opacity,0.001,"A scheduled title holds its hidden first pose")
        XCTAssertEqual(try XCTUnwrap(route.decorationLayer?.presentation()).opacity,1,accuracy:0.000001)
        motion.suspend()
        let frozen=title.layer.convertTime(CACurrentMediaTime(),from:nil),pausedAt=CACurrentMediaTime()
        try await Task.sleep(for:.milliseconds(150))
        XCTAssertEqual(title.layer.convertTime(CACurrentMediaTime(),from:nil),frozen,accuracy:0.000001)
        let pausedFor=CACurrentMediaTime()-pausedAt;motion.resume()
        XCTAssertEqual(try XCTUnwrap(route.animation(forKey:"native-route")).beginTime,parent.beginTime,accuracy:0.000001)
        XCTAssertEqual(try XCTUnwrap(title.layer.animation(forKey:"native.navigation.content.enter")).beginTime,child.beginTime,accuracy:0.000001)
        XCTAssertEqual(route.convertTime(parent.beginTime,to:nil)-requested,pausedFor,accuracy:0.02,"Resume shifts the physical boundary while preserving the same local timeline")
        XCTAssertEqual(parent.duration,(0.10+2*0.13+0.56)/(1.3*1.2),accuracy:0.000001)
        motion.cancel()

        let transform=CAKeyframeAnimation(keyPath:"transform")
        transform.values=[NSValue(caTransform3D:CATransform3DMakeScale(0.96,0.96,1)),NSValue(caTransform3D:CATransform3DIdentity)];transform.duration=0.2
        let source=CAAnimationGroup();source.animations=[transform];source.duration=0.2
        header.entryNotBefore=CACurrentMediaTime()+5
        route.installNavigation(source,forKey:"reduced-no-wait",reducedMotion:true)
        let reduced=try XCTUnwrap(route.animation(forKey:"reduced-no-wait"))
        XCTAssertNil(header.entryNotBefore)
        XCTAssertLessThanOrEqual(route.convertTime(reduced.beginTime,to:nil),CACurrentMediaTime()+0.005,"Reduced Motion consumes the reference deadline without adding a wait")
        XCTAssertEqual(reduced.duration,0.20/1.2,accuracy:0.000001)
        route.removeAllAnimations()
    }

    func testReducedInstalledContentFadeCannotFadeContinuousNavigationBackground() async throws {
        let motion=owner(),host=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        window.windowScene=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first
        window.rootViewController=host;window.makeKeyAndVisible()
        let hub=motion.hub;hub.frame=window.bounds;host.view.addSubview(hub);hub.layoutIfNeeded()
        defer{motion.cancel();window.isHidden=true}
        let header=hub.header,route=try XCTUnwrap(hub.header.layer as? JimiV9NavigationRouteLayer)
        let decoration=try XCTUnwrap(route.decorationLayer)
        let title=try XCTUnwrap(header.subviews.compactMap{$0 as? JimiV9ArchedNavigationTitle}.first)
        let targets:[UIView]=[title as UIView]+header.subviews.compactMap{$0 as? UIButton}.map{$0 as UIView}
        let unrelatedContent=CALayer();host.view.layer.addSublayer(unrelatedContent)
        for continuous in [true,false] {
            header.continuousBackground=continuous
            for entering in [true,false] {
                route.removeAllAnimations()
                let transforms=CAKeyframeAnimation(keyPath:"transform")
                transforms.values=[NSValue(caTransform3D:CATransform3DMakeScale(entering ? 0.96:1,entering ? 0.96:1,1)),NSValue(caTransform3D:CATransform3DMakeScale(entering ? 1:0.96,entering ? 1:0.96,1))]
                transforms.duration=0.56
                let source=CAAnimationGroup();source.animations=[transforms];source.duration=0.56
                source.beginTime=route.convertTime(CACurrentMediaTime(),from:nil)+0.08
                source.fillMode = .both;source.isRemovedOnCompletion=false
                let slowContent=CABasicAnimation(keyPath:"opacity");slowContent.fromValue=1;slowContent.toValue=0.5;slowContent.duration=0.6
                unrelatedContent.add(slowContent,forKey:"unrelated-content")
                route.installNavigation(source,forKey:"reduced-test",reducedMotion:true)
                let duration=(entering ? 0.20:0.16)/1.2
                let parent=try XCTUnwrap(route.animation(forKey:"reduced-test") as? CAAnimationGroup)
                let rootAlpha=try XCTUnwrap(parent.animations?.compactMap{$0 as? CAKeyframeAnimation}.first{$0.keyPath == "opacity"})
                XCTAssertEqual(try XCTUnwrap(rootAlpha.values as? [NSNumber]).map{$0.doubleValue},[1,1],"The common ancestor never fades decoration with its content")
                XCTAssertEqual(parent.duration,duration,accuracy:0.000001)
                for target in targets {
                    let group=try XCTUnwrap(target.layer.animation(forKey:"native.navigation.content.enter") as? CAAnimationGroup)
                    XCTAssertEqual(group.duration,duration,accuracy:0.000001)
                    XCTAssertEqual(group.beginTime-target.layer.convertTime(parent.beginTime,from:route),0,accuracy:0.000001,"Reduced title and icons start simultaneously")
                    let transform=try XCTUnwrap(group.animations?.compactMap{$0 as? CAKeyframeAnimation}.first{$0.keyPath == "transform"})
                    let values=try XCTUnwrap(transform.values as? [NSValue])
                    XCTAssertEqual(values.count,2)
                    XCTAssertTrue(CATransform3DEqualToTransform(values[0].caTransform3DValue,values[1].caTransform3DValue),"Reduced content changes alpha only")
                }
                let background=try XCTUnwrap(decoration.animation(forKey:"reduced-test") as? CAAnimationGroup)
                let alpha=try XCTUnwrap(background.animations?.compactMap{$0 as? CAKeyframeAnimation}.first{$0.keyPath == "opacity"})
                let values=try XCTUnwrap(alpha.values as? [NSNumber]).map{$0.doubleValue}
                if continuous {XCTAssertEqual(values,[1,1])}
                else {XCTAssertEqual(values.last,entering ? 1:0)}
                try await Task.sleep(for:.seconds(duration+0.05))
                XCTAssertNotNil(unrelatedContent.animation(forKey:"unrelated-content"),"Content admission may remain pending after navigation content fades")
                XCTAssertEqual(try XCTUnwrap(route.presentation()).opacity,1,accuracy:0.000001)
                if continuous {XCTAssertEqual(try XCTUnwrap(decoration.presentation()).opacity,1,accuracy:0.000001,"Continuous navigation stays opaque after title/icon exit, while unrelated content is still active")}
                if !entering {
                    for target in targets {XCTAssertLessThan(try XCTUnwrap(target.layer.presentation()).opacity,0.001)}
                }
            }
        }
    }

    func testNavigationExitContinuationKeepsPaintedGlyphsAndRemainingClockAfterSourceHides() async throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Full navigation tail required")}
        let motion=owner(),host=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        window.windowScene=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first
        window.rootViewController=host;window.makeKeyAndVisible()
        let hub=motion.hub;hub.frame=window.bounds;host.view.addSubview(hub);hub.layoutIfNeeded()
        defer{motion.cancel();window.isHidden=true}
        motion.animate([(hub.header,JimiV9Motion.journeyNavigationExit())]){}
        try await Task.sleep(for:.milliseconds(30))
        let tail=try XCTUnwrap(JimiV9NavigationExitContinuation(header:hub.header,host:host.view.layer,includeBackground:true))
        defer{tail.dispose()}
        let root=try XCTUnwrap(host.view.layer.sublayers?.first{$0.name == "native.navigation.exit-continuation"})
        XCTAssertGreaterThan(root.bounds.width,380,"Tail must copy actual painted header geometry")
        XCTAssertGreaterThan(root.bounds.height,50)
        func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap(descendants)}
        let copied=descendants(root)
        XCTAssertGreaterThan(copied.compactMap{$0 as? CAShapeLayer}.filter{$0.path != nil}.count,5,"Original curved title glyph paths survive source hide")
        XCTAssertTrue(copied.contains{$0.contents != nil},"Original navigation image payload survives source hide")
        let route=try XCTUnwrap(root.animation(forKey:"native-route"))
        let localNow=root.convertTime(CACurrentMediaTime(),from:nil)
        XCTAssertGreaterThanOrEqual(localNow,route.beginTime)
        XCTAssertLessThan(localNow,route.beginTime+route.duration,"Continuation keeps only the still-running authored clock")
        XCTAssertEqual(route.duration,(3*0.13+0.56)/(1.3*1.2),accuracy:0.000001)
        XCTAssertTrue(copied.contains{$0.animation(forKey:"native.navigation.content.enter") != nil},"Independent title/icon tails retain their exact existing tracks")
        hub.isHidden=true;motion.cancel()
        XCTAssertNotNil(root.superlayer,"Short content hide cannot truncate the longer navigation tail")
        let deadline=Date().addingTimeInterval(2)
        while root.superlayer != nil,Date()<deadline {try await Task.sleep(for:.milliseconds(10))}
        XCTAssertNil(root.superlayer,"Actual authored completion retires the copied layer tree")
        tail.dispose();tail.dispose()
    }

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
            let staggeredCount=home.cloudPanoramaLayers.indices.filter{$0%5>=2}.count
            // Existing accepted coast/settle profiles predate top-navigation
            // speed tuning. Their full travel+coast+return may exceed one second.
            let profiles:[(coast:Double,settle:Double)]=[
                (0.75,1.25),(1.05,0.90),(1.30,1.60),
                (0.90,1.90),(1.45,1.10),(1.15,1.45)]
            for (index,layer) in home.cloudPanoramaLayers.enumerated() {
                let animation=try XCTUnwrap(layer.animation(forKey:"native-slide-selection") as? CAKeyframeAnimation)
                let values=try XCTUnwrap(animation.values as? [NSNumber])
                let start=try XCTUnwrap(values.first).doubleValue,end=try XCTUnwrap(values.last).doubleValue
                let staggered=index%5>=2,profile=profiles[index%profiles.count]
                let travel=(staggered ? 0.85+Double(index%3)*0.06:0.90)/4.20
                let coastAndReturn=abs(end-start)>0.5 ? (1.5*1.40/4.20*profile.coast+1.8*1.40/4.20*profile.settle):0
                let maximumDelay=staggered ? Double(staggeredCount-1)*0.014/4.20:0
                XCTAssertGreaterThanOrEqual(animation.duration,travel+coastAndReturn-0.000001)
                XCTAssertLessThanOrEqual(animation.duration,travel+coastAndReturn+maximumDelay+0.000001)
                let delay=animation.duration-travel-coastAndReturn
                if staggered {
                    let rank=delay/(0.014/4.20)
                    XCTAssertEqual(rank,rank.rounded(),accuracy:0.000001,"Only the accepted cascade rank may offset this cloud")
                } else {XCTAssertEqual(delay,0,accuracy:0.000001)}
                XCTAssertEqual(end,Double(layer.position.x),accuracy:0.001)
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
    func testNavigationDividerUsesSharedExitFadeAndRestoresAfterCancellation() async throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Full decoration fade required")}
        let motion=owner(),host=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        window.windowScene=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first
        window.rootViewController=host;window.makeKeyAndVisible()
        let header=JimiV9NavigationHeader(frame:.init(x:0,y:0,width:390,height:110))
        header.backgroundColor=NativeAppPaperSurface.base;host.view.addSubview(header);header.layoutIfNeeded()
        defer {motion.cancel();window.isHidden=true}
        let decoration=try XCTUnwrap((header.layer as? JimiV9NavigationRouteLayer)?.decorationLayer)
        XCTAssertTrue(JimiV9NavigationHeader.usesHomeDividerTrial)
        XCTAssertEqual(header.layer.shadowOpacity,0,"Accepted divider decoration replaces the legacy root drop shadow")
        CATransaction.flush();try await Task.sleep(for:.milliseconds(40))
        motion.animate([(header,JimiV9Motion.journeyNavigationExit())]){}
        let group=try XCTUnwrap(decoration.animation(forKey:"native-route") as? CAAnimationGroup)
        let fade=try XCTUnwrap(group.animations?.compactMap{$0 as? CAKeyframeAnimation}.first{$0.keyPath=="opacity"})
        let speed=1.3*1.2,delay=3*0.13/speed,duration=0.56/speed
        XCTAssertEqual(fade.beginTime,delay,accuracy:0.000001)
        XCTAssertEqual(fade.duration,duration,accuracy:0.000001)
        XCTAssertEqual(group.duration,delay+duration,accuracy:0.000001)
        let alphas=try XCTUnwrap(fade.values as? [NSNumber]).map{$0.doubleValue}
        XCTAssertEqual(try XCTUnwrap(alphas.first),1,accuracy:0.000001)
        XCTAssertEqual(try XCTUnwrap(alphas.last),0,accuracy:0.000001)
        XCTAssertTrue(alphas.contains{$0>0 && $0<1},"Decoration owns the authored gradual exit fade")
        XCTAssertTrue(zip(alphas,alphas.dropFirst()).allSatisfy{$0.0+0.000001 >= $0.1})
        CATransaction.flush();try await Task.sleep(for:.milliseconds(80))
        XCTAssertEqual(try XCTUnwrap(decoration.presentation()).opacity,1,accuracy:0.001,"Divider holds through its shared exit delay")
        try await Task.sleep(for:.seconds(delay+duration+0.04))
        XCTAssertLessThan(try XCTUnwrap(decoration.presentation()).opacity,0.001)
        XCTAssertEqual(header.layer.shadowOpacity,0)
        motion.cancel()
        XCTAssertNil(header.layer.animation(forKey:"native-route"))
        XCTAssertNil(decoration.animation(forKey:"native-route"))
        XCTAssertEqual(decoration.opacity,1,accuracy:0.001,"Cancellation restores the settled decoration model")
        motion.animate([(header,JimiV9Motion.homeEnter(.navigation))]){}
        XCTAssertNotNil(decoration.animation(forKey:"native-route"))
        XCTAssertEqual(header.layer.shadowOpacity,0)
    }
    func testHomeBottomNavigationUsesSeparateMirroredTracksAndRetiresTogether() throws {
        let motion=owner(),home=motion.home,host=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        window.windowScene=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first
        window.rootViewController=host;window.makeKeyAndVisible();host.view.addSubview(home)
        home.frame=window.bounds;home.layoutIfNeeded()
        defer {motion.cancel();window.isHidden=true}
        let entry=motion.homeTracks(enter:true)
        XCTAssertFalse(entry.contains{$0.0 === home.navView})
        let footer=try XCTUnwrap(entry.first{$0.0 === home.fixedShadowView}?.1)
        XCTAssertEqual(footer.tweens.first?.from.y,24)
        XCTAssertEqual(footer.tweens.last?.to.y,0)
        XCTAssertGreaterThanOrEqual(footer.pose(at:footer.duration*0.7).scaleX,1)
        motion.animate(entry){}
        let layers=home.navigationButtonViews.map{$0.layer}+[home.fixedShadowView.layer]
        XCTAssertTrue(layers.allSatisfy{$0.animation(forKey:"native-route") != nil})
        motion.suspend();XCTAssertTrue(layers.allSatisfy{$0.speed==0})
        motion.resume();XCTAssertTrue(layers.allSatisfy{$0.speed==1})
        motion.cancel();motion.cancel()
        XCTAssertTrue(layers.allSatisfy{$0.animation(forKey:"native-route")==nil})
        let exit=home.navigationRouteTracks(enter:false)
        let delays=exit.filter{$0.0 !== home.fixedShadowView}.map{$0.1.tweens[0].begin}.sorted()
        XCTAssertEqual(delays,[0,0.13/1.3,2*0.13/1.3],"Home bottom keeps its previously authored speed")
        XCTAssertTrue(exit.allSatisfy{$0.1.tweens.last!.to.y>0 && $0.1.tweens.last!.to.opacity==0})
        let background=try XCTUnwrap(exit.first{$0.0 === home.fixedShadowView}?.1)
        XCTAssertEqual(background.tweens[0].begin,JimiV9ArchedNavigationTitle.backgroundExitDelay,accuracy:0.000001,"Paper and divider share the upper navigation exit onset")
        XCTAssertEqual(background.tweens[0].begin,0.25,accuracy:0.000001)
        XCTAssertEqual(background.tweens[0].duration,0.56/1.3,accuracy:0.000001,"Only placement changes; the Home exit curve and speed stay authored")
        XCTAssertEqual(footer.tweens[0].begin,0,"Home decoration entry is unchanged")
        motion.animate(exit){};motion.cancel()
        motion.animate(home.navigationRouteTracks(enter:true)){}
        XCTAssertTrue(layers.allSatisfy{$0.animation(forKey:"native-route") != nil})
    }

    func testHomeNavigationSelectionSizesRetainHorizontalAnchorsOnPhoneAndTablet() {
        for size in [CGSize(width:390,height:844),CGSize(width:820,height:1180)] {
            let home=JimiV9HomeView(frame:CGRect(origin:.zero,size:size),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
            home.layoutIfNeeded()
            let anchors=home.navigationButtonViews.map{$0.center.x}
            for selected in 0..<3 {
                home.selectSlide(selected,animated:false);home.layoutIfNeeded()
                for (index,button) in home.navigationButtonViews.enumerated() {
                    let original:CGFloat=size.width>600 ? (index==selected ? 84:76):(index==selected ? 72:64)
                    XCTAssertEqual(button.bounds.width,original*(index==selected ? 1.1:0.9),accuracy:0.001)
                    XCTAssertEqual(button.center.x,anchors[index],accuracy:0.001)
                }
            }
        }
    }

    func testSelectedHomeDieSwaysBothWaysAndRestoresExistingIdleOnDeselection() throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Reduced Motion")}
        let home=owner().home,host=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        window.windowScene=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first
        window.rootViewController=host;window.makeKeyAndVisible();host.view.addSubview(home)
        home.frame=window.bounds;home.layoutIfNeeded()
        defer{home.stopHeroIdle();window.isHidden=true}
        home.selectSlide(1,animated:false);home.startHeroIdle()
        let shell=try XCTUnwrap(home.navigationIconViews[1].superview).layer
        let sway=try XCTUnwrap(shell.animation(forKey:"native-home-nav-idle") as? CAKeyframeAnimation)
        XCTAssertEqual((sway.value(forKey:"nativeHomeActiveDie") as? NSNumber)?.boolValue,true)
        let poses=try XCTUnwrap(sway.values as? [NSValue])
        let angles=poses.map{atan2($0.caTransform3DValue.m12,$0.caTransform3DValue.m11)*180 / .pi}
        XCTAssertEqual(angles.count,7);XCTAssertTrue(angles.contains{$0>=1.5});XCTAssertTrue(angles.contains{$0<=(-1.5)})
        XCTAssertTrue(angles.allSatisfy{abs($0)<=3.001});XCTAssertGreaterThan(sway.duration,14)
        for pose in poses {
            let t=pose.caTransform3DValue
            XCTAssertEqual(t.m41,0);XCTAssertEqual(t.m42,0)
            XCTAssertEqual(hypot(t.m11,t.m12),1,accuracy:0.000001)
        }
        home.pauseHeroIdle();XCTAssertEqual(shell.speed,0)
        home.startHeroIdle();XCTAssertEqual(shell.speed,1)
        home.selectSlide(0,animated:false);home.startHeroIdle()
        let ordinary=try XCTUnwrap(shell.animation(forKey:"native-home-nav-idle") as? CAKeyframeAnimation)
        XCTAssertEqual((ordinary.value(forKey:"nativeHomeActiveDie") as? NSNumber)?.boolValue,false)
        XCTAssertEqual(ordinary.values?.count,3)
        let handoff=try XCTUnwrap(shell.animation(forKey:"native-home-nav-profile-handoff") as? CABasicAnimation)
        XCTAssertTrue(handoff.isAdditive);XCTAssertEqual(handoff.duration,0.65)
        home.stopHeroIdle();home.stopHeroIdle()
        XCTAssertNil(shell.animation(forKey:"native-home-nav-idle"))
        XCTAssertNil(shell.animation(forKey:"native-home-nav-profile-handoff"))
    }

    func testFiniteRouteCompletionIsIndependentOfSurroundingAnimationTransactions() async throws {
        let motion=owner(),host=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        window.windowLevel=UIWindow.Level(rawValue:UIWindow.Level.alert.rawValue+1)
        window.rootViewController=host;window.makeKeyAndVisible()
        let first=UIView(frame:.init(x:20,y:180,width:80,height:80)),last=UIView(frame:.init(x:120,y:180,width:80,height:80))
        let header=JimiV9NavigationHeader(frame:.init(x:0,y:0,width:390,height:110))
        header.continuousBackground=true
        [first,last,header].forEach{host.view.addSubview($0)}
        let sibling=CALayer();host.view.layer.addSublayer(sibling)
        defer{motion.cancel();sibling.removeAllAnimations();window.isHidden=true}
        for mode in ["long","repeating","paused"] {
            motion.cancel();sibling.removeAllAnimations();sibling.speed=1;sibling.timeOffset=0
            let short=JimiV9Motion.Track(tweens:[.init(begin:0,duration:0.10,from:.scale(0.8),to:.scale(1),ease:.powerOut(2))])
            let terminal=JimiV9Motion.Track(tweens:[.init(begin:0.04,duration:0.14,from:.scale(0.8),to:.scale(1),ease:.powerOut(2))])
            var completed=0
            CATransaction.begin()
            motion.animate([(first,short),(last,terminal),(header,JimiV9Motion.journeyNavigationExit())]){completed+=1}
            let unrelated=CABasicAnimation(keyPath:"opacity");unrelated.fromValue=1;unrelated.toValue=0.5;unrelated.duration=mode == "long" ? 5:0.5
            if mode == "repeating" {unrelated.repeatCount = .infinity}
            sibling.add(unrelated,forKey:"unrelated-sibling")
            if mode == "paused" {sibling.speed=0;sibling.timeOffset=0.1}
            CATransaction.commit()
            XCTAssertEqual(try XCTUnwrap(first.layer.animation(forKey:"native-route")).duration,terminal.duration,accuracy:0.000001,"All real content groups share the actual terminal endpoint")
            XCTAssertEqual(try XCTUnwrap(last.layer.animation(forKey:"native-route")).duration,terminal.duration,accuracy:0.000001)
            let deadline=Date().addingTimeInterval(2)
            while completed==0,Date()<deadline {try await Task.sleep(for:.milliseconds(10))}
            XCTAssertEqual(completed,1,"Finite route completion cannot wait for an unrelated \(mode) sibling or the surrounding transaction")
            XCTAssertNotNil(sibling.animation(forKey:"unrelated-sibling"),"The unrelated animation is still owned by its original caller")
            try await Task.sleep(for:.milliseconds(50))
            XCTAssertEqual(completed,1,"The terminal receipt completes at most once")
        }
    }

    func testRouteCompletionReleasesCancelledAndReplacedCallbacksBeforeOldTracksEnd() async throws {
        let motion=owner(),host=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        window.windowLevel=UIWindow.Level(rawValue:UIWindow.Level.alert.rawValue+1)
        window.rootViewController=host;window.makeKeyAndVisible()
        let old=UIView(frame:.init(x:20,y:180,width:80,height:80)),next=UIView(frame:.init(x:120,y:180,width:80,height:80))
        host.view.addSubview(old);host.view.addSubview(next)
        defer{motion.cancel();window.isHidden=true}
        let long=JimiV9Motion.Track(tweens:[.init(begin:0,duration:2,from:.scale(0.8),to:.scale(1),ease:.powerOut(2))])
        let short=JimiV9Motion.Track(tweens:[.init(begin:0,duration:0.10,from:.scale(0.8),to:.scale(1),ease:.powerOut(2))])
        var oldCallbacks=0,newCallbacks=0
        weak var replacedCapture:CALayer?
        autoreleasepool {
            let capture=CALayer();replacedCapture=capture
            motion.animate([(old,long)]){[capture] in _=capture;oldCallbacks+=1}
            motion.animate([(next,short)]){newCallbacks+=1}
        }
        let releaseDeadline=Date().addingTimeInterval(0.5)
        while replacedCapture != nil,Date()<releaseDeadline {try await Task.sleep(for:.milliseconds(10))}
        XCTAssertNil(replacedCapture,"Replacing a receipt must release its callback captures before the old2s track retires")
        let completionDeadline=Date().addingTimeInterval(2)
        while newCallbacks==0,Date()<completionDeadline {try await Task.sleep(for:.milliseconds(10))}
        XCTAssertEqual(newCallbacks,1);XCTAssertEqual(oldCallbacks,0)
        weak var cancelledCapture:CALayer?
        autoreleasepool {
            let capture=CALayer();cancelledCapture=capture
            motion.animate([(old,long)]){[capture] in _=capture;oldCallbacks+=1}
            motion.cancel();motion.cancel()
        }
        let cancelDeadline=Date().addingTimeInterval(0.5)
        while cancelledCapture != nil,Date()<cancelDeadline {try await Task.sleep(for:.milliseconds(10))}
        XCTAssertNil(cancelledCapture,"Cancellation retires callback resources immediately")
        try await Task.sleep(for:.milliseconds(150))
        XCTAssertEqual(oldCallbacks,0);XCTAssertEqual(newCallbacks,1)
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
