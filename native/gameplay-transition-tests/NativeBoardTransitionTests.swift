import XCTest
@testable import Stack_to_Six

final class NativeBoardTransitionTests:XCTestCase {
    func testDigitsMatch180OriginalSourceGSAPPoses() {
        for fixture in NativeBoardTransitionOracle.digits {
            let pose=fixture[0]==1 ? NativeBoardTransitionPlan.digitExit(fixture[3],index:Int(fixture[1]),rotation:fixture[2]):NativeBoardTransitionPlan.digitEnter(fixture[3],rotation:fixture[2])
            for (actual,expected) in zip([pose.scale,pose.alpha,pose.rotation,pose.rotationX,pose.rotationY,pose.z],fixture.dropFirst(4)) {
                XCTAssertEqual(actual,expected,accuracy:0.00001,"Source sample \(fixture.prefix(4))")
            }
        }
    }
    func testDependencySchedulePreservesSourceOrderAndRejectsInvalidOwnership() throws {
        let plan=try NativeBoardTransitionPlan.exitSchedule(keys:["fence-left","fence-right","pine1","mountain"],base:0.35,stagger:0.045,duration:0.28,dependencies:["fence-left":"pine1"],offsets:["fence-right":0.2])
        XCTAssertEqual(plan.map(\.key),["fence-left","fence-right","pine1","mountain"])
        for (actual,expected) in zip(plan.map(\.start),[0.72,0.595,0.44,0.485]) {XCTAssertEqual(actual,expected,accuracy:0.000000001)}
        XCTAssertThrowsError(try NativeBoardTransitionPlan.exitSchedule(keys:["a","a"],base:0,stagger:0,duration:1))
        XCTAssertThrowsError(try NativeBoardTransitionPlan.exitSchedule(keys:["a"],base:0,stagger:0,duration:1,dependencies:["a":"missing"]))
        XCTAssertThrowsError(try NativeBoardTransitionPlan.exitSchedule(keys:["a","b"],base:0,stagger:0,duration:1,dependencies:["a":"b","b":"a"]))
    }
    func testStageLabelsStayLocalWhileBoardAndThemeIdentitiesStayGlobal() {
        for board in 1...30 {
            XCTAssertEqual(NativeBoardTransitionPlan.localStage(board),String(format:"%02d",(board-1)%10+1))
            XCTAssertEqual(NativeBoardTransitionPlan.Theme(board:board).rawValue,board<=10 ? "forest":board<=20 ? "beach":"area55")
        }
        XCTAssertEqual(NativeBoardTransitionPlan.digitEnterStart(theme:.area55,index:0),1.3)
        XCTAssertEqual(NativeBoardTransitionPlan.enterHaptic(theme:.forest,index:0),0.4)
        XCTAssertEqual(NativeBoardTransitionPlan.enterHaptic(theme:.forest,index:1),0.85)
    }
}
