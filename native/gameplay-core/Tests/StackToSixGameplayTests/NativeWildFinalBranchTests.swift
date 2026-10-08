import XCTest
@testable import StackToSixGameplay
final class NativeWildFinalBranchTests:XCTestCase {
 struct Row:Decodable {let archetype,mode:String;let remaining,branchRandomDraws:Int;let ownerReleasedBeforeClean,spawnPermitRejected:Bool}
 func testExecutedOriginalFinalBranchStaysOutsideNewSpawnGraphAndBackgroundSettlesOnlyCapturedEarnedStars()throws {
  let rows=try JSONDecoder().decode([Row].self,from:Data(#"[{"archetype":"star","mode":"journey","remaining":0,"branchRandomDraws":0,"ownerReleasedBeforeClean":true,"spawnPermitRejected":true},{"archetype":"star","mode":"arcade","remaining":0,"branchRandomDraws":0,"ownerReleasedBeforeClean":true,"spawnPermitRejected":true},{"archetype":"juice","mode":"journey","remaining":0,"branchRandomDraws":0,"ownerReleasedBeforeClean":true,"spawnPermitRejected":true},{"archetype":"juice","mode":"arcade","remaining":0,"branchRandomDraws":0,"ownerReleasedBeforeClean":true,"spawnPermitRejected":true}]"#.utf8));XCTAssertEqual(rows.count,4)
  for row in rows {
   let archetype:NativeWildArchetype=row.archetype=="star" ? .star:.juice
   let initial=NativeBoardState(tiles:[NativeTile(id:"a",cell:.init(column:0,row:0),value:6,starOrbitCount:3,archetype:archetype),NativeTile(id:"b",cell:.init(column:1,row:0),value:5)],mode:row.mode=="arcade" ? .arcade:.journey,board:10,score:37,rngState:12345)
   let e=NativeGameplayEngine(state:initial,recordedRandomChoices:archetype == .juice ? [0.2]:[])
   e.stagedDirectWildMoves=true;e.stagedDirectWildAssignments=true
   XCTAssertTrue(e.beginDrag(tileID:"a"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
   let plan=try XCTUnwrap(e.pendingDirectWild);XCTAssertTrue(plan.isFinal);XCTAssertEqual(e.state,initial)
   let committed=e.commitDirectWildGameplay(transactionID:plan.id);XCTAssertTrue(committed.accepted)
   XCTAssertFalse(committed.events.contains{$0.kind == .spawned});XCTAssertEqual(e.state.tiles.count,row.remaining)
   XCTAssertEqual(row.branchRandomDraws,0);XCTAssertEqual(e.state.rngState,initial.rngState)
   XCTAssertTrue(row.ownerReleasedBeforeClean);XCTAssertTrue(row.spawnPermitRejected)
   XCTAssertTrue(e.pendingWildSpawnActions.isEmpty);XCTAssertTrue(e.pendingWildSpawnArrivals.isEmpty);XCTAssertTrue(e.pendingWildSpawnPresentations.isEmpty);XCTAssertTrue(e.pendingWildLockedBonusPresentations.isEmpty)
   let earned=e.pendingHUDStars.count;XCTAssertEqual(earned,archetype == .star ? 3:1)
   XCTAssertEqual(e.state.moves,49);XCTAssertEqual(e.state.score,49)
   e.cancelForBackground();let settled=e.state
   XCTAssertNil(e.pendingDirectWild);XCTAssertTrue(e.pendingHUDStars.isEmpty);XCTAssertEqual(settled.score,49+earned*100)
   XCTAssertEqual(settled.moves,49);XCTAssertEqual(settled.terminal?.kind,.complete)
   XCTAssertFalse(e.commitDirectWildGameplay(transactionID:plan.id).accepted);XCTAssertFalse(e.releaseDirectWildPresentation(transactionID:plan.id,generation:plan.generation).accepted)
   e.cancelForBackground();XCTAssertEqual(e.state,settled)
   e.restart(state:initial);let fresh=e.state
   XCTAssertFalse(e.commitDirectWildGameplay(transactionID:plan.id).accepted);XCTAssertEqual(e.state,fresh)
  }
 }
}
