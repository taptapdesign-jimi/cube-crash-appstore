import XCTest
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceMandatoryMergeCellOwnerTests:XCTestCase {
    func testActualPhaseWriterCreates2500ExpiryRepairWriterRenews1200AndPhysicalClearReadsNoDate()throws {
        var now=1000.0,reads=0
        let owner=NativeSourceMandatoryMergeCellOwner(date:{reads+=1;return now},current:{true})
        XCTAssertNil(owner.pending);XCTAssertEqual(reads,0)
        XCTAssertTrue(owner.begin(ownerID:"real-primary",generation:1,cell:.init(column:2,row:3)))
        let initial=try XCTUnwrap(owner.pending);XCTAssertEqual(initial.expiresAt,3500);XCTAssertEqual(reads,1)
        now=3501;let renewed=try XCTUnwrap(owner.renewForRepair(initial));XCTAssertEqual(renewed.expiresAt,4701);XCTAssertEqual(reads,2)
        XCTAssertFalse(owner.verifiedActive(initial));XCTAssertTrue(owner.verifiedActive(renewed));XCTAssertEqual(reads,2);XCTAssertNil(owner.pending)
    }
    func testDateReentryRetirementCannotPublishLateMandatoryCell() {
        var owner:NativeSourceMandatoryMergeCellOwner!
        owner=NativeSourceMandatoryMergeCellOwner(date:{owner.retire();return 1000},current:{true})
        XCTAssertFalse(owner.begin(ownerID:"old",generation:1,cell:.init(column:0,row:0)));XCTAssertNil(owner.pending)
    }
    func testActualFalseRepairClearsOnlyMatchingClaimAndRetirementNeverClearsSuccessor()throws {
        var current=true,reads=0
        let owner=NativeSourceMandatoryMergeCellOwner(date:{reads+=1;return 1000},current:{current})
        XCTAssertTrue(owner.begin(ownerID:"repair",generation:2,cell:.init(column:0,row:0)))
        let old=try XCTUnwrap(owner.pending),renewed=try XCTUnwrap(owner.renewForRepair(old))
        XCTAssertFalse(owner.repairFailed(old));current=false
        XCTAssertFalse(owner.repairFailed(renewed));XCTAssertEqual(owner.pending,renewed)
        current=true;XCTAssertTrue(owner.repairFailed(renewed));XCTAssertNil(owner.pending);XCTAssertEqual(reads,2)
    }

}
