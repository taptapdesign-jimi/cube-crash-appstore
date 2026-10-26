import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeKitePresentationTests:XCTestCase {
    func testPairAlwaysChoosesOppositeExitEdgesAndMirrorsRightwardSVG() {
        for draw in [0.0,0.1,0.49,0.5,0.9,1.0,Double.nan] {
            let main=NativeKiteFinaleMotion(route:.init(width:390,height:844,origin:.init(x:195,y:500),seed:0.5))
            var pairedDraws=0,individualDraws=0
            let pair=NativeKiteBackgroundPlan.makePair(main:main,width:390,height:844,flagCount:8,random:{pairedDraws+=1;return draw})
            for index in 0..<2 {_ = NativeKiteBackgroundPlan(main:main,width:390,height:844,flagCount:8,index:index,random:{individualDraws+=1;return draw})}
            XCTAssertEqual(pairedDraws,individualDraws,"Pair assignment reuses the first facing draw; it must not advance shared randomness further")
            XCTAssertEqual(pair.count,2)
            XCTAssertEqual(Set(pair.map(\.direction)),Set([-1,1]))
            for plan in pair {
                XCTAssertEqual(plan.facing,plan.direction>0 ? -1:1,"Rightward Kite2 reflects the entire original left-facing SVG")
                for t in [0.8,1.7,2.4,3.4,4.7] {XCTAssertEqual(plan.sample(seconds:t).facing,plan.facing)}
                let end=plan.sample(seconds:NativeKiteBackgroundPlan.flightDuration)
                if plan.direction<0 {XCTAssertLessThan(end.point.x,0)}
                else {XCTAssertGreaterThan(end.point.x,390)}
            }
            if draw.isFinite {XCTAssertEqual(pair[0].direction,draw<0.5 ? -1:1)}
        }
    }
    func testSelectedSVGAndMountedFlightAreBoundedAndRetire() async throws {
        let root=Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")
        let artwork=JimiV9Artwork(resourceRoot:root)
        for path in NativeKiteArt.assets {
            let image=await withCheckedContinuation {continuation in artwork.prepareImage(path,densityAware:true){continuation.resume(returning:$0)}}
            XCTAssertNotNil(image,path)
        }
        let atlas=try XCTUnwrap(artwork.image(NativeKiteArt.path,densityAware:true)?.cgImage)
        XCTAssertEqual(atlas.width,1200);XCTAssertEqual(atlas.height,1920)
        let backgroundAtlas=try XCTUnwrap(artwork.image(NativeKiteArt.backgroundPath,densityAware:true)?.cgImage)
        XCTAssertEqual(backgroundAtlas.width,2400);XCTAssertEqual(backgroundAtlas.height,3600)
        weak var released:NativeBeeFinalePresentation?
        try autoreleasepool {
            let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),host=UIViewController()
            window.rootViewController=host;window.makeKeyAndVisible();host.view.backgroundColor=UIColor(red:0.98,green:0.95,blue:0.91,alpha:1)
            var draws=0
            let viewport=CGSize(width:390,height:844)
            let flight=NativeBeeFinalePresentation(resourceRoot:root,viewport:viewport,origin:.init(x:viewport.width-56,y:300),preparedArtwork:artwork,kite:true,random:{draws+=1;return Double(draws%97)/97})
            released=flight;XCTAssertTrue(flight.assetReady);host.view.addSubview(flight)
            flight.start();XCTAssertTrue(flight.hasActiveClock);flight.setSuspended(true)
            let rightFlight=NativeBeeFinalePresentation(resourceRoot:root,viewport:viewport,origin:.init(x:56,y:300),preparedArtwork:artwork,kite:true,random:{0.5})
            rightFlight.paint(seconds:0)
            let rightHero=try XCTUnwrap(rightFlight.subviews.first{$0.accessibilityIdentifier=="native-kite-hero"})
            XCTAssertLessThan(rightHero.transform.a*rightHero.transform.d-rightHero.transform.b*rightHero.transform.c,0,"Captured upper-half random draw mirrors hero immediately")
            rightFlight.dispose()
            let captured=draws
            let field=try XCTUnwrap(flight.subviews.first),hero=try XCTUnwrap(flight.subviews.first{$0.accessibilityIdentifier=="native-kite-hero"})
            XCTAssertEqual(hero.bounds.size,CGSize(width:390,height:390))
            XCTAssertTrue(flight.subviews.last === flight.subviews.first{$0 is NativeSplashGlyphField},"FLY AWAY stays above all three kites")
            XCTAssertGreaterThan(try XCTUnwrap(flight.subviews.last).layer.zPosition,hero.layer.zPosition)
            func glowColors(_ view:UIView)->Set<Int> {
                var colors=Set<Int>()
                if view.layer.shadowOpacity>0,let color=view.layer.shadowColor {
                    var r:CGFloat=0,g:CGFloat=0,b:CGFloat=0,a:CGFloat=0
                    UIColor(cgColor:color).getRed(&r,green:&g,blue:&b,alpha:&a)
                    colors.insert(Int((r*255).rounded())<<16 | Int((g*255).rounded())<<8 | Int((b*255).rounded()))
                }
                for child in view.subviews {colors.formUnion(glowColors(child))}
                return colors
            }
            XCTAssertTrue(glowColors(flight).isSuperset(of:[0x8FD593,0xDFEB89]))

            XCTAssertEqual(flight.duration,4.75,accuracy:0.0001)
            flight.paint(seconds:0.225)
            let pop=UIGraphicsImageRenderer(size:window.bounds.size).image{_ in host.view.drawHierarchy(in:host.view.bounds,afterScreenUpdates:true)}
            try pop.pngData()?.write(to:URL(fileURLWithPath:"/tmp/native-kite-spring-pop.png"))
            for frame in 0...270 {
                flight.paint(seconds:Double(frame)/60)
                let direction:CGFloat = 1
                XCTAssertGreaterThan(hero.transform.a*hero.transform.d-hero.transform.b*hero.transform.c,0,"Captured lower-half random draw keeps original orientation")
                XCTAssertLessThanOrEqual(abs(atan2(hero.transform.b*direction,hero.transform.a*direction)),20 * .pi/180+0.0001)
            }
            XCTAssertEqual(draws,captured,"No random draws during paint")
            let companions=field.subviews.filter{$0.accessibilityIdentifier?.hasPrefix("native-kite-background-")==true}
            XCTAssertEqual(companions.count,2)
            let lowerImage=try XCTUnwrap((companions[0].subviews.first as? UIImageView)?.image?.cgImage)
            let upperImage=try XCTUnwrap((companions[1].subviews.first as? UIImageView)?.image?.cgImage)
            XCTAssertEqual(lowerImage.width,2400,"Both companions now use user-selected kite2.svg")
            XCTAssertEqual(lowerImage.height,3600)
            XCTAssertEqual(upperImage.width,2400,"Upper companion must load kite2.svg atlas")
            XCTAssertEqual(upperImage.height,3600)
            XCTAssertEqual(field.subviews.count,102,"84 hero flags plus sixteen companion flags and two backgrounds")
            let companionFlags=field.subviews.filter{$0.accessibilityIdentifier?.hasPrefix("native-kite-companion-flag-")==true}
            XCTAssertEqual(companionFlags.count,16,"Eight flags from each smaller companion")
            XCTAssertTrue(companionFlags.allSatisfy{$0.layer.zPosition>4})
            XCTAssertTrue(companions.allSatisfy{$0.bounds.width<hero.bounds.width})
            let mainFlags=Array(field.subviews.prefix(84))
            let green=try XCTUnwrap(artwork.image("assets/shop/kite/zastavica2.png",densityAware:true)?.cgImage)
            let yellow=try XCTUnwrap(artwork.image("assets/shop/kite/zastavica3.png",densityAware:true)?.cgImage)
            for flag in mainFlags {
                let image=try XCTUnwrap((flag.subviews.first as? UIImageView)?.image?.cgImage)
                XCTAssertTrue(image === green || image === yellow,"Main green Kite emits only flags2/3")
            }
            for (index,flag) in companionFlags.enumerated() {
                XCTAssertEqual(flag.bounds.width,mainFlags[index].bounds.width*0.5,accuracy:0.001)
                XCTAssertEqual(flag.bounds.height,mainFlags[index].bounds.height*0.5,accuracy:0.001)
            }
            flight.paint(seconds:1.5)
            XCTAssertNotEqual(companions[0].transform.a*companions[0].transform.d-companions[0].transform.b*companions[0].transform.c,0)
            XCTAssertNotEqual(companions[1].transform.a*companions[1].transform.d-companions[1].transform.b*companions[1].transform.c,0)
            for t in [1.8,1.95,2.1] {
                flight.paint(seconds:t)
                XCTAssertLessThan(companions[0].center.y,companions[1].center.y)
                XCTAssertLessThanOrEqual(companions[1].center.y,844)
            }
            flight.paint(seconds:NativeKiteFinaleMotion.flightDuration)
            XCTAssertTrue(companions.allSatisfy{$0.center.y.isFinite})
            XCTAssertTrue(companions.allSatisfy{$0.center.x<0 || $0.center.x>390})
            XCTAssertTrue(hero.center.x < -195 || hero.center.x > 585)
            let image=try XCTUnwrap(hero.subviews.first as? UIImageView)
            XCTAssertEqual(image.bounds.size,CGSize(width:292.5,height:292.5),"Authored480px viewport inside640px SVG")
            flight.paint(seconds:2.575)
            let snapshot=UIGraphicsImageRenderer(size:window.bounds.size).image{_ in host.view.drawHierarchy(in:host.view.bounds,afterScreenUpdates:true)}
            try snapshot.pngData()?.write(to:URL(fileURLWithPath:"/tmp/native-kite-wind-finale.png"))
            flight.setSuspended(false);flight.dispose();flight.dispose()
            XCTAssertFalse(flight.hasActiveClock);XCTAssertNil(flight.superview)
            window.isHidden=true
        }
        XCTAssertNil(released,"Disposed finite owner releases its views and callbacks after autorelease drain")
    }
    func testGreenKiteCrossesSeventyPercentOfViewportInBothDirections() {
        for draw in [0.1,0.9] {
            let main=NativeKiteFinaleMotion(route:.init(width:390,height:844,origin:.init(x:195,y:400),seed:draw),random:{draw})
            let first=main.sample(seconds:1.1).point.y,last=main.sample(seconds:main.departure.start).point.y
            XCTAssertEqual(abs(first-last),844*0.7,accuracy:2)
            XCTAssertEqual(first>last,draw>=0.5)
        }
    }
    func testCompanionArrivalIsSlowAndHoldStaysInsideViewport() {
        for width in [320.0,390.0,768.0] {for draw in [0.0,0.5,1.0] {
            let main=NativeKiteFinaleMotion(route:.init(width:width,height:844,origin:.init(x:56,y:700),seed:draw),random:{draw})
            for index in 0..<2 {
                let plan=NativeKiteBackgroundPlan(main:main,width:width,height:844,flagCount:4,index:index,random:{draw})
                let early=plan.point(seconds:plan.delay+0.3)
                let settled=plan.point(seconds:plan.delay+1.15)
                XCTAssertGreaterThan(hypot(early.x-settled.x,early.y-settled.y),50)
                for frame in 0...100 {
                    let t=plan.delay+1.15+(plan.departure.start-plan.delay-1.15)*Double(frame)/100
                    let p=plan.point(seconds:t),inset=min(plan.size*0.56,width*0.46)
                    XCTAssertGreaterThanOrEqual(p.x,inset);XCTAssertLessThanOrEqual(p.x,width-inset)
                    XCTAssertGreaterThanOrEqual(p.y,inset);XCTAssertLessThanOrEqual(p.y,844-inset)
                }
            }
        }}
    }
    func testIndependentSideExitsStayContinuousBoundedAndFinishOnExistingClock() {
        for width in [320.0,390.0,768.0] {for draw in [0.0,0.5,1.0] {for origin in [NativeBeeFinaleMotion.Point(x:56,y:150),.init(x:width-56,y:700)] {
            let main=NativeKiteFinaleMotion(route:.init(width:width,height:844,origin:origin,seed:draw*6),random:{draw})
            let plans=NativeKiteBackgroundPlan.makePair(main:main,width:width,height:844,flagCount:3,random:{draw})
            XCTAssertLessThan(plans[1].departure.start,main.departure.start)
            XCTAssertGreaterThanOrEqual(plans[0].departure.start-main.departure.start,0.4-0.000001)
            let departures=[main.departure]+plans.map(\.departure)
            XCTAssertEqual(Set(departures.map{$0.style.rawValue}).count,3,"Three different curve styles, randomly assigned per run")
            XCTAssertEqual(Set(departures.map(\.duration)).count,3,"Each kite has its own speed even at identical RNG draws")
            for departure in departures {XCTAssertLessThan(departure.finish,NativeKiteFinaleMotion.flightDuration)}
            let end=main.sample(seconds:NativeKiteFinaleMotion.flightDuration)
            XCTAssertTrue(end.point.x < -195 || end.point.x > width+195)
            XCTAssertEqual(main.sample(seconds:main.departure.start).point.y-end.point.y,main.departure.rise,accuracy:0.001)
            for plan in plans {XCTAssertEqual(plan.point(seconds:NativeKiteFinaleMotion.flightDuration).x<0,plan.side<0)}
            for frame in 1...4700 {
                let t=Double(frame)/1000,hero=main.sample(seconds:t),prior=main.sample(seconds:t-0.001)
                XCTAssertLessThan(abs(hero.point.x-prior.point.x),8)
                XCTAssertLessThan(abs(hero.point.y-prior.point.y),8)
                XCTAssertLessThanOrEqual(abs(hero.rotation),20.0001)
                for plan in plans {
                    let a=plan.sample(seconds:t),b=plan.sample(seconds:t-0.001)
                    XCTAssertLessThan(abs(a.point.x-b.point.x),8);XCTAssertLessThan(abs(a.point.y-b.point.y),8)
                    XCTAssertLessThanOrEqual(abs(a.rotation),20.0001)
                    if t>=plan.departure.start {XCTAssertGreaterThanOrEqual(a.point.y,plan.point(seconds:plan.departure.start).y-150.001)}
                }
            }
            let stretch=main.stretch(seconds:1.1)
            XCTAssertEqual(stretch.x*stretch.y,1,accuracy:0.000001)
        }}}
    }
    func testRandomDeparturePlansAreCapturedOnceVaryAcrossRunsAndSeparateOpposedKites() {
        var signatures:Set<String>=[]
        for seed in 1...8 {
            var state=UInt64(seed),draws=0
            func random()->Double {draws+=1;state=state &* 6364136223846793005 &+ 1442695040888963407;return Double(state>>11)/Double(UInt64.max>>11)}
            let main=NativeKiteFinaleMotion(route:.init(width:390,height:844,origin:.init(x:195,y:500),seed:0.5),random:random)
            let plans=NativeKiteBackgroundPlan.makePair(main:main,width:390,height:844,flagCount:4,random:random)
            XCTAssertEqual(plans[0].direction,-plans[1].direction)
            XCTAssertNotEqual(plans[0].departure.style,plans[1].departure.style)
            XCTAssertNotEqual(plans[0].departure.start,plans[1].departure.start)
            XCTAssertNotEqual(plans[0].departure.tempo,plans[1].departure.tempo)
            let captured=draws
            let samples=(0...470).map{frame->[Double] in
                let t=Double(frame)/100,a=main.sample(seconds:t),b=plans[0].sample(seconds:t),c=plans[1].sample(seconds:t)
                return [a.point.x,a.point.y,a.rotation,b.point.x,b.point.y,b.rotation,c.point.x,c.point.y,c.rotation]
            }
            for frame in (0...470).reversed() {
                let t=Double(frame)/100,a=main.sample(seconds:t),b=plans[0].sample(seconds:t),c=plans[1].sample(seconds:t)
                XCTAssertEqual([a.point.x,a.point.y,a.rotation,b.point.x,b.point.y,b.rotation,c.point.x,c.point.y,c.rotation],samples[frame],"Rewind/resume cannot reroll a departure")
            }
            XCTAssertEqual(draws,captured,"No RNG during painting")
            signatures.insert("\(main.departure.start)-\(main.departure.duration)-\(plans[0].departure.phase)-\(plans[1].departure.start)")
            let origin=NativeBeeFinaleMotion.Point(x:195,y:500)
            let own=main.departure.point(origin:origin,targetX:-350,elapsed:main.departure.floatDuration+main.departure.duration*0.5)
            let other=plans[0].departure.point(origin:origin,targetX:-350,elapsed:plans[0].departure.floatDuration+plans[0].departure.duration*0.5)
            XCTAssertGreaterThan(hypot(own.x-other.x,own.y-other.y),2,"Same-side hero and companion must have distinct curve shapes")
        }
        XCTAssertEqual(signatures.count,8,"Fresh presentations capture fresh intervals/speeds/curves")
    }
    func testAllKitesPopToFortyPercentOvershootThenSettleAndCaptureFacingOnce() {
        for seed in [0.1,4.0] {
            let main=NativeKiteFinaleMotion(route:.init(width:390,height:844,origin:.init(x:195,y:500),seed:seed))
            let facing=main.sample(seconds:0).facing
            XCTAssertEqual(facing,seed < .pi ? 1:-1)
            XCTAssertEqual(main.sample(seconds:0.225).scale,1.4,accuracy:0.000001)
            XCTAssertLessThan(main.sample(seconds:0.38).scale,1)
            XCTAssertGreaterThan(main.sample(seconds:0.51).scale,1)
            XCTAssertEqual(main.sample(seconds:0.81).scale,1,accuracy:0.000001)
            for t in [0.0,0.2,1,2.4,3.4] {XCTAssertEqual(main.sample(seconds:t).facing,facing)}
            XCTAssertEqual(main.sample(seconds:NativeKiteFinaleMotion.flightDuration).point.x<0,facing<0)
            for index in 0..<2 {
                let plan=NativeKiteBackgroundPlan(main:main,width:390,height:844,flagCount:4,index:index)
                XCTAssertEqual(plan.sample(seconds:plan.delay+0.275).scale,1.4,accuracy:0.000001)
                XCTAssertEqual(plan.sample(seconds:plan.delay+0.86).scale,1,accuracy:0.000001)
            }
            XCTAssertGreaterThan(main.stretch(seconds:0.225).x,1.15)
            XCTAssertLessThan(main.stretch(seconds:0.38).x,0.95)
        }
    }
    func testCompanionsKeepUpperAndLowerSlotsWithoutPaintRandomness() {
        let main=NativeKiteFinaleMotion(route:.init(width:390,height:844,origin:.init(x:195,y:300),seed:0.5))
        var draws=0
        let plans=NativeKiteBackgroundPlan.makePair(main:main,width:390,height:844,flagCount:3,random:{draws+=1;return 0.5})
        let captured=draws
        for frame in 108...126 {
            let t=Double(frame)/60
            let a=plans[0].sample(seconds:t),b=plans[1].sample(seconds:t)
            XCTAssertLessThan(a.point.y,b.point.y)
            XCTAssertLessThanOrEqual(b.point.y,844)
            XCTAssertLessThanOrEqual(abs(a.point.x-195),345.00001)
            XCTAssertLessThanOrEqual(abs(b.point.x-195),300.00001)
            for plan in plans {
                let prior=plan.sample(seconds:t-0.001),now=plan.sample(seconds:t)
                XCTAssertLessThan(abs(now.point.y-prior.point.y),2)
            }
        }
        XCTAssertEqual(draws,captured)
        XCTAssertLessThan(plans[0].point(seconds:1.8).y,plans[1].point(seconds:1.8).y)
        XCTAssertLessThan(plans[0].point(seconds:2.1).y,plans[1].point(seconds:2.1).y)
    }
    func testFacingOwnsDirectionCentreEntryContinuousDepartureAndOneSecondStretch() {
        for draw in [0.1,0.9] {
            let main=NativeKiteFinaleMotion(route:.init(width:390,height:844,origin:.init(x:195,y:500),seed:draw*2 * .pi),random:{draw})
            let plans=NativeKiteBackgroundPlan.makePair(main:main,width:390,height:844,flagCount:4,random:{draw})
            for plan in plans {XCTAssertEqual(plan.facing,-plan.direction,"Original Kite2 points left; rightward travel must mirror it")}
            let upper=plans[0],birth=upper.sample(seconds:upper.delay)
            XCTAssertEqual(birth.point.x,upper.side>0 ? -upper.size*0.55:390+upper.size*0.55,accuracy:0.000001);XCTAssertEqual(birth.point.y,422,accuracy:0.000001)
            let entering=upper.sample(seconds:upper.delay+0.15)
            XCTAssertGreaterThan((entering.point.x-birth.point.x)*upper.side,0)
            let samplers:[(Double,(Double)->NativeBeeFinaleMotion.Pose,NativeKiteDeparturePlan,Double)]=[(main.departure.start,{main.sample(seconds:$0)},main.departure,Double(main.facing))]+plans.map{plan in (plan.departure.start,{plan.sample(seconds:$0)},plan.departure,plan.side)}
            for (start,sample,departure,direction) in samplers {
                let h=0.00001,a=sample(start-h),b=sample(start),c=sample(start+h)
                XCTAssertEqual((b.point.x-a.point.x)/h,(c.point.x-b.point.x)/h,accuracy:2,"No new launch/reset in exit velocity")
                XCTAssertEqual((b.point.y-a.point.y)/h,(c.point.y-b.point.y)/h,accuracy:2)
                for frame in 0...100 {
                    let pose=sample(start+Double(frame)/100)
                    XCTAssertGreaterThan(pose.rotation*direction,0,"Bank and mirror face the same side")
                    let stretch=departure.stretch(elapsed:Double(frame)/100)
                    XCTAssertEqual(stretch.x*stretch.y,1,accuracy:0.000001)
                }
                XCTAssertEqual(departure.stretch(elapsed:0).x,1)
                XCTAssertNotEqual(departure.stretch(elapsed:0.5).x,1)
                XCTAssertEqual(departure.stretch(elapsed:1).x,1)
                XCTAssertEqual(departure.stretch(elapsed:1.2).x,1)
                XCTAssertEqual(sample(NativeKiteFinaleMotion.flightDuration).point.x<0,direction<0)
            }
        }
    }
    func testFlagsKeepOriginalFallAndWindPlansReachRequestedBounds() {
        let main=NativeKiteFinaleMotion(route:.init(width:390,height:844,origin:.init(x:195,y:400),seed:0.1))
        let plans=(0..<2).map{NativeKiteBackgroundPlan(main:main,width:390,height:844,flagCount:4,index:$0)}
        for (pose,size,stretch) in [(main.sample(seconds:1.5),390.0,main.stretch(seconds:1.5))]+plans.map{($0.sample(seconds:1.5),$0.size,$0.stretch(seconds:1.5))} {
            let origin=NativeKiteFinaleMotion.flagOrigin(pose:pose,size:size,stretch:stretch)
            XCTAssertGreaterThan(origin.y-pose.point.y,size*0.28)
            let base=NativeBeeLeafMotion(birth:1.5,lifetime:1.5,birthX:0,birthY:0,velocityX:100,velocityY:-100,gravity:320,flutter:2,spin:90,scale:1,peakOpacity:1)
            let motion=NativeKiteFlagMotion.make(from:base,origin:origin,viewportHeight:844)
            XCTAssertEqual(motion.birthX,origin.x);XCTAssertEqual(motion.birthY,origin.y)
            XCTAssertEqual(motion.velocityX,base.velocityX);XCTAssertEqual(motion.velocityY,base.velocityY)
            XCTAssertEqual(motion.gravity,NativeBeeLeafMotion.gravity(viewportHeight:844,birthY:origin.y,velocityY:base.velocityY,lifetime:1.5),accuracy:0.000001)
            let age=0.3,p=motion.sample(seconds:1.5+age)
            XCTAssertEqual(p.y,origin.y+base.velocityY*age+motion.gravity*age*age*0.5+cos(age*10.5+base.flutter)*(14+19*age/1.5),accuracy:0.000001,"Original flutter/fall recipe restored")
        }
        for draw in [0.0,0.5,1.0] {
            let wind=NativeKiteWindPlan(random:{draw})
            XCTAssertLessThanOrEqual(wind.horizontal,300);XCTAssertLessThanOrEqual(wind.vertical,200)
            var xs:[Double]=[],ys:[Double]=[]
            for frame in 0...470 {
                let p=wind.offset(seconds:Double(frame)/100)
                XCTAssertLessThanOrEqual(abs(p.x),300.000001);XCTAssertLessThanOrEqual(abs(p.y),200.000001)
                xs.append(p.x);ys.append(p.y)
            }
            XCTAssertGreaterThan(xs.max()!-xs.min()!,40);XCTAssertGreaterThan(ys.max()!-ys.min()!,30)
        }
    }
    func testMountedCompanionsActuallyBankSqueezeAndEmitFourMixedSmallerFlags() async throws {
        let artwork=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        for path in NativeKiteArt.assets {let _=await withCheckedContinuation{continuation in artwork.prepareImage(path,densityAware:true){continuation.resume(returning:$0)}}}
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844)),host=UIViewController()
        window.rootViewController=host;window.makeKeyAndVisible()
        let flight=NativeBeeFinalePresentation(resourceRoot:NativeTestResources.root,viewport:window.bounds.size,origin:.init(x:195,y:400),preparedArtwork:artwork,kite:true,random:{0.5})
        host.view.addSubview(flight);defer{flight.dispose();window.isHidden=true}
        let main=NativeKiteFinaleMotion(route:.init(width:390,height:844,origin:.init(x:195,y:400),seed:.pi),random:{0.5})
        let field=try XCTUnwrap(flight.subviews.first),companions=field.subviews.filter{$0.accessibilityIdentifier?.hasPrefix("native-kite-background-")==true}
        let pairedPlans=NativeKiteBackgroundPlan.makePair(main:main,width:390,height:844,flagCount:8,random:{0.5})
        flight.paint(seconds:1.7)
        let determinants=companions.map{$0.transform.a*$0.transform.d-$0.transform.b*$0.transform.c}
        XCTAssertLessThan(determinants[0]*determinants[1],0,"One whole SVG carrier is mirrored, including its patch; the other is original")
        for index in 0..<2 {
            let plan=pairedPlans[index],view=companions[index]
            flight.paint(seconds:plan.departure.start-0.01)
            let before=abs(atan2(Double(view.transform.b)*Double(plan.facing),Double(view.transform.a)*Double(plan.facing)))
            flight.paint(seconds:plan.departure.start+0.5)
            let after=atan2(Double(view.transform.b)*Double(plan.facing),Double(view.transform.a)*Double(plan.facing))
            XCTAssertGreaterThan(after*plan.side,before+5 * .pi/180,"Real Kite2 carrier must visibly bank toward its exit")
            let ratio=hypot(view.transform.a,view.transform.b)/hypot(view.transform.c,view.transform.d)
            XCTAssertGreaterThan(abs(ratio-1),0.15,"Real Kite2 carrier must visibly squeeze/stretch")
        }
        let flags=field.subviews.filter{$0.accessibilityIdentifier?.hasPrefix("native-kite-companion-flag-")==true}
        let images=(1...4).compactMap{artwork.image("assets/shop/kite/zastavica\($0).png",densityAware:true)?.cgImage}
        for group in 0..<2 {
            let used=Set(flags[(group*8)..<(group*8+8)].compactMap{flag -> Int? in
                guard let image=(flag.subviews.first as? UIImageView)?.image?.cgImage else{return nil}
                return images.firstIndex{$0 === image}
            })
            XCTAssertEqual(used,Set(0..<4),"Both companions emit their own randomized1–4 mix")
        }
        host.view.backgroundColor=NativeAppPaperSurface.base
        for time in [0.75,1.5,2.5,3.3,3.7,4.2] {
            flight.paint(seconds:time)
            let image=UIGraphicsImageRenderer(size:window.bounds.size).image{_ in host.view.drawHierarchy(in:host.view.bounds,afterScreenUpdates:true)}
            try image.pngData()?.write(to:URL(fileURLWithPath:"/tmp/native-kite-wide-\(Int(time*100)).png"))
        }
        let reference=NativeBeeLeafPlan.make(route:.init(width:390,height:844,origin:.init(x:195,y:400),seed:.pi))
        for index in 0..<42 {XCTAssertEqual(field.subviews[index].bounds.width,reference[index].width*0.6,accuracy:0.001);XCTAssertEqual(field.subviews[index].bounds.height,reference[index].height*0.6,accuracy:0.001)}
    }
    func testBoardUsesGreenPNGAndGreenSVGAtlasDecodesSeparately() async throws {
        let root=Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")
        let textures=NativeBoardTextures(root:root)
        let frames=await withCheckedContinuation{continuation in textures.prepare(.kite){continuation.resume(returning:$0)}}
        XCTAssertEqual(frames.count,40)
        let definition=NativeDiceArtwork.definition(kind:"wild",variant:"kite")
        XCTAssertEqual(definition.path,"assets/shop/kite/kite-green.png")
        XCTAssertNil(definition.idleSheet,"Board and modal use supplied PNG,SVG is selected finale only")
        XCTAssertEqual(NativeSpecialDiceRegistry.variants["kite"]?.texture,"assets/shop/kite/kite-green@2x.png")
        textures.dispose()
    }
    func testAudioUsesThreePopsWithoutHissOrBeeVoices() {
        let cues=NativeAuthoredAudioCatalog.groups["kite"] ?? []
        XCTAssertEqual(cues.count,10)
        XCTAssertTrue(cues.contains{$0.source.hasSuffix("brushing.wav")})
        XCTAssertTrue(cues.contains{$0.source.hasSuffix("kite meerge.wav") && $0.gain==0.6 && $0.delay==0 && $0.stopAfter==nil})
        XCTAssertFalse(cues.contains{$0.source.hasSuffix("hiss.wav")})
        for name in ["prvi pop.wav","baloon pop.wav","mini explozije/mini2.mp3"] {XCTAssertTrue(cues.contains{$0.source.hasSuffix(name) && $0.delay==0 && $0.stopAfter==nil})}
        XCTAssertFalse(cues.contains{$0.source.hasSuffix("BEE.wav") || $0.source.hasSuffix("bee start.wav") || $0.source.hasSuffix("happy bee.wav")})
        XCTAssertEqual(NativeStarDropCountPolicy.effectiveCount(variant:"kite",savedCount:3),1)
        XCTAssertEqual(NativeKiteArt.playbackRate,2)
        XCTAssertEqual(NativeKiteArt.greenPlaybackRate,1.3)
        XCTAssertEqual(NativeKiteArt.frame(seconds:0.35),7)
        XCTAssertEqual(NativeKiteArt.frame(seconds:NativeKiteArt.cycle-0.001),39)
        XCTAssertEqual(NativeKiteArt.frame(seconds:NativeKiteArt.cycle),0)
        XCTAssertEqual(NativeKiteArt.frame(seconds:0),0)
        XCTAssertEqual(NativeKiteArt.frame(seconds:NativeKiteArt.cycle*2-0.001),39)
        XCTAssertEqual(NativeKiteArt.frame(seconds:NativeKiteArt.cycle*2),0)
    }
}
