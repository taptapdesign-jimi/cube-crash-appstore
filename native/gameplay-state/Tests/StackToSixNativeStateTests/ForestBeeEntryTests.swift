import XCTest
@testable import StackToSixNativeState

final class ForestBeeEntryTests:XCTestCase {
    private func planner(behind:Bool?=nil,choice:Double=0.5)->NativeForestBeePlanning {
        NativeForestBeePlanning(contentTop:138,mainX:0,mainY:154,mainWidth:390,mainHeight:350,startsBehindGate:behind,random:{choice})
    }
    func testGateEntryStartsBehindWoodAndEveryBeeReturnsToExistingRoam() throws {
        let owner=planner(behind:true)
        let plans=owner.next()
        XCTAssertEqual(plans.map{$0["id"] as! Int},NativeForestBeePlanning.retainedIDs)
        for plan in plans {
            let frames=try XCTUnwrap(plan["frames"] as? [[String:Any]])
            let first=try XCTUnwrap(frames.first)
            XCTAssertEqual(first["depth"] as? String,"behind")
            let center=(first["x"] as! Double)+(first["width"] as! Double)*(first["scaleX"] as! Double)/2
            XCTAssertGreaterThan(center,150);XCTAssertLessThan(center,215)
            XCTAssertTrue(frames.contains{$0["depth"] as? String == "front"})
            XCTAssertEqual(frames.last?["depth"] as? String,"front")
        }
        // Plan renewal stays finite and preserves the retained identity set.
        XCTAssertEqual(owner.next().map{$0["id"] as! Int},NativeForestBeePlanning.retainedIDs)
    }
    func testOneHalfProbabilityBoundaryChoosesPerVisit() throws {
        for (choice,expected) in [(0.499999,"behind"),(0.5,"front")] {
            let plans=planner(choice:choice).next()
            for plan in plans {
                let first=try XCTUnwrap((plan["frames"] as? [[String:Any]])?.first)
                XCTAssertEqual(first["depth"] as? String,expected)
            }
        }
    }
    func testExplicitRoamKeepsOriginalStartup() throws {
        let plans=planner(behind:false,choice:0).next()
        for plan in plans {
            let first=try XCTUnwrap((plan["frames"] as? [[String:Any]])?.first)
            XCTAssertEqual(first["depth"] as? String,"front")
        }
    }
}
