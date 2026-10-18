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
    func testReadableCoinsKeepCapturedGeometryAndIncreaseDurationSizeAndSpacing() {
        var previous=0.0,previousCoinEnd=0.0
        for ordinal in 0..<3 {
            let original=NativeSourceHUDStarPlan.construct(ordinal:ordinal,sizes:[56,42,30],origin:.init(x:195,y:430),target:.init(x:37,y:76),textureWidth:28,previousArrival:&previous,random:{0.5})
            let priorEnd=previousCoinEnd
            let coin=original.readableCoin(ordinal:ordinal,previousEnd:&previousCoinEnd)
            XCTAssertEqual(coin.points,original.points);XCTAssertEqual(coin.rotation,original.rotation)
            XCTAssertEqual(coin.size,original.size*1.2,accuracy:1e-10)
            XCTAssertGreaterThanOrEqual(coin.duration,original.duration*1.25)
            XCTAssertEqual(coin.delay-original.delay,Double(ordinal)*0.12,accuracy:1e-10)
            if ordinal>0 {XCTAssertGreaterThanOrEqual(coin.end-priorEnd,0.24-1e-10)}
        }
    }

}
