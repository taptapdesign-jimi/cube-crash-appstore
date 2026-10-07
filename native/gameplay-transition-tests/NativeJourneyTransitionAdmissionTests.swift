import XCTest
@testable import Stack_to_Six

final class NativeJourneyTransitionAdmissionTests:XCTestCase {
    func testExecutedOriginalWorldOwnersAlwaysAdmitTransitionForResumeAndCompletedReplay() {
        XCTAssertEqual(NativeJourneyAdmissionOracle.worldRows.count,12)
        for row in NativeJourneyAdmissionOracle.worldRows {
            XCTAssertTrue(row.showTransition,"\(row.owner) saved=\(row.saved) completed=\(row.completed)")
            XCTAssertEqual(row.starts,1)
            XCTAssertEqual(NativeJourneyTransitionAdmission.requiresTransition(entry:.worldCard,tutorial:false),row.showTransition)
        }
    }
    func testOriginalCleanReplayAndRetryOwnersRestartDirectlyWhileNextBoardUsesTransition() {
        for row in NativeJourneyAdmissionOracle.actionRows {
            guard let entry=NativeJourneyTransitionAdmission.Entry(rawValue:row.entry) else{return XCTFail("Unknown original owner \(row.entry)")}
            XCTAssertEqual(NativeJourneyTransitionAdmission.requiresTransition(entry:entry,tutorial:false),row.showTransition)
        }
    }
    func testFirstPlayTutorialNeverAdmitsJourneyTransitionFromAnyAction() {
        for entry in NativeJourneyTransitionAdmission.Entry.allCases {
            XCTAssertFalse(NativeJourneyTransitionAdmission.requiresTransition(entry:entry,tutorial:true))
        }
    }
}
