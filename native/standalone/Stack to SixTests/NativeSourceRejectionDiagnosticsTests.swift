import XCTest
@testable import Stack_to_Six

@MainActor final class NativeSourceRejectionDiagnosticsTests:XCTestCase {
    private func location()->URL {FileManager.default.temporaryDirectory.appendingPathComponent("source-rejections-"+UUID().uuidString).appendingPathComponent("evidence.json")}
    func testFailureEvidenceSurvivesIndependentReadsAndKeepsOnlyLastEight()throws {
        let url=location();defer{try? FileManager.default.removeItem(at:url.deletingLastPathComponent())}
        for index in 0..<13 {
            XCTAssertTrue(NativeSourceRejectionDiagnostics.record(.init(reason:"source-test-\(index)",generation:UInt64(index),board:3,mode:"journey",phase:"flower-impact",counters:["pendingHUD":index]),to:url))
        }
        let evidence=NativeSourceRejectionDiagnostics.read(from:url)
        XCTAssertEqual(evidence.map(\.generation),Array(5...12).map(UInt64.init))
        XCTAssertEqual(evidence.last?.reason,"source-test-12")
        XCTAssertEqual(evidence.last?.counters,["pendingHUD":12])
        XCTAssertLessThanOrEqual(try Data(contentsOf:url).count,NativeSourceRejectionDiagnostics.maximumBytes)
    }
    func testCorruptAndOversizedEvidenceCannotPreventNextFailureCapture()throws {
        let url=location();defer{try? FileManager.default.removeItem(at:url.deletingLastPathComponent())}
        try FileManager.default.createDirectory(at:url.deletingLastPathComponent(),withIntermediateDirectories:true)
        for data in [Data("invalid json".utf8),Data(repeating:32,count:NativeSourceRejectionDiagnostics.maximumBytes+1)] {
            try data.write(to:url)
            XCTAssertTrue(NativeSourceRejectionDiagnostics.read(from:url).isEmpty)
            XCTAssertTrue(NativeSourceRejectionDiagnostics.record(.init(reason:"latest",generation:7,board:3,mode:"journey",phase:"suspended"),to:url))
            XCTAssertEqual(NativeSourceRejectionDiagnostics.read(from:url).map(\.reason),["latest"])
        }
    }
    func testPayloadIsBoundedAndWriteFailureIsNonthrowing()throws {
        let url=location();defer{try? FileManager.default.removeItem(at:url.deletingLastPathComponent())}
        let counters=Dictionary(uniqueKeysWithValues:(0..<100).map{("counter-\($0)"+String(repeating:"x",count:100),$0)})
        let details=Dictionary(uniqueKeysWithValues:(0..<20).map{("detail-\($0)"+String(repeating:"x",count:100),String(repeating:"x",count:4000))})
        let entry=NativeSourceRejectionDiagnostics.Entry(reason:String(repeating:"🌼",count:1000),generation:8,board:3,mode:String(repeating:"x",count:1000),phase:String(repeating:"x",count:1000),counters:counters,details:details)
        XCTAssertEqual(entry.reason.count,192);XCTAssertEqual(entry.mode.count,32);XCTAssertEqual(entry.phase.count,96)
        XCTAssertEqual(entry.counters.count,12);XCTAssertTrue(entry.counters.keys.allSatisfy{$0.count<=32})
        XCTAssertEqual(entry.details?.count,6);XCTAssertTrue(entry.details?.keys.allSatisfy{$0.count<=32} == true)
        XCTAssertTrue(entry.details?.values.allSatisfy{$0.count==1024} == true)
        XCTAssertTrue(NativeSourceRejectionDiagnostics.record(entry,to:url))
        XCTAssertEqual(NativeSourceRejectionDiagnostics.read(from:url),[entry])
        // A regular file cannot serve as a parent directory.
        XCTAssertFalse(NativeSourceRejectionDiagnostics.record(entry,to:url.appendingPathComponent("blocked.json")))
        XCTAssertEqual(NativeSourceRejectionDiagnostics.read(from:url),[entry])
    }
    func testMaximalUnicodeDetailsKeepNewestEventWithinDiskBudget()throws {
        let url=location();defer{try? FileManager.default.removeItem(at:url.deletingLastPathComponent())}
        let details=Dictionary(uniqueKeysWithValues:(0..<6).map{("context-\($0)",String(repeating:"🌼",count:1024))})
        for generation in 0..<12 {
            XCTAssertTrue(NativeSourceRejectionDiagnostics.record(.init(reason:"source-impact-rejected",generation:UInt64(generation),board:3,mode:"journey",phase:"flower",details:details),to:url))
        }
        let evidence=NativeSourceRejectionDiagnostics.read(from:url)
        XCTAssertEqual(evidence.last?.generation,11)
        XCTAssertGreaterThan(evidence.count,0);XCTAssertLessThanOrEqual(evidence.count,8)
        XCTAssertLessThanOrEqual(try Data(contentsOf:url).count,NativeSourceRejectionDiagnostics.maximumBytes)
        XCTAssertEqual(evidence.last?.details,details)
    }
}
