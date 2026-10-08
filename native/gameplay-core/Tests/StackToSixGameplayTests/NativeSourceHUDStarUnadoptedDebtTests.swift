import XCTest
@testable import StackToSixGameplay
final class NativeSourceHUDStarUnadoptedDebtTests:XCTestCase {
    func fixture()->NativeGameplayEngine {
        let e=NativeGameplayEngine(state:.init(tiles:[.init(id:"s",cell:.init(column:0,row:0),value:6,archetype:.star),.init(id:"d",cell:.init(column:1,row:0),value:2)]))
        XCTAssertTrue(e.beginDrag(tileID:"s"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted);return e
    }
    func testInstalledSourceOwnershipProtectsEarnedDebtBeforeActualJobAdoption()throws {
        let e=fixture();e.sourceHUDStarJobsEnabled=true
        let state=e.state,earned=e.pendingHUDStars;XCTAssertEqual(earned.count,3);XCTAssertTrue(e.sourceHUDStarJobs.isEmpty)
        e.cancelForBackground();XCTAssertEqual(e.state,state);XCTAssertEqual(e.pendingHUDStars,earned)
        let job=try XCTUnwrap(e.registerSourceHUDStarJob(receiptIDs:earned.map(\.id),generation:1))
        XCTAssertTrue(e.retireSourceHUDStarJob(job:job));XCTAssertTrue(e.pendingHUDStars.isEmpty);XCTAssertEqual(e.state.score,state.score)
    }
    func testRawArrivalCannotAwardUnadoptedSourceDebtButAuthenticJobArrivalCan()throws {
        let e=fixture();e.sourceHUDStarJobsEnabled=true;let earned=e.pendingHUDStars,state=e.state
        XCTAssertFalse(e.commitHUDStarArrival(receiptID:earned[0].id,generation:1).accepted);XCTAssertEqual(e.state,state)
        let job=try XCTUnwrap(e.registerSourceHUDStarJob(receiptIDs:earned.map(\.id),generation:1))
        XCTAssertTrue(e.commitSourceHUDStarArrival(job:job,receiptID:earned[0].id).accepted);XCTAssertEqual(e.state.score,state.score+100)
        XCTAssertTrue(e.retireSourceHUDStarJob(job:job));XCTAssertEqual(e.state.score,state.score+100)
        let raw=fixture(),rawScore=raw.state.score;raw.cancelForBackground();XCTAssertEqual(raw.state.score,rawScore+300);XCTAssertTrue(raw.pendingHUDStars.isEmpty)
    }
}
