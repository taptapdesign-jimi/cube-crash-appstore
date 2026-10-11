import XCTest
@testable import StackToSixGameplay

nonisolated final class NativeSourceSixParentVisibilityTests:XCTestCase {
 private func engine(sourceParent:Bool,final:Bool=true,hook:Bool=true)->NativeGameplayEngine {
  var dst=NativeTile(id:"dst",cell:.init(column:1,row:0),value:4);dst.alpha=0.8
  let e=NativeGameplayEngine(state:.init(tiles:[.init(id:"src",cell:.init(column:0,row:0),value:2),dst]+(final ? []:[.init(id:"other",cell:.init(column:4,row:8),value:3)])),recordedRandomChoices:Array(repeating:0.5,count:40))
  e.stagedOrdinaryMoves=true;e.stagedOrdinaryAssignments=true
  if hook {e.sourceMergeSixAutoCenterHook=NativeSourceMergeSixAutoCenterHook(usesSourceDestinationParentState:sourceParent,prepare:{_,_,_ in .init(isCurrent:{true},rejected:{})})}
  return e
 }
 private func stage(_ e:NativeGameplayEngine)throws->NativeOrdinaryMovePlan {
  XCTAssertTrue(e.beginDrag(tileID:"src"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
  return try XCTUnwrap(e.pendingOrdinarySix)
 }
 func testActualSourceStagePreservesParentVisibilityAndSetValueResetsAlphaWithoutAccounting()throws {
  for final in [false,true] {
   let e=engine(sourceParent:true,final:final),before=e.state,plan=try stage(e),dst=try XCTUnwrap(e.state.tiles.first{$0.id=="dst"})
   XCTAssertTrue(dst.visible);XCTAssertEqual(dst.alpha,1);XCTAssertEqual(dst.value,6);XCTAssertEqual(dst.stackDepth,final ? 1:2)
   XCTAssertEqual(e.state.moves,before.moves);XCTAssertEqual(e.state.score,before.score);XCTAssertEqual(e.state.rngState,before.rngState)
   XCTAssertEqual(plan.destination.alpha,0.8);XCTAssertTrue(plan.destination.visible);XCTAssertTrue(e.hasUnsavableSourceGameplayState);XCTAssertEqual(e.resolve().kind,.wait)
  }
 }
 func testDefaultRawAndPreviouslyInstalledHookRetainExistingWholeNodeProjection()throws {
  for hook in [false,true] {for final in [false,true] {
   let e=engine(sourceParent:false,final:final,hook:hook);_=try stage(e)
   let dst=try XCTUnwrap(e.state.tiles.first{$0.id=="dst"});XCTAssertEqual(dst.visible,!final);XCTAssertEqual(dst.alpha,0.8)
  }}
 }
 func testDestructiveInterruptionDoesNotTurnParentStateIntoArrivalOrAward()throws {
  let e=engine(sourceParent:true,final:false),p=try stage(e),before=e.state
  XCTAssertTrue(e.cancelSourceMergeSixAbsorb(receiptID:p.id,generation:p.generation).accepted)
  XCTAssertEqual(e.state.tiles.map(\.id),["other"]);XCTAssertEqual(e.state.moves,before.moves);XCTAssertEqual(e.state.score,before.score);XCTAssertEqual(e.state.rngState,before.rngState)
  XCTAssertFalse(e.commitOrdinarySix(receiptID:p.id,generation:p.generation).accepted)
 }
 func testSourceOptionCannotBypassCapturedPreparationRevalidation()throws {
  let e=engine(sourceParent:false),before=e.state
  e.sourceMergeSixAutoCenterHook=NativeSourceMergeSixAutoCenterHook(usesSourceDestinationParentState:true,prepare:{_,_,_ in .init(isCurrent:{false},rejected:{})})
  XCTAssertTrue(e.beginDrag(tileID:"src"));XCTAssertFalse(e.drop(target:.init(column:1,row:0)).accepted);XCTAssertEqual(e.state,before);XCTAssertNil(e.pendingOrdinarySix)
 }
}
