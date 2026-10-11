import XCTest
@testable import Stack_to_Six

@MainActor final class NativeSourceMagnetCoroutineTests:XCTestCase {
 @MainActor private final class Fixture {
  let fifo=NativeSourceMicrotaskFIFO()
  var scope:NativeSourceMicrotaskFIFO.Scope!
  var owned=true,revision=1.0,observations=0,waits:[Int]=[],guardReleases:[Bool]=[],checks:[String]=[],finals:[NativeSourceMagnetCoroutineOwner.Outcome]=[],outer:[NativeSourceMagnetCoroutineOwner.Outcome]=[]
  var deliveries:[()->Void]=[],cancelled:[()->Void]=[],actions:[String]=[],snapshot=NativeSourceMagnetCoroutineOwner.Observation(lockedActiveCount:0,stillSpawningCount:0,activeCount:2,playableLockedCount:0,resolution:.mergePotential(clearLastMerge:false))
  var onAcquire:(()->Void)?,onObserve:(()->Void)?,fallbackCalls=0
  lazy var owner=NativeSourceMagnetCoroutineOwner(hooks:.init(ownsLifecycle:{[unowned self] in owned},revision:{[unowned self] in revision},beginGuard:{[unowned self] in
   onAcquire?();return {[unowned self] owns in guardReleases.append(owns);actions.append("guard-")}
  },schedule:{[unowned self] ms,elapsed,cancel in
   waits.append(ms);deliveries.append(elapsed);cancelled.append(cancel);var done=false
   return {if !done{done=true;cancel()}}
  },enqueue:{[unowned self] callback in scope.enqueue(callback)},simulate:{[unowned self] in actions.append("simulate");return false},observe:{[unowned self] in observations+=1;onObserve?();return snapshot},fallback:{[unowned self] count,complete in fallbackCalls+=1;actions.append("fallback:\(count)");snapshot = .init(lockedActiveCount:0,stillSpawningCount:0,activeCount:2,playableLockedCount:0,resolution:.mergePotential(clearLastMerge:false));complete(true);complete(true);return true},readFXStatus:{false},clearCapturedLastMerge:{},updateGhostVisibility:{},centralCheck:{[unowned self] in checks.append($0);actions.append("central")},helperFinally:{[unowned self] _,outcome in finals.append(outcome);actions.append("finally")},handlerComplete:{[unowned self] _,outcome in outer.append(outcome);actions.append("outer")}))
  init(){scope=fifo.makeMeterScope(boundProducers:Set(NativeSourceMicrotaskFIFO.Boundary.allCases),isCurrent:{true})!}
  func begin(){_=fifo.performTask(.inputTask){XCTAssertTrue(owner.begin());owner.boardCommitted(spawnCount:2,shouldRunPostCheck:true,publish:{})}}
  func deliver(){XCTAssertFalse(deliveries.isEmpty);let callback=deliveries.removeFirst();_=fifo.performTask(.appTimeoutTask,callback)}
 }
 func testActualPromiseFIFOSettlesGuardBeforeCentralAndNestedOuterRelease(){
  let f=Fixture();f.begin();XCTAssertEqual(f.waits,[1200]);XCTAssertTrue(f.guardReleases.isEmpty)
  f.deliver();XCTAssertEqual(f.guardReleases,[true]);XCTAssertEqual(f.checks,["mergePulledTiles_mergePotential_refresh"]);XCTAssertEqual(f.actions,["simulate","guard-","central","finally","outer"]);XCTAssertEqual(f.outer,[.completed]);XCTAssertEqual(f.fifo.pendingCount,0)
 }
 func testTrackedWaitResumesHelperAfterTheFirstProbeAndBeforeTheSecond(){
  let f=Fixture();f.begin();let delivered=f.deliveries.removeFirst()
  _=f.fifo.performTask(.appTimeoutTask){delivered();_=f.scope.enqueue{f.actions.append("probe1");_=f.scope.enqueue{f.actions.append("probe2")}}}
  XCTAssertEqual(f.actions,["probe1","simulate","probe2","guard-","central","finally","outer"])
  XCTAssertEqual(f.outer,[.completed]);XCTAssertEqual(f.fifo.pendingCount,0)
 }
 func testSettling600AndExactlyTenUnlock50ReceiptsUseActualObservations(){
  let f=Fixture();f.snapshot = .init(lockedActiveCount:1,stillSpawningCount:1,activeCount:2,playableLockedCount:1,resolution:.stuckUnlocked);f.begin();f.deliver();XCTAssertEqual(f.waits,[1200,600]);f.deliver()
  for _ in 0..<10 {f.deliver()}
  XCTAssertEqual(f.waits,[1200,600]+Array(repeating:50,count:10));XCTAssertEqual(f.guardReleases,[true]);XCTAssertEqual(f.checks,["mergePulledTiles_stuck_unlocked_tiles"])
 }
 func testZeroActiveUses500ActualCoreFallbackThen100WithoutDuplicateArrival(){
  let f=Fixture();f.snapshot = .init(lockedActiveCount:0,stillSpawningCount:0,activeCount:0,playableLockedCount:0,resolution:.continueWithoutCheck(clearLastMerge:false));f.begin();f.deliver();f.deliver();f.deliver()
  XCTAssertEqual(f.waits,[1200,500,100]);XCTAssertEqual(f.fallbackCalls,1);XCTAssertEqual(f.guardReleases,[true]);XCTAssertEqual(f.outer,[.completed])
 }
 func testNewAcceptedContactSupersedesInspectionButStillReleasesOwnedGuard(){
  let f=Fixture();f.begin();f.revision+=1;f.deliver();XCTAssertEqual(f.observations,0);XCTAssertEqual(f.guardReleases,[true]);XCTAssertEqual(f.outer,[.superseded]);XCTAssertTrue(f.checks.isEmpty)
 }
 func testOldLifecycleNeverReleasesNewGuardOrPublishesOuterFallback(){
  let f=Fixture();f.begin();f.owned=false;f.deliver();XCTAssertEqual(f.guardReleases,[false]);XCTAssertEqual(f.outer,[]);XCTAssertTrue(f.checks.isEmpty);XCTAssertEqual(f.observations,0)
 }
 func testAcquisitionAndObservationReentrySealBeforeNewRootsOrPublication(){
  let f=Fixture();f.onAcquire={f.owner.retire()};_=f.fifo.performTask(.inputTask){XCTAssertFalse(f.owner.begin())};XCTAssertEqual(f.guardReleases,[true]);XCTAssertTrue(f.waits.isEmpty)
  let c=Fixture();c.onObserve={c.owner.retire()};c.begin();c.deliver();XCTAssertEqual(c.guardReleases,[true]);XCTAssertEqual(c.outer,[.cancelled]);XCTAssertTrue(c.checks.isEmpty);XCTAssertFalse(c.owner.active)
 }
 func testExistingAppWallTimeoutProgressesIndependentOfGlobalAnimationPause()async {
  let f=Fixture(),timeouts=NativeSourceAppTimeoutOwner(),tasks=NativeSourceMicrotaskAdapters(fifo:f.fifo)
  timeouts.sourceMicrotaskTasks=tasks
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:Date().timeIntervalSince1970*1000)
  XCTAssertTrue(service.setSourceGlobalPaused(true))
  let ended=expectation(description:"actual wall continuation")
  var guarded=true
  var coroutine:NativeSourceMagnetCoroutineOwner?=NativeSourceMagnetCoroutineOwner(hooks:.init(ownsLifecycle:{true},revision:{1},beginGuard:{return {_ in guarded=false}},schedule:{ms,elapsed,cancel in let r=timeouts.schedule(sourceID:"actual-magnet-1200",generation:1,delayMilliseconds:ms,elapsed:elapsed,cancelled:cancel);return {_=timeouts.cancel(r)}},enqueue:{f.scope.enqueue($0)},simulate:{false},observe:{f.snapshot},fallback:{_,_ in false},readFXStatus:{false},clearCapturedLastMerge:{},updateGhostVisibility:{},centralCheck:{_ in XCTAssertFalse(guarded)},helperFinally:{_,_ in},handlerComplete:{_,outcome in XCTAssertEqual(outcome,.completed);ended.fulfill()}))
  _=f.fifo.performTask(.inputTask){XCTAssertTrue(coroutine!.begin());coroutine!.boardCommitted(spawnCount:2,shouldRunPostCheck:false,publish:{})}
  XCTAssertEqual(timeouts.pendingReceipts.map(\.sourceID),["actual-magnet-1200"])
  await fulfillment(of:[ended],timeout:2);XCTAssertEqual(timeouts.pendingCount,0);coroutine=nil;service.dispose()
 }
}

