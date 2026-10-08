import XCTest
@testable import StackToSixGameplay
final class NativeSourceSaveAdmissionTests:XCTestCase {
 struct Row:Decodable {
  let marker:String?;let destroyed:Bool?;let unsavable:Bool
  let busyEnding,wildSpawnInProgress,merge6SpawnInProgress,wildMagnetPullInProgress,specialActive,regularHandoff,cleanupOwned,dragActive,wildDrop:Bool?
 }
 func testExecutedOriginalSaveGuardAllSourceOwnersAndDestroyedMarkers()throws {
  let rows=try JSONDecoder().decode([Row].self,from:Data(#"[{"unsavable":false},{"busyEnding":true,"unsavable":true},{"wildSpawnInProgress":true,"unsavable":true},{"merge6SpawnInProgress":true,"unsavable":true},{"wildMagnetPullInProgress":true,"unsavable":true},{"specialActive":true,"unsavable":true},{"regularHandoff":true,"unsavable":true},{"cleanupOwned":true,"unsavable":true},{"dragActive":true,"unsavable":true},{"wildDrop":true,"unsavable":true},{"endgameGuardOnly":true,"unsavable":false},{"decorativeOnly":true,"unsavable":false},{"hudPendingOnly":true,"unsavable":false},{"marker":"_ccWildSpawnDropping","destroyed":false,"source":"STATE","unsavable":true},{"marker":"_ccWildSpawnDropping","destroyed":false,"source":"tiles","unsavable":true},{"marker":"_ccWildSpawnDropping","destroyed":true,"source":"STATE","unsavable":false},{"marker":"_ccWildSpawnDropping","destroyed":true,"source":"tiles","unsavable":false},{"marker":"_ccWildSpawnHandoffLock","destroyed":false,"source":"STATE","unsavable":true},{"marker":"_ccWildSpawnHandoffLock","destroyed":false,"source":"tiles","unsavable":true},{"marker":"_ccWildSpawnHandoffLock","destroyed":true,"source":"STATE","unsavable":false},{"marker":"_ccWildSpawnHandoffLock","destroyed":true,"source":"tiles","unsavable":false},{"marker":"_isBeingSpawned","destroyed":false,"source":"STATE","unsavable":true},{"marker":"_isBeingSpawned","destroyed":false,"source":"tiles","unsavable":true},{"marker":"_isBeingSpawned","destroyed":true,"source":"STATE","unsavable":false},{"marker":"_isBeingSpawned","destroyed":true,"source":"tiles","unsavable":false},{"marker":"_pendingRemoval","destroyed":false,"source":"STATE","unsavable":true},{"marker":"_pendingRemoval","destroyed":false,"source":"tiles","unsavable":true},{"marker":"_pendingRemoval","destroyed":true,"source":"STATE","unsavable":false},{"marker":"_pendingRemoval","destroyed":true,"source":"tiles","unsavable":false},{"marker":"_beingRemoved","destroyed":false,"source":"STATE","unsavable":true},{"marker":"_beingRemoved","destroyed":false,"source":"tiles","unsavable":true},{"marker":"_beingRemoved","destroyed":true,"source":"STATE","unsavable":false},{"marker":"_beingRemoved","destroyed":true,"source":"tiles","unsavable":false},{"marker":"_cleanupQueued","destroyed":false,"source":"STATE","unsavable":true},{"marker":"_cleanupQueued","destroyed":false,"source":"tiles","unsavable":true},{"marker":"_cleanupQueued","destroyed":true,"source":"STATE","unsavable":false},{"marker":"_cleanupQueued","destroyed":true,"source":"tiles","unsavable":false},{"marker":"_ccSpawnAnimating","destroyed":false,"source":"STATE","unsavable":true},{"marker":"_ccSpawnAnimating","destroyed":false,"source":"tiles","unsavable":true},{"marker":"_ccSpawnAnimating","destroyed":true,"source":"STATE","unsavable":false},{"marker":"_ccSpawnAnimating","destroyed":true,"source":"tiles","unsavable":false},{"marker":"_spawnAnimating","destroyed":false,"source":"STATE","unsavable":true},{"marker":"_spawnAnimating","destroyed":false,"source":"tiles","unsavable":true},{"marker":"_spawnAnimating","destroyed":true,"source":"STATE","unsavable":false},{"marker":"_spawnAnimating","destroyed":true,"source":"tiles","unsavable":false},{"marker":"_isSpawning","destroyed":false,"source":"STATE","unsavable":true},{"marker":"_isSpawning","destroyed":false,"source":"tiles","unsavable":true},{"marker":"_isSpawning","destroyed":true,"source":"STATE","unsavable":false},{"marker":"_isSpawning","destroyed":true,"source":"tiles","unsavable":false},{"marker":"_spawnTween","destroyed":false,"source":"STATE","unsavable":true},{"marker":"_spawnTween","destroyed":false,"source":"tiles","unsavable":true},{"marker":"_spawnTween","destroyed":true,"source":"STATE","unsavable":false},{"marker":"_spawnTween","destroyed":true,"source":"tiles","unsavable":false}]"#.utf8));XCTAssertEqual(rows.count,53)
  for row in rows {
   var runtime=NativeSourceSaveRuntime()
   runtime.busyEnding=row.busyEnding==true;runtime.wildSpawnInProgress=row.wildSpawnInProgress==true;runtime.merge6SpawnInProgress=row.merge6SpawnInProgress==true;runtime.wildMagnetPullInProgress=row.wildMagnetPullInProgress==true;runtime.specialTransactionActive=row.specialActive==true;runtime.regularHandoffActive=row.regularHandoff==true;runtime.cleanupOwned=row.cleanupOwned==true;runtime.activeDrag=row.dragActive==true;runtime.wildDropInProgress=row.wildDrop==true
   if let key=row.marker {var marker=NativeSourceSaveTileMarkers();marker.destroyed=row.destroyed==true
    switch key {case "_ccWildSpawnDropping":marker.wildSpawnDropping=true;case "_ccWildSpawnHandoffLock":marker.wildSpawnHandoffLock=true;case "_isBeingSpawned":marker.isBeingSpawned=true;case "_pendingRemoval":marker.pendingRemoval=true;case "_beingRemoved":marker.beingRemoved=true;case "_cleanupQueued":marker.cleanupQueued=true;case "_ccSpawnAnimating":marker.ccSpawnAnimating=true;case "_spawnAnimating":marker.spawnAnimating=true;case "_isSpawning":marker.isSpawning=true;case "_spawnTween":marker.hasSpawnTween=true;default:XCTFail(key)}
    runtime.tileMarkers=[marker]
   }
   XCTAssertEqual(runtime.hasUnsavableTransientGameplayState,row.unsavable,row.marker ?? "runtime")
  }
 }
 func testPurePauseSaveQueriesLeaveAcceptedWildReceiptsCountersAndRandomStreamUnchangedUntilActualArrival()throws {
  let initial=NativeBoardState(tiles:[NativeTile(id:"a",cell:.init(column:0,row:0),value:6,archetype:.juice),NativeTile(id:"b",cell:.init(column:1,row:0),value:5),NativeTile(id:"other",cell:.init(column:4,row:8),value:2)],board:10,rngState:12345)
  let e=NativeGameplayEngine(state:initial,recordedRandomChoices:Array(repeating:0.2,count:1000));e.stagedDirectWildMoves=true;e.stagedDirectWildAssignments=true
  XCTAssertFalse(e.hasUnsavableSourceGameplayState);XCTAssertTrue(e.beginDrag(tileID:"a"));XCTAssertTrue(e.hasUnsavableSourceGameplayState)
  XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted);let plan=try XCTUnwrap(e.pendingDirectWild)
  XCTAssertTrue(e.hasUnsavableSourceGameplayState);let before=e.state
  for _ in 0..<5 {XCTAssertTrue(e.hasUnsavableSourceGameplayState)};XCTAssertEqual(e.state,before)
  XCTAssertTrue(e.commitDirectWildGameplay(transactionID:plan.id).accepted)
  let accepted=e.state,actions=e.pendingWildSpawnActions,arrivals=e.pendingWildSpawnArrivals,stars=e.pendingHUDStars
  for _ in 0..<5 {XCTAssertTrue(e.hasUnsavableSourceGameplayState)}
  XCTAssertEqual(e.state,accepted);XCTAssertEqual(e.pendingWildSpawnActions,actions);XCTAssertEqual(e.pendingWildSpawnArrivals,arrivals);XCTAssertEqual(e.pendingHUDStars,stars)
  var callbacks=0
  while (!e.pendingWildSpawnActions.isEmpty || !e.pendingWildSpawnArrivals.isEmpty) && callbacks<100 {
   if let action=e.pendingWildSpawnActions.first {XCTAssertTrue(e.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:action.id).accepted)}
   else if let arrival=e.pendingWildSpawnArrivals.first {XCTAssertTrue(e.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id).accepted)}
   callbacks+=1
  }
  XCTAssertLessThan(callbacks,100);XCTAssertNotNil(e.pendingDirectWild);XCTAssertFalse(e.pendingHUDStars.isEmpty)
  // Neither retained Wild-only presentation nor earned HUD flights are source save blockers.
  XCTAssertFalse(e.hasUnsavableSourceGameplayState)
  var marker=NativeSourceSaveTileMarkers();marker.wildSpawnDropping=true;e.sourceSaveRuntime.tileMarkers=[marker]
  XCTAssertTrue(e.hasUnsavableSourceGameplayState);e.sourceSaveRuntime.tileMarkers=[]
  e.restart(state:initial);XCTAssertFalse(e.hasUnsavableSourceGameplayState)
 }
}
