import XCTest
import StackToSixGameplay
nonisolated final class NativeSourceSixAbsorbInterruptionTests:XCTestCase {
 private func ordinary(final:Bool=false)->NativeGameplayEngine {
  let tiles:[NativeTile]=[.init(id:"src",cell:.init(column:0,row:0),value:2),.init(id:"dst",cell:.init(column:1,row:0),value:4)]+(final ? []:[.init(id:"same-cell-fresh",cell:.init(column:2,row:0),value:3)])
  let e=NativeGameplayEngine(state:.init(tiles:tiles,score:100,combo:2,wildMeter:0.25))
  e.stagedOrdinaryMoves=true;e.stagedOrdinaryAssignments=true;return e
 }
 private func direct(_ choice:NativeWildRewardChoice,final:Bool=true)->NativeGameplayEngine {
  let tiles:[NativeTile]=[.init(id:"src",cell:.init(column:0,row:0),value:6,archetype:choice.archetype,variant:choice.variant),.init(id:"dst",cell:.init(column:1,row:0),value:2)]+(final ? []:[.init(id:"same-cell-fresh",cell:.init(column:2,row:0),value:3)])
  let e=NativeGameplayEngine(state:.init(tiles:tiles,score:100,combo:2,wildMeter:0.25))
  e.stagedDirectWildMoves=true;e.stagedDirectWildAssignments=true;return e
 }
 private func reserve(_ e:NativeGameplayEngine)throws->(String,UInt64) {
  XCTAssertTrue(e.beginDrag(tileID:"src"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
  if let plan=e.pendingOrdinarySix {return(plan.id,plan.generation)}
  let plan=try XCTUnwrap(e.pendingDirectWild);return(plan.id,plan.generation)
 }
 private func accounting(_ state:NativeBoardState)->[Double] {[Double(state.score),Double(state.moves),Double(state.combo),Double(state.earnedComboBonus),Double(state.cubesCracked),state.wildMeter,Double(state.wildSpawnCount)]}
 func testOrdinarySixExplicitInterruptRetiresProtectedCapturedPairWithoutRunningMain()throws {
  for final in [false,true] {
   let e=ordinary(final:final),(id,gen)=try reserve(e),before=e.state
   XCTAssertTrue(e.hasUnsavableSourceGameplayState)
   let result=e.cancelSourceMergeSixAbsorb(receiptID:id,generation:gen)
   XCTAssertTrue(result.accepted);XCTAssertEqual(accounting(e.state),accounting(before));XCTAssertEqual(e.state.rngState,before.rngState)
   XCTAssertNil(e.pendingOrdinarySix);XCTAssertFalse(e.hasUnsavableSourceGameplayState);XCTAssertTrue(e.pendingOrdinaryAssignments.isEmpty);XCTAssertTrue(e.pendingOrdinarySpawns.isEmpty);XCTAssertNil(e.pendingOrdinaryPrimaryArrival);XCTAssertNil(e.pendingOrdinaryDestinationCleanup)
   XCTAssertEqual(Set(e.state.tiles.map(\.id)),final ? []:["same-cell-fresh"]);XCTAssertNil(e.state.terminal)
   XCTAssertTrue(result.events.contains{$0.kind == .mergeSixAbsorbInterrupted && $0.reason==id});XCTAssertFalse(result.events.contains{[.merged,.spawned,.terminal,.ordinarySpawnsPrepareRequested].contains($0.kind)})
   XCTAssertFalse(e.commitOrdinarySix(receiptID:id,generation:gen).accepted);XCTAssertFalse(e.cancelSourceMergeSixAbsorb(receiptID:id,generation:gen).accepted)
  }
 }
 func testEveryOriginalSelectedFinalFamilyExplicitInterruptHasNoArtificialCompletion()throws {
  let choices:[NativeWildRewardChoice]=[.init(.star),.init(.juice),.init(.magnet),.init(.tnt)]+NativeSpecialDiceRegistry.variants.values.sorted{$0.id<$1.id}.map{.init($0.archetype,variant:$0.id)}
  XCTAssertEqual(choices.count,17)
  for choice in choices {
   let e=direct(choice),(id,gen)=try reserve(e),before=e.state
   XCTAssertTrue(e.hasUnsavableSourceGameplayState);let result=e.cancelSourceMergeSixAbsorb(receiptID:id,generation:gen)
   XCTAssertTrue(result.accepted,choice.variant ?? choice.archetype.rawValue);XCTAssertEqual(accounting(e.state),accounting(before));XCTAssertEqual(e.state.rngState,before.rngState)
   XCTAssertTrue(e.state.tiles.isEmpty);XCTAssertNil(e.state.terminal);XCTAssertNil(e.pendingDirectWild);XCTAssertFalse(e.hasUnsavableSourceGameplayState)
   XCTAssertTrue(e.hasReachedWildSourceResolutionBoundary(transactionID:id,generation:gen));XCTAssertTrue(e.pendingWildSpawnActions.isEmpty);XCTAssertTrue(e.pendingWildSpawnArrivals.isEmpty);XCTAssertTrue(e.pendingWildRecoveryChecks.isEmpty)
   XCTAssertFalse(result.events.contains{[.merged,.spawned,.terminal,.wildRecoveryCheckPrepared,.wildSpawnActionsPrepared].contains($0.kind)})
   XCTAssertFalse(e.commitDirectWildGameplay(transactionID:id).accepted);XCTAssertFalse(e.cancelSourceMergeSixAbsorb(receiptID:id,generation:gen).accepted)
  }
 }
 func testNonfinalStarJuiceRemoveOnlyCapturedPairAndReleaseOrdinaryInput()throws {
  for archetype in [NativeWildArchetype.star,.juice] {
   let e=direct(.init(archetype),final:false),(id,gen)=try reserve(e),before=e.state
   XCTAssertTrue(e.cancelSourceMergeSixAbsorb(receiptID:id,generation:gen).accepted);XCTAssertEqual(accounting(e.state),accounting(before));XCTAssertEqual(e.state.tiles.map(\.id),["same-cell-fresh"])
   XCTAssertTrue(e.beginDrag(tileID:"same-cell-fresh"));e.cancelDrag()
  }
 }
 func testForeignObsoleteAndAfterActualMainReceiptsCannotDestroyCurrentTransaction()throws {
  for kind in ["ordinary","direct"] {
   let e=kind=="ordinary" ? ordinary():direct(.init(.star)),(id,gen)=try reserve(e),before=e.state
   XCTAssertFalse(e.cancelSourceMergeSixAbsorb(receiptID:"foreign",generation:gen).accepted);XCTAssertFalse(e.cancelSourceMergeSixAbsorb(receiptID:id,generation:gen+1).accepted);XCTAssertEqual(e.state,before)
   if kind=="ordinary" {XCTAssertTrue(e.commitOrdinarySix(receiptID:id,generation:gen).accepted)} else {XCTAssertTrue(e.commitDirectWildGameplay(transactionID:id).accepted)}
   let committed=e.state;XCTAssertFalse(e.cancelSourceMergeSixAbsorb(receiptID:id,generation:gen).accepted);XCTAssertEqual(e.state,committed)
   e.restart(state:.init(tiles:[.init(id:"src",cell:.init(column:0,row:0),value:3)]))
   XCTAssertFalse(e.cancelSourceMergeSixAbsorb(receiptID:id,generation:gen).accepted);XCTAssertEqual(e.state.tiles.first?.id,"src")
  }
 }
 private struct Gold:Decodable {let records:[Row]}
 private struct Row:Decodable {let type:String,scenario:String,removed:[String],sourceResolution:Bool,destinationResolution:Bool,frameReleases:Int,idleReleases:Int,pullCleanup:Int,transactionActive:Bool,queued:Int}
 func testActualOriginalCallback48CaseEvidenceAndNativeSupportedNormalPaths()throws {
  let url=try XCTUnwrap(Bundle(for:NativeSourceSixAbsorbInterruptionTests.self).url(forResource:"SourceAbsorbInterruptOracle",withExtension:"json")),rows=try JSONDecoder().decode(Gold.self,from:Data(contentsOf:url)).records
  XCTAssertEqual(rows.count,48)
  for row in rows where row.scenario=="normal" && row.type != "mixed-magnet-tnt" {
   let e=row.type=="regular" ? ordinary():direct(.init(try XCTUnwrap(NativeWildArchetype(rawValue:row.type=="star" ? "wild": "wild-"+row.type))))
   let (id,gen)=try reserve(e),result=e.cancelSourceMergeSixAbsorb(receiptID:id,generation:gen)
   XCTAssertEqual(result.events.first{$0.kind == .removed}?.tileIDs,row.removed);XCTAssertFalse(row.sourceResolution);XCTAssertFalse(row.destinationResolution);XCTAssertEqual(row.frameReleases,1);XCTAssertEqual(row.idleReleases,1);XCTAssertFalse(row.transactionActive)
   // Source Promise queue is a separate adapter receipt, never an immediate
   // Core spawn on interruption. Failure/stale-token Source rows stay evidence
   // for the imperative renderer; NativeCore cannot synthesize thrown cleanup.
   XCTAssertEqual(row.queued,row.type=="regular" ? 0:row.type=="magnet" ? 2:1)
   XCTAssertFalse(result.events.contains{$0.kind == .spawned})
  }
 }
}

extension NativeSourceSixAbsorbInterruptionTests {
 func testCapturedMagnetPullReleasePreservesIndependentTerminalOwner()throws {
  let e=direct(.init(.magnet));let (id,gen)=try reserve(e)
  var flags=NativeGameplayRuntimeFlags();flags.wildMagnetPullInProgress=true;flags.busyEnding=true;e.setRuntimeFlags(flags)
  let before=e.state;XCTAssertTrue(e.cancelSourceMergeSixAbsorb(receiptID:id,generation:gen).accepted)
  XCTAssertEqual(accounting(e.state),accounting(before));XCTAssertFalse(e.flags.wildMagnetPullInProgress);XCTAssertTrue(e.flags.busyEnding);XCTAssertFalse(e.flags.pendingSpecialMutation)
  XCTAssertEqual(e.resolve().kind,.wait);XCTAssertNil(e.pendingDirectWild);XCTAssertTrue(e.state.tiles.isEmpty)
 }

 func testNestedSubSixCaptureAndAccountingSurviveExactOtherSixInterruption()throws {
  let e=NativeGameplayEngine(state:.init(tiles:[.init(id:"src",cell:.init(column:0,row:0),value:2),.init(id:"dst",cell:.init(column:1,row:0),value:4),.init(id:"small-src",cell:.init(column:2,row:0),value:1),.init(id:"small-dst",cell:.init(column:3,row:0),value:1)],score:100,combo:2,wildMeter:0.25))
  e.stagedOrdinaryMoves=true;let (id,gen)=try reserve(e)
  XCTAssertTrue(e.beginDrag(tileID:"small-src"));XCTAssertTrue(e.drop(target:.init(column:3,row:0),now:0.02).accepted)
  let small=try XCTUnwrap(e.pendingOrdinaryStack),before=e.state
  XCTAssertTrue(e.cancelSourceMergeSixAbsorb(receiptID:id,generation:gen).accepted)
  XCTAssertEqual(accounting(e.state),accounting(before));XCTAssertEqual(e.pendingOrdinaryStack,small);XCTAssertTrue(e.hasUnsavableSourceGameplayState)
  XCTAssertEqual(Set(e.state.tiles.map(\.id)),["small-src","small-dst"])
  XCTAssertTrue(e.finishOrdinaryStackAbsorb(receiptID:small.id,generation:small.generation).accepted)
  XCTAssertEqual(e.state.tiles.map(\.id),["small-dst"]);XCTAssertEqual(e.state.tiles.first?.value,2)
 }
}
