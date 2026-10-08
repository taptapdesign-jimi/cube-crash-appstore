import XCTest
@testable import StackToSixGameplay
nonisolated final class NativeMeterHiddenHolderTests:XCTestCase {
 private func engine(choice:NativeWildRewardChoice = .init(.tnt))->NativeGameplayEngine {
  let state=NativeBoardState(tiles:(0..<45).map{.init(id:"holder:\($0)",cell:.init(column:$0%5,row:$0/5),value:0,locked:true)},wildMeter:1.25)
  let e=NativeGameplayEngine(state:state,recordedRandomChoices:Array(repeating:0,count:100),rewardPicker:{_,_ in choice})
  e.stagedMeterDrops=true;e.stagedMeterOpen=true;return e
 }
 private func request(_ engine:NativeGameplayEngine)throws->NativeMeterOpenRequest {XCTAssertTrue(engine.claimMeterReward().accepted);return try XCTUnwrap(engine.pendingMeterOpen)}
 func testReusedHolderIdentityFlowsThroughActualOpenChargeAndDropForAllSelections()throws {
  let choices:[NativeWildRewardChoice]=[.init(.star),.init(.juice),.init(.magnet),.init(.tnt)]+NativeSpecialDiceRegistry.variants.values.map{.init($0.archetype,variant:$0.id)}
  XCTAssertEqual(choices.count,17)
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
