import XCTest
@testable import StackToSixGameplay

/// Both candidates remain default-off. Tests opt into genuine captured owners.
final class NativeMeterNoMovesIntegrationTests:XCTestCase {
 private func engine()->NativeGameplayEngine {
  let e=NativeGameplayEngine(state:NativeBoardState(tiles:[
   NativeTile(id:"a",cell:.init(column:0,row:0),value:4),
   NativeTile(id:"b",cell:.init(column:1,row:0),value:5)],wildMeter:1.25),
   recordedRandomChoices:[0,0,0],rewardPicker:{_,_ in NativeWildRewardChoice(.star)})
  return e
 }
 private func reserve(_ e:NativeGameplayEngine)throws->NativeMeterDropReservation {
  e.stagedMeterDrops=true;e.stagedSourceNoMoves=true
  XCTAssertTrue(e.claimMeterReward().accepted)
  return try XCTUnwrap(e.meterDropReservations.values.first)
 }
 private func receipt(_ r:NativeMeterDropReceipt,_ d:NativeMeterDropReservation,_ e:NativeGameplayEngine) {
  XCTAssertTrue(e.applyMeterDropReceipt(id:d.id,generation:d.generation,receipt:r).accepted)
 }
 func testBothCandidatesAreOffByDefault() {
  let e=engine();XCTAssertFalse(e.stagedMeterDrops);XCTAssertFalse(e.stagedSourceNoMoves)
  XCTAssertEqual(e.beginSourceNoMoves(origin:.levelEnd),.ignored)
  XCTAssertTrue(e.claimMeterReward().accepted);XCTAssertTrue(e.meterDropReservations.isEmpty)
  XCTAssertEqual(e.state.wildSpawnCount,1)
 }
 func testGenuineHiddenQueueDefersWithoutStoredFlagsOrLockingUnrelatedInput()throws {
  let e=engine(),d=try reserve(e)
  XCTAssertFalse(e.flags.wildSpawnInProgress);XCTAssertFalse(e.sourceSaveRuntime.wildSpawnInProgress)
  XCTAssertTrue(e.sourceMeterSpawnInProgress);XCTAssertFalse(e.sourceMeterHandoffInProgress)
  XCTAssertEqual(e.beginSourceNoMoves(origin:.levelEnd),.deferred("wild-continuation-pending"))
  XCTAssertNil(e.pendingSourceNoMoves);XCTAssertTrue(e.beginDrag(tileID:"a"));e.cancelDrag()
  XCTAssertFalse(e.beginDrag(tileID:d.tileID));XCTAssertTrue(e.hasUnsavableSourceGameplayState)
 }
 func testHandoffAloneDefersAfterGenuineQueueBookkeepingAndDisappearsOnActualWallReceipt()throws {
  let e=engine(),d=try reserve(e)
  for r:NativeMeterDropReceipt in [.selectedWarmupCompleted,.assetsPrepared,.revealed,.impact,.boardFallbackRestored,.dropPromiseCompleted] {receipt(r,d,e)}
  XCTAssertFalse(e.sourceMeterSpawnInProgress);XCTAssertTrue(e.sourceMeterHandoffInProgress)
  XCTAssertFalse(e.flags.wildSpawnInProgress);XCTAssertFalse(e.sourceSaveRuntime.wildSpawnInProgress)
  XCTAssertEqual(e.beginSourceNoMoves(origin:.levelEnd),.deferred("fresh-result:continue"))
  XCTAssertNil(e.pendingSourceNoMoves);XCTAssertEqual(e.state.wildSpawnCount,1)
  receipt(.wallHandoffUnlocked,d,e)
  XCTAssertFalse(e.sourceMeterHandoffInProgress);XCTAssertFalse(e.hasUnsavableSourceGameplayState)
  XCTAssertEqual(e.beginSourceNoMoves(origin:.levelEnd),.deferred("fresh-result:continue"))
  XCTAssertTrue(e.beginDrag(tileID:d.tileID));e.cancelDrag()
 }
 func testColdSelectedWarmupRetainsQueueEvenAfterWallHandoffClears()throws {
  let e=engine(),d=try reserve(e)
  for r:NativeMeterDropReceipt in [.assetsPrepared,.revealed,.impact,.boardFallbackRestored,.dropPromiseCompleted,.wallHandoffUnlocked] {receipt(r,d,e)}
  XCTAssertTrue(e.sourceMeterSpawnInProgress);XCTAssertFalse(e.sourceMeterHandoffInProgress)
  XCTAssertEqual(e.beginSourceNoMoves(origin:.levelEnd),.deferred("wild-continuation-pending"))
  XCTAssertTrue(e.hasUnsavableSourceGameplayState);XCTAssertFalse(e.beginDrag(tileID:d.tileID))
  receipt(.selectedWarmupCompleted,d,e)
  XCTAssertTrue(e.meterDropReservations.isEmpty);XCTAssertEqual(e.state.wildSpawnCount,1)
  XCTAssertEqual(e.beginSourceNoMoves(origin:.levelEnd),.deferred("fresh-result:continue"))
 }
}
