import XCTest
@testable import StackToSixGameplay
final class NativeSourceMagnetPullSelectionTests:XCTestCase {
 private func engine()->NativeGameplayEngine {
  let e=NativeGameplayEngine(state:.init(tiles:[.init(id:"m",cell:.init(column:0,row:0),value:6,archetype:.magnet),.init(id:"d",cell:.init(column:1,row:0),value:2),.init(id:"near-grid",cell:.init(column:2,row:0),value:1),.init(id:"far-grid",cell:.init(column:4,row:8),value:3),.init(id:"tie-a",cell:.init(column:0,row:2),value:2),.init(id:"tie-b",cell:.init(column:2,row:2),value:2),.init(id:"fifth",cell:.init(column:4,row:6),value:1)]),recordedRandomChoices:Array(repeating:0,count:300))
  e.sourceMagnetMain80Enabled=true;return e
 }
 private func drop(_ e:NativeGameplayEngine)->NativeMoveResult {XCTAssertTrue(e.beginDrag(tileID:"m"));return e.drop(target:.init(column:1,row:0))}
 func testPreparedPhysicalOrderOverridesGridDistanceWithStableTies(){
  let e=engine();var claims=0,reads=0
  e.sourceSpecialContactHook = .init{_,_,_ in claims+=1;return .init(isCurrent:{true},rejected:{XCTFail("accepted")})}
  e.sourceMagnetPullSelection = .init{state,src,dst,candidates in
   reads+=1;XCTAssertEqual(claims,1);XCTAssertNil(e.pendingSpecial);XCTAssertEqual(state,e.state);XCTAssertEqual(src.id,"m");XCTAssertEqual(dst.id,"d")
   XCTAssertEqual(candidates.map(\.id),["near-grid","far-grid","tie-a","tie-b","fifth"])
   return ["far-grid","tie-b","tie-a","near-grid","fifth"]
  }
  XCTAssertTrue(drop(e).accepted);XCTAssertEqual(reads,1);XCTAssertEqual(e.pendingSpecial?.targets.map(\.id),["far-grid","tie-b","tie-a","near-grid"])
 }
 func testIncompleteDuplicateOrUnownedRosterRefusesBeforePlanAndReleasesOnlyOwnClaim(){
  for ids in [["near-grid"],["near-grid","far-grid","tie-a","tie-a","fifth"],["m","far-grid","tie-a","tie-b","fifth"]] {
   let e=engine(),before=e.state;var releases=0
   e.sourceSpecialContactHook = .init{_,_,_ in .init(isCurrent:{true},rejected:{releases+=1})}
   e.sourceMagnetPullSelection = .init{_,_,_,_ in ids}
   XCTAssertFalse(drop(e).accepted);XCTAssertEqual(e.state,before);XCTAssertNil(e.pendingSpecial);XCTAssertEqual(releases,1)
  }
 }
 func testCaptureReentryCannotPublishPlanOrConsumeRngAndReplacementSurvives(){
  let e=engine(),before=e.state;var releases=0
  let c=NativeSourceMagnetPullSelectionOwner{_,_,_,_ in nil}
  e.sourceSpecialContactHook = .init{_,_,_ in .init(isCurrent:{true},rejected:{releases+=1})}
  e.sourceMagnetPullSelection = .init{_,_,_,candidates in e.sourceMagnetPullSelection=c;return candidates.map(\.id)}
  XCTAssertFalse(drop(e).accepted);XCTAssertEqual(e.state,before);XCTAssertNil(e.pendingSpecial);XCTAssertTrue(e.sourceMagnetPullSelection === c);XCTAssertEqual(releases,1)
 }
 func testExternalCurrentReentryAfterCaptureIsRevalidated(){
  let e=engine();var reads=0,releases=0
  e.sourceSpecialContactHook = .init{_,_,_ in .init(isCurrent:{
   reads+=1;if reads==2{var f=e.flags;f.busyEnding=true;e.setRuntimeFlags(f)};return true
  },rejected:{releases+=1})}
  e.sourceMagnetPullSelection = .init{_,_,_,candidates in candidates.map(\.id)}
  XCTAssertFalse(drop(e).accepted);XCTAssertEqual(reads,2);XCTAssertEqual(releases,1);XCTAssertNil(e.pendingSpecial)
 }
 func testDefaultNilKeepsOriginalRawGridOrdering(){
  let e=engine();XCTAssertNil(e.sourceMagnetPullSelection);XCTAssertTrue(drop(e).accepted)
  XCTAssertEqual(e.pendingSpecial?.targets.first?.id,"near-grid")
 }
}
