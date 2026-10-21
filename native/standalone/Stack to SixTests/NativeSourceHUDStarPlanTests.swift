import Foundation
import XCTest
@testable import Stack_to_Six
nonisolated final class NativeSourceHUDStarPlanTests:XCTestCase {
    struct Child:Decodable {let ordinal:Int,x,y,scale,rotation,alpha:Double}
    struct Sample:Decodable {let wall:Double,localTimes:[Double],children:[Child],jobs:Int,destroyed:Bool}
    struct Descriptor:Decodable {let delay,duration:Double}
    struct Row:Decodable {let seed:Int?,count:Int?,draws:Int,plans:[Descriptor]?,samples:[Sample]?}
    func testFinalMergeCoinCompressesEveryClockThreefoldWithoutChangingTrajectory() {
        for gentle in [false,true] {
            var previous=0.0,end=0.0,interval:Double?
            for ordinal in 0..<7 {
                let source=NativeSourceHUDStarPlan.construct(ordinal:ordinal,sizes:[56,42,30],origin:.init(x:195,y:600),target:.init(x:195,y:76),textureWidth:64,previousArrival:&previous,random:{0.5})
                let normal=source.readableCoin(ordinal:ordinal,previousEnd:&end,gentleLaunch:gentle,launchInterval:interval)
                if interval==nil {interval=normal.originalMotionDuration*0.20}
                let fast=normal.finalMergeCoin()
                XCTAssertEqual(fast.delay*3,normal.delay,accuracy:1e-10)
                XCTAssertEqual(fast.duration*3,normal.duration,accuracy:1e-10)
                XCTAssertEqual(fast.accelerationStart*3,normal.accelerationStart,accuracy:1e-10)
                XCTAssertEqual(fast.originalMotionDuration*3,normal.originalMotionDuration,accuracy:1e-10)
                XCTAssertEqual(fast.points,normal.points);XCTAssertEqual(fast.size,normal.size)
                for fraction in [0.0,0.2,0.5,0.8,0.95,1.0] {
                    let a=normal.sample(localSeconds:normal.duration*fraction,previousScale:normal.size/64)
                    let b=fast.sample(localSeconds:fast.duration*fraction,previousScale:fast.size/64)
                    XCTAssertEqual(a.point.x,b.point.x,accuracy:0.003);XCTAssertEqual(a.point.y,b.point.y,accuracy:0.003)
                    XCTAssertEqual(a.rotation,b.rotation,accuracy:0.00001)
                    XCTAssertEqual(a.arrived,b.arrived)
                }
            }
        }
    }
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
        XCTAssertEqual(normal.points.first,laser.points.first)
        XCTAssertEqual(normal.points.last,laser.points.last)
        XCTAssertLessThan(distance(laser.sample(localSeconds:0.10,previousScale:1).point),distance(normal.sample(localSeconds:0.10,previousScale:1).point))
        XCTAssertTrue(laser.sample(localSeconds:laser.duration,previousScale:1).arrived)
        XCTAssertEqual(laser.sample(localSeconds:laser.duration,previousScale:1).point,laser.points.last!)
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
    func testFinalTwentyPercentClockAcceleratesSmoothlyToFortyPercent() {
        for gentle in [false,true] {
            var arrival=0.0,end=0.0
            let source=NativeSourceHUDStarPlan.construct(ordinal:0,sizes:[56,42,30],origin:.init(x:195,y:600),target:.init(x:195,y:76),textureWidth:28,previousArrival:&arrival,random:{0.5})
            let coin=source.readableCoin(ordinal:0,previousEnd:&end,gentleLaunch:gentle)
            let start=coin.accelerationStart,tail=coin.duration-start
            XCTAssertEqual(pow(start/coin.originalMotionDuration,coin.launchPower),0.8,accuracy:1e-10)
            XCTAssertEqual(coin.motionSeconds(start),start,accuracy:1e-10)
            XCTAssertEqual(coin.motionSeconds(start/2),start/2,accuracy:1e-10)
            XCTAssertLessThan(coin.duration,coin.originalMotionDuration)
            XCTAssertEqual(coin.motionSeconds(coin.duration),coin.originalMotionDuration,accuracy:1e-10)
            let epsilon=0.00001
            for fraction in [0.0,0.25,0.5,0.75,0.99] {
                let time=start+tail*fraction
                let speed=(coin.motionSeconds(time+epsilon)-coin.motionSeconds(time))/epsilon
                XCTAssertEqual(speed,1+0.40*fraction*fraction,accuracy:0.0001)
            }
            XCTAssertEqual(end,coin.end,accuracy:1e-10)
        }
    }
    func testCoinsLaunchInCompactIrregularPairsAndNeverBrakeBeforeTrophy() {
        for gentle in [false,true] {
            var previous=0.0,end=0.0,interval:Double?,lastDelay:Double?
            var left=false,right=false
            var launchGaps:[Double]=[]
            for ordinal in 0..<7 {
                let original=NativeSourceHUDStarPlan.construct(ordinal:ordinal,sizes:[56,42,30],origin:.init(x:195,y:600),target:.init(x:195,y:76),textureWidth:28,previousArrival:&previous,random:{0.5})
                let coin=original.readableCoin(ordinal:ordinal,previousEnd:&end,viewport:CGSize(width:390,height:844),gentleLaunch:gentle,launchInterval:interval)
                if interval==nil {interval=coin.originalMotionDuration*0.20}
                if let lastDelay {launchGaps.append(coin.delay-lastDelay);XCTAssertLessThan(coin.delay,Double(ordinal)*interval!)}
                lastDelay=coin.delay
                XCTAssertEqual(coin.points.first,original.points.first);XCTAssertEqual(coin.points.last,original.points.last)
                XCTAssertEqual(coin.size,original.size*1.2,accuracy:1e-10)
                let midpoint=coin.points[32]
                left = left || midpoint.x<120;right = right || midpoint.x>270
                // Equal time steps through the former burst/pause boundary:
                // every step rises, and upward speed keeps increasing.
                var lastY=coin.points[0].y,lastRise=0.0
                let flight=coin.duration
                for frame in 1...80 {
                    let pose=coin.sample(localSeconds:flight*Double(frame)/100,previousScale:coin.size/28)
                    let rise=lastY-pose.point.y
                    XCTAssertGreaterThan(rise,0)
                    XCTAssertGreaterThanOrEqual(rise+0.002,lastRise)
                    lastY=pose.point.y;lastRise=rise
                }
                let step=coin.duration*0.005
                let near=coin.sample(localSeconds:coin.duration-step,previousScale:1).point
                let earlier=coin.sample(localSeconds:coin.duration-step*2,previousScale:1).point
                let endpoint=coin.sample(localSeconds:coin.duration,previousScale:1).point
                XCTAssertGreaterThanOrEqual(hypot(endpoint.x-near.x,endpoint.y-near.y),hypot(near.x-earlier.x,near.y-earlier.y)*0.97,"No final-frame braking")
                XCTAssertFalse(coin.sample(localSeconds:coin.duration-0.05,previousScale:1).arrived)
                let arrived=coin.sample(localSeconds:coin.duration,previousScale:1)
                XCTAssertTrue(arrived.arrived)
                XCTAssertEqual(arrived.point.x,coin.points.last!.x,accuracy:1e-9)
                XCTAssertEqual(arrived.point.y,coin.points.last!.y,accuracy:1e-9)
            }
            XCTAssertTrue(left && right)
            XCTAssertGreaterThan((launchGaps.max() ?? 0)-(launchGaps.min() ?? 0),0.01)
        }
    }
}
