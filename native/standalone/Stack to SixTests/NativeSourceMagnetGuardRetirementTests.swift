import XCTest
@testable import Stack_to_Six
@MainActor final class NativeSourceMagnetGuardRetirementTests:XCTestCase {
 func testDestructiveOldScopeRetiresOnlyCapturedGuardAndPreservesNewC(){
  let session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{0})
  let a=session.beginScope(epoch:1);a.bindParentCurrent{true};let ae=a.mountCapturedEndpoint(.magnetGuardBeginFinally)!;let old=a.beginMagnetGuard()!
  let c=session.beginScope(epoch:2);c.bindParentCurrent{true};_=c.mountCapturedEndpoint(.magnetGuardBeginFinally);let next=c.beginMagnetGuard()!
  XCTAssertEqual(c.snapshot(isWild:false)?.endgameGuard.count,2)
  // Literal stale helper finally skips release. Teardown has a separate KING
  // receipt; no global reset and no invented source ownsLifecycle success.
  XCTAssertFalse(a.releaseMagnetGuard(old,ownsLifecycle:false));a.dispose()
  XCTAssertEqual(c.snapshot(isWild:false)?.endgameGuard.count,1);XCTAssertEqual(c.snapshot(isWild:false)?.endgameGuard.sources,["mergePulledTilesIntoMerge6"])
  XCTAssertFalse(a.releaseMagnetGuard(old,ownsLifecycle:true));XCTAssertFalse(a.unmountCapturedEndpoint(ae));a.dispose()
  XCTAssertEqual(c.snapshot(isWild:false)?.endgameGuard.count,1);XCTAssertTrue(c.releaseMagnetGuard(next,ownsLifecycle:true));XCTAssertEqual(c.snapshot(isWild:false)?.endgameGuard.count,0)
 }
 func testLiveHelperFinallyRetiresOnceAndScopeTeardownCannotDoubleDebitOtherLease(){
  let session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{0}),s=session.beginScope(epoch:1);s.bindParentCurrent{true};_=s.mountCapturedEndpoint(.magnetGuardBeginFinally)
  let first=s.beginMagnetGuard()!,second=s.beginMagnetGuard()!;XCTAssertTrue(s.releaseMagnetGuard(first,ownsLifecycle:true));XCTAssertFalse(s.releaseMagnetGuard(first,ownsLifecycle:true))
  XCTAssertEqual(s.snapshot(isWild:false)?.endgameGuard.count,1);s.dispose();XCTAssertFalse(s.releaseMagnetGuard(second,ownsLifecycle:true))
  let next=session.beginScope(epoch:2);next.bindParentCurrent{true};XCTAssertEqual(next.snapshot(isWild:false)?.endgameGuard.count,0)
 }
}
