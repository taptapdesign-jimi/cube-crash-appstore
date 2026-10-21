import XCTest
@testable import StackToSixGameplay
nonisolated final class NativeMeterHiddenHolderTests:XCTestCase {
 private func engine(choice:NativeWildRewardChoice = .init(.tnt))->NativeGameplayEngine {
  let state=NativeBoardState(tiles:(0..<45).map{.init(id:"holder:\($0)",cell:.init(column:$0%5,row:$0/5),value:0,locked:true)},wildMeter:1.25)
  let e=NativeGameplayEngine(state:state,recordedRandomChoices:Array(repeating:0,count:100),rewardPicker:{_,_ in choice})
  e.stagedMeterDrops=true;e.stagedMeterOpen=true;return e
 }
 private func request(_ engine:NativeGameplayEngine)throws->NativeMeterOpenRequest {XCTAssertTrue(engine.claimMeterReward().accepted);return try XCTUnwrap(engine.pendingMeterOpen)}
 func testSourceSpawnOrbitPriorityMatches125LiteralOriginalCases() {
 let rows:[(Int,Int,Int,Int)]=[
(0,0,0,3),
(0,0,1,1),
(0,0,2,2),
(0,0,3,3),
(0,0,4,3),
(0,1,0,1),
(0,1,1,1),
(0,1,2,1),
(0,1,3,1),
(0,1,4,1),
(0,2,0,2),
(0,2,1,2),
(0,2,2,2),
(0,2,3,2),
(0,2,4,2),
(0,3,0,3),
(0,3,1,3),
(0,3,2,3),
(0,3,3,3),
(0,3,4,3),
(0,4,0,3),
(0,4,1,3),
(0,4,2,3),
(0,4,3,3),
(0,4,4,3),
(1,0,0,1),
(1,0,1,1),
(1,0,2,1),
(1,0,3,1),
(1,0,4,1),
(1,1,0,1),
(1,1,1,1),
(1,1,2,1),
(1,1,3,1),
(1,1,4,1),
(1,2,0,1),
(1,2,1,1),
(1,2,2,1),
(1,2,3,1),
(1,2,4,1),
(1,3,0,1),
(1,3,1,1),
(1,3,2,1),
(1,3,3,1),
(1,3,4,1),
(1,4,0,1),
(1,4,1,1),
(1,4,2,1),
(1,4,3,1),
(1,4,4,1),
(2,0,0,2),
(2,0,1,2),
(2,0,2,2),
(2,0,3,2),
(2,0,4,2),
(2,1,0,2),
(2,1,1,2),
(2,1,2,2),
(2,1,3,2),
(2,1,4,2),
(2,2,0,2),
(2,2,1,2),
(2,2,2,2),
(2,2,3,2),
(2,2,4,2),
(2,3,0,2),
(2,3,1,2),
(2,3,2,2),
(2,3,3,2),
(2,3,4,2),
(2,4,0,2),
(2,4,1,2),
(2,4,2,2),
(2,4,3,2),
(2,4,4,2),
(3,0,0,3),
(3,0,1,3),
(3,0,2,3),
(3,0,3,3),
(3,0,4,3),
(3,1,0,3),
(3,1,1,3),
(3,1,2,3),
(3,1,3,3),
(3,1,4,3),
(3,2,0,3),
(3,2,1,3),
(3,2,2,3),
(3,2,3,3),
(3,2,4,3),
(3,3,0,3),
(3,3,1,3),
(3,3,2,3),
(3,3,3,3),
(3,3,4,3),
(3,4,0,3),
(3,4,1,3),
(3,4,2,3),
(3,4,3,3),
(3,4,4,3),
(4,0,0,3),
(4,0,1,3),
(4,0,2,3),
(4,0,3,3),
(4,0,4,3),
(4,1,0,3),
(4,1,1,3),
(4,1,2,3),
(4,1,3,3),
(4,1,4,3),
(4,2,0,3),
(4,2,1,3),
(4,2,2,3),
(4,2,3,3),
(4,2,4,3),
(4,3,0,3),
(4,3,1,3),
(4,3,2,3),
(4,3,3,3),
(4,3,4,3),
(4,4,0,3),
(4,4,1,3),
(4,4,2,3),
(4,4,3,3),
(4,4,4,3)
]
 for r in rows {XCTAssertEqual(NativeSpawnRules.sourceStarOrbitCountForSpawn(savedPositions:r.0,savedSystem:r.1,liveSystem:r.2),r.3)}
 }
 func testSourcePlainStarConstructorDefersOnlyItsOrbitDrawToActualPresentation()throws {
  func attempt(_ enabled:Bool,_ shared:Bool)throws->(Int,NativeMeterOpenRequest) {
   var draws=0
   let stream=NativeSourceMathRandomStream(draw:{draws+=1;return 0.5})
   let state=NativeBoardState(tiles:(0..<45).map{.init(id:"holder:\($0)",cell:.init(column:$0%5,row:$0/5),value:0,locked:true)},wildMeter:1.25)
   let e=NativeGameplayEngine(state:state,recordedRandomChoices:Array(repeating:0.5,count:100),rewardPicker:{_,_ in NativeWildRewardChoice(.star)},sourceMathRandom:shared ? stream:nil)
   e.stagedMeterDrops=true;e.stagedMeterOpen=true;e.sourceStarOrbitCountAtPresentationEnabled=enabled
   let r=try request(e);return(draws,r)
  }
  let raw=try attempt(false,true),source=try attempt(true,true),unbound=try attempt(true,false)
  XCTAssertEqual(raw.0-source.0,1);XCTAssertEqual(raw.1.tile.starOrbitCount,2)
  XCTAssertEqual(source.1.tile.starOrbitCount,0);XCTAssertEqual(unbound.1.tile.starOrbitCount,2)
  XCTAssertEqual(raw.1.tile.cell,source.1.tile.cell);XCTAssertEqual(raw.1.expectedHolderID,source.1.expectedHolderID)
 }
 func testReusedHolderIdentityFlowsThroughActualOpenChargeAndDropForAllSelections()throws {
  let choices:[NativeWildRewardChoice]=[.init(.star),.init(.juice),.init(.magnet),.init(.tnt)]+NativeSpecialDiceRegistry.variants.values.map{.init($0.archetype,variant:$0.id)}
  XCTAssertEqual(choices.count,18)
  for choice in choices {
   let e=engine(choice:choice),r=try request(e),actual=try XCTUnwrap(r.expectedHolderID)
   XCTAssertNotEqual(r.tile.id,actual);let count=e.state.tiles.count
   var prepared:NativeTile?
   let result=e.completeMeterOpen(id:r.id,generation:r.generation,receipt:.created(tileID:actual),prepareCommitted:{prepared=$0})
   XCTAssertTrue(result.accepted);XCTAssertEqual(prepared?.id,actual);XCTAssertEqual(prepared?.variant,r.tile.variant);XCTAssertEqual(e.state.tiles.count,count)
   let opened=try XCTUnwrap(e.state.tile(at:r.tile.cell));XCTAssertEqual(opened.id,actual);XCTAssertFalse(opened.visible);XCTAssertEqual(opened.alpha,0)
   XCTAssertNil(e.state.tiles.first{$0.id==r.tile.id});XCTAssertEqual(e.state.wildMeter,0.25,accuracy:1e-10)
   let drop=try XCTUnwrap(e.meterDropReservations.values.first);XCTAssertEqual(drop.tileID,actual)
   for event in result.events where [.meterDropOpenCreated,.meterDropChargeConsumed,.meterDropReserved].contains(event.kind) {XCTAssertEqual(event.tileIDs,[actual])}
   XCTAssertFalse(e.completeMeterOpen(id:r.id,generation:r.generation,receipt:.created(tileID:actual)).accepted)
  }
 }
 func testFreshCreationCannotReplaceLiveReusableHolderOrForeignIdentity()throws {
  let e=engine(),r=try request(e),before=e.state
  XCTAssertFalse(e.completeMeterOpen(id:r.id,generation:r.generation,receipt:.created(tileID:r.tile.id)).accepted);XCTAssertEqual(e.state,before);XCTAssertEqual(e.pendingMeterOpen,r)
  XCTAssertFalse(e.completeMeterOpen(id:r.id,generation:r.generation,receipt:.created(tileID:"foreign")).accepted);XCTAssertEqual(e.state,before)
  XCTAssertTrue(e.completeMeterOpen(id:r.id,generation:r.generation,receipt:.created(tileID:try XCTUnwrap(r.expectedHolderID))).accepted)
 }
 func testOriginalDestroyedHolderIsEmptyAndRequiresActualFreshCreation()throws {
  let e=engine(),r=try request(e),old=try XCTUnwrap(r.expectedHolderID);var marker=NativeNoMovesTileRuntime();marker.destroyed=true;e.noMovesTileRuntime[old]=marker
  XCTAssertFalse(e.completeMeterOpen(id:r.id,generation:r.generation,receipt:.created(tileID:old)).accepted)
  XCTAssertTrue(e.completeMeterOpen(id:r.id,generation:r.generation,receipt:.created(tileID:r.tile.id)).accepted)
  XCTAssertEqual(e.state.tile(at:r.tile.cell)?.id,r.tile.id);XCTAssertNil(e.state.tiles.first{$0.id==old})
 }
 func testCancellationRetiresOnlyCapturedReusedNodeBeforeOrAfterCharge()throws {
  for timing in ["before","prepare","explicit"] {
   let e=engine(),r=try request(e),actual=try XCTUnwrap(r.expectedHolderID)
   if timing=="before" {var flags=NativeGameplayRuntimeFlags();flags.busyEnding=true;e.setRuntimeFlags(flags)}
   let result=e.completeMeterOpen(id:r.id,generation:r.generation,receipt:.created(tileID:actual),prepareCommitted:{_ in
    if timing=="prepare" {var flags=NativeGameplayRuntimeFlags();flags.busyEnding=true;e.setRuntimeFlags(flags)}
    if timing=="explicit" {_=e.cancelMeterSourceContinuation()}
   })
   XCTAssertTrue(result.accepted);XCTAssertNil(e.state.tiles.first{$0.id==actual});XCTAssertNil(e.state.tiles.first{$0.id==r.tile.id});XCTAssertEqual(e.state.tiles.count,44)
   XCTAssertEqual(e.state.wildMeter,timing=="before" ? 1.25:timing=="explicit" ? 0:0.25,accuracy:1e-10);XCTAssertTrue(e.meterDropReservations.isEmpty)
   XCTAssertTrue(result.events.contains{$0.kind == .meterDropOpenCanceled && $0.tileIDs==[actual]})
  }
 }
 func testReentrantRestartNeverConsumesNewGenerationOrRetiresReplacementIdentity()throws {
  let e=engine(),r=try request(e),actual=try XCTUnwrap(r.expectedHolderID)
  let replacement=NativeBoardState(tiles:[.init(id:actual,cell:r.tile.cell,value:4)],wildMeter:2.25)
  let result=e.completeMeterOpen(id:r.id,generation:r.generation,receipt:.created(tileID:actual),prepareCommitted:{_ in e.restart(state:replacement)})
  XCTAssertFalse(result.accepted);XCTAssertEqual(e.state.wildMeter,2.25);XCTAssertEqual(e.state.tiles.first?.id,actual);XCTAssertEqual(e.state.tiles.first?.value,4)
  XCTAssertTrue(e.meterDropReservations.isEmpty)
 }
}
