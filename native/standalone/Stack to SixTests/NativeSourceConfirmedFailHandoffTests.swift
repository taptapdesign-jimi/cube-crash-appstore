import XCTest
@testable import Stack_to_Six
nonisolated final class NativeSourceConfirmedFailHandoffTests:XCTestCase {
    @MainActor func testLiteralArcade40AndJourney60WaitThenCleanupThenExit() async {
        for arcade in [false,true] {
            var delivery:(()->Void)?,events:[String]=[],delay=0
            let owner=NativeSourceConfirmedFailHandoff {_,ms,elapsed,_ in delay=ms;delivery=elapsed;return {}}
            XCTAssertTrue(owner.begin(generation:1,planToken:3,isArcade:arcade,current:{true},cleanup:{events.append("cleanup");return true},completion:{events.append($0 ? "exit":"rejected")}))
            XCTAssertEqual(delay,arcade ? 40:60);XCTAssertEqual(events,[])
            delivery?();delivery?();XCTAssertEqual(events,["cleanup","exit"])
        }
    }
    @MainActor func testRetirementDuringWaitRejectsOnceAndLateReplyNeverCleans() async {
        var delivery:(()->Void)?,cancelled:(()->Void)?,events:[String]=[]
        let owner=NativeSourceConfirmedFailHandoff {_,_,elapsed,cancel in delivery=elapsed;cancelled=cancel;return {cancel()}}
        XCTAssertTrue(owner.begin(generation:1,planToken:3,isArcade:false,current:{true},cleanup:{events.append("cleanup");return true},completion:{events.append($0 ? "exit":"rejected")}))
        owner.retire();delivery?();cancelled?();owner.retire();XCTAssertEqual(events,["rejected"])
    }
    @MainActor func testCurrentPredicateReentryCannotReviveRetiredCapture() async {
        var events:[String]=[]
        let owner=NativeSourceConfirmedFailHandoff {_,_,_,_ in XCTFail("no wait");return {}}
        XCTAssertFalse(owner.begin(generation:1,planToken:3,isArcade:false,current:{owner.retire();return true},cleanup:{events.append("cleanup");return true},completion:{events.append($0 ? "exit":"rejected")}))
        XCTAssertEqual(events,["rejected"])
    }
    @MainActor func testCleanupReentryCannotExitAndCannotAcceptLateWait() async {
        var delivery:(()->Void)?,events:[String]=[]
        let owner=NativeSourceConfirmedFailHandoff {_,_,elapsed,_ in delivery=elapsed;return {}}
        XCTAssertTrue(owner.begin(generation:1,planToken:3,isArcade:false,current:{true},cleanup:{events.append("cleanup");owner.retire();return true},completion:{events.append($0 ? "exit":"rejected")}))
        delivery?();delivery?();XCTAssertEqual(events,["cleanup","rejected"])
    }
    @MainActor func testUnavailableGenuineCleanupRefusesBoardExit() async {
        var delivery:(()->Void)?,events:[Bool]=[]
        let owner=NativeSourceConfirmedFailHandoff {_,_,elapsed,_ in delivery=elapsed;return {}}
        XCTAssertTrue(owner.begin(generation:1,planToken:3,isArcade:false,current:{true},cleanup:{false},completion:{events.append($0)}))
        delivery?();XCTAssertEqual(events,[false])
    }
    @MainActor func testActualWallDeliveryMayContinueWhileAnimationClockPaused() async {
        var delivery:(()->Void)?,paused=true,events:[String]=[]
        let owner=NativeSourceConfirmedFailHandoff {_,_,elapsed,_ in delivery=elapsed;return {}}
        _=owner.begin(generation:1,planToken:3,isArcade:true,current:{true},cleanup:{XCTAssertTrue(paused);events.append("cleanup");return true},completion:{events.append($0 ? "exit":"rejected")})
        delivery?();paused=false;XCTAssertEqual(events,["cleanup","exit"])
    }
}
