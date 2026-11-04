import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeHomeBreezeTests:XCTestCase {
    func testFanOriginGustReversalSizesAndForegroundBudget() {
        XCTAssertEqual(NativeHomeBreeze.families(slide:0),[.leaf])
        XCTAssertEqual(NativeHomeBreeze.families(slide:1),[.balloon])
        XCTAssertEqual(NativeHomeBreeze.families(slide:2),[.die])
        for size in [CGSize(width:390,height:844),CGSize(width:820,height:1180)] {
            let origin=CGPoint(x:size.width/2,y:size.height*0.72)
            for family in NativeHomeBreeze.Family.allCases {
                let plans=(0..<NativeHomeBreeze.slots(family)).map{NativeHomeBreeze.Flight(family:family,index:$0,size:size,seed:51,origin:origin,balloonMaximum:100)}
                if family == .balloon {
                    XCTAssertEqual(plans.count,2)
                    XCTAssertTrue(plans.filter{$0.stageBorn}.allSatisfy{!$0.foreground && !$0.rear})
                } else if family == .leaf {XCTAssertLessThanOrEqual(plans.filter{$0.foreground}.count,1)}
                else {XCTAssertEqual(plans.filter{$0.foreground}.count,0)}
                XCTAssertEqual(plans.first?.birth,0)
                XCTAssertLessThanOrEqual(plans.last!.birth,family == .leaf ? 2.22:0.56)
                for plan in plans {
                    if family == .balloon && !plan.stageBorn {
                        XCTAssertGreaterThan(plan.point(0).y,size.height)
                        XCTAssertFalse(plan.rear)
                    } else if family == .leaf {
                        XCTAssertGreaterThanOrEqual(plan.point(0).x,plan.side/2)
                        XCTAssertLessThanOrEqual(plan.point(0).x,size.width-plan.side/2)
                        XCTAssertTrue(plan.point(0).y == origin.y || plan.point(0).y < 0)
                    } else {
                        XCTAssertLessThan(abs(plan.point(0).x-origin.x),9)
                        XCTAssertLessThan(abs(plan.point(0).y-origin.y),7)
                    }
                    if family == .balloon {
                        if plan.foreground || plan.stageBorn {
                            XCTAssertEqual(plan.side,100)
                            for progress in [0.0,0.5,1] {
                                let transform=plan.transform(progress)
                                XCTAssertEqual(sqrt(transform.m11*transform.m11+transform.m12*transform.m12),1,accuracy:0.0001)
                            }
                        }
                        XCTAssertLessThan(plan.point(0.60).y,plan.origin.y-80)
                    } else if family == .die {
                        XCTAssertFalse(plan.foreground)
                        XCTAssertLessThan(plan.point(0.20).y,plan.origin.y)
                        XCTAssertLessThanOrEqual(abs(plan.spin),460 * .pi/180)
                    }
                    if family == .leaf {
                        if plan.origin.y<0 {
                            XCTAssertGreaterThan(plan.point(0.8).y,plan.point(0.2).y)
                        } else {XCTAssertNotNil(plan.leafMotion)}
                        XCTAssertGreaterThanOrEqual(plan.duration,2.4/1.60)
                        let angle=plan.phase.truncatingRemainder(dividingBy:.pi/2)
                        XCTAssertGreaterThanOrEqual(angle,18 * .pi/180-0.001)
                        XCTAssertLessThanOrEqual(angle,72 * .pi/180+0.001)
                    }
                    XCTAssertLessThanOrEqual(plan.duration,family == .leaf ? 3.6/1.60:9)
                    if family == .balloon {
                        XCTAssertLessThan(plan.point(1).y,0);XCTAssertLessThanOrEqual(plan.side,100)
                    } else if family == .leaf {XCTAssertGreaterThan(plan.point(1).y,size.height)}
                    else {XCTAssertGreaterThan(plan.point(1).y,size.height)}
                    for step in 0...120 {
                        let t=Double(step)/120,transform=plan.transform(t)
                        let side=plan.side*sqrt(transform.m11*transform.m11+transform.m12*transform.m12)
                        XCTAssertGreaterThan(side,0)
                        XCTAssertLessThanOrEqual(side,family == .shard ? 39.0001:family == .balloon ? 100.0001:family == .leaf ? plan.side*1.10:60.0001)
                        XCTAssertTrue(plan.point(t).x.isFinite);XCTAssertTrue(plan.point(t).y.isFinite)
                    }
                }
            }
        }
    }

    func testLeavesMixSideReleasesAndRandomTopBirthsAcrossCloudDepths() {
        let flights=(0..<32).flatMap{seed in (0..<6).map{index in
            NativeHomeBreeze.Flight(family:.leaf,index:index,size:CGSize(width:390,height:844),seed:Double(seed))
        }}
        XCTAssertTrue(flights.filter{$0.source.hasPrefix("assets/shop/bee/")}.allSatisfy{!$0.foreground && !$0.stageBorn})
        for seed in 0..<32 {
            let leaves=Array(flights[(seed*6)..<(seed*6+6)])
            for i in 1..<leaves.count {XCTAssertGreaterThan(leaves[i].birth-leaves[i-1].birth,0.17)}
            XCTAssertEqual(Set(leaves.compactMap{ $0.leafMotion?.gravity }).count,6)
            XCTAssertEqual(Set(leaves.compactMap{ $0.leafMotion?.flutter }).count,6)
        }
        let phone=NativeHomeBreeze.Flight(family:.leaf,index:0,size:CGSize(width:390,height:844),seed:51)
        let tablet=NativeHomeBreeze.Flight(family:.leaf,index:0,size:CGSize(width:820,height:1180),seed:51)
        XCTAssertEqual(phone.side,tablet.side*0.5,accuracy:0.0001)
        XCTAssertTrue(flights.contains{$0.origin.y<0})
        XCTAssertTrue(flights.contains{$0.origin.y>0})
        XCTAssertTrue(flights.allSatisfy{$0.leafMotion != nil && $0.point(1).y>844})
        XCTAssertTrue(flights.filter{$0.origin.y>0}.allSatisfy{plan in (0...120).allSatisfy{plan.point(Double($0)/120).y>0}})
        XCTAssertTrue(flights.contains{$0.rear});XCTAssertTrue(flights.contains{!$0.rear})
        XCTAssertLessThan(flights.filter{$0.origin.y<0}.map(\.origin.x).min()!,50)
        XCTAssertGreaterThan(flights.filter{$0.origin.y<0}.map(\.origin.x).max()!,340)
    }

    func testJourneyFlowerSlotUsesOriginalThreeColorsAndLeafMotion() {
        let size=CGSize(width:390,height:844)
        let flowers=(0..<64).map{NativeHomeBreeze.Flight(family:.leaf,index:NativeHomeBreeze.flowerSlotIndex,size:size,seed:Double($0))}
        XCTAssertEqual(Set(flowers.map(\.source)),Set((1...3).map{"assets/shop/bush/flowr\($0).png"}))
        XCTAssertTrue(flowers.allSatisfy{$0.leafMotion != nil && !$0.stageBorn})
        XCTAssertTrue(flowers.contains{$0.foreground})
        XCTAssertTrue(flowers.contains{!$0.foreground})
        XCTAssertTrue(flowers.filter{$0.foreground}.allSatisfy{!$0.rear})
        for index in 0..<NativeHomeBreeze.flowerSlotIndex {
            XCTAssertTrue(NativeHomeBreeze.Flight(family:.leaf,index:index,size:size,seed:51).source.hasPrefix("assets/shop/bee/leaf"))
        }
    }

    func testSparsePopulationAndLeafDescentTiming() {
        XCTAssertEqual(NativeHomeBreeze.slots(.leaf),3)
        XCTAssertEqual(NativeHomeBreeze.slots(.balloon),2)
        XCTAssertEqual(NativeHomeBreeze.slots(.die),2)
        XCTAssertEqual(NativeHomeBreeze.slots(.shard),3)
        for seed in 0..<100 {
            let leaf=NativeHomeBreeze.Flight(family:.leaf,index:0,size:CGSize(width:390,height:844),seed:Double(seed))
            XCTAssertGreaterThanOrEqual(leaf.playbackDuration,leaf.duration)
            XCTAssertLessThanOrEqual(leaf.playbackDuration,leaf.duration/0.8/0.70+0.0001)
            for p in [0.0,0.2,0.5,0.8,1] {
                XCTAssertEqual(leaf.progress(after:leaf.elapsed(at:p)),p,accuracy:0.0001)
            }
        }
    }

    func testHomeLeavesUseWeeBeeScatterSamplerAcrossDeviceSizes() throws {
        for size in [CGSize(width:390,height:844),CGSize(width:820,height:1180)] {
            for seed in 0..<32 {
                let leaf=NativeHomeBreeze.Flight(family:.leaf,index:0,size:size,seed:Double(seed))
                let motion=try XCTUnwrap(leaf.leafMotion)
                XCTAssertEqual(leaf.playbackDuration,motion.lifetime/0.70,accuracy:0.0001)
                XCTAssertEqual(leaf.point(0).x,leaf.origin.x,accuracy:0.0001)
                XCTAssertEqual(leaf.point(0).y,leaf.origin.y,accuracy:0.0001)
                for progress in [0.0,0.15,0.35,0.6,0.85,1] {
                    let expected=motion.sample(seconds:leaf.sampleElapsed(at:progress))
                    XCTAssertEqual(leaf.point(progress).x,expected.x,accuracy:0.0001)
                    XCTAssertEqual(leaf.point(progress).y,expected.y,accuracy:0.0001)
                    XCTAssertEqual(leaf.opacity(progress),Float(expected.opacity),accuracy:0.0001)
                }
            }
        }
    }
    func testFreshEntryUsesAnActualVisibleAuthoredPose() {
        let size=CGSize(width:390,height:844)
        for family in [NativeHomeBreeze.Family.leaf,.balloon] {
            var visibleCandidates=0
            for seed in 0..<100 {
                let plan=NativeHomeBreeze.Flight(family:family,index:0,size:size,seed:Double(seed))
                guard let progress=plan.visibleEntryProgress(in:size) else{continue}
                visibleCandidates+=1
                let point=plan.point(progress)
                XCTAssertGreaterThanOrEqual(plan.opacity(progress),0.25)
                XCTAssertGreaterThanOrEqual(point.x,plan.side*0.25)
                XCTAssertLessThanOrEqual(point.x,size.width-plan.side*0.25)
                XCTAssertGreaterThanOrEqual(point.y,family == .leaf ? size.height*0.10:plan.side*0.25)
                XCTAssertLessThanOrEqual(point.y,family == .leaf ? size.height*0.40:size.height-plan.side*0.25)
            }
            XCTAssertGreaterThan(visibleCandidates,0)
        }
    }

    func testHitFallHasImmediateDownwardVelocityAndConstantAcceleration() {
        for y in [60.0,450,800] {
            for variation in [0.0,0.5,1] {
                let drop=NativeHomeBreeze.Drop(start:CGPoint(x:195,y:y),velocityX:-120,viewportHeight:844,side:60,variation:variation)
                XCTAssertLessThanOrEqual(drop.duration,1.30)
                XCTAssertGreaterThan(drop.point(seconds:0.05).y,y)
                XCTAssertGreaterThan(drop.point(seconds:drop.duration).y,844)
                let dt=drop.duration/4
                let a=drop.point(seconds:0),b=drop.point(seconds:dt),c=drop.point(seconds:2*dt)
                XCTAssertEqual(Double(c.y-2*b.y+a.y)/(dt*dt),drop.gravity,accuracy:0.001)
                XCTAssertEqual(Double(b.x-a.x)/dt,-120,accuracy:0.001)
            }
        }
    }

    func testImmediatePreparedActivationFiniteFallsAndBoundedRapidReentry() throws {
        guard UIApplication.shared.applicationState == .active,!UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Active compositor required")}
        let breeze=NativeHomeBreeze(),host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.windowScene=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first
        window.rootViewController=host;window.makeKeyAndVisible()
        for plane in [breeze.rearPlane,breeze.middlePlane,breeze.frontPlane,breeze.balloonStagePlane] {host.view.addSubview(plane)}
        defer{breeze.stop();window.isHidden=true;window.rootViewController=nil}
        breeze.layout(size:window.bounds.size)
        breeze.configure(origin:CGPoint(x:195,y:580),balloonMaximum:90)
        breeze.start(resourceRoot:NativeTestResources.root,slide:0,reducedMotion:false)
        XCTAssertEqual(breeze.particles.count,7);XCTAssertEqual(breeze.retainedImageCount,14)
        XCTAssertEqual(breeze.emittingFamilies,[.leaf])
        XCTAssertEqual(breeze.plans.filter{$0.source.hasPrefix("assets/shop/bush/flowr")}.count,1)
        XCTAssertEqual(breeze.plans.filter{$0.source.hasPrefix("assets/shop/bee/leaf")}.count,2)
        let identities=Set(breeze.particles.map{ObjectIdentifier($0)})
        let leaf=try XCTUnwrap(breeze.particles.filter{$0.animation(forKey:NativeHomeBreeze.animationKey) != nil}.min {
            $0.animation(forKey:NativeHomeBreeze.animationKey)!.beginTime < $1.animation(forKey:NativeHomeBreeze.animationKey)!.beginTime
        })
        let extraLeaf=try XCTUnwrap(breeze.particles.first{$0 !== leaf && $0.animation(forKey:NativeHomeBreeze.animationKey) != nil})
        let extraAnimation=try XCTUnwrap(extraLeaf.animation(forKey:NativeHomeBreeze.animationKey))
        extraAnimation.delegate?.animationDidStop?(extraAnimation,finished:true)
        XCTAssertNotNil(extraLeaf.animation(forKey:NativeHomeBreeze.animationKey),"Second leaf renews independently")
        let entryBegin=leaf.animation(forKey:NativeHomeBreeze.animationKey)!.beginTime
        XCTAssertLessThan(entryBegin,leaf.convertTime(CACurrentMediaTime(),from:nil))
        breeze.start(resourceRoot:NativeTestResources.root,slide:0,reducedMotion:false)
        XCTAssertEqual(leaf.animation(forKey:NativeHomeBreeze.animationKey)!.beginTime,entryBegin,"Idle admission must preserve the early entry clock")
        let leafAnimation=try XCTUnwrap(leaf.animation(forKey:NativeHomeBreeze.animationKey))
        XCTAssertEqual(leafAnimation.repeatCount,0)
        XCTAssertTrue(breeze.particles.filter{$0.animation(forKey:NativeHomeBreeze.animationKey) != nil}.allSatisfy{$0.superlayer !== breeze.frontPlane.layer})
        let leafReceipt=leafAnimation.delegate
        leafReceipt?.animationDidStop?(leafAnimation,finished:true)
        for _ in 2...5 {
            let next=try XCTUnwrap(leaf.animation(forKey:NativeHomeBreeze.animationKey))
            next.delegate?.animationDidStop?(next,finished:true)
            XCTAssertNotNil(extraLeaf.animation(forKey:NativeHomeBreeze.animationKey),"Both leaves stay independently admitted")
        }
        let leafDepth=leaf.superlayer?.superlayer?.superlayer
        XCTAssertTrue(leafDepth === breeze.rearPlane.layer || leafDepth === breeze.middlePlane.layer)
        XCTAssertNotNil(leaf.animation(forKey:NativeHomeBreeze.animationKey))
        XCTAssertEqual(breeze.retainedImageCount,14)
        CATransaction.flush();RunLoop.main.run(until:Date().addingTimeInterval(0.15))
        breeze.activatePrepared(slide:1)
        XCTAssertEqual(breeze.emittingFamilies,[.balloon])
        func liveBalloonImages()->Set<ObjectIdentifier> {
            Set(breeze.particles.filter{($0.animation(forKey:NativeHomeBreeze.animationKey) as? CAAnimationGroup)?.delegate != nil}
                .compactMap{$0.contents as? CGImage}.map{ObjectIdentifier($0)})
        }
        XCTAssertEqual(liveBalloonImages().count,2,"Active balloon slots must have different colors")
        let balloon=try XCTUnwrap(breeze.particles.filter {($0.animation(forKey:NativeHomeBreeze.animationKey) as? CAAnimationGroup)?.delegate != nil}.min {
            $0.animation(forKey:NativeHomeBreeze.animationKey)!.beginTime < $1.animation(forKey:NativeHomeBreeze.animationKey)!.beginTime
        })
        let balloonFlight=try XCTUnwrap(balloon.animation(forKey:NativeHomeBreeze.animationKey))
        let previousBalloonImage=try XCTUnwrap(balloon.contents as? CGImage)
        XCTAssertEqual(balloonFlight.repeatCount,0)
        balloonFlight.delegate?.animationDidStop?(balloonFlight,finished:true)
        XCTAssertFalse(previousBalloonImage === (balloon.contents as? CGImage))
        XCTAssertEqual(liveBalloonImages().count,2,"Renewal must preserve a mixed palette")
        XCTAssertNotNil(balloon.animation(forKey:NativeHomeBreeze.animationKey))
        let secondBalloon=try XCTUnwrap(breeze.particles.first {$0 !== balloon && ($0.animation(forKey:NativeHomeBreeze.animationKey) as? CAAnimationGroup)?.delegate != nil})
        let secondFlight=try XCTUnwrap(secondBalloon.animation(forKey:NativeHomeBreeze.animationKey))
        secondFlight.delegate?.animationDidStop?(secondFlight,finished:true)
        XCTAssertNotNil(secondBalloon.animation(forKey:NativeHomeBreeze.animationKey),"Second balloon renews independently")
        XCTAssertEqual(liveBalloonImages().count,2)
        XCTAssertEqual(breeze.retainedImageCount,14)
        XCTAssertGreaterThan(breeze.fallingLayers.count,0)
        XCTAssertTrue(breeze.fallingLayers.allSatisfy{$0.superlayer?.name=="native-home-ambient-slide-0" && $0.superlayer?.masksToBounds == true})
        let falling=try XCTUnwrap(breeze.fallingLayers.first)
        let animation=try XCTUnwrap(falling.animation(forKey:NativeHomeBreeze.fallKey) as? CAAnimationGroup)
        XCTAssertEqual(animation.repeatCount,0);XCTAssertLessThanOrEqual(animation.duration,1.30)
        let receipt=animation.delegate
        receipt?.animationDidStop?(animation,finished:true)
        XCTAssertNil(falling.superlayer);XCTAssertNil(falling.contents)
        for _ in 0..<12 {
            for slide in [2,0,1] {breeze.activatePrepared(slide:slide)}
            XCTAssertEqual(Set(breeze.particles.map{ObjectIdentifier($0)}),identities)
            XCTAssertLessThanOrEqual(breeze.fallingLayers.count,12)
            XCTAssertEqual(breeze.retainedImageCount,14)
        }
        breeze.activatePrepared(slide:2)
        XCTAssertEqual(breeze.emittingFamilies,[.die])
        XCTAssertEqual(breeze.particles.filter{$0.animation(forKey:NativeHomeBreeze.animationKey) != nil}.count,1)
        breeze.pause()
        XCTAssertTrue((breeze.particles+breeze.fallingLayers).allSatisfy{$0.speed==0})
        breeze.start(resourceRoot:NativeTestResources.root,slide:2,reducedMotion:false)
        XCTAssertTrue((breeze.particles+breeze.fallingLayers).allSatisfy{$0.speed==1})
        let retired=breeze.particles+breeze.fallingLayers
        breeze.stop();breeze.stop();receipt?.animationDidStop?(animation,finished:true);leafReceipt?.animationDidStop?(leafAnimation,finished:true)
        XCTAssertEqual(breeze.retainedImageCount,0);XCTAssertTrue(breeze.fallingLayers.isEmpty)
        XCTAssertTrue(retired.allSatisfy{$0.contents==nil && $0.superlayer==nil && $0.animationKeys()==nil})
        breeze.start(resourceRoot:NativeTestResources.root,reducedMotion:true)
        XCTAssertTrue(breeze.particles.isEmpty)
        breeze.start(resourceRoot:URL(fileURLWithPath:"/nonexistent-home-breeze"),reducedMotion:false)
        XCTAssertTrue(breeze.particles.isEmpty)
    }

    func testHomeDepthExitCleanupAndWeakOwnerRelease() throws {
        guard UIApplication.shared.applicationState == .active,!UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Active compositor required")}
        weak var released:NativeHomeBreeze?
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),host=UIViewController()
        window.rootViewController=host;window.makeKeyAndVisible()
        defer{window.isHidden=true;window.rootViewController=nil}
        autoreleasepool {
            let home=JimiV9HomeView(frame:window.bounds,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
            released=home.breeze
            host.view.addSubview(home);home.layoutIfNeeded();home.startHeroIdle()
            XCTAssertEqual(home.breeze.particles.count,7)
            XCTAssertEqual(home.heroImages[2].center.y-home.heroImages[2].superview!.bounds.midY,4,accuracy:0.001)
            let viewport=home.breeze.rearPlane.superview!
            XCTAssertTrue(home.breeze.frontPlane.superview === home)
            XCTAssertGreaterThan(home.subviews.firstIndex(of:home.breeze.frontPlane)!,home.subviews.firstIndex(of:viewport)!)
            XCTAssertFalse(home.breeze.frontPlane.isUserInteractionEnabled)
            XCTAssertTrue(home.breeze.frontPlane.clipsToBounds)
            XCTAssertEqual(home.breeze.middlePlane.layer.zPosition,-1.5)
            for (plan,layer) in zip(home.breeze.plans,home.breeze.particles) {
                let slide=plan.family == .leaf ? 0:plan.family == .die ? 2:1
                XCTAssertEqual(layer.superlayer?.name,"native-home-ambient-slide-\(slide)")
                XCTAssertTrue(layer.superlayer?.masksToBounds == true)
            }
            XCTAssertEqual(home.ambientSlideLayers.count,4)
            home.selectSlide(1,animated:false)
            for layer in home.ambientSlideLayers {XCTAssertEqual(layer.position.x,home.sliderTrack.layer.position.x)}
            XCTAssertEqual(home.breeze.emittingFamilies,[.balloon])
            home.selectSlide(2,animated:false)
            XCTAssertEqual(home.breeze.emittingFamilies,[.die])
            let tracks=home.ambientRouteTracks(enter:false)
            XCTAssertEqual(tracks.count,4)
            let exit=JimiV9Motion.homeExit(.hero,reducedMotion:UIAccessibility.isReduceMotionEnabled)
            for (_,track) in tracks {XCTAssertEqual(track.duration,exit.duration)}
            let route=NativeRouteMotion(home:home,hub:JimiV9HubView(frame:window.bounds,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root)))
            route.selectSlide(0){}
            CATransaction.flush()
            for layer in home.ambientSlideLayers {
                XCTAssertNotNil(layer.animation(forKey:"native-slide-selection"))
            }
            route.suspend()
            for layer in home.ambientSlideLayers {XCTAssertEqual(layer.speed,0)}
            route.resume();route.cancel()
            for layer in home.ambientSlideLayers {XCTAssertNil(layer.animation(forKey:"native-slide-selection"))}
            home.stopHeroIdle(preservePaintedPose:true)
            route.animate(route.homeTracks(enter:false)){};CATransaction.flush();route.suspend();route.resume();route.cancel();route.cancel()
            for (plane,_) in tracks {XCTAssertNil(plane.layer.animation(forKey:"native-route"))}
            home.isHidden=true
            XCTAssertTrue(home.breeze.particles.isEmpty);XCTAssertTrue(home.breeze.fallingLayers.isEmpty)
            home.isHidden=false;home.startHeroIdle()
            XCTAssertEqual(home.breeze.particles.count,7)
            home.removeFromSuperview();XCTAssertTrue(home.breeze.particles.isEmpty)
        }
        XCTAssertNil(released)
    }
}
