import XCTest
@testable import StackToSixGameplay
final class NativeWildRejectedRNGTests:XCTestCase {
 struct Row:Decodable {
  struct Event:Decodable {let kind:String;let at,c,r:Int;let value,direction:Int?}
  struct Tile:Decodable {let c,r,value:Int;let locked:Bool}
  let mode,archetype:String;let lockedCount,orbitCount,board,seed,rejectPermits:Int;let trace:[Event];let tiles:[Tile]
 }
 func testRejectedPrimaryFacesAndSuccessfulHardBounceConsumeOriginalConditionalRandomStream()throws {
  let rows=try JSONDecoder().decode([Row].self,from:NativeWildRejectedRNGOracle.data);XCTAssertEqual(rows.count,48)
  for row in rows {
   let archetype:NativeWildArchetype=row.archetype=="star" ? .star:.juice
   var tiles=[NativeTile(id:"a",cell:.init(column:0,row:0),value:6,starOrbitCount:row.orbitCount,archetype:archetype),NativeTile(id:"b",cell:.init(column:1,row:0),value:5),NativeTile(id:"survivor",cell:.init(column:4,row:8),value:2)]
   if row.lockedCount>0 {tiles.append(NativeTile(id:"locked0",cell:.init(column:0,row:1),value:0,locked:true,alpha:0.2))}
   let choices=(0..<1000).map{Double(($0*37+row.seed)%101)/101}
   let e=NativeGameplayEngine(state:NativeBoardState(tiles:tiles,board:row.board),recordedRandomChoices:choices)
   e.stagedDirectWildMoves=true;e.stagedDirectWildAssignments=true
   var rejected=0
   e.wildSpawnPermitAdmission={purpose in if (row.rejectPermits==99 || purpose == .primary || purpose == .hardFallback) && rejected<row.rejectPermits {rejected+=1;return false};return true}
   XCTAssertTrue(e.beginDrag(tileID:"a"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
   let plan=try XCTUnwrap(e.pendingDirectWild),first=e.commitDirectWildGameplay(transactionID:plan.id)
   XCTAssertTrue(first.accepted)
   var now=80,sequence=0,assignments:[String]=[],timers:[(at:Int,id:Int,fn:()->Void)]=[],scheduled:Set<String>=[]
   func capture(_ result:NativeMoveResult){for event in result.events where event.kind == .spawned && (event.value ?? 0)>0 {for id in event.tileIDs {if let tile=e.state.tiles.first(where:{$0.id==id}) {assignments.append("\(now):\(tile.cell.column),\(tile.cell.row):\(tile.value)")}}}}
   func schedule(_ delay:Int,_ fn:@escaping()->Void){sequence+=1;timers.append((now+delay,sequence,fn))}
   func pump(){
    for action in e.pendingWildSpawnActions where scheduled.insert(action.id).inserted {schedule(action.delayMilliseconds){let result=e.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:action.id);XCTAssertTrue(result.accepted);capture(result);pump()}}
    for arrival in e.pendingWildSpawnArrivals where scheduled.insert("arrival:"+arrival.id).inserted {schedule(560){XCTAssertTrue(e.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id).accepted);pump()}}
   }
   capture(first);pump();var callbacks=0
   while !timers.isEmpty && callbacks<100 {timers.sort{$0.at != $1.at ? $0.at<$1.at:$0.id<$1.id};let t=timers.removeFirst();now=t.at;t.fn();callbacks+=1}
   let tag="\(row.mode)/\(row.archetype)/\(row.orbitCount)/\(row.board)/\(row.seed)/\(row.rejectPermits)"
   XCTAssertLessThan(callbacks,100)
   XCTAssertEqual(assignments,row.trace.filter{$0.kind=="assignment"}.map{"\($0.at):\($0.c),\($0.r):\($0.value!)"},tag)
   XCTAssertEqual(e.state.tiles.map{"\($0.cell.column),\($0.cell.row):\($0.value):\($0.locked)"}.sorted(),row.tiles.map{"\($0.c),\($0.r):\($0.value):\($0.locked)"}.sorted(),tag)
   XCTAssertEqual(e.pendingWildSpawnPresentations.map(\.direction),row.trace.filter{$0.kind=="bounce-direction"}.map{$0.direction!},tag)
  }
 }
}
