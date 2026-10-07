import XCTest
@testable import Stack_to_Six

final class NativeArtworkPhaseTests:XCTestCase {
    func testCapturedPhasePolicyMatchesOriginalCrowdedFamilyStarts() throws {
        var owner=NativeArtworkPhaseScheduler()
        let expected:[Double]=[0,170,340,510,680,850,1000,85,255,425,595,765]
        for time in expected {
            let id=owner.reserve(group:"star",cycleMilliseconds:2000,now:0),entry=try XCTUnwrap(owner.entry(id))
            XCTAssertEqual(entry.plannedStart,time);XCTAssertEqual(entry.slot,id-1)
        }
        let other=owner.reserve(group:"flower",cycleMilliseconds:1600,now:0)
        XCTAssertEqual(owner.entry(other)?.slot,0);XCTAssertEqual(owner.entry(other)?.plannedStart,0)
        owner.release(3)
        let reused=owner.reserve(group:"star",cycleMilliseconds:2000,now:50)
        XCTAssertEqual(owner.entry(reused)?.slot,2,"Retired source phase slot is reusable")
    }
    func testLatePendingStartsReplanWithoutSynchronizingTheFamily() throws {
        var owner=NativeArtworkPhaseScheduler()
        let first=owner.reserve(group:"robo",cycleMilliseconds:2400,now:0),second=owner.reserve(group:"robo",cycleMilliseconds:2400,now:0),third=owner.reserve(group:"robo",cycleMilliseconds:2400,now:0)
        XCTAssertEqual(owner.entry(second)?.plannedStart,200);XCTAssertEqual(owner.entry(third)?.plannedStart,400)
        owner.advancePending(now:1200)
        XCTAssertTrue(try XCTUnwrap(owner.entry(second)).started)
        XCTAssertEqual(owner.entry(second)?.plannedStart,1200)
        XCTAssertFalse(try XCTUnwrap(owner.entry(third)).started)
        XCTAssertEqual(owner.entry(third)?.plannedStart,1400)
        owner.advancePending(now:1400)
        XCTAssertTrue(try XCTUnwrap(owner.entry(third)).started)
        owner.release(first);owner.release(second);owner.release(third)
        XCTAssertEqual(owner.count,0)
        let fresh=owner.reserve(group:"robo",cycleMilliseconds:2400,now:3000)
        XCTAssertEqual(owner.entry(fresh)?.slot,0);XCTAssertEqual(owner.entry(fresh)?.plannedStart,3000)
    }
    func testDisposalRevokesPendingEntriesAndCannotRestartThem() {
        var owner=NativeArtworkPhaseScheduler()
        let first=owner.reserve(group:"barrel",cycleMilliseconds:821.428571,now:0),next=owner.reserve(group:"barrel",cycleMilliseconds:821.428571,now:0)
        XCTAssertTrue(owner.advance(first,now:0));XCTAssertFalse(owner.advance(next,now:50))
        owner.dispose();owner.advancePending(now:10000)
        XCTAssertFalse(owner.advance(next,now:10000));XCTAssertEqual(owner.count,0)
    }
}
