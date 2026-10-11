import XCTest
@testable import StackToSixGameplay
final class NativeWildBusySourceTests:XCTestCase {
 struct Row:Decodable {let archetype:String;let final:Bool;let removed,remaining:[String];let recoveryDelay:Double}
 func testOriginalMain80BusyAbortRetiresOnlyCapturedIDsWithoutDebitAndOwnsRecoveryOnce()throws {
  let data=Data(#"[{"archetype":"star","final":false,"remaining":["other"],"removed":["b","a"],"recoveryDelay":0.12},{"archetype":"star","final":true,"remaining":["other"],"removed":["b","a"],"recoveryDelay":0.12},{"archetype":"juice","final":false,"remaining":["other"],"removed":["b","a"],"recoveryDelay":0.12},{"archetype":"juice","final":true,"remaining":["other"],"removed":["b","a"],"recoveryDelay":0.12}]"#.utf8)
  let rows=try JSONDecoder().decode([Row].self,from:data);XCTAssertEqual(rows.count,4)
  for row in rows {
   let archetype:NativeWildArchetype=row.archetype=="star" ? .star:.juice
   let other=NativeTile(id:"other",cell:.init(column:2,row:0),value:row.final ? 0:2,locked:row.final)
   let initial=NativeBoardState(tiles:[NativeTile(id:"a",cell:.init(column:0,row:0),value:6,archetype:archetype),NativeTile(id:"b",cell:.init(column:1,row:0),value:5),other],board:10,score:37,combo:2,rngState:12345)
   let e=NativeGameplayEngine(state:initial);e.stagedDirectWildMoves=true;e.stagedDirectWildAssignments=true
   XCTAssertTrue(e.beginDrag(tileID:"a"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
   let plan=try XCTUnwrap(e.pendingDirectWild);XCTAssertEqual(plan.isFinal,row.final)
   var flags=e.flags;flags.busyEnding=true;e.setRuntimeFlags(flags)
   let result=e.commitDirectWildGameplay(transactionID:plan.id);XCTAssertTrue(result.accepted)
   XCTAssertEqual(result.events.filter{$0.kind == .removed}.flatMap(\.tileIDs),row.removed)
   XCTAssertEqual(e.state.tiles.map(\.id),row.remaining);XCTAssertEqual(e.state.tiles,[other])
   XCTAssertEqual(e.state.moves,initial.moves);XCTAssertEqual(e.state.score,37);XCTAssertEqual(e.state.combo,2);XCTAssertEqual(e.state.rngState,12345)
   XCTAssertTrue(e.pendingHUDStars.isEmpty);XCTAssertTrue(e.pendingMeterRewards.isEmpty);XCTAssertTrue(e.pendingWildSpawnActions.isEmpty);XCTAssertNil(e.pendingDirectWild)
   let check=try XCTUnwrap(e.pendingWildRecoveryChecks.first);XCTAssertEqual(Double(check.delayMilliseconds)/1000,row.recoveryDelay)
   XCTAssertFalse(e.commitDirectWildGameplay(transactionID:plan.id).accepted)
   XCTAssertFalse(e.releaseDirectWildPresentation(transactionID:plan.id,generation:plan.generation).accepted)
   XCTAssertTrue(e.commitWildRecoveryCheck(receiptID:check.id,generation:check.generation).accepted)
   XCTAssertTrue(e.flags.busyEnding);XCTAssertFalse(e.commitWildRecoveryCheck(receiptID:check.id,generation:check.generation).accepted)
   e.restart(state:initial);XCTAssertFalse(e.commitWildRecoveryCheck(receiptID:check.id,generation:check.generation).accepted)
  }
 }
}
