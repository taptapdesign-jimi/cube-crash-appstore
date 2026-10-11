import XCTest
@testable import Stack_to_Six
nonisolated final class NativeSpecialInputRetirementTests:XCTestCase {
 @MainActor func testExpiredAReleasingAfterCClaimDropsOnlyOldCaptureAndKeepsCLock()throws {
  var now=0.0;let session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{now})
  let a=session.beginScope(epoch:1);a.bindParentCurrent{true};a.endpointMounted(.specialContactCommitRelease)
  let old=try XCTUnwrap(a.claimSpecial(kind:.star));XCTAssertEqual(session.retainedSpecialInputCaptureCount,1)
  now=15001
  let c=session.beginScope(epoch:2);c.bindParentCurrent{true};c.endpointMounted(.specialContactCommitRelease)
  let fresh=try XCTUnwrap(c.claimSpecial(kind:.tnt));XCTAssertEqual(session.retainedSpecialInputCaptureCount,2)
  XCTAssertFalse(a.releaseSpecial(token:old));XCTAssertEqual(session.retainedSpecialInputCaptureCount,1)
  XCTAssertEqual(c.snapshot(isWild:false)?.special?.token,fresh);XCTAssertEqual(c.snapshot(isWild:false)?.inputReasons,["special-transaction"])
  XCTAssertFalse(a.releaseSpecial(token:old));XCTAssertEqual(session.retainedSpecialInputCaptureCount,1)
  XCTAssertTrue(c.releaseSpecial(token:fresh));XCTAssertEqual(session.retainedSpecialInputCaptureCount,0);XCTAssertEqual(c.snapshot(isWild:true)?.inputReasons,[])
  session.dispose()
 }
 @MainActor func testVisualTailReplacementPreservesExactCInputIdentityAndRefcount()throws {
  var now=0.0;let session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{now})
  let a=session.beginScope(epoch:1);a.bindParentCurrent{true};a.endpointMounted(.specialContactCommitRelease)
  let old=try XCTUnwrap(a.claimSpecial(kind:.tnt));XCTAssertTrue(a.commitSpecial(token:old,revision:1));XCTAssertEqual(a.snapshot(isWild:false)?.inputReasons,[])
  now=15001
  let c=session.beginScope(epoch:2);c.bindParentCurrent{true};c.endpointMounted(.specialContactCommitRelease)
  let fresh=try XCTUnwrap(c.claimSpecial(kind:.juice));XCTAssertEqual(session.retainedSpecialInputCaptureCount,2)
  XCTAssertFalse(a.releaseSpecial(token:old));XCTAssertEqual(session.retainedSpecialInputCaptureCount,1);XCTAssertEqual(c.snapshot(isWild:false)?.inputReasons,["special-transaction"])
  XCTAssertEqual(c.snapshot(isWild:true)?.special?.token,fresh)
  XCTAssertTrue(c.releaseSpecial(token:fresh));XCTAssertEqual(session.retainedSpecialInputCaptureCount,0)
  XCTAssertFalse(c.releaseSpecial(token:fresh));XCTAssertEqual(session.retainedSpecialInputCaptureCount,0);session.dispose()
 }
}
