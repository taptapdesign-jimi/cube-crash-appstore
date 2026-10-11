import XCTest
@testable import Stack_to_Six

@MainActor final class NativeSourceBoardTransitionStateTests:XCTestCase {
    func testGenuineCallerWritesAndCapturedHandoffClearsOnlyItsOwnFlag()throws {
        let owner=NativeSourceBoardTransitionState()
        XCTAssertEqual(owner.snapshot,false)
        XCTAssertNil(owner.begin(current:{false}));XCTAssertEqual(owner.snapshot,false)
        let a=try XCTUnwrap(owner.begin(current:{true}))
        XCTAssertEqual(owner.snapshot,true);XCTAssertNil(owner.begin(current:{true}))
        XCTAssertTrue(a.release());XCTAssertEqual(owner.snapshot,false)
        let b=try XCTUnwrap(owner.begin(current:{true}))
        XCTAssertFalse(a.release());XCTAssertEqual(owner.snapshot,true)
        XCTAssertTrue(b.release());XCTAssertEqual(owner.snapshot,false)
        owner.dispose();XCTAssertNil(owner.snapshot);XCTAssertNil(owner.begin(current:{true}))
    }
    func testReentrantNewCallerCannotBeOverwrittenByOlderAdmission()throws {
        let owner=NativeSourceBoardTransitionState()
        var replacement:NativeSourceBoardTransitionState.Claim?
        XCTAssertNil(owner.begin(current:{replacement=owner.begin(current:{true});return true}))
        XCTAssertEqual(owner.snapshot,true)
        XCTAssertTrue(try XCTUnwrap(replacement).release());XCTAssertEqual(owner.snapshot,false)
        owner.dispose()
    }
    func testDroppedAndDisposedClaimNeverRevivesClosedAppFlag()throws {
        let owner=NativeSourceBoardTransitionState()
        var claim=try XCTUnwrap(owner.begin(current:{true})) as NativeSourceBoardTransitionState.Claim?
        XCTAssertEqual(owner.snapshot,true);claim=nil;XCTAssertNil(claim);XCTAssertEqual(owner.snapshot,false)
        let last=try XCTUnwrap(owner.begin(current:{true}))
        owner.dispose();XCTAssertFalse(last.release());XCTAssertNil(owner.snapshot)
    }
}
