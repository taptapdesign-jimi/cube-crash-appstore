import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeForestTransitionBeeTests: XCTestCase {
    // Original source executed withLCGseed17, digit rectangles already scale0;
    // the mountain remains live until each route captures its late peak.
    func testTransitionUsesCleanBoardHoverAtThirtyPercentFasterWithIndependentRoutes() {
        var seed:UInt32=73
        let owner=NativeForestTransitionBees(viewport:CGSize(width:390,height:844),digitCenters:[CGPoint(x:170,y:240)],images:[:],random:{seed=1664525 &* seed &+ 1013904223;return Double(seed)/4294967296})
        XCTAssertEqual(Set(owner.flights.map(\.phase)).count,6)
        XCTAssertEqual(Set(owner.flights.map{$0.moves[0].start}).count,6)
        XCTAssertTrue(owner.flights.allSatisfy{$0.honeyAccent != nil})
        for original in owner.flights {
            let p=original.anchor
            let plan=NativeResultForestBees.Plan(anchor:p,moves:[.init(start:0,duration:0.1,from:p,to:p,control1:p,control2:p,exits:false)],phase:original.phase,scale:original.scale,travelSpeed:original.travelSpeed,startsBehind:original.startsBehind,distantScale:original.distantScale,lifetime:original.lifetime,hoverRate:1.30,flightRegion:original.flightRegion)
            var clean=plan;clean.hoverRate=1
            for frame in 20...300 {
                let time=Double(frame)/120
                let actual=plan.sample(time).point,expected=clean.sample(time*1.30).point
                XCTAssertEqual(actual.x,expected.x,accuracy:0.000001)
                XCTAssertEqual(actual.y,expected.y,accuracy:0.000001)
            }
        }
        for plan in owner.flights {
            for move in plan.moves {
                let direction=move.to.x>=move.from.x ? 1.0:-1.0
                var last=plan.sample(move.start,includeHover:false).point.x
                for step in 1...100 {
                    let x=plan.sample(move.start+move.duration*Double(step)/100,includeHover:false).point.x
                    XCTAssertGreaterThanOrEqual((x-last)*direction,-0.000001)
                    last=x
                }
            }
        }
        owner.dispose()
    }
    func testTransitionHoneyAccentUsesExactHoneyProfileAndDoesNotReroll() throws {
        var seed:UInt32=91,draws=0
        let owner=NativeForestTransitionBees(viewport:CGSize(width:390,height:844),digitCenters:[CGPoint(x:170,y:240)],images:[:],random:{draws+=1;seed=1664525 &* seed &+ 1013904223;return Double(seed)/4294967296})
        let captured=draws
        XCTAssertEqual(Set(owner.flights.compactMap{$0.honeyAccent?.wobblePhase}).count,6)
        for original in owner.flights {
            let profile=try XCTUnwrap(original.honeyAccent)
            let p=original.anchor
            var plan=NativeResultForestBees.Plan(anchor:p,moves:[.init(start:0,duration:0.1,from:p,to:p,control1:p,control2:p,exits:false)],phase:original.phase,scale:original.scale,travelSpeed:original.travelSpeed,startsBehind:original.startsBehind,distantScale:original.distantScale,hoverRate:1.30,honeyAccent:profile)
            plan.flightRegion=nil
            var clean=plan;clean.honeyAccent=nil
            for frame in 20...300 {
                let time=Double(frame)/120
                let actual=plan.sample(time).point,base=clean.sample(time).point
                let accent=NativeHoneyIdleMotion.flightAccent(profile,seconds:time*1.30)
                XCTAssertEqual(actual.x-base.x,accent.x,accuracy:0.000001)
                XCTAssertEqual(actual.y-base.y,accent.y,accuracy:0.000001)
            }
        }
        XCTAssertEqual(draws,captured);owner.dispose()
    }
    func testFourExactRoutesAndStatefulDepthFacingMatchExecutedOriginalOwner() {
        var rng:UInt32=17,draws=0
        let plans=NativeForestTransitionBeeMotion.make(viewport:CGSize(width:390,height:844),digitCenters:[CGPoint(x:175.5,y:240.76),CGPoint(x:214.5,y:240.76)],initialDigitHeights:[0,0],random:{draws+=1;rng=1664525 &* rng &+ 1013904223;return Double(rng)/4294967296})
        XCTAssertEqual(draws,151);XCTAssertEqual(plans.map(\.role),["left","right","high-scout","low-dancer"])
        XCTAssertTrue(plans.allSatisfy {$0.samples.count==577 && $0.times.count==10 && $0.waves.count==9})
        var runtime=plans.map(NativeForestTransitionBeeMotion.Runtime.init)
        let gold:[(Int,[Double])]=[
(0,[522.6,57.37403924690559,0.0,1.5977082210460436,1.5763275600652267,3.0,0.0,0.0,424.0,734.0390479793213,0.0,2.2319469403599443,2.175799938146952,3.0,0.0,0.0,-111.38373804595321,142.93846680045127,0.0,1.5628575551546218,1.5762645416167116,1.0,0.0,0.0,-147.72409437447786,788.9955296965688,0.0,1.4253568139117478,1.3950798145763808,1.0,0.0,0.0]),
(10,[320.255349727195,105.77458713909479,1.683989353879972,1.5172555892969417,1.5151084402176302,3.0,0.0,0.0,403.47517052284985,554.9185544348785,-8.92236836878682,2.046865871240323,2.092478373651759,5.0,0.0,0.0,-16.77003238171655,155.4547341159249,1.0106763132811765,1.4866488427880074,1.5102423978068287,1.0,0.0,0.0,-82.31294385191157,597.9348638789282,-8.91941213962141,1.3256066087294913,1.336113582719607,2.0,0.0,0.0]),
(45,[171.8941022196517,236.2502398107396,0.47354177660003705,0.8015380372593189,0.7813200347181231,1.0,0.0,0.0,252.33448312120794,234.61650930803705,-1.0911673573185983,0.8363816520914146,0.82201670375516,3.0,0.0,0.0,192.1740854974666,260.97223064798294,9.75971230819191,0.7843867586931754,0.7646209191934284,6.0,0.0,0.0,270.9279859288013,407.92109965273914,1.3606391445874375,0.5541305589687988,0.5419129771011093,1.0,0.0,0.0]),
(90,[332.9537719921741,214.5892650732615,5.637717537942064,0.5898219553433736,0.5900744946410547,7.0,0.0,0.0,65.2298978045338,282.70583464240616,-3.2292545906715837,0.572529942121545,0.5736001315169044,4.0,0.0,0.0,199.2963462230713,252.45583469775974,-10.088703762872758,0.62033820031814,0.6247801387062923,5.0,0.0,0.0,225.8030574200301,206.19409366349043,2.4279075365595095,0.3882212125484001,0.38593078033757344,3.0,0.0,0.0]),
(150,[190.11036313969996,349.69716477923106,4.302989610573625,0.39087900067878867,0.38129182618238594,3.0,0.0,0.0,162.79747493507998,143.97610548588048,-2.6894973630276575,0.5741386711963083,0.5732350072473101,1.0,0.0,0.0,145.0670415117884,298.6829229855974,10.091439251090245,0.4632342281430642,0.46078811425453176,7.0,0.0,0.0,90.6718265866459,305.2026237916211,3.414844856796987,0.3436523047424855,0.3529721254061673,3.0,0.0,0.0]),
(170,[149.86233732127639,501.97585055722135,6.7807486051413,0.38679367113861696,0.38384773598664007,7.0,1.0,0.0,265.45024012692943,164.54435193409677,3.2118086913575468,0.5643776767172356,0.5787635121614922,6.0,0.0,0.0,89.033692152497,295.18104208129967,-5.80527551750502,0.4593680325262822,0.46253354508574,5.0,0.0,0.0,117.18521483609831,356.50054748444853,2.44816826444005,0.2670129582928329,0.26571932905525225,1.0,0.0,0.0]),
(180,[77.79822550001985,473.58441949488883,-1.4165863992417842,0.39000001381325244,0.3815627986236293,3.0,1.0,0.0,309.18107782460925,189.97485632505854,4.613177891737595,0.4698714574747243,0.47143655665788997,6.0,0.0,0.0,80.08421030854906,210.22954098881416,-10.018843281793718,0.4585918627841199,0.46257022919661356,5.0,0.0,0.0,211.3139176556483,380.1225173219051,2.334695198915298,0.2582018100051743,0.25385574986328985,1.0,0.0,0.0]),
(216,[-134.59942769950837,338.80778361191494,-4.839027604830925,0.0,0.0,4.0,0.0,1.0,524.598164320023,360.039211361807,6.34885200733081,0.0,0.0,6.0,0.0,1.0,-164.8996489677296,127.74088625318643,-1.4015947136808031,0.0,0.0,3.0,0.0,1.0,547.3516082989344,391.5639585397944,-0.6001330579334622,0.0,0.0,1.0,0.0,1.0])
]
        let indexed=Dictionary(uniqueKeysWithValues:gold)
        for frame in 0...216 {
            let poses=runtime.indices.map {runtime[$0].sample(seconds:Double(frame)/60,mountainBounds:CGRect(x:0,y:844*0.58,width:390,height:328))}
            guard let expected=indexed[frame] else {continue}
            let actual:[Double]=poses.flatMap {pose -> [Double] in [Double(pose.point.x),Double(pose.point.y),pose.rotation,pose.scaleX,pose.scaleY,Double(pose.asset),pose.behindMountain ? 1:0,pose.hidden ? 1:0]}
            for index in actual.indices {XCTAssertEqual(actual[index],expected[index],accuracy:0.000001,"frame\(frame) scalar\(index)")}
        }
    }
    func testLatePeakCaptureKeepsItsOwnMountainsAndSceneCleanupIsFinite() {
        let plans=NativeForestTransitionBeeMotion.make(viewport:CGSize(width:390,height:844),digitCenters:[CGPoint(x:175.5,y:240.76),CGPoint(x:214.5,y:240.76)],initialDigitHeights:[0,0],random:{0.5})
        var reference=plans.map(NativeForestTransitionBeeMotion.Runtime.init),changed=reference
        for frame in 0...240 {
            let time=Double(frame)/60,mountain=CGRect(x:0,y:489.52,width:390,height:328)
            let later=time>2.8 ? CGRect(x:200,y:20,width:700,height:700):mountain
            for index in plans.indices {
                let a=reference[index].sample(seconds:time,mountainBounds:mountain),b=changed[index].sample(seconds:time,mountainBounds:later)
                XCTAssertEqual(a.point.x,b.point.x,accuracy:0.000001);XCTAssertEqual(a.point.y,b.point.y,accuracy:0.000001)
                XCTAssertEqual(a.asset,b.asset);XCTAssertEqual(a.behindMountain,b.behindMountain)
                if time>=3.55+1.0/60 {XCTAssertTrue(a.hidden);XCTAssertTrue(b.hidden)}
            }
        }
    }
    func testNativeHostsMountAtSourceSiblingDepthAndDisposeEveryOwnedBitmap() {
        let root=Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle"),artwork=JimiV9Artwork(resourceRoot:root)
        let images=Dictionary(uniqueKeysWithValues:(1...7).compactMap {index in artwork.image("assets/shop/honey/bee\(index).png",densityAware:true).map {("bee\(index)",$0)}})
        let owner=NativeForestTransitionBees(viewport:CGSize(width:390,height:844),digitCenters:[CGPoint(x:175.5,y:240.76),CGPoint(x:214.5,y:240.76)],images:images,random:{0.5}),parent=UIView(frame:CGRect(x:0,y:0,width:390,height:844))
        XCTAssertTrue(owner.needsNativeParityReady);XCTAssertEqual(owner.duration,3.55+1.0/60,accuracy:0.000001)
        let original=NativeForestTransitionBeeMotion.make(viewport:CGSize(width:390,height:844),digitCenters:[CGPoint(x:175.5,y:240.76),CGPoint(x:214.5,y:240.76)],initialDigitHeights:[0,0],random:{0.5})
        XCTAssertEqual(owner.flights.count,6)
        XCTAssertEqual(Set(owner.flights.map(\.phase)).count,6)
        XCTAssertTrue(owner.flights.allSatisfy{$0.hoverXRate == 1})
        XCTAssertTrue(owner.flights.allSatisfy{$0.hoverYRate == 1})
        XCTAssertEqual(Set(owner.flights.map { $0.moves[0].start }).count,6)
        XCTAssertEqual(Set(owner.flights.map { $0.moves.last!.start }).count,6)
        XCTAssertEqual(Set(owner.flights.map(\.phase)).count,6)
        for (index,flight) in owner.flights.enumerated() {
            let old=original[index%4]
            XCTAssertEqual(flight.travelSpeed,old.samples.last!.distance/old.end*1.30,accuracy:0.000001)
            XCTAssertEqual(flight.hoverRate,1.30)
            XCTAssertEqual(flight.hoverStrength,1)
            if (1...owner.numberBeeCount).contains(index) {
                XCTAssertNotNil(flight.flightRegion)
                XCTAssertTrue(flight.moves.filter {!$0.enters && !$0.exits}.allSatisfy {$0.duration>=0.28/1.30})
            }
        }
        owner.mountLayers(in:parent);XCTAssertEqual(parent.subviews.map {$0.layer.zPosition},[3,9,11])
        XCTAssertEqual(parent.subviews.flatMap(\.subviews).count,6)
        for frame in 0...220 {owner.paint(seconds:Double(frame)/60,mountainBounds:CGRect(x:0,y:489.52,width:390,height:328))}
        XCTAssertTrue(parent.subviews.flatMap(\.subviews).allSatisfy(\.isHidden))
        owner.dispose();owner.mountLayers(in:parent);owner.paint(seconds:1,mountainBounds:nil)
        XCTAssertTrue(parent.subviews.isEmpty)
    }
    func testTransitionRandomRoutesVaryEveryBeeWithoutChangingEntryExitOrLifetime() {
        for viewport in [CGSize(width:390,height:844),CGSize(width:320,height:568)] {
            func plans(seed:UInt32,randomized:Bool)->[NativeForestTransitionBeeMotion.Plan] {
                var rng=seed
                return NativeForestTransitionBeeMotion.make(viewport:viewport,digitCenters:[CGPoint(x:viewport.width*0.45,y:viewport.height*0.285),CGPoint(x:viewport.width*0.55,y:viewport.height*0.285)],initialDigitHeights:[0,0],randomizeRoutes:randomized,random:{rng=1664525 &* rng &+ 1013904223;return Double(rng)/4294967296})
            }
            let first=plans(seed:17,randomized:true),second=plans(seed:39,randomized:true),original=plans(seed:17,randomized:false)
            XCTAssertEqual(first.count,4)
            for index in first.indices {
                XCTAssertNotEqual(first[index].points,second[index].points)
                XCTAssertNotEqual(first[index].points,original[index].points)
                XCTAssertEqual(first[index].points.first,original[index].points.first)
                XCTAssertEqual(Array(first[index].points.suffix(2)),Array(original[index].points.suffix(2)))
                XCTAssertEqual(first[index].times,original[index].times)
                XCTAssertEqual(first[index].mode,original[index].mode)
                var runtime=NativeForestTransitionBeeMotion.Runtime(first[index])
                for frame in 0...216 {
                    let pose=runtime.sample(seconds:Double(frame)/60,mountainBounds:CGRect(x:0,y:viewport.height*0.58,width:viewport.width,height:328))
                    XCTAssertTrue(pose.point.x.isFinite && pose.point.y.isFinite && pose.scaleX.isFinite && pose.scaleY.isFinite)
                    if frame==216 {XCTAssertTrue(pose.hidden)}
                }
            }
        }
    }
    func testMountedTransitionCapturesFreshRoutesAndDoesNotRerollWhilePainting() {
        let root=Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle"),artwork=JimiV9Artwork(resourceRoot:root)
        let images=Dictionary(uniqueKeysWithValues:(1...7).compactMap {index in artwork.image("assets/shop/honey/bee\(index).png",densityAware:true).map {("bee\(index)",$0)}})
        var rng:UInt32=17,draws=0
        func roll()->Double {draws+=1;rng=1664525 &* rng &+ 1013904223;return Double(rng)/4294967296}
        var poses:[[CGPoint]]=[]
        for iteration in 0..<2 {
            let owner=NativeForestTransitionBees(viewport:CGSize(width:390,height:844),digitCenters:[CGPoint(x:175.5,y:240.76),CGPoint(x:214.5,y:240.76)],images:images,random:roll)
            let parent=UIView(frame:CGRect(x:0,y:0,width:390,height:844))
            owner.mountLayers(in:parent);let captured=draws
            XCTAssertEqual(captured,(iteration+1)*151)
            for frame in 0...60 {owner.paint(seconds:Double(frame)/60,mountainBounds:nil)}
            poses.append(parent.subviews.flatMap(\.subviews).map(\.center))
            XCTAssertEqual(draws,captured)
            owner.dispose();owner.dispose();XCTAssertTrue(parent.subviews.isEmpty)
        }
        XCTAssertNotEqual(poses[0],poses[1])
    }

    func testMountedHoverUsesNNAndMountainDepthAndOpaqueOffscreenExit() {
        let root=Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle"),artwork=JimiV9Artwork(resourceRoot:root)
        let images=Dictionary(uniqueKeysWithValues:(1...7).compactMap {index in artwork.image("assets/shop/honey/bee\(index).png",densityAware:true).map {("bee\(index)",$0)}})
        var rng:UInt32=17
        let owner=NativeForestTransitionBees(viewport:CGSize(width:390,height:844),digitCenters:[CGPoint(x:175.5,y:240.76),CGPoint(x:214.5,y:240.76)],images:images,
            random:{rng=1664525 &* rng &+ 1013904223;return Double(rng)/4294967296})
        let parent=UIView(frame:CGRect(x:0,y:0,width:390,height:844));owner.mountLayers(in:parent)
        XCTAssertTrue(parent.subviews.flatMap(\.subviews).allSatisfy(\.isHidden))
        var usedDepths=Set<CGFloat>(),positions:[String:Set<CGFloat>]=[:],beeDepths:[String:Set<CGFloat>]=[:]
        for frame in 0...212 {
            owner.paint(seconds:Double(frame)/60,mountainBounds:CGRect(x:0,y:489.52,width:390,height:328))
            for layer in parent.subviews {for bee in layer.subviews where !bee.isHidden {
                usedDepths.insert(layer.layer.zPosition)
                beeDepths[bee.accessibilityIdentifier!,default:[]].insert(layer.layer.zPosition)
                positions[bee.accessibilityIdentifier!,default:[]].insert(bee.center.y)
                XCTAssertEqual(bee.alpha,1)
                XCTAssertTrue(bee.center.x.isFinite && bee.center.y.isFinite)
                let index=Int(bee.accessibilityIdentifier!.split(separator:".").last!)!
                let flight=owner.flights[index],entry=flight.moves[0],exit=flight.moves.last!
                let time=Double(frame)/60
                if time>=entry.start+entry.duration && time<=exit.start {
                    XCTAssertTrue(parent.bounds.contains(bee.frame),"Full rendered bee must stay inside viewport: \(bee.frame)")
                }
            }}
        }
        XCTAssertEqual(usedDepths,Set([CGFloat(3),CGFloat(9),CGFloat(11)]))
        XCTAssertEqual(positions.count,6)
        for index in 1...owner.numberBeeCount {XCTAssertEqual(beeDepths["native.transition.forest.bee.\(index)"],Set([CGFloat(9),CGFloat(11)]))}
        XCTAssertTrue(positions.values.allSatisfy {$0.count>80})
        owner.paint(seconds:owner.duration-0.001,mountainBounds:nil)
        XCTAssertTrue(parent.subviews.flatMap(\.subviews).allSatisfy {$0.center.x < -100 || $0.center.x > 490})
        owner.paint(seconds:owner.duration,mountainBounds:nil)
        XCTAssertTrue(parent.subviews.flatMap(\.subviews).allSatisfy(\.isHidden))
        owner.dispose();XCTAssertTrue(parent.subviews.isEmpty)
    }

    func testNarrowViewportContainsCompleteRenderedSpritesWhileDwelling() {
        let root=Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle"),artwork=JimiV9Artwork(resourceRoot:root)
        let images=Dictionary(uniqueKeysWithValues:(1...7).compactMap {index in artwork.image("assets/shop/honey/bee\(index).png",densityAware:true).map {("bee\(index)",$0)}})
        XCTAssertEqual(images.count,7)
        for seed in 1...8 {
            var rng=UInt32(seed)
            let parent=UIView(frame:CGRect(x:0,y:0,width:320,height:568))
            let owner=NativeForestTransitionBees(viewport:parent.bounds.size,digitCenters:[CGPoint(x:160,y:162)],images:images,random:{rng=1664525 &* rng &+ 1013904223;return Double(rng)/4294967296})
            owner.mountLayers(in:parent)
            for frame in 0...430 {
                let time=Double(frame)/120
                owner.paint(seconds:time,mountainBounds:nil)
                for bee in parent.subviews.flatMap(\.subviews) where !bee.isHidden {
                    let index=Int(bee.accessibilityIdentifier!.split(separator:".").last!)!
                    let plan=owner.flights[index],entry=plan.moves[0],exit=plan.moves.last!
                    if time>=entry.start+entry.duration && time<=exit.start {
                        XCTAssertTrue(parent.bounds.contains(bee.frame),"seed\(seed) full bee frame\(bee.frame)")
                    }
                }
            }
            owner.dispose()
            XCTAssertTrue(parent.subviews.isEmpty)
        }
    }

    func testMountedFreeFlightsContainSpritesWithoutFixedColumnsOrMirroring() {
        let artwork=JimiV9Artwork(resourceRoot:Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle"))
        let images=Dictionary(uniqueKeysWithValues:(1...7).compactMap {index in artwork.image("assets/shop/honey/bee\(index).png",densityAware:true).map {("bee\(index)",$0)}})
        for viewport in [CGSize(width:320,height:568),CGSize(width:390,height:844)] {
            var leftCounts=Set<Int>(),crossed=false
            for seed in 1...48 {
                var rng=UInt32(seed)
                let owner=NativeForestTransitionBees(viewport:viewport,digitCenters:[CGPoint(x:viewport.width/2,y:viewport.height*0.285)],images:images,random:{rng=1664525 &* rng &+ 1013904223;return Double(rng)/4294967296})
                leftCounts.insert(owner.flights.filter {$0.anchor.x<viewport.width/2}.count)
                for (index,plan) in owner.flights.enumerated() {
                    for other in owner.flights.dropFirst(index+1) {
                        if (plan.sample(1.4).point.x-other.sample(1.4).point.x)*(plan.sample(2.1).point.x-other.sample(2.1).point.x)<0 {crossed=true}
                    }
                }
                let parent=UIView(frame:CGRect(origin:.zero,size:viewport));owner.mountLayers(in:parent)
                XCTAssertEqual(Set(owner.flights.map { "\($0.anchor.x),\($0.anchor.y)" }).count,6)
                for frame in 0...430 {
                    let time=Double(frame)/120
                    owner.paint(seconds:time,mountainBounds:nil)
                    let bees=parent.subviews.flatMap(\.subviews).filter {!$0.isHidden}
                    let dwelling=bees.filter {bee in
                        let index=Int(bee.accessibilityIdentifier!.split(separator:".").last!)!
                        let plan=owner.flights[index]
                        return time>=plan.moves[0].start+plan.moves[0].duration && time<=plan.moves.last!.start
                    }
                    for bee in dwelling {XCTAssertTrue(parent.bounds.contains(bee.frame))}
                    // Free overlap/crossing is permitted. Each bee has its own
                    // full-width region, never an assigned left/right station.
                    for plan in owner.flights {
                        XCTAssertLessThan(plan.flightRegion!.minX,viewport.width*0.30)
                        XCTAssertGreaterThan(plan.flightRegion!.maxX,viewport.width*0.70)
                    }
                }
                for plan in owner.flights {
                    for move in plan.moves {
                        for boundary in [move.start,move.start+move.duration] {
                            let before=plan.sample(boundary-0.000001).point,after=plan.sample(boundary+0.000001).point
                            XCTAssertLessThan(hypot(after.x-before.x,after.y-before.y),0.05)
                        }
                    }
                }
                owner.dispose();XCTAssertTrue(parent.subviews.isEmpty)
            }
            XCTAssertGreaterThan(leftCounts.count,3,"No fixed three-left/three-right assignment")
            XCTAssertTrue(crossed,"Independent paths may exchange horizontal ordering")
        }
    }

    func testTransitionKeepsCleanBoardUnmodulatedClock() {
        var seed:UInt32=17
        let owner=NativeForestTransitionBees(viewport:CGSize(width:390,height:844),digitCenters:[CGPoint(x:195,y:240)],images:[:],random:{seed=1664525 &* seed &+ 1013904223;return Double(seed)/4294967296})
        for plan in owner.flights {
            XCTAssertEqual(plan.motionVariation,0)
            for step in 0...100 {
                XCTAssertEqual(plan.flightRateMultiplier(Double(step)/100),1)
                XCTAssertEqual(plan.hoverRateMultiplier(Double(step)/30),1)
            }
        }
        owner.dispose()
    }

    func testSeparateCleanBoardKeepsItsUnmodulatedAuthoredHoverClock() {
        let plans=NativeResultForestBees.plans(viewport:CGSize(width:390,height:844),random:{0.5})
        XCTAssertEqual(plans.count,4)
        for plan in plans {
            XCTAssertNil(plan.flightRegion)
            XCTAssertEqual(plan.motionVariation,0)
            for seconds in [0.0,0.4,1.3,2.7,5.4] {
                XCTAssertEqual(plan.flightRateMultiplier(seconds),1)
                XCTAssertEqual(plan.hoverRateMultiplier(seconds),1)
                let point=CGPoint(x:143,y:321)
                let stationary=NativeResultForestBees.Plan(anchor:point,moves:[.init(start:0,duration:0.1,from:point,to:point,control1:point,control2:point,exits:false)],phase:plan.phase,scale:plan.scale,travelSpeed:plan.travelSpeed,startsBehind:plan.startsBehind,distantScale:plan.distantScale)
                let expected=CGPoint(x:point.x+sin(seconds*2.9+plan.phase)*28+sin(seconds*5.3+plan.phase*0.7)*12,
                    y:point.y+sin(seconds*3.7+plan.phase)*55+sin(seconds*6.1+plan.phase*1.3)*25)
                XCTAssertEqual(stationary.sample(seconds).point.x,expected.x,accuracy:0.000001)
                XCTAssertEqual(stationary.sample(seconds).point.y,expected.y,accuracy:0.000001)
            }
        }
    }

    func testIncompleteAssetLeaseCannotMountAnApproximateForestField() {
        let noDigits=NativeForestTransitionBees(viewport:CGSize(width:390,height:844),digitCenters:[],images:[:],random:{0.5})
        XCTAssertFalse(noDigits.needsNativeParityReady);noDigits.dispose()

        let owner=NativeForestTransitionBees(viewport:CGSize(width:390,height:844),digitCenters:[CGPoint(x:195,y:240)],images:[:],random:{0.5}),parent=UIView()
        XCTAssertFalse(owner.needsNativeParityReady);owner.mountLayers(in:parent);owner.paint(seconds:2,mountainBounds:nil);XCTAssertTrue(parent.subviews.isEmpty);owner.dispose()
    }
}
