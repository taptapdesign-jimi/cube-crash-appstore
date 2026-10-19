import Foundation
import XCTest
@testable import Stack_to_Six
nonisolated final class NativeSourceHUDStarPlanTests:XCTestCase {
    struct Child:Decodable {let ordinal:Int,x,y,scale,rotation,alpha:Double}
    struct Sample:Decodable {let wall:Double,localTimes:[Double],children:[Child],jobs:Int,destroyed:Bool}
    struct Descriptor:Decodable {let delay,duration:Double}
    struct Row:Decodable {let seed:Int?,count:Int?,draws:Int,plans:[Descriptor]?,samples:[Sample]?}
    func testExecutedJSCOriginalFullGSAPPlansAndEveryDeliveredChildPose()throws {
        let url=try XCTUnwrap(Bundle(for:NativeSourceHUDStarPlanTests.self).url(forResource:"NativeSourceHUDStarSourceOracle",withExtension:"json"))
        let rows=try JSONDecoder().decode([Row].self,from:Data(contentsOf:url));var comparisons=0
        for row in rows where row.seed != nil {
            var rng=UInt32(row.seed!),draws=0
            func random()->Double {rng=rng &* 1664525 &+ 1013904223;draws += 1;return Double(rng)/4294967296}
            let sizes=NativeSourceHUDStarPlan.sizeOrder(random:random)
            var previous=0.0
            let plans=(0..<min(3,row.count!)).map{NativeSourceHUDStarPlan.construct(ordinal:$0,sizes:sizes,origin:.init(x:195,y:430),target:.init(x:37,y:76),textureWidth:64,previousArrival:&previous,random:random)}
            XCTAssertEqual(draws,row.draws)
            for (i,p) in plans.enumerated() {XCTAssertEqual(p.delay,row.plans![i].delay,accuracy:1e-12);XCTAssertEqual(p.duration,row.plans![i].duration,accuracy:1e-12)}
            var scales=plans.map{$0.size/64},alive=Array(repeating:true,count:plans.count)
            for frame in row.samples! {
                for (i,p) in plans.enumerated() where alive[i] {
                    let local=frame.localTimes[i]
                    var point=p.points[0],rotation=0.0
                    if local>0 {
                        let pose=p.sample(localSeconds:local,previousScale:scales[i]);point=pose.point;scales[i]=pose.scale;rotation=pose.rotation
                        if pose.arrived {alive[i]=false;continue}
                    }
                    if let source=frame.children.first(where:{$0.ordinal==i}) {
                        XCTAssertEqual(point.x,source.x,accuracy:0.000001);XCTAssertEqual(point.y,source.y,accuracy:0.000001)
                        XCTAssertEqual(scales[i],source.scale,accuracy:0.000001);XCTAssertEqual(rotation,source.rotation,accuracy:0.000001);comparisons += 4
                    } else {XCTFail("native visible but Source removed seed \(row.seed!) ordinal \(i) wall \(frame.wall)")}
                }
                XCTAssertEqual(alive.enumerated().filter{$0.element}.map(\.offset),frame.children.map(\.ordinal))
            }
        }
        XCTAssertGreaterThan(comparisons,10000)
    }
    func testLaserCoinsStartSlowerAndStillFinishAtSameTrophy() {
        var previous=0.0,normalEnd=0.0,laserEnd=0.0
        let source=NativeSourceHUDStarPlan.construct(ordinal:0,sizes:[56,42,30],origin:CGPoint(x:195,y:500),target:CGPoint(x:195,y:60),textureWidth:28,previousArrival:&previous,random:{0.5})
        let normal=source.readableCoin(ordinal:0,previousEnd:&normalEnd)
        let laser=source.readableCoin(ordinal:0,previousEnd:&laserEnd,gentleLaunch:true)
        let origin=laser.points[0]
        func distance(_ p:CGPoint)->Double {hypot(p.x-origin.x,p.y-origin.y)}
        XCTAssertEqual(normal.points,laser.points)
        XCTAssertLessThan(distance(laser.sample(localSeconds:0.10,previousScale:1).point),distance(normal.sample(localSeconds:0.10,previousScale:1).point))
        XCTAssertTrue(laser.sample(localSeconds:laser.duration,previousScale:1).arrived)
        XCTAssertEqual(laser.sample(localSeconds:laser.duration,previousScale:1).point,laser.points.last!)
    }
    func testCoinsApproachTrophyFromAboveBelowAndBothSides() {
        var previous=0.0,end=0.0,left=false,right=false,above=false,below=false
        let target=CGPoint(x:195,y:90)
        for ordinal in 0..<7 {
            let source=NativeSourceHUDStarPlan.construct(ordinal:ordinal,sizes:[56,42,30],origin:CGPoint(x:195,y:600),target:target,textureWidth:28,previousArrival:&previous,random:{0.5})
            let coin=source.readableCoin(ordinal:ordinal,previousEnd:&end,viewport:CGSize(width:390,height:844))
            let near=coin.points[62]
            left = left || near.x<target.x-1;right = right || near.x>target.x+1
            above = above || near.y<target.y-1;below = below || near.y>target.y+1
            XCTAssertEqual(coin.points.last,target)
            XCTAssertFalse(coin.sample(localSeconds:coin.duration-0.05,previousScale:1).arrived)
        }
        XCTAssertTrue(left && right && above && below)
    }
    func testMagneticCoinsRemainInsideViewportFromEdgeOrigins() {
        for viewport in [CGSize(width:320,height:568),CGSize(width:390,height:844)] {
            for origin in [CGPoint(x:8,y:300),CGPoint(x:viewport.width-8,y:300),CGPoint(x:100,y:viewport.height-8)] {
                var previous=0.0,end=0.0
                for ordinal in 0..<7 {
                    let source=NativeSourceHUDStarPlan.construct(ordinal:ordinal,sizes:[56,42,30],origin:origin,target:CGPoint(x:viewport.width/2,y:60),textureWidth:28,previousArrival:&previous,random:{0.5})
                    let coin=source.readableCoin(ordinal:ordinal,previousEnd:&end,viewport:viewport)
                    var scale=coin.size/28
                    for frame in 0...240 {
                        let pose=coin.sample(localSeconds:coin.duration*Double(frame)/240,previousScale:scale);scale=pose.scale
                        let radius=28*scale*0.71
                        XCTAssertGreaterThanOrEqual(pose.point.x-radius,-1)
                        XCTAssertLessThanOrEqual(pose.point.x+radius,viewport.width+1)
                        XCTAssertGreaterThanOrEqual(pose.point.y-radius,-1)
                        XCTAssertLessThanOrEqual(pose.point.y+radius,viewport.height+1)
                    }
                    XCTAssertEqual(coin.points.last,CGPoint(x:viewport.width/2,y:60))
                }
            }
        }
    }
    func testReadableCoinsBurstInDiverseDirectionsAndRetainArrivalOwnership() {
        var previous=0.0,previousCoinEnd=0.0
        var left=false,right=false,down=false
        var earlyDistances:[Double]=[]
        for ordinal in 0..<7 {
            let original=NativeSourceHUDStarPlan.construct(ordinal:ordinal,sizes:[56,42,30],origin:.init(x:195,y:430),target:.init(x:37,y:76),textureWidth:28,previousArrival:&previous,random:{0.5})
            let priorEnd=previousCoinEnd
            let variation=abs(sin(original.rotation*17.13+original.size*0.731+Double(ordinal)*2.399))
            let coin=original.readableCoin(ordinal:ordinal,previousEnd:&previousCoinEnd)
            XCTAssertEqual(coin.points.first,original.points.first);XCTAssertEqual(coin.points.last,original.points.last);XCTAssertEqual(coin.rotation,original.rotation)
            XCTAssertEqual(coin.size,original.size*1.2,accuracy:1e-10)
            XCTAssertEqual(coin.duration,max(original.duration*1.25*1.30/(0.60*1.20*2*0.90)*(0.82+abs(sin(original.rotation*17.13+original.size*0.731+Double(ordinal)*2.399))*0.36)+0.28,priorEnd+0.32+variation*0.12-coin.delay),accuracy:1e-10)
            XCTAssertEqual(coin.delay,variation*0.025,accuracy:1e-10)
            XCTAssertGreaterThan(coin.burstProgress,0)
            let early=coin.sample(localSeconds:coin.duration*0.08,previousScale:1).point
            let dx=early.x-coin.points[0].x,dy=early.y-coin.points[0].y
            left = left || dx < -5;right = right || dx > 5;down = down || dy > 5
            earlyDistances.append(hypot(dx,dy))
            XCTAssertGreaterThan(hypot(dx,dy),5)
            XCTAssertFalse(coin.sample(localSeconds:coin.duration-0.12,previousScale:1).arrived)
            let before=coin.sample(localSeconds:coin.duration-0.10,previousScale:1).point
            let near=coin.sample(localSeconds:coin.duration-0.05,previousScale:1).point
            let end=coin.sample(localSeconds:coin.duration,previousScale:1)
            XCTAssertLessThan(hypot(end.point.x-near.x,end.point.y-near.y),hypot(near.x-before.x,near.y-before.y))
            XCTAssertTrue(end.arrived)
            XCTAssertEqual(end.point.x,coin.points.last!.x,accuracy:0.001)
            XCTAssertEqual(end.point.y,coin.points.last!.y,accuracy:0.001)
            if ordinal>0 {XCTAssertGreaterThanOrEqual(coin.end-priorEnd,0.32-1e-10)}
        }
        XCTAssertTrue(left || right)
        _=down
        XCTAssertGreaterThan((earlyDistances.max() ?? 0)-(earlyDistances.min() ?? 0),10)
    }

}
