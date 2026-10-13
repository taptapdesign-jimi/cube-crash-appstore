import XCTest
import UIKit
import SpriteKit
import QuartzCore
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativeDiagnosticsCaptureTests:XCTestCase {
    @MainActor private final class Fixture {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-diagnostics-test-\(UUID().uuidString)")
        let center=NotificationCenter(),timeouts=NativeSourceAppTimeoutOwner()
        var owner:NativeDiagnosticsCapture?
        func make(limit:Int=720,interval:Int=5000,batteryMonitor:NativeDiagnosticsCapture.BatteryMonitor?=nil,
                  processCPUReading:@escaping()->NativeDiagnosticsCapture.ProcessCPUReading?={NativeDiagnosticsCapture.ProcessCPUReading.current()},
                  diagnosticMillisecondsNow:@escaping()->Double={ProcessInfo.processInfo.systemUptime*1000},
                  snapshot:@escaping()->[String:Any]={ ["thermalState":"nominal","lowPowerMode":false] },output:@escaping(String)->Void={_ in})->NativeDiagnosticsCapture {
            let value=NativeDiagnosticsCapture(directory:directory,center:center,timeouts:timeouts,sampleLimit:limit,intervalMilliseconds:interval,batteryMonitor:batteryMonitor,processCPUReading:processCPUReading,diagnosticMillisecondsNow:diagnosticMillisecondsNow,snapshot:snapshot,output:output)
            owner=value;return value
        }
        func rows()throws->[[String:Any]] {
            let data=try Data(contentsOf:XCTUnwrap(owner?.fileURL))
            return try data.split(separator:10).map{try XCTUnwrap(JSONSerialization.jsonObject(with:Data($0)) as? [String:Any])}
        }
        func dispose(){owner?.dispose();owner=nil;try? FileManager.default.removeItem(at:directory)}
    }
    func testDrawableBudgetProbeAndCensusRemainEmptyWhenDisabledWithoutMutatingPresentation()throws {
        let state=NativeBoardState(tiles:[.init(id:"one",cell:.init(column:0,row:0),value:1)])
        let controller=NativeGameplayViewController(engine:NativeGameplayEngine(state:state),resourceRoot:NativeTestResources.root)
        controller.drawableBudgetDiagnosticsEnabled=false
        controller.loadViewIfNeeded();controller.view.frame = .init(x:0,y:0,width:390,height:844)
        controller.view.layoutIfNeeded()
        defer{controller.dispose()}
        let sprite=try XCTUnwrap(controller.view.subviews.compactMap{$0 as? SKView}.first)
        let beforeSize=(sprite.layer as? CAMetalLayer)?.drawableSize,beforeState=controller.engine.state
        for _ in 0..<3 {
            XCTAssertTrue(controller.drawableBudgetDiagnosticSnapshot().isEmpty)
            let census=NativeDiagnosticsRenderCensus.capture(root:controller.view)
            XCTAssertEqual((census["gameplayDrawableBudgets"] as? [[String:Any]])?.count,0)
        }
        XCTAssertEqual((sprite.layer as? CAMetalLayer)?.drawableSize,beforeSize)
        XCTAssertEqual(controller.engine.state,beforeState)
    }
    func testDrawableBudgetProbeCountsActualMetalWriteAndCensusReadingDoesNotWrite()throws {
        let state=NativeBoardState(tiles:[.init(id:"one",cell:.init(column:0,row:0),value:1)])
        let controller=NativeGameplayViewController(engine:NativeGameplayEngine(state:state),resourceRoot:NativeTestResources.root)
        controller.drawableBudgetDiagnosticsEnabled=false
        controller.loadViewIfNeeded();controller.view.frame = .init(x:0,y:0,width:390,height:844)
        controller.view.layoutIfNeeded()
        defer{controller.dispose()}
        let sprite=try XCTUnwrap(controller.view.subviews.compactMap{$0 as? SKView}.first)
        let metal=try XCTUnwrap(sprite.layer as? CAMetalLayer,"This regression requires the actual SpriteKit Metal-backed surface")
        XCTAssertGreaterThan(sprite.bounds.width,0);XCTAssertGreaterThan(sprite.bounds.height,0)
        let desired=sprite.bounds.size,oversized=CGSize(width:desired.width*3,height:desired.height*3)
        controller.drawableBudgetDiagnosticsEnabled=true
        let before=controller.drawableBudgetDiagnosticSnapshot()
        metal.drawableSize=oversized
        controller.viewDidLayoutSubviews()
        let after=controller.drawableBudgetDiagnosticSnapshot()
        XCTAssertEqual(after["isAsynchronous"] as? Bool,sprite.isAsynchronous)
        XCTAssertEqual(after["renderingMode"] as? String,sprite.isAsynchronous ? "asynchronous":"synchronous")
        XCTAssertEqual(after["preferredFramesPerSecond"] as? Int,sprite.preferredFramesPerSecond)
        XCTAssertEqual(after["contentScaleFactor"] as? Double,Double(sprite.contentScaleFactor))
        XCTAssertEqual(after["calls"] as? Int,(before["calls"] as? Int ?? 0)+1)
        XCTAssertEqual(after["actualWrites"] as? Int,(before["actualWrites"] as? Int ?? 0)+1)
        XCTAssertEqual(after["lastWriteBeforePixels"] as? [Double],[Double(oversized.width),Double(oversized.height)])
        XCTAssertEqual(after["lastWriteAfterPixels"] as? [Double],[Double(desired.width),Double(desired.height)])
        XCTAssertEqual(after["desiredPixels"] as? [Double],[Double(desired.width),Double(desired.height)])
        XCTAssertEqual(metal.drawableSize,desired)
        for _ in 0..<3 {
            let census=NativeDiagnosticsRenderCensus.capture(root:controller.view)
            let snapshots=try XCTUnwrap(census["gameplayDrawableBudgets"] as? [[String:Any]])
            XCTAssertEqual(snapshots.count,1)
            XCTAssertEqual(snapshots.first?["actualWrites"] as? Int,after["actualWrites"] as? Int)
            XCTAssertEqual(snapshots.first?["isAsynchronous"] as? Bool,sprite.isAsynchronous)
            XCTAssertEqual(snapshots.first?["renderingMode"] as? String,after["renderingMode"] as? String)
        }
        XCTAssertEqual(controller.drawableBudgetDiagnosticSnapshot()["calls"] as? Int,after["calls"] as? Int)
        XCTAssertEqual(metal.drawableSize,desired);XCTAssertEqual(controller.engine.state,state)
    }
    func testAdmissionRequiresExactNativeIdentityAndExplicitArgument() {
        for flag in ["--cc-performance-diagnostics","--cc-native-thermal-telemetry"] {
            XCTAssertTrue(NativeDiagnosticsCapture.admitted(arguments:[flag],bundleIdentifier:"com.taptapdesign.stacktosix.native"))
            for other in [nil,"com.taptapdesign.stacktosix.Stack-to-Six","com.kockice.crash"] {
                XCTAssertFalse(NativeDiagnosticsCapture.admitted(arguments:[flag],bundleIdentifier:other))
            }
        }
        XCTAssertFalse(NativeDiagnosticsCapture.admitted(arguments:[],bundleIdentifier:"com.taptapdesign.stacktosix.native"))
        XCTAssertTrue(NativeDiagnosticsCapture.admitted(arguments:[],bundleIdentifier:"com.taptapdesign.stacktosix.native",preferenceEnabled:true))
        XCTAssertFalse(NativeDiagnosticsCapture.admitted(arguments:[],bundleIdentifier:"com.taptapdesign.stacktosix.Stack-to-Six",preferenceEnabled:true))
    }
    func testCaptureMeasuresItsOwnSnapshotAndOutputOverheadOnlyWhenStarted()throws {
        let f=Fixture();defer{f.dispose()}
        var now=0.0,reads=0
        let owner=f.make(processCPUReading:{nil},diagnosticMillisecondsNow:{reads+=1;return now},snapshot:{now+=2;return [:]},output:{_ in now+=3})
        XCTAssertEqual(reads,0)
        owner.start(foreground:true)
        let first=try XCTUnwrap(f.rows().first)
        XCTAssertEqual(first["diagnosticSnapshotMilliseconds"] as? Double,2)
        XCTAssertEqual(first["diagnosticPreviousSampleMilliseconds"] as? Double,0)
        f.center.post(name:ProcessInfo.thermalStateDidChangeNotification,object:nil)
        let second=try XCTUnwrap(f.rows().last)
        XCTAssertEqual(second["diagnosticSnapshotMilliseconds"] as? Double,2)
        XCTAssertEqual(second["diagnosticPreviousSampleMilliseconds"] as? Double,5)
        owner.dispose();let stoppedReads=reads
        f.center.post(name:ProcessInfo.thermalStateDidChangeNotification,object:nil)
        XCTAssertEqual(reads,stoppedReads)
    }
    func testCPUIntervalUsesMonotonicProcessDeltaAndResetsAcrossBackground()throws {
        let f=Fixture();defer{f.dispose()}
        var reading=NativeDiagnosticsCapture.ProcessCPUReading(uptimeSeconds:10,userSeconds:2,systemSeconds:1)
        let owner=f.make(processCPUReading:{reading});owner.start(foreground:true)
        XCTAssertNil(try f.rows()[0]["processCPUPercentOfOneCore"])
        reading = .init(uptimeSeconds:15,userSeconds:7,systemSeconds:3.5)
        f.center.post(name:ProcessInfo.thermalStateDidChangeNotification,object:nil)
        let row=try XCTUnwrap(f.rows().last)
        XCTAssertEqual(row["processCPUIntervalMilliseconds"] as? Double,5000)
        XCTAssertEqual(row["processCPUConsumedMilliseconds"] as? Double,7500)
        XCTAssertEqual(row["processCPUPercentOfOneCore"] as? Double,150)
        XCTAssertEqual(row["processCPUUserMilliseconds"] as? Double,7000)
        f.center.post(name:UIApplication.didEnterBackgroundNotification,object:nil)
        reading = .init(uptimeSeconds:115,userSeconds:27,systemSeconds:9)
        f.center.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertNil(try f.rows().last?["processCPUIntervalMilliseconds"])
        reading = .init(uptimeSeconds:120,userSeconds:27.5,systemSeconds:9.5)
        f.center.post(name:ProcessInfo.thermalStateDidChangeNotification,object:nil)
        XCTAssertEqual(try f.rows().last?["processCPUPercentOfOneCore"] as? Double,20)
        XCTAssertEqual(owner.pendingCount,1)
    }
    func testCPUUnavailableOrRegressedReadingStartsFreshBaseline()throws {
        let f=Fixture();defer{f.dispose()}
        var reading:NativeDiagnosticsCapture.ProcessCPUReading? = .init(uptimeSeconds:10,userSeconds:2,systemSeconds:1)
        let owner=f.make(processCPUReading:{reading});owner.start(foreground:true)
        for next in [nil,.init(uptimeSeconds:15,userSeconds:4,systemSeconds:2),
                     .init(uptimeSeconds:14,userSeconds:3,systemSeconds:1),
                     .init(uptimeSeconds:Double.nan,userSeconds:3,systemSeconds:1),
                     .init(uptimeSeconds:20,userSeconds:5,systemSeconds:2)] as [NativeDiagnosticsCapture.ProcessCPUReading?] {
            reading=next;f.center.post(name:ProcessInfo.thermalStateDidChangeNotification,object:nil)
            XCTAssertNil(try f.rows().last?["processCPUPercentOfOneCore"])
        }
    }
    func testCPUReadReentrantRetirementDoesNotWriteOrSchedule()throws {
        let f=Fixture();defer{f.dispose()}
        var owner:NativeDiagnosticsCapture?
        owner=f.make(processCPUReading:{owner?.dispose();return .init(uptimeSeconds:1,userSeconds:0,systemSeconds:0)})
        owner?.start(foreground:true)
        XCTAssertEqual(try f.rows().count,0);XCTAssertEqual(owner?.pendingCount,0)
        XCTAssertEqual(owner?.observerCount,0);XCTAssertEqual(owner?.sampleCount,0)
        owner=nil
    }
    func testActualProcessCPUReadingIsAvailableAndFinite()throws {
        let reading=try XCTUnwrap(NativeDiagnosticsCapture.ProcessCPUReading.current())
        XCTAssertTrue(reading.uptimeSeconds.isFinite);XCTAssertGreaterThan(reading.uptimeSeconds,0)
        XCTAssertGreaterThanOrEqual(reading.userSeconds,0);XCTAssertGreaterThanOrEqual(reading.systemSeconds,0)
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
    func testExistingSessionCapPreservesEvidenceAndContinuesBoundedConsoleCapture()throws {
        let f=Fixture();defer{f.dispose()}
        try FileManager.default.createDirectory(at:f.directory,withIntermediateDirectories:true)
        let bytes=Data("retained evidence".utf8)
        for i in 0..<8{try bytes.write(to:f.directory.appendingPathComponent("native-thermal-\(i).jsonl"))}
        var lines:[String]=[]
        let owner=f.make(limit:2,output:{lines.append($0)});owner.start(foreground:true)
        XCTAssertTrue(owner.active);XCTAssertNil(owner.fileURL);XCTAssertEqual(owner.observerCount,5);XCTAssertEqual(f.timeouts.pendingCount,1)
        f.center.post(name:ProcessInfo.thermalStateDidChangeNotification,object:nil)
        XCTAssertFalse(owner.active);XCTAssertEqual(owner.sampleCount,2);XCTAssertEqual(owner.observerCount,0);XCTAssertEqual(f.timeouts.pendingCount,0)
        let rows=try lines.filter{$0.hasPrefix("[CC_NATIVE_THERMAL] ")}.map {
            try XCTUnwrap(JSONSerialization.jsonObject(with:Data($0.dropFirst("[CC_NATIVE_THERMAL] ".count).utf8)) as? [String:Any])
        }
        XCTAssertEqual(rows.count,2)
        XCTAssertTrue(rows.allSatisfy{$0["persistenceAvailable"] as? Bool==false})
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath:f.directory.path).count,8)
        for i in 0..<8{XCTAssertEqual(try Data(contentsOf:f.directory.appendingPathComponent("native-thermal-\(i).jsonl")),bytes)}
    }
    func testUnavailableCaptureDirectoryUsesConsoleAndRestoresMonitoringOnDispose()throws {
        let f=Fixture();defer{f.dispose()}
        try Data("preserve".utf8).write(to:f.directory)
        var enabled=false,writes:[Bool]=[],lines:[String]=[]
        let owner=f.make(batteryMonitor:.init(isEnabled:{enabled},setEnabled:{enabled=$0;writes.append($0)}),output:{lines.append($0)})
        owner.start(foreground:true)
        XCTAssertTrue(owner.active);XCTAssertTrue(enabled);XCTAssertNil(owner.fileURL)
        XCTAssertTrue(lines.contains{$0.contains("\"persistenceAvailable\":false")})
        owner.dispose();XCTAssertFalse(enabled);XCTAssertEqual(writes,[true,false]);XCTAssertEqual(owner.observerCount,0);XCTAssertEqual(f.timeouts.pendingCount,0)
        XCTAssertEqual(try Data(contentsOf:f.directory),Data("preserve".utf8))
    }
    func testRenderCensusCountsSharedTexturesAndUnmountedSceneWithoutLoadingResources() {
        let root=UIView(),view=SKView();root.addSubview(view)
        let scene=SKScene(size:.init(width:20,height:20)),texture=SKTexture(image:UIGraphicsImageRenderer(size:.init(width:4,height:4)).image{_ in})
        let group=SKNode();group.isHidden=true;scene.addChild(group)
        group.addChild(SKSpriteNode(texture:texture));scene.addChild(SKSpriteNode(texture:texture));scene.addChild(SKShapeNode())
        view.presentScene(scene)
        let first=NativeDiagnosticsRenderCensus.capture(root:root)
        XCTAssertEqual(first["mountedSKViews"] as? Int,1);XCTAssertEqual(first["mountedScenes"] as? Int,1)
        XCTAssertEqual(first["sceneNodes"] as? Int,5);XCTAssertEqual(first["paintableNodes"] as? Int,3)
        XCTAssertEqual(first["sprites"] as? Int,2);XCTAssertEqual(first["shapes"] as? Int,1)
        XCTAssertEqual(first["uniqueSpriteTextureObjects"] as? Int,1)
        XCTAssertEqual(first["truncated"] as? Bool,false)
        view.presentScene(nil)
        XCTAssertEqual(NativeDiagnosticsRenderCensus.capture(root:root)["sceneNodes"] as? Int,0)
    }
    func testRenderCensusTraversalIsBoundedAndMarksTruncation() {
        let root=UIView();for _ in 0..<100 {root.addSubview(UIView())}
        let result=NativeDiagnosticsRenderCensus.capture(root:root,visitLimit:8)
        XCTAssertEqual(result["mountedViews"] as? Int,8);XCTAssertEqual(result["truncated"] as? Bool,true)
    }
    func testActualProcessFootprintIsFiniteAndPublishedInDiagnosticSample()throws {
        let bytes=try XCTUnwrap(NativeDiagnosticsCapture.memoryFootprintBytes())
        XCTAssertGreaterThan(bytes,0)
        let f=Fixture();defer{f.dispose()};let owner=f.make();owner.start(foreground:true)
        let row=try XCTUnwrap(f.rows().first)
        XCTAssertGreaterThan(try XCTUnwrap(row["processPhysicalFootprintBytes"] as? NSNumber).uint64Value,0)
    }
    func testActualNativeRootConnectsCaptureAndLeavesNativeSaveBytesUntouched()throws {
        let f=Fixture();defer{f.dispose()}
        let directory=f.directory.appendingPathComponent("profile"),store=NativeSaveStore(directory:directory)
        let seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        try store.save(seed)
        let file=directory.appendingPathComponent("state-v1.json"),before=try Data(contentsOf:file)
        let root=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,
            diagnosticsArguments:["--cc-native-thermal-telemetry"],diagnosticsPreference:false,
            diagnosticsDirectory:f.directory.appendingPathComponent("captures"))
        defer{root.dispose()}
        root.loadViewIfNeeded();f.owner=try XCTUnwrap(root.diagnostics)
        XCTAssertTrue(f.owner?.active==true);XCTAssertEqual(try f.rows().first?["product"] as? String,"com.taptapdesign.stacktosix.native")
        XCTAssertEqual(try f.rows().first?["performanceDiagnosticsEnabled"] as? Bool,false)
        XCTAssertEqual(try f.rows().first?["nativeThermalTelemetryEnabled"] as? Bool,true)
        XCTAssertEqual(try f.rows().first?["persistenceAvailable"] as? Bool,true)
        XCTAssertEqual(try Data(contentsOf:file),before);XCTAssertEqual(try store.load(),seed)
        root.dispose();XCTAssertNil(root.diagnostics);XCTAssertEqual(f.owner?.observerCount,0);XCTAssertEqual(f.owner?.pendingCount,0)
    }
    func testActualOrdinaryNativeRootStartsWithoutDiagnosticWorkOrFiles()throws {
        let f=Fixture();defer{f.dispose()}
        let store=NativeSaveStore(directory:f.directory.appendingPathComponent("profile"))
        try store.save(NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false)))
        let captures=f.directory.appendingPathComponent("captures")
        let root=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,
            diagnosticsArguments:[],diagnosticsPreference:false,diagnosticsDirectory:captures)
        defer{root.dispose()};root.loadViewIfNeeded()
        XCTAssertNil(root.diagnostics);XCTAssertFalse(FileManager.default.fileExists(atPath:captures.path))
    }
    func testBatteryMonitoringRestoresPreviousStateAfterOwnerDeallocation() {
        let f=Fixture();defer{f.dispose()}
        var enabled=false,writes:[Bool]=[]
        var owner:NativeDiagnosticsCapture?=f.make(batteryMonitor:.init(isEnabled:{enabled},setEnabled:{enabled=$0;writes.append($0)}))
        weak var weakOwner=owner
        owner?.start(foreground:true);XCTAssertTrue(enabled)
        f.owner=nil;owner=nil
        XCTAssertNil(weakOwner);XCTAssertEqual(f.timeouts.pendingCount,0)
        XCTAssertFalse(enabled);XCTAssertEqual(writes,[true,false])
    }
    func testActualDeviceMonitoringReadbackRetainsOriginalStateAfterCleanup() {
        let f=Fixture();defer{f.dispose()}
        let previous=UIDevice.current.isBatteryMonitoringEnabled,owner=f.make()
        owner.start(foreground:true);owner.dispose()
        // Simulator may reject enabling battery monitoring. This proves cleanup
        // of observed state, not physical battery availability or accuracy.
        XCTAssertEqual(UIDevice.current.isBatteryMonitoringEnabled,previous)
    }
    func testReentrantBatteryReadOrWriteDisposalCannotInstallLateObserversOrTimeout()throws {
        for retireOnRead in [true,false] {
            let f=Fixture();defer{f.dispose()}
            var owner:NativeDiagnosticsCapture?,enabled=false,writes:[Bool]=[]
            owner=f.make(batteryMonitor:.init(isEnabled:{
                if retireOnRead {owner?.dispose()};return enabled
            },setEnabled:{value in
                enabled=value;writes.append(value)
                if value {owner?.dispose()}
            }))
            owner?.start(foreground:true)
            XCTAssertFalse(owner?.active==true);XCTAssertFalse(enabled)
            XCTAssertEqual(owner?.observerCount,0);XCTAssertEqual(f.timeouts.pendingCount,0)
            XCTAssertEqual(writes,retireOnRead ? []:[true,false]);XCTAssertEqual(try f.rows().count,0)
            owner=nil
        }
    }
}
