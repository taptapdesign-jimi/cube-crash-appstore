import XCTest
@testable import StackToSixGameplay

nonisolated final class NativeSourceMagnetMainSetupTests:XCTestCase {
 private func fixture(enabled:Bool)throws->(NativeGameplayEngine,NativeSpecialMovePlan) {
  let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"m",cell:.init(column:0,row:0),value:6,stackDepth:2,archetype:.magnet),.init(id:"d",cell:.init(column:1,row:0),value:2,stackDepth:3),.init(id:"a",cell:.init(column:2,row:0),value:1)]),recordedRandomChoices:Array(repeating:0,count:80))
  engine.sourceMagnetMain80Enabled=enabled
  XCTAssertTrue(engine.beginDrag(tileID:"m"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
  return(engine,try XCTUnwrap(engine.pendingSpecial))
 }
 func testSourceParentPrefixRetainsActualVisibilityAndCombinedDepthWhileRawRemainsHidden()throws {
  for enabled in [false,true] {
   let(e,_)=try fixture(enabled:enabled),tile=try XCTUnwrap(e.state.tiles.first{$0.id=="d"})
   XCTAssertEqual(tile.visible,enabled);XCTAssertEqual(tile.alpha,enabled ? 1:0)
   XCTAssertEqual(tile.stackDepth,enabled ? 4:3);XCTAssertEqual(tile.sourceWildStateCleared,enabled)
   XCTAssertTrue(tile.resolutionOwned);XCTAssertNil(e.pendingSourceSpecialAbsorb)
  }
 }
 func testSourceSetupAbortDoesNotRequireOrManufactureInstalledMainAndKeepsAccountingRng()throws {
  let(e,p)=try fixture(enabled:true),before=e.state
  XCTAssertTrue(e.cancelSourceMagnetMainSetup(transactionID:p.id,generation:p.generation).accepted)
  XCTAssertEqual(e.state.score,before.score);XCTAssertEqual(e.state.moves,before.moves);XCTAssertEqual(e.state.rngState,before.rngState);XCTAssertEqual(e.state.combo,before.combo)
  XCTAssertNil(e.pendingSpecial);XCTAssertNil(e.pendingSourceSpecialAbsorb);XCTAssertFalse(e.flags.pendingSpecialMutation);XCTAssertFalse(e.flags.wildMagnetPullInProgress)
  XCTAssertEqual(e.state.tiles.map(\.id),["a"]);XCTAssertFalse(e.state.tiles[0].magnetOwned);XCTAssertFalse(e.state.tiles[0].locked)
  XCTAssertFalse(e.cancelSourceMagnetMainSetup(transactionID:p.id,generation:p.generation).accepted)
 }
 func testSetupAbortRejectsRawInstalledMainAndReplacementGeneration()throws {
  let(raw,r)=try fixture(enabled:false),rawBefore=raw.state
  XCTAssertFalse(raw.cancelSourceMagnetMainSetup(transactionID:r.id,generation:r.generation).accepted);XCTAssertEqual(raw.state,rawBefore)
  let(e,p)=try fixture(enabled:true)
  let receipt=try XCTUnwrap(e.registerSourceSpecialAbsorbOwner(transactionID:p.id,generation:p.generation))
  XCTAssertFalse(e.cancelSourceMagnetMainSetup(transactionID:p.id,generation:p.generation).accepted)
  XCTAssertTrue(e.commitSourceSpecialAbsorbMain(receiptID:receipt.id,generation:receipt.generation).accepted)
  XCTAssertFalse(e.cancelSourceMagnetMainSetup(transactionID:p.id,generation:p.generation).accepted)
  e.restart(state:.init(tiles:[.init(id:"d",cell:.init(column:1,row:0),value:4)]))
  XCTAssertFalse(e.cancelSourceMagnetMainSetup(transactionID:p.id,generation:p.generation).accepted);XCTAssertEqual(e.state.tiles.first?.value,4)
 }
}
