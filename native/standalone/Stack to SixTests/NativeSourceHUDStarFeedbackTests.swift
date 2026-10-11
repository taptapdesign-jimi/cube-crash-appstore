import XCTest
@testable import Stack_to_Six
@MainActor final class NativeSourceHUDStarFeedbackTests:XCTestCase {
    func testMultipleActualArrivalsCoalesceOneFutureFrameAndReadLatestScore() {
        var score=0,frames:[()->Void]=[],paints:[Int]=[]
        let owner=NativeSourceHUDStarFeedback(current:{true},schedule:{frames.append($0);return{}},paint:{paints.append(score)})
        for _ in 0..<3 {score += 100;XCTAssertTrue(owner.scoreChanged())}
        XCTAssertEqual(frames.count,1);XCTAssertTrue(paints.isEmpty);frames[0]()
        XCTAssertEqual(paints,[300]);XCTAssertFalse(owner.framePending)
        score += 100;XCTAssertTrue(owner.scoreChanged());XCTAssertEqual(frames.count,2);frames[1]();XCTAssertEqual(paints,[300,400])
    }
    func testCallbackClearsPendingBeforeAuthoredFeedbackAndReentrantArrivalQueuesFutureFrame() {
        var frames:[()->Void]=[],paints=0;var owner:NativeSourceHUDStarFeedback!
        owner=NativeSourceHUDStarFeedback(current:{true},schedule:{frames.append($0);return{}},paint:{paints += 1;if paints==1{XCTAssertTrue(owner.scoreChanged())}})
        XCTAssertTrue(owner.scoreChanged());frames[0]();XCTAssertEqual(frames.count,2);XCTAssertEqual(paints,1)
        frames[1]();XCTAssertEqual(paints,2);XCTAssertFalse(owner.framePending)
    }
    func testCapturedDisposeAndReentrantCurrentPredicateNeverPaintObsoleteFrame() {
        var frame:(()->Void)?,paints=0,cancels=0;var disposeOnQuery=false;var owner:NativeSourceHUDStarFeedback!
        owner=NativeSourceHUDStarFeedback(current:{if disposeOnQuery{owner.dispose()};return true},schedule:{frame=$0;return{cancels += 1}},paint:{paints += 1})
        XCTAssertTrue(owner.scoreChanged());disposeOnQuery=true;frame?();frame?()
        XCTAssertEqual(paints,0);XCTAssertEqual(cancels,1);XCTAssertFalse(owner.framePending)
    }
}
