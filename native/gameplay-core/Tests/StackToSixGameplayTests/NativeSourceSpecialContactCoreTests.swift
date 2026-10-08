import XCTest
@testable import StackToSixGameplay
final class NativeSourceSpecialContactCoreTests:XCTestCase {
 private func fixture(_ kind:NativeWildArchetype = .star)->NativeGameplayEngine {
  let e=NativeGameplayEngine(state:.init(tiles:[.init(id:"w",cell:.init(column:0,row:0),value:6,archetype:kind),.init(id:"a",cell:.init(column:1,row:0),value:2),.init(id:"b",cell:.init(column:2,row:0),value:1)]),recordedRandomChoices:Array(repeating:0,count:80))
  e.stagedDirectWildMoves=true;e.stagedTntActivation=true;e.specialPresentationAdmitted={_,_ in true};return e
 }
 func testAllFourFamiliesClaimAfterLegalityBeforePlanScoreOrRNG() {
  for kind in NativeWildArchetype.allCases {
   let e=fixture(kind),before=e.state;var calls=0
   e.sourceSpecialContactHook=NativeSourceSpecialContactHook{src,dst,family in calls+=1;XCTAssertEqual(src.id,"w");XCTAssertEqual(dst.id,"a");XCTAssertEqual(family,kind);XCTAssertEqual(e.state,before);XCTAssertNil(e.pendingSpecial);XCTAssertNil(e.pendingDirectWild);return .init(isCurrent:{true},rejected:{XCTFail("accepted owner")})}
   XCTAssertTrue(e.beginDrag(tileID:"w"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted);XCTAssertEqual(calls,1)
  }
 }
 func testIllegalContactAndMissingPresentationNeverAllocateSourceClaim() {
  let e=fixture();var calls=0;e.sourceSpecialContactHook=NativeSourceSpecialContactHook{_,_,_ in calls+=1;return nil}
  XCTAssertTrue(e.beginDrag(tileID:"w"));XCTAssertFalse(e.drop(target:.init(column:4,row:8)).accepted);XCTAssertEqual(calls,0)
  e.specialPresentationAdmitted={_,_ in false};XCTAssertTrue(e.beginDrag(tileID:"w"));XCTAssertFalse(e.drop(target:.init(column:1,row:0)).accepted);XCTAssertEqual(calls,0)
 }
 func testClaimRefusalLeavesExactSequenceRNGCountersAndBoardUnchanged() {
  let e=fixture(.tnt),before=e.state;e.sourceSpecialContactHook=NativeSourceSpecialContactHook{_,_,_ in nil}
  XCTAssertTrue(e.beginDrag(tileID:"w"));let result=e.drop(target:.init(column:1,row:0));XCTAssertFalse(result.accepted);XCTAssertEqual(e.state,before);XCTAssertNil(e.pendingSpecial)
  e.sourceSpecialContactHook=nil;XCTAssertTrue(e.beginDrag(tileID:"w"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted);XCTAssertEqual(e.pendingSpecial?.id,"native-special:1:1")
 }
 func testReentrantBusyOwnerRejectsBeforeAllocationAndRollsBackOnlyCapturedClaim() {
  let e=fixture();var rejected=0;e.sourceSpecialContactHook=NativeSourceSpecialContactHook{_,_,_ in var flags=e.flags;flags.busyEnding=true;e.setRuntimeFlags(flags);return .init(isCurrent:{true},rejected:{rejected+=1})}
  let before=e.state;XCTAssertTrue(e.beginDrag(tileID:"w"));XCTAssertFalse(e.drop(target:.init(column:1,row:0)).accepted);XCTAssertEqual(e.state,before);XCTAssertEqual(rejected,1);XCTAssertNil(e.pendingDirectWild)
 }
 func testSynchronousHookReplacementSurvivesOldRejection() {
  let e=fixture();let replacement=NativeSourceSpecialContactHook{_,_,_ in nil};var rejected=0
  e.sourceSpecialContactHook=NativeSourceSpecialContactHook{_,_,_ in e.sourceSpecialContactHook=replacement;return .init(isCurrent:{true},rejected:{rejected+=1})}
  XCTAssertTrue(e.beginDrag(tileID:"w"));XCTAssertFalse(e.drop(target:.init(column:1,row:0)).accepted);XCTAssertTrue(e.sourceSpecialContactHook === replacement);XCTAssertEqual(rejected,1);XCTAssertNil(e.pendingDirectWild)
 }
}
