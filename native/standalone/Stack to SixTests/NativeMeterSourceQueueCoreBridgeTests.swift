import XCTest
@testable import Stack_to_Six
@testable import StackToSixGameplay

nonisolated final class NativeMeterSourceQueueCoreBridgeTests:XCTestCase {
    @MainActor func testSpecialBarIntervalBlocksRealQueueBeforePermissionShimmerOrRetry() {
        var tutorial=NativeTutorialState();tutorial.step = .freePlay
        let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"live",cell:.init(column:0,row:0),value:1)],wildMeter:1.25,tutorial:tutorial))
        XCTAssertTrue(engine.beginTutorialSpecialBarInterval().accepted)
        let timeouts=NativeSourceAppTimeoutOwner(),signals=NativeMeterQueueSignals()
        let bridge=NativeMeterSourceQueueCoreBridge(engine:engine,timeouts:timeouts,signalRegistry:signals,hooks:.init(
            current:{true},permission:{_ in XCTFail("Deferred tutorial must precede permission hooks");return .allow},continuation:{true},meterReady:{true},enqueue:{$0()},sourceQueueInProgress:{_ in},shimmer:{XCTFail("No deferred shimmer")},canonicalSave:{_ in XCTFail("No retry save")},consume:{_,_ in XCTFail("No deferred claim")},fault:{XCTFail($0)}))
        defer{bridge.dispose();signals.dispose();timeouts.cancelAll()}
        for _ in 0..<3 {bridge.guardReleased();bridge.queueIfNeeded()}
        XCTAssertEqual(bridge.captureSourceQueueSignals(),.init(generation:engine.state.generation,inProgress:false,retryPending:false))
        XCTAssertEqual(timeouts.pendingCount,0);XCTAssertEqual(engine.state.wildMeter,1.25)
    }
    @MainActor func testCapturedQueueClaimPreservesForeignMutationVetoAndRejectsRetiredWriter() {
        let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"live",cell:.init(column:0,row:0),value:1)],wildMeter:1.25))
        engine.stagedMeterDrops=true;engine.stagedMeterOpen=true
        var current=true
        let capture=NativeGameplayEngine.SourceMeterQueueClaimCapture(ownerID:UUID(),generation:engine.state.generation,isCurrent:{current})
        var flags=engine.flags;flags.wildSpawnInProgress=true;flags.merge6SpawnInProgress=true;engine.setRuntimeFlags(flags)
        let before=engine.state
        XCTAssertFalse(engine.claimSourceMeterReward(queue:capture).accepted)
        XCTAssertEqual(engine.state,before);XCTAssertNil(engine.pendingMeterOpen)
        flags.merge6SpawnInProgress=false;engine.setRuntimeFlags(flags);current=false
        XCTAssertFalse(engine.claimSourceMeterReward(queue:capture).accepted)
        XCTAssertEqual(engine.state,before);XCTAssertNil(engine.pendingMeterOpen)
        XCTAssertFalse(engine.claimMeterReward().accepted,"Uncaptured generic claim must keep the active Wild veto")
    }
    @MainActor func testInstalledQueuePublishesItsActualInitialWriterBeforePermissionAndRetiresIt() {
        let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"live",cell:.init(column:0,row:0),value:1)],wildMeter:1.25))
        let timeouts=NativeSourceAppTimeoutOwner(),signals=NativeMeterQueueSignals()
        var permissionReads=0,claims=0
        let bridge=NativeMeterSourceQueueCoreBridge(engine:engine,timeouts:timeouts,signalRegistry:signals,hooks:.init(
            current:{true},permission:{_ in permissionReads+=1;return .block("not-ready")},continuation:{true},meterReady:{true},
            enqueue:{$0()},sourceQueueInProgress:{_ in},shimmer:{},canonicalSave:{_ in},consume:{_,_ in claims+=1},fault:{XCTFail($0)}))
        defer{bridge.dispose();signals.dispose();timeouts.cancelAll()}
        XCTAssertNil(bridge.captureSourceQueueSignals())
        XCTAssertTrue(bridge.activateSourceSignals())
        XCTAssertEqual(bridge.captureSourceQueueSignals(),.init(generation:engine.state.generation,inProgress:false,retryPending:false))
        XCTAssertEqual(permissionReads,0);XCTAssertEqual(claims,0);XCTAssertEqual(timeouts.pendingCount,0)
        bridge.queueIfNeeded();XCTAssertEqual(permissionReads,1);XCTAssertEqual(claims,0)
        bridge.dispose();XCTAssertNil(bridge.captureSourceQueueSignals())
    }
    @MainActor func testRealCoreTwelveEmptyWaitsBecomeOuter600RetryAndCanonical400Save()async throws {
        let cells=(0..<9).flatMap{r in (0..<5).map{c in NativeTile(id:"occupied:\(r):\(c)",cell:.init(column:c,row:r),value:1)}}
        let engine=NativeGameplayEngine(state:.init(tiles:cells,wildMeter:1.25))
        engine.stagedMeterOpen=true;engine.stagedMeterDrops=true
        let wall=NativeSourceAppTimeoutOwner(),saved=expectation(description:"actual Core failed coroutine then/finally requests canonical save400")
        var progress=false,waits=0,failures=0,saves:[Int]=[],current=true
        var bridge:NativeMeterSourceQueueCoreBridge!
        bridge=NativeMeterSourceQueueCoreBridge(engine:engine,timeouts:wall,signalRegistry:NativeMeterQueueSignals(),hooks:.init(current:{current},permission:{queueProgress in
            if queueProgress{return .block("wild-spawn-in-progress")};return .allow // test genuine full-grid setup only, no production predicate
        },continuation:{engine.state.wildMeter>=1-0.000001 && !engine.flags.busyEnding},meterReady:{engine.state.wildMeter>=1-0.000001},enqueue:{action in DispatchQueue.main.async{action()}},sourceQueueInProgress:{progress=$0},shimmer:{},canonicalSave:{delay in saves.append(delay);saved.fulfill()},consume:{result,_ in
            for event in result.events{if event.kind == .meterDropOpenRetryPrepared{waits+=1};if event.kind == .meterDropOpenFailed{failures+=1}}
            bridge.receive(result)
        },fault:{XCTFail($0)}))
        defer{current=false;bridge.dispose();wall.cancelAll()}
        XCTAssertNil(bridge.captureSourceQueueSignals(),"Absent writer is unknown, not false")
        bridge.queueIfNeeded()
        XCTAssertEqual(bridge.captureSourceQueueSignals(),.init(generation:engine.state.generation,inProgress:true,retryPending:false))
        XCTAssertFalse(engine.flags.wildSpawnInProgress,"Actual queue ownership must not publish an unrelated shared input lock")
        // Actual wall owner delivers twelve40 callbacks. Global Source animation
        // is absent: no fake root or new Timer, no synchronous timeout receipt.
        await fulfillment(of:[saved],timeout:2)
        XCTAssertEqual(waits,12);XCTAssertEqual(failures,1);XCTAssertEqual(saves,[400]);XCTAssertFalse(progress)
        XCTAssertTrue(engine.sourceWildRetryPending);XCTAssertNil(engine.pendingMeterOpenRetry)
        XCTAssertEqual(bridge.captureSourceQueueSignals(),.init(generation:engine.state.generation,inProgress:false,retryPending:true))
        XCTAssertEqual(wall.pendingReceipts.count,1);XCTAssertTrue(wall.pendingReceipts[0].sourceID.hasPrefix("source-meter-outer-retry:"))
        XCTAssertEqual(engine.state.wildMeter,1.25);XCTAssertEqual(engine.state.wildSpawnCount,0)
        bridge.dispose();XCTAssertFalse(engine.sourceWildRetryPending);XCTAssertEqual(wall.pendingCount,0)
        XCTAssertNil(bridge.captureSourceQueueSignals())
    }
    @MainActor func testDeallocationReleasesActualRetryReceiptAndCoreSignalsWithoutWeakBridgeWriter() {
        let engine=NativeGameplayEngine(state:.init(tiles:[NativeTile(id:"live",cell:.init(column:0,row:0),value:1)],wildMeter:1.25))
        let timeouts=NativeSourceAppTimeoutOwner(),signals=NativeMeterQueueSignals()
        var progress=false
        var bridge:NativeMeterSourceQueueCoreBridge?=NativeMeterSourceQueueCoreBridge(engine:engine,timeouts:timeouts,signalRegistry:signals,hooks:.init(current:{true},permission:{_ in .retry("board-settling",80)},continuation:{true},meterReady:{true},enqueue:{$0()},sourceQueueInProgress:{progress=$0},shimmer:{XCTFail("retry must not start")},canonicalSave:{_ in XCTFail("deallocation must not save")},consume:{_,_ in XCTFail("retry must not claim")},fault:{XCTFail($0)}))
        weak var weakBridge=bridge
        bridge!.queueIfNeeded()
        XCTAssertTrue(engine.sourceWildRetryPending);XCTAssertEqual(timeouts.pendingCount,1)
        bridge=nil
        XCTAssertNil(weakBridge);XCTAssertFalse(engine.sourceWildRetryPending);XCTAssertFalse(progress)
        XCTAssertEqual(timeouts.pendingCount,0)
        signals.dispose();timeouts.cancelAll()
    }
    @MainActor func testSameGenerationReplacementCannotHaveItsCoreRetryClearedByOldCapture() {
        let engine=NativeGameplayEngine(state:.init(tiles:[NativeTile(id:"live",cell:.init(column:0,row:0),value:1)],wildMeter:1.25))
        let timeouts=NativeSourceAppTimeoutOwner(),signals=NativeMeterQueueSignals()
        var progress=false
        let hooks=NativeMeterSourceQueueCoreBridge.Hooks(current:{true},permission:{_ in .retry("board-settling",80)},continuation:{true},meterReady:{true},enqueue:{$0()},sourceQueueInProgress:{progress=$0},shimmer:{XCTFail("retry must not start")},canonicalSave:{_ in},consume:{_,_ in XCTFail("retry must not claim")},fault:{XCTFail($0)})
        let a=NativeMeterSourceQueueCoreBridge(engine:engine,timeouts:timeouts,signalRegistry:signals,hooks:hooks)
        let c=NativeMeterSourceQueueCoreBridge(engine:engine,timeouts:timeouts,signalRegistry:signals,hooks:hooks)
        defer{a.dispose();c.dispose();signals.dispose();timeouts.cancelAll()}
        a.queueIfNeeded();c.queueIfNeeded()
        XCTAssertNil(a.captureSourceQueueSignals(),"Old same-generation writer cannot observe its successor")
        XCTAssertEqual(c.captureSourceQueueSignals(),.init(generation:engine.state.generation,inProgress:false,retryPending:true))
        XCTAssertTrue(engine.sourceWildRetryPending);XCTAssertEqual(timeouts.pendingCount,1)
        a.dispose()
        XCTAssertTrue(engine.sourceWildRetryPending);XCTAssertEqual(timeouts.pendingCount,1)
        c.dispose();XCTAssertFalse(engine.sourceWildRetryPending);XCTAssertEqual(timeouts.pendingCount,0);XCTAssertFalse(progress)
    }
}
