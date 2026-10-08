import XCTest
@testable import Stack_to_Six

nonisolated final class NativeSourceMicrotaskFIFOTests:XCTestCase {
    @MainActor private func scope(_ fifo:NativeSourceMicrotaskFIFO,current:@escaping()->Bool={true})->NativeSourceMicrotaskFIFO.Scope {
        fifo.makeMeterScope(boundProducers:Set(NativeSourceMicrotaskFIFO.Boundary.allCases),isCurrent:current)!
    }
    @MainActor func testLiteralV9PromiseThenCatchFinallyMatchNineExecutedBrowserTaskTraces()throws {
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"NativeSourceMicrotaskOracle",withExtension:"json"))
        let gold=try JSONSerialization.jsonObject(with:Data(contentsOf:url)) as! [String:Any]
        for f in gold["results"] as! [[String:Any]] {
            let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo),capture=scope(fifo)
            let boundary=f["boundary"] as! String,outcome=f["outcome"] as! String
            var trace:[String]=[],ready=true,progress=false,settle:((NativeMeterSourceQueue.Outcome)->Void)?
            let queue=NativeMeterSourceQueue(hooks:.init(current:{true},permission:{progress ? .block("wild-spawn-in-progress"):.allow},continuation:{ready},meterReady:{ready},enqueue:{job in XCTAssertTrue(capture.enqueue(job))},after:{ms,_ in trace.append("after:\(ms)");return{}},inProgress:{progress=$0},retryPending:{_ in},shimmer:{trace.append("shimmer")},spawn:{settle=$0},reportFailure:{trace.append("catch-error")},debounceCanonicalSave:{trace.append("save:\($0)")}))
            var count=0
            @MainActor func probe(){count+=1;trace.append("probe:\(count)");if count<6{XCTAssertTrue(capture.enqueue{probe()})}}
            let task={trace.append(boundary+":begin");queue.queueIfNeeded();if outcome != "false"{ready=false};settle!(outcome=="false" ? .notSpawned:outcome=="rejected" ? .rejected:.spawned);XCTAssertTrue(capture.enqueue{probe()});trace.append(boundary+":end")}
            if boundary=="raf" {tasks.frameCallback(task)();tasks.frameCallback{trace.append("second-raf:progress=\(progress)")}();trace.append("next-frame")}
            else if boundary=="timeout" {tasks.timeoutCallback(task)();trace.append("next-task")}
            else {tasks.inputTask(task);trace.append("next-task")}
            XCTAssertEqual(trace,f["trace"] as! [String],"\(boundary)/\(outcome)");XCTAssertEqual(fifo.pendingCount,0)
            queue.dispose();capture.dispose();fifo.dispose()
        }
    }
    @MainActor func testActualSourceCADICallbackCheckpointRunsBeforeNextRAFCallbackAndStopsEmpty()async throws {
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo),capture=scope(fifo)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:Date().timeIntervalSince1970*1000,sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=tasks
        let done=expectation(description:"real union CADI delivers second literal RAF after reactions"),generation:UInt64=1
        var trace:[String]=[]
        defer{capture.dispose();service.dispose();fifo.dispose()}
        tasks.inputTask{
            XCTAssertNotNil(service.requestSourceAnimationFrame(ownerID:"A",generation:generation){
                trace.append("raf-A");XCTAssertTrue(capture.enqueue{trace.append("then");XCTAssertTrue(capture.enqueue{trace.append("finally")})})
            })
            XCTAssertNotNil(service.requestSourceAnimationFrame(ownerID:"B",generation:generation){trace.append("raf-B");done.fulfill()})
        }
        XCTAssertEqual(trace,[]);XCTAssertTrue(service.hasActiveClock);XCTAssertEqual(service.displayLinkCreationCount,1)
        await fulfillment(of:[done],timeout:1)
        XCTAssertEqual(trace,["raf-A","then","finally","raf-B"])
        XCTAssertEqual(service.pendingSourceAnimationFrameCount,0);XCTAssertFalse(service.hasActiveClock)
    }
    @MainActor func testOneSourceCallbackRetainsWholeSynchronousRootTraversalBeforeCheckpoint()async {
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo),capture=scope(fifo)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:Date().timeIntervalSince1970*1000,sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=tasks
        let done=expectation(description:"one actual RAF callback encloses all children"),generation:UInt64=1
        var trace:[String]=[]
        defer{capture.dispose();service.dispose();fifo.dispose()}
        service.requestSourceAnimationFrame(ownerID:"one-traversal",generation:generation){
            trace.append("child-A");XCTAssertTrue(capture.enqueue{trace.append("reaction-A")})
            trace.append("child-B");XCTAssertTrue(capture.enqueue{trace.append("reaction-B")})
        }
        service.requestSourceAnimationFrame(ownerID:"next-callback",generation:generation){trace.append("next-RAF");done.fulfill()}
        await fulfillment(of:[done],timeout:1)
        XCTAssertEqual(trace,["child-A","child-B","reaction-A","reaction-B","next-RAF"])
        // These synchronous siblings share one callback, as executed installed
        // GSAP3.13 roots in NativeSourceMicrotaskOracle.json independently prove.
    }
    @MainActor func testActualExistingTimeoutDrainsReactionsBeforeFollowingPhysicalSourceRAF()async {
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo),capture=scope(fifo)
        let timeouts=NativeSourceAppTimeoutOwner(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:Date().timeIntervalSince1970*1000,sourceFrameTransportEnabled:true)
        timeouts.sourceMicrotaskTasks=tasks;service.sourceMicrotaskTasks=tasks
        let done=expectation(description:"actual timer then/finally precedes physical CADI"),generation:UInt64=1
        var trace:[String]=[]
        defer{capture.dispose();timeouts.cancelAll();service.dispose();fifo.dispose()}
        timeouts.schedule(sourceID:"captured-meter-timeout",generation:generation,delayMilliseconds:0,elapsed:{
            XCTAssertEqual(timeouts.pendingCount,0);trace.append("timeout")
            XCTAssertTrue(capture.enqueue{trace.append("then");XCTAssertTrue(capture.enqueue{trace.append("finally")})})
            service.requestSourceAnimationFrame(ownerID:"physical-after-timeout",generation:generation){trace.append("RAF");done.fulfill()}
        })
        await fulfillment(of:[done],timeout:1)
        XCTAssertEqual(trace,["timeout","then","finally","RAF"]);XCTAssertEqual(fifo.pendingCount,0)
    }
    @MainActor func testMissingBoundaryAndOutsideTaskRefuseInsteadOfInventingDispatchOrder() {
        let fifo=NativeSourceMicrotaskFIFO()
        XCTAssertNil(fifo.makeMeterScope(isCurrent:{true}));XCTAssertNil(fifo.makeMeterScope(boundProducers:[.inputTask,.appTimeoutTask],isCurrent:{true}))
        let capture=scope(fifo)
        XCTAssertFalse(capture.enqueue{XCTFail("unmapped callback may not run")});XCTAssertEqual(fifo.pendingCount,0)
        capture.dispose();fifo.dispose()
    }
    @MainActor func testNestedTaskFIFOAndReplacementCaptureCannotDrainEarlyOrEraseNewC() {
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo),a=scope(fifo),c=scope(fifo)
        var trace:[String]=[]
        tasks.inputTask{
            trace.append("input-start");XCTAssertTrue(a.enqueue{trace.append("A");a.dispose();XCTAssertTrue(c.enqueue{trace.append("C")})})
            tasks.timeoutCallback{trace.append("nested");XCTAssertTrue(a.enqueue{XCTFail("retired A must not run")})}()
            trace.append("input-end")
        }
        XCTAssertEqual(trace,["input-start","nested","input-end","A","C"]);XCTAssertEqual(fifo.pendingCount,0)
        c.dispose();fifo.dispose()
    }
    @MainActor func testTerminalAndExternalCurrentReentryRefuseLatePublicationAndReleaseCaptures() {
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        var checking=false
        let capture=scope(fifo,current:{if checking{fifo.dispose()};return true})
        tasks.inputTask{checking=true;XCTAssertFalse(capture.enqueue{XCTFail("current returned true after terminal disposal")})}
        XCTAssertEqual(fifo.pendingCount,0);XCTAssertFalse(tasks.inputTask{XCTFail("closed")})
        let second=NativeSourceMicrotaskFIFO(),secondTasks=NativeSourceMicrotaskAdapters(fifo:second)
        var local:NativeSourceMicrotaskFIFO.Scope?=scope(second)
        weak var weakScope=local
        secondTasks.inputTask{XCTAssertTrue(local!.enqueue{XCTFail("scope deallocation must retire job")});local=nil}
        XCTAssertNil(weakScope);XCTAssertEqual(second.pendingCount,0);second.dispose()
    }
    @MainActor func testRawTimeoutDefaultIsUnchangedWithoutExplicitSourceBoundaryInstallation()async {
        let fifo=NativeSourceMicrotaskFIFO(),capture=scope(fifo),timeouts=NativeSourceAppTimeoutOwner()
        let done=expectation(description:"existing raw callback unchanged")
        timeouts.schedule(sourceID:"raw-default",generation:1,delayMilliseconds:0,elapsed:{XCTAssertFalse(capture.enqueue{XCTFail("Raw is not Source")});done.fulfill()})
        await fulfillment(of:[done],timeout:1)
        XCTAssertEqual(fifo.pendingCount,0);capture.dispose();fifo.dispose();timeouts.cancelAll()
    }
    @MainActor func testAppCapabilityRefusesMissingRealProducerAndReentrantUnbinding() {
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo),timeouts=NativeSourceAppTimeoutOwner()
        let disabled=NativeSourceAnimationClockService(wallOriginMilliseconds:0)
        let source=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceFrameTransportEnabled:true)
        defer{source.dispose();disabled.dispose();timeouts.cancelAll();fifo.dispose()}
        disabled.sourceMicrotaskTasks=tasks;timeouts.sourceMicrotaskTasks=tasks
        XCTAssertNil(NativeSourceMeterMicrotaskCapability(fifo:fifo,tasks:tasks,service:disabled,timeouts:timeouts,inputBoundaryInstalled:true,renderHandoffInstalled:true,current:{true}))
        source.sourceMicrotaskTasks=tasks
        XCTAssertNil(NativeSourceMeterMicrotaskCapability(fifo:fifo,tasks:tasks,service:source,timeouts:timeouts,current:{true}))
        XCTAssertNil(NativeSourceMeterMicrotaskCapability(fifo:fifo,tasks:tasks,service:source,timeouts:timeouts,inputBoundaryInstalled:true,renderHandoffInstalled:true,current:{source.sourceMicrotaskTasks=nil;return true}))
        source.sourceMicrotaskTasks=tasks
        XCTAssertNil(NativeSourceMeterMicrotaskCapability(fifo:fifo,tasks:tasks,service:source,timeouts:timeouts,inputBoundaryInstalled:true,current:{true}))
        let wrongFIFO=NativeSourceMicrotaskFIFO()
        XCTAssertNil(NativeSourceMeterMicrotaskCapability(fifo:wrongFIFO,tasks:tasks,service:source,timeouts:timeouts,inputBoundaryInstalled:true,renderHandoffInstalled:true,current:{true}))
        wrongFIFO.dispose()
        let capability=NativeSourceMeterMicrotaskCapability(fifo:fifo,tasks:tasks,service:source,timeouts:timeouts,inputBoundaryInstalled:true,renderHandoffInstalled:true,current:{true})
        XCTAssertNotNil(capability)
        tasks.inputTask{timeouts.sourceMicrotaskTasks=nil;XCTAssertFalse(capability!.enqueue{XCTFail("unbound timeout may not publish a new reaction")})}
        capability?.dispose();XCTAssertEqual(fifo.pendingCount,0)
    }
}
