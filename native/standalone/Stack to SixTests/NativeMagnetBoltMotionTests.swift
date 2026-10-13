import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeMagnetBoltMotionTests:XCTestCase {
    private struct Oracle:Decodable {let cases:[Case]}
    private struct Case:Decodable {
        let name:String,width:Double,height:Double,seed:UInt32?,draws:Int,plans:[Plan],samples:[Sample]
    }
    private struct Plan:Decodable {
        let assetIndex:Int,birth:[Double],size:Double,delay:Double,repeatDelay:Double,cycleDuration:Double,initialRotation:Double
    }
    private struct Sample:Decodable {let seconds:Double,poses:[Pose]}
    private struct Pose:Decodable {let point:[Double],scale:Double,alpha:Double,rotation:Double}
    func testAllOriginalBoltTracksMatchExecutedImmutableGSAPIncludingRepeatWrap()throws {
        let oracle=try JSONDecoder().decode(Oracle.self,from:Data(NativeMagnetBoltSourceOracle.json.utf8))
        for entry in oracle.cases {
            var state=entry.seed,draws=0
            let plans=NativeMagnetBoltMotion.make(viewport:CGSize(width:entry.width,height:entry.height),random:{
                draws += 1
                guard let value=state else{return 0.5}
                let next=value &* 1664525 &+ 1013904223;state=next
                return Double(next)/4294967296
            })
            XCTAssertEqual(plans.count,16,entry.name)
            XCTAssertEqual(draws,entry.draws,entry.name+" original random draw order")
            for (index,plan) in plans.enumerated() {
                let original=entry.plans[index],label=entry.name+" bolt\(index)"
                XCTAssertEqual(plan.assetIndex,original.assetIndex,label)
                XCTAssertEqual(plan.birth.x,original.birth[0],accuracy:0.000001,label)
                XCTAssertEqual(plan.birth.y,original.birth[1],accuracy:0.000001,label)
                XCTAssertEqual(plan.size,original.size,accuracy:0.000001,label)
                XCTAssertEqual(plan.delay,original.delay,accuracy:0.000001,label)
                XCTAssertEqual(plan.repeatDelay,original.repeatDelay,accuracy:0.000001,label)
                XCTAssertEqual(plan.cycleDuration,original.cycleDuration,accuracy:0.000001,label)
                for sample in entry.samples {
                    let actual=plan.sample(seconds:sample.seconds),expected=sample.poses[index]
                    let frame=label+" t\(sample.seconds)"
                    // CSSPlugin stores transforms to four or six decimal places.
                    XCTAssertEqual(actual.point.x,expected.point[0],accuracy:0.00011,frame)
                    XCTAssertEqual(actual.point.y,expected.point[1],accuracy:0.00011,frame)
                    XCTAssertEqual(actual.scale,expected.scale,accuracy:0.00011,frame)
                    XCTAssertEqual(actual.alpha,expected.alpha,accuracy:0.00011,frame)
                    XCTAssertEqual(actual.rotation,expected.rotation,accuracy:0.00011,frame)
                }
            }
        }
    }
}
