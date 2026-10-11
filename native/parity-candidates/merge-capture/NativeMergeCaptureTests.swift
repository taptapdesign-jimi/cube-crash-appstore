import XCTest
@testable import Stack_to_Six

@MainActor
final class NativeMergeCaptureTests: XCTestCase {
    func testBoundedRingRetainsChronologicalTailAndReportsLoss() {
        let capture = NativeMergeCaptureRecorder(enabled:true,capacity:3)
        for index in 0..<7 {capture.event("event",value:Double(index))}
        let result=capture.snapshot(reason:"test")
        XCTAssertEqual(result.records.map(\.value),[4,5,6])
        XCTAssertEqual(result.recordsSeen,7);XCTAssertEqual(result.droppedRecords,4)
    }
    func testDisabledCaptureDoesNotRecordOrAllocateRecords() {
        let capture=NativeMergeCaptureRecorder(enabled:false,capacity:3)
        capture.event("ignored");capture.frame(now:1,targetFPS:60)
        XCTAssertEqual(capture.recordedCount,0)
    }
    func testResumeDoesNotCountBackgroundTimeAsFrameHitch() {
        let capture=NativeMergeCaptureRecorder(enabled:true)
        capture.frame(now:1,targetFPS:60);capture.frame(now:1.04,targetFPS:60)
        capture.resume();capture.frame(now:100,targetFPS:60);capture.frame(now:100.02,targetFPS:60)
        let gaps=capture.snapshot(reason:"test").records.filter{$0.kind=="frame-gap"}
        XCTAssertEqual(gaps.count,2);XCTAssertEqual(gaps[0].value,40,accuracy:0.00001)
        XCTAssertEqual(gaps[1].value,20,accuracy:0.00001)
    }
    func testAtomicPhoneLocalFileContainsThisSession() async throws {
        let capture=NativeMergeCaptureRecorder(enabled:true)
        capture.event("persistence-sentinel",value:42)
        let expected=capture.snapshot(reason:"persistence-test")
        capture.flush(reason:"persistence-test")
        let url=FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0]
            .appendingPathComponent("NativeMergeCapture/latest.json")
        let decoder=JSONDecoder();decoder.dateDecodingStrategy = .iso8601
        for _ in 0..<30 {
            if let data=try? Data(contentsOf:url),let saved=try? decoder.decode(NativeMergeCaptureRecorder.Snapshot.self,from:data),saved.session==expected.session {
                XCTAssertEqual(saved.records.first?.kind,"persistence-sentinel")
                XCTAssertEqual(saved.records.first?.value,42)
                return
            }
            try await Task.sleep(nanoseconds:100_000_000)
        }
        XCTFail("Phone-local atomic capture did not persist this session")
    }
}