@MainActor final class NativeSourceMagnetGuardAdapterTests:XCTestCase {
 func testLateGuardAcquisitionAfterDateReentryRetiresCaptureWithoutPublication(){
  let fifo=NativeSourceMicrotaskFIFO(),timeouts=NativeSourceAppTimeoutOwner(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
  // Guard-only test: no Promise delivery occurs; exact task identity is bound.
  timeouts.sourceMicrotaskTasks=tasks
  var onDate:(()->Void)?
  let registry=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{onDate?();return 0}),scope=registry.beginScope(epoch:1);scope.bindParentCurrent{true}
  let adapter=NativeSourceMagnetGuardAdapter(scope:scope,timeouts:timeouts,tasks:tasks,enqueue:{_ in XCTFail("no rejected-admission jobs");return false})
  XCTAssertTrue(adapter.mount());onDate={adapter.retire()}
  XCTAssertNil(adapter.beginGuard());onDate=nil
  XCTAssertEqual(scope.snapshot(isWild:false)?.endgameGuard.count,0);XCTAssertEqual(timeouts.pendingCount,0);XCTAssertTrue(scope.missing([.magnetGuardBeginFinally]).contains("magnetGuardBeginFinally"));fifo.dispose()
 }
 func testAdapterTeardownAfterSkippedLiteralFinallyPreservesNewCGuard(){
  let registry=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{0}),a=registry.beginScope(epoch:1);a.bindParentCurrent{true}
  let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo),timeouts=NativeSourceAppTimeoutOwner();timeouts.sourceMicrotaskTasks=tasks
  let adapter=NativeSourceMagnetGuardAdapter(scope:a,timeouts:timeouts,tasks:tasks,enqueue:{_ in false});XCTAssertTrue(adapter.mount());let old=adapter.beginGuard()!
  let c=registry.beginScope(epoch:2);c.bindParentCurrent{true};_=c.mountCapturedEndpoint(.magnetGuardBeginFinally);let next=c.beginMagnetGuard()!
  old(false);XCTAssertEqual(c.snapshot(isWild:false)?.endgameGuard.count,2)
  adapter.retire();XCTAssertEqual(c.snapshot(isWild:false)?.endgameGuard.count,1);old(true);adapter.retire();XCTAssertEqual(c.snapshot(isWild:false)?.endgameGuard.count,1)
  XCTAssertTrue(c.releaseMagnetGuard(next,ownsLifecycle:true));XCTAssertEqual(c.snapshot(isWild:false)?.endgameGuard.count,0);fifo.dispose()
 }
}
