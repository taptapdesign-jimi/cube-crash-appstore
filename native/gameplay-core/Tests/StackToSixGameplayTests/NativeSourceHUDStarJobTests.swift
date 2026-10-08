import XCTest
@testable import StackToSixGameplay
final class NativeSourceHUDStarJobTests:XCTestCase {
    func fixture(count:Int=3)->NativeGameplayEngine {
        var star=NativeTile(id:"s",cell:.init(column:0,row:0),value:6,archetype:.star);star.starOrbitCount=count
        let e=NativeGameplayEngine(state:.init(tiles:[star,.init(id:"d",cell:.init(column:1,row:0),value:2)]))
        XCTAssertTrue(e.beginDrag(tileID:"s"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted);return e
    }
    func testDefaultOffCannotRegisterOrChangeExistingRawBackgroundBehavior() {
        let e=fixture(),score=e.state.score;XCTAssertNil(e.registerSourceHUDStarJob(receiptIDs:e.pendingHUDStars.map(\.id),generation:1))
        e.cancelForBackground();XCTAssertEqual(e.state.score,score+300);XCTAssertTrue(e.pendingHUDStars.isEmpty)
    }
    func testOriginalCap3NoFourthDebtAndSingleActualArrivalDoesNotEndJob()throws {
        let e=fixture(count:99);e.sourceHUDStarJobsEnabled=true;XCTAssertEqual(e.pendingHUDStars.count,3)
        let ids=e.pendingHUDStars.map(\.id),job=try XCTUnwrap(e.registerSourceHUDStarJob(receiptIDs:ids,generation:1)),before=e.state.score
        XCTAssertFalse(e.commitHUDStarArrival(receiptID:ids[0],generation:1).accepted)
        XCTAssertTrue(e.commitSourceHUDStarArrival(job:job,receiptID:ids[0]).accepted);XCTAssertEqual(e.state.score,before+100)
        XCTAssertFalse(e.commitSourceHUDStarArrival(job:job,receiptID:ids[0]).accepted);XCTAssertEqual(e.sourceHUDStarJobs,[job])
        XCTAssertTrue(e.retireSourceHUDStarJob(job:job));XCTAssertEqual(e.state.score,before+100);XCTAssertTrue(e.pendingHUDStars.isEmpty)
        XCTAssertFalse(e.retireSourceHUDStarJob(job:job));XCTAssertFalse(e.commitSourceHUDStarArrival(job:job,receiptID:ids[1]).accepted)
    }
    func testSourceProtectedBackgroundRetainsDebtWithoutScoreUntilGenuineWallRetirement()throws {
        let e=fixture();e.sourceHUDStarJobsEnabled=true;let pending=e.pendingHUDStars,state=e.state
        let job=try XCTUnwrap(e.registerSourceHUDStarJob(receiptIDs:pending.map(\.id),generation:1))
        e.cancelForBackground();XCTAssertEqual(e.pendingHUDStars,pending);XCTAssertEqual(e.state.score,state.score)
        XCTAssertTrue(e.retireSourceHUDStarJob(job:job));XCTAssertTrue(e.pendingHUDStars.isEmpty);XCTAssertEqual(e.state.score,state.score)
    }
    func testMalformedPartialDuplicateOutOfOrderAndStaleCapturedBatchesRefused()throws {
        let e=fixture();e.sourceHUDStarJobsEnabled=true;let ids=e.pendingHUDStars.map(\.id)
        XCTAssertNil(e.registerSourceHUDStarJob(receiptIDs:[ids[0]],generation:1))
        XCTAssertNil(e.registerSourceHUDStarJob(receiptIDs:[ids[0],ids[0],ids[2]],generation:1))
        XCTAssertNil(e.registerSourceHUDStarJob(receiptIDs:ids.reversed(),generation:1))
        XCTAssertNil(e.registerSourceHUDStarJob(receiptIDs:ids,generation:99))
        let job=try XCTUnwrap(e.registerSourceHUDStarJob(receiptIDs:ids,generation:1));XCTAssertNil(e.registerSourceHUDStarJob(receiptIDs:ids,generation:1))
        e.restart(state:.init(tiles:[]));let state=e.state
        XCTAssertFalse(e.retireSourceHUDStarJob(job:job));XCTAssertFalse(e.commitSourceHUDStarArrival(job:job,receiptID:ids[0]).accepted);XCTAssertEqual(e.state,state)
    }
    func testSeparateOriginalTntCallsCannotFlattenIntoOneFlightCap()throws {
        let e=NativeGameplayEngine(state:.init(tiles:[.init(id:"t",cell:.init(column:0,row:0),value:6,archetype:.tnt),.init(id:"d",cell:.init(column:1,row:0),value:1),.init(id:"a",cell:.init(column:2,row:0),value:2),.init(id:"b",cell:.init(column:3,row:0),value:4),.init(id:"c",cell:.init(column:4,row:0),value:5)]),recordedRandomChoices:Array(repeating:0,count:200))
        XCTAssertTrue(e.beginDrag(tileID:"t"));_=e.drop(target:.init(column:1,row:0));let plan=try XCTUnwrap(e.pendingSpecial)
        for target in plan.targets {XCTAssertTrue(e.commitSpecialImpact(transactionID:plan.id,tileID:target.id).accepted)}
        e.sourceHUDStarJobsEnabled=true;XCTAssertEqual(e.pendingHUDStars.count,3)
        XCTAssertNil(e.registerSourceHUDStarJob(receiptIDs:e.pendingHUDStars.map(\.id),generation:1))
        for receipt in e.pendingHUDStars {XCTAssertNotNil(e.registerSourceHUDStarJob(receiptIDs:[receipt.id],generation:1))}
        XCTAssertEqual(e.sourceHUDStarJobs.count,3)
    }
}
