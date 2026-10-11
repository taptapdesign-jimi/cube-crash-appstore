import XCTest
import UIKit

@MainActor final class NativeDiagnosticsCaptureTests:XCTestCase {
    @MainActor private final class Fixture {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-diagnostics-test-\(UUID().uuidString)")
        let center=NotificationCenter(),timeouts=NativeSourceAppTimeoutOwner()
        var owner:NativeDiagnosticsCapture?
        func make(limit:Int=720,interval:Int=5000,snapshot:@escaping()->[String:Any]={ ["thermalState":"nominal","lowPowerMode":false] },output:@escaping(String)->Void={_ in})->NativeDiagnosticsCapture {
            let value=NativeDiagnosticsCapture(directory:directory,center:center,timeouts:timeouts,sampleLimit:limit,intervalMilliseconds:interval,snapshot:snapshot,output:output)
            owner=value;return value
        }
        func rows()throws->[[String:Any]] {
            let data=try Data(contentsOf:XCTUnwrap(owner?.fileURL))
            return try data.split(separator:10).map{try XCTUnwrap(JSONSerialization.jsonObject(with:Data($0)) as? [String:Any])}
        }
        func dispose(){owner?.dispose();owner=nil;try? FileManager.default.removeItem(at:directory)}
    }
    func testAdmissionRequiresExactNativeIdentityAndExplicitArgument() {
        for flag in ["--cc-performance-diagnostics","--cc-native-thermal-telemetry"] {
            XCTAssertTrue(NativeDiagnosticsCapture.admitted(arguments:[flag],bundleIdentifier:"com.taptapdesign.stacktosix.native"))
            for other in [nil,"com.taptapdesign.stacktosix.Stack-to-Six","com.kockice.crash"] {
                XCTAssertFalse(NativeDiagnosticsCapture.admitted(arguments:[flag],bundleIdentifier:other))
            }
        }
        XCTAssertFalse(NativeDiagnosticsCapture.admitted(arguments:[],bundleIdentifier:"com.taptapdesign.stacktosix.native"))
    }
    func testActualLifecycleWritesSentinelAndRetiresBackgroundTimeoutWithoutDuplicateResume()throws {
        let f=Fixture(),owner=f.make();defer{f.dispose()}
        owner.start(foreground:true);owner.start(foreground:true)
        XCTAssertEqual(owner.sampleCount,1);XCTAssertEqual(owner.pendingCount,1);XCTAssertEqual(f.timeouts.pendingCount,1);XCTAssertEqual(owner.observerCount,5)
        let first=try f.rows();XCTAssertEqual(first[0]["reason"] as? String,"telemetry-start");XCTAssertEqual(first[0]["webRuntime"] as? String,"absent")
        f.center.post(name:UIApplication.willResignActiveNotification,object:nil)
        XCTAssertEqual(f.timeouts.pendingCount,0)
        f.center.post(name:UIApplication.didEnterBackgroundNotification,object:nil)
        XCTAssertEqual(f.timeouts.pendingCount,0)
        f.center.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        f.center.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertEqual(f.timeouts.pendingCount,1)
        f.center.post(name:UIApplication.didReceiveMemoryWarningNotification,object:nil)
        f.center.post(name:ProcessInfo.thermalStateDidChangeNotification,object:nil)
        let rows=try f.rows();XCTAssertEqual(rows.count,7);XCTAssertEqual(rows.last?["reason"] as? String,"thermal-state-change")
        owner.dispose();owner.dispose();XCTAssertEqual(owner.observerCount,0);XCTAssertEqual(f.timeouts.pendingCount,0)
        let stable=try Data(contentsOf:XCTUnwrap(owner.fileURL));f.center.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        owner.start(foreground:true);XCTAssertEqual(try Data(contentsOf:XCTUnwrap(owner.fileURL)),stable)
    }
    func testActualFiniteIntervalStopsAtCapAndClosesCapturedFile()async throws {
        let f=Fixture(),owner=f.make(limit:3,interval:5);defer{f.dispose()}
        let done=expectation(description:"actual finite interval cap")
        var samples=0
        let capture=f.make(limit:3,interval:5,output:{line in
            if line.hasPrefix("[CC_NATIVE_THERMAL] "){samples+=1;if samples==3{done.fulfill()}}
        })
        owner.dispose();capture.start(foreground:true)
        await fulfillment(of:[done],timeout:2)
        XCTAssertEqual(capture.sampleCount,3);XCTAssertFalse(capture.active);XCTAssertEqual(f.timeouts.pendingCount,0);XCTAssertEqual(capture.observerCount,0)
        XCTAssertEqual(try f.rows().map{$0["sequence"] as? Int},[1,2,3])
    }
    func testSnapshotReentrantDisposeCannotWriteOrPublishLateSample()throws {
        let f=Fixture();defer{f.dispose()}
        var owner:NativeDiagnosticsCapture?
        owner=f.make(snapshot:{owner?.dispose();return ["unexpected":true]})
        owner?.start(foreground:true)
        XCTAssertEqual(owner?.sampleCount,0);XCTAssertEqual(f.timeouts.pendingCount,0);XCTAssertEqual(owner?.observerCount,0)
        XCTAssertEqual(try f.rows().count,0)
        owner=nil
    }
    func testOversizePayloadFailsClosedWithoutPartialJSONLine()throws {
        let f=Fixture(),owner=f.make(snapshot:{["oversize":String(repeating:"a",count:5000)]});defer{f.dispose()}
        owner.start(foreground:true)
        XCTAssertFalse(owner.active);XCTAssertEqual(owner.sampleCount,0);XCTAssertEqual(f.timeouts.pendingCount,0);XCTAssertEqual(owner.observerCount,0)
        XCTAssertEqual(try f.rows().count,0)
    }
    func testExistingSessionCapPreservesEvidenceAndCreatesNoObserverOrTimeout()throws {
        let f=Fixture();defer{f.dispose()}
        try FileManager.default.createDirectory(at:f.directory,withIntermediateDirectories:true)
        let bytes=Data("retained evidence".utf8)
        for i in 0..<8{try bytes.write(to:f.directory.appendingPathComponent("native-thermal-\(i).jsonl"))}
        let owner=f.make();owner.start(foreground:true)
        XCTAssertFalse(owner.active);XCTAssertNil(owner.fileURL);XCTAssertEqual(owner.observerCount,0);XCTAssertEqual(f.timeouts.pendingCount,0)
        for i in 0..<8{XCTAssertEqual(try Data(contentsOf:f.directory.appendingPathComponent("native-thermal-\(i).jsonl")),bytes)}
    }
}
