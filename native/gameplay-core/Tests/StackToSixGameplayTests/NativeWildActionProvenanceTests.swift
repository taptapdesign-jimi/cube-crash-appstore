import XCTest
@testable import StackToSixGameplay
nonisolated final class NativeWildActionProvenanceTests:XCTestCase {
 private func engine(_ kind:NativeWildArchetype,denyAll:Bool)->NativeGameplayEngine {
  var tiles=[NativeTile(id:"w",cell:.init(column:0,row:0),value:6,archetype:kind),NativeTile(id:"d",cell:.init(column:1,row:0),value:5),NativeTile(id:"other",cell:.init(column:4,row:8),value:2)]
  tiles += (0..<10).map{NativeTile(id:"locked\($0)",cell:.init(column:$0%5,row:1+$0/5),value:0,locked:true)}
  let e=NativeGameplayEngine(state:.init(tiles:tiles,board:10),recordedRandomChoices:Array(repeating:0.2,count:1000));e.stagedDirectWildMoves=true;e.stagedDirectWildAssignments=true
  if denyAll {e.wildSpawnPermitAdmission={_ in false}}
  XCTAssertTrue(e.beginDrag(tileID:"w"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
  return e
 }
 func testMarkerProvenanceExistsAtPromisePreparationBeforeLogicalAssignmentAndBounce()throws {
  let e=engine(.star,denyAll:false),p=try XCTUnwrap(e.pendingDirectWild);XCTAssertTrue(e.commitDirectWildGameplay(transactionID:p.id).accepted)
  let arrival=try XCTUnwrap(e.pendingWildSpawnArrivals.first);XCTAssertTrue(e.finishWildSpawnArrival(transactionID:p.id,generation:p.generation,arrivalID:arrival.id).accepted)
  let a=try XCTUnwrap(e.pendingWildSpawnActions.first);XCTAssertEqual(a.kind,.locked);XCTAssertTrue(a.sourceLevelFlow)
  XCTAssertEqual(e.state.tile(at:try XCTUnwrap(a.cell))?.value,0);XCTAssertTrue(e.state.tile(at:try XCTUnwrap(a.cell))?.locked==true)
  XCTAssertFalse(e.pendingWildSpawnPresentations.contains{$0.tileID==a.tileID})
  XCTAssertTrue(e.commitWildSpawnAction(transactionID:p.id,generation:p.generation,actionID:a.id).accepted)
  XCTAssertEqual(e.pendingWildSpawnPresentations.first{$0.tileID==a.tileID}?.sourceLevelFlowReinforcement,a.sourceLevelFlow)
 }
 func testRejectedOriginalContinuationDistinguishesLevelFlowFromManualForceBeforeEveryTimer()throws {
  var level=0,manual=0
  for kind in [NativeWildArchetype.star,.juice] {
   let e=engine(kind,denyAll:true),p=try XCTUnwrap(e.pendingDirectWild);XCTAssertTrue(e.commitDirectWildGameplay(transactionID:p.id).accepted)
   for _ in 0..<100 {
    guard let a=e.pendingWildSpawnActions.first else{break}
    if a.kind == .locked {if a.sourceLevelFlow {level+=1}else{manual+=1}}else{XCTAssertFalse(a.sourceLevelFlow)}
    XCTAssertTrue(e.commitWildSpawnAction(transactionID:p.id,generation:p.generation,actionID:a.id).accepted)
   }
   XCTAssertTrue(e.pendingWildSpawnActions.isEmpty)
  }
  XCTAssertGreaterThan(level,0);XCTAssertGreaterThan(manual,0)
 }
}
