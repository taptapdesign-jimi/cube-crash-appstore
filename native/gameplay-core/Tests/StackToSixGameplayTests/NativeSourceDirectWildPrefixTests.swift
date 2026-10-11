import XCTest
@testable import StackToSixGameplay

nonisolated final class NativeSourceDirectWildPrefixTests:XCTestCase {
 private var choices:[NativeWildRewardChoice] {
  [.init(.star),.init(.juice),.init(.magnet),.init(.tnt)]+NativeSpecialDiceRegistry.variants.values.sorted{$0.id<$1.id}.map{.init($0.archetype,variant:$0.id)}
 }
 private func engine(_ choice:NativeWildRewardChoice,destinationWild:Bool=false,final:Bool=true,meter:Double=0.2)->NativeGameplayEngine {
  let wild=NativeTile(id:destinationWild ? "dst":"src",cell:.init(column:destinationWild ? 1:0,row:0),value:6,stackDepth:2,starOrbitCount:2,archetype:choice.archetype,variant:choice.variant)
  let regular=NativeTile(id:destinationWild ? "src":"dst",cell:.init(column:destinationWild ? 0:1,row:0),value:4,stackDepth:3)
  let e=NativeGameplayEngine(state:.init(tiles:[wild,regular]+(final ? []:[.init(id:"other",cell:.init(column:4,row:8),value:3)]),score:100,wildMeter:meter),recordedRandomChoices:Array(repeating:0.25,count:80))
  e.stagedDirectWildMoves=true;e.stagedDirectWildAssignments=true
  return e
 }
 func testPhysicalEntryFinalSnapshotSurvivesRealPrefixAndMainWithoutRefill()throws {
  for choice in [NativeWildRewardChoice(.star),NativeWildRewardChoice(.juice),NativeWildRewardChoice(.tnt)] {for destinationWild in [false,true] {
   let e=engine(choice,destinationWild:destinationWild,final:false)
   e.sourceDirectPhysicalFinalSnapshotEnabled=true
   e.sourceFinalMergePresenceAuthority = .init(isCurrent:{true},capture:{
    var physical=e.state.tiles
    for i in physical.indices where physical[i].id=="other" {physical[i].alpha=0.01}
    return .init(canonicalState:e.state,physicalTiles:physical,runtime:Dictionary(uniqueKeysWithValues:physical.map{($0.id,NativeNoMovesTileRuntime())}))
   })
   if choice.archetype == .tnt {
    let admission=try XCTUnwrap(e.sourceDirectTntFinalAdmission(source:e.state.tiles[0],destination:e.state.tiles[1]))
    XCTAssertTrue(admission.isFinalMerge);XCTAssertEqual(e.sourceDirectPhysicalFinalCaptureCount,0)
   }
   let plan=try reserve(e)
   XCTAssertTrue(plan.isFinal);XCTAssertTrue(try XCTUnwrap(plan.sourceEntryFinalSnapshot).isFinalMerge)
   XCTAssertEqual(e.sourceDirectPhysicalFinalCaptureCount,1)
   XCTAssertTrue(e.prepareSourceDirectWildPrefix(receiptID:plan.id,generation:plan.generation).accepted)
   // The real prefix clears Wild state. Neither later paint nor unavailable
   // physical authority may revoke a genuinely confirmed entry finality.
   e.sourceFinalMergePresenceAuthority=nil
   let result=e.commitDirectWildGameplay(transactionID:plan.id)
   XCTAssertTrue(result.accepted);XCTAssertEqual(result.resolution.kind,.complete)
   XCTAssertEqual(e.sourceDirectPhysicalFinalCaptureCount,1)
   XCTAssertTrue(e.pendingWildSpawnActions.isEmpty)
   XCTAssertTrue(e.pendingWildLockedBonusPresentations.isEmpty)
   XCTAssertNil(e.sourceNoMovesRuntimeAuthority)
  }}
 }
 func testMissingPhysicalEntryCannotAcquireDirectOwnerOrDebit()throws {
  let e=engine(.init(.juice),final:false),before=e.state
  e.sourceDirectPhysicalFinalSnapshotEnabled=true
  XCTAssertTrue(e.beginDrag(tileID:"src"));XCTAssertFalse(e.drop(target:.init(column:1,row:0)).accepted)
  XCTAssertEqual(e.state,before);XCTAssertNil(e.pendingDirectWild)
  XCTAssertEqual(e.sourceDirectPhysicalFinalCaptureCount,0)
 }
 func testPhysicalEntryCaptureRestartCannotStageOrChargeSuccessor()throws {
  let e=engine(.init(.star),final:false)
  e.sourceDirectPhysicalFinalSnapshotEnabled=true
  e.sourceFinalMergePresenceAuthority = .init(isCurrent:{true},capture:{
   let captured=e.state
   let snapshot=NativeSourceFinalMergePresenceAuthority.Snapshot(canonicalState:captured,physicalTiles:captured.tiles,runtime:Dictionary(uniqueKeysWithValues:captured.tiles.map{($0.id,NativeNoMovesTileRuntime())}))
   e.restart(state:.init(tiles:[.init(id:"successor",cell:.init(column:0,row:0),value:4)]))
   return snapshot
  })
  XCTAssertTrue(e.beginDrag(tileID:"src"));XCTAssertFalse(e.drop(target:.init(column:1,row:0)).accepted)
  XCTAssertEqual(e.state.tiles.map(\.id),["successor"]);XCTAssertNil(e.pendingDirectWild)
  XCTAssertEqual(e.sourceDirectPhysicalFinalCaptureCount,0)
 }
 func testLaterPhysicalFinalChangeUsesTypedLateReceiptWithoutRefill()throws {
  let e=engine(.init(.juice),final:false)
  var hideOther=false
  e.sourceDirectPhysicalFinalSnapshotEnabled=true
  e.sourceFinalMergePresenceAuthority = .init(isCurrent:{true},capture:{
   var physical=e.state.tiles
   if hideOther {for i in physical.indices where physical[i].id=="other" {physical[i].alpha=0.01}}
   return .init(canonicalState:e.state,physicalTiles:physical,runtime:Dictionary(uniqueKeysWithValues:physical.map{($0.id,NativeNoMovesTileRuntime())}))
  })
  let plan=try reserve(e);XCTAssertFalse(plan.isFinal)
  XCTAssertTrue(e.prepareSourceDirectWildPrefix(receiptID:plan.id,generation:plan.generation).accepted)
  XCTAssertNotNil(e.sourceDirectWildPrefix)
  let before=e.state;hideOther=true
  let committed=e.commitDirectWildGameplay(transactionID:plan.id)
  XCTAssertTrue(committed.accepted)
  XCTAssertEqual(e.state.moves,before.moves-1);XCTAssertGreaterThan(e.state.score,before.score)
  XCTAssertEqual(e.pendingDirectWild,plan);XCTAssertFalse(plan.isFinal)
  XCTAssertTrue(e.hasConfirmedSourceLateFinalMerge(ownerID:plan.id,generation:plan.generation))
  XCTAssertEqual(e.state.terminal?.reason,"final_wild_merge6")
  XCTAssertNil(e.sourceDirectWildPrefix,"Actual committed main retires its consumed prefix; the confirmed late owner remains until visual release")
  XCTAssertTrue(e.pendingWildSpawnActions.isEmpty)
  XCTAssertEqual(e.sourceDirectPhysicalFinalCaptureCount,2)
 }
 func testRetainedWildDestinationKeepsActualCommittedFirstFaceAtMain()throws {
  var state=engine(.init(.star),destinationWild:true,final:false).state
  state.tiles.append(.init(id:"locked",cell:.init(column:0,row:1),value:0,locked:true))
  let e=NativeGameplayEngine(state:state,sourceMathRandom:NativeSourceMathRandomStream(draw:{0.2}))
  e.stagedDirectWildMoves=true;e.stagedDirectWildAssignments=true
  e.sourceDirectPhysicalFinalSnapshotEnabled=true;e.sourceDirectNormalPreSpawnGuardsEnabled=true
  e.sourceWildSpawnBegin={_ in true};e.sourceWildCoroutineResume={_,_ in true}
  e.sourceRetainedDirectDestinationCleanup={_ in true}
  e.sourceFinalMergePresenceAuthority = .init(isCurrent:{true},capture:{
   .init(canonicalState:e.state,physicalTiles:e.state.tiles,runtime:Dictionary(uniqueKeysWithValues:e.state.tiles.map{($0.id,NativeNoMovesTileRuntime())}))
  })
  let plan=try reserve(e)
  XCTAssertTrue(e.prepareSourceDirectWildPrefix(receiptID:plan.id,generation:plan.generation).accepted)
  let before=try XCTUnwrap(e.sourceDirectWildPrefix?.preparedDestination)
  let face=try XCTUnwrap(e.prepareSourceWildDestinationFace(transactionID:plan.id,generation:plan.generation))
  XCTAssertTrue(e.commitSourceWildDestinationFace(receiptID:face.id,generation:face.generation).accepted)
  XCTAssertTrue(e.commitDirectWildGameplay(transactionID:plan.id).accepted)
  let retained=try XCTUnwrap(e.state.tiles.first{$0.id==plan.destination.id})
  XCTAssertEqual(retained.stackDepth,1);XCTAssertTrue(retained.sourceResidualWildPresence)
  XCTAssertTrue(retained.sourceWildStateCleared);XCTAssertNil(retained.archetype)
  XCTAssertGreaterThan(before.stackDepth,retained.stackDepth);XCTAssertFalse(before.sourceResidualWildPresence)
  XCTAssertEqual(e.sourceRetainedDirectDestination?.tileID,retained.id)
 }
 func testMinimumPaintAcceptsOnlyExplicitDetachedRosterAndKeepsGlobalSaveStrict()throws {
  let old=NativeTile(id:"retained",cell:.init(column:0,row:0),value:6,archetype:.star,sourceWildStateCleared:true,visible:false,alpha:0,merge6CleanupOwned:true,nonFinalMerge6:true)
  let primary=NativeTile(id:"primary",cell:old.cell,value:2)
  var canonical=NativeBoardState(tiles:[old,primary],sourceDetachedGridTileIDs:[old.id])
  typealias Receipt=NativeSourceNoMovesRuntimeSnapshot.PaintedStateReceipt
  XCTAssertNil(Receipt(canonicalState:canonical,paintedState:canonical),"Global/save capability remains strict")
  XCTAssertNotNil(Receipt(canonicalState:canonical,paintedState:canonical,allowSourceDetachedGridReferences:true))
  var wrong=canonical;wrong.tiles[1].value=3
  XCTAssertNil(Receipt(canonicalState:canonical,paintedState:wrong,allowSourceDetachedGridReferences:true),"No logical field can be normalized")
  wrong=canonical;wrong.sourceDetachedGridTileIDs=[]
  XCTAssertNil(Receipt(canonicalState:wrong,paintedState:wrong,allowSourceDetachedGridReferences:true),"An unowned duplicate cell remains invalid")
  canonical.tiles.append(.init(id:"foreign",cell:primary.cell,value:1))
  XCTAssertNil(Receipt(canonicalState:canonical,paintedState:canonical,allowSourceDetachedGridReferences:true),"A third unrelated duplicate is never admitted")
 }
 func testLivePresenceAcceptsActualTemporaryFaceMarkersWithoutWeakeningSavePaint()throws {
  let e=engine(.init(.juice),final:false),canonical=e.state
  var physical=canonical.tiles;physical[1].merge6CleanupOwned=true;physical[1].nonFinalMerge6=true
  var painted=canonical;painted.tiles=physical
  XCTAssertNil(NativeSourceNoMovesRuntimeSnapshot.PaintedStateReceipt(canonicalState:canonical,paintedState:painted))
  let runtime=Dictionary(uniqueKeysWithValues:physical.map{($0.id,NativeNoMovesTileRuntime())})
  let snapshot=try XCTUnwrap(NativeSourceFinalMergePresenceAuthority.Snapshot(canonicalState:canonical,physicalTiles:physical,runtime:runtime))
  XCTAssertFalse(try XCTUnwrap(NativeSourceFinalMergeBlockers.finalSnapshot(tiles:snapshot.physicalTiles,runtime:snapshot.runtime,source:canonical.tiles[0],destination:canonical.tiles[1],effectiveSum:6)).isFinalMerge)
  physical[2].cell=physical[0].cell
  XCTAssertNil(NativeSourceFinalMergePresenceAuthority.Snapshot(canonicalState:canonical,physicalTiles:physical,runtime:runtime))
 }
 private func reserve(_ e:NativeGameplayEngine)throws->NativeDirectWildMovePlan {
  XCTAssertTrue(e.beginDrag(tileID:"src"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
  return try XCTUnwrap(e.pendingDirectWild)
 }
 func testLiteralPrefixClearsActualWildDestinationWithoutDebitingOrHidingParent()throws {
  for choice in choices {for dstWild in [false,true] {
   let e=engine(choice,destinationWild:dstWild),plan=try reserve(e),before=e.state
   let result=e.prepareSourceDirectWildPrefix(receiptID:plan.id,generation:plan.generation)
   XCTAssertTrue(result.accepted);XCTAssertTrue(result.events.isEmpty)
   let actual=try XCTUnwrap(e.state.tiles.first{$0.id=="dst"})
   XCTAssertEqual(actual.value,6);XCTAssertEqual(actual.stackDepth,1);XCTAssertNil(actual.archetype);XCTAssertEqual(actual.variant,plan.destination.variant);XCTAssertTrue(actual.sourceWildStateCleared);XCTAssertFalse(actual.isWild)
   XCTAssertEqual(actual.alpha,1);XCTAssertEqual(actual.visible,plan.destination.visible)
   XCTAssertEqual(e.pendingDirectWild,plan);XCTAssertEqual(e.sourceDirectWildPrefix?.originalDestination,plan.destination)
   XCTAssertEqual(e.state.score,before.score);XCTAssertEqual(e.state.moves,before.moves);XCTAssertEqual(e.state.wildMeter,before.wildMeter);XCTAssertEqual(e.state.rngState,before.rngState);XCTAssertEqual(e.state.revision,before.revision)
   XCTAssertTrue(e.hasUnsavableSourceGameplayState);XCTAssertEqual(e.resolve().kind,.wait)
  }}
 }
 func testAllSeventeenFinalFamiliesBothOrientationsKeepCanonicalMainHUDAndVariantProvenance()throws {
  for choice in choices {for dstWild in [false,true] {
   let a=engine(choice,destinationWild:dstWild),b=engine(choice,destinationWild:dstWild)
   let pa=try reserve(a),pb=try reserve(b)
   XCTAssertTrue(b.prepareSourceDirectWildPrefix(receiptID:pb.id,generation:pb.generation).accepted)
   let ra=a.commitDirectWildGameplay(transactionID:pa.id),rb=b.commitDirectWildGameplay(transactionID:pb.id)
   XCTAssertTrue(rb.accepted,choice.variant ?? choice.archetype.rawValue);XCTAssertEqual(rb.state,ra.state);XCTAssertEqual(rb.events,ra.events);XCTAssertEqual(rb.resolution,ra.resolution)
   XCTAssertEqual(b.state,a.state);XCTAssertEqual(b.pendingHUDStars,a.pendingHUDStars);XCTAssertNil(b.sourceDirectWildPrefix)
  }}
 }
 func testNonfinalStarJuiceOriginalAvoidValueOrbitAndRecordedRNGRemainExact()throws {
  for choice in choices where choice.archetype == .star || choice.archetype == .juice {for dstWild in [false,true] {
   let a=engine(choice,destinationWild:dstWild,final:false),b=engine(choice,destinationWild:dstWild,final:false)
   let pa=try reserve(a),pb=try reserve(b)
   XCTAssertTrue(b.prepareSourceDirectWildPrefix(receiptID:pb.id,generation:pb.generation).accepted)
   XCTAssertEqual(b.sourceDirectWildPrefix?.preparedDestination.stackDepth,4)
   let ra=a.commitDirectWildGameplay(transactionID:pa.id),rb=b.commitDirectWildGameplay(transactionID:pb.id)
   XCTAssertTrue(rb.accepted);XCTAssertEqual(rb.state,ra.state);XCTAssertEqual(rb.events,ra.events);XCTAssertEqual(rb.resolution,ra.resolution);XCTAssertEqual(b.pendingWildSpawnActions,a.pendingWildSpawnActions);XCTAssertEqual(b.pendingHUDStars,a.pendingHUDStars)
  }}
 }
 func testActualMainObserverAlwaysSeesLivePrefixInsteadOfTemporarilyRestoredOriginal()throws {
  let e=engine(.init(.star),destinationWild:true),plan=try reserve(e)
  XCTAssertTrue(e.prepareSourceDirectWildPrefix(receiptID:plan.id,generation:plan.generation).accepted)
  let expected=try XCTUnwrap(e.sourceDirectWildPrefix?.preparedDestination)
  var observed:[NativeTile]=[]
  e.finalePresentationAdmitted={_,_ in observed += e.state.tiles.filter{$0.id=="dst"};return true}
  XCTAssertTrue(e.commitDirectWildGameplay(transactionID:plan.id).accepted)
  XCTAssertEqual(observed.count,1);XCTAssertEqual(observed.first,expected)
 }
 func testDuplicateForeignStaleAndPostMainPrefixCannotAlterState()throws {
  let e=engine(.init(.star)),plan=try reserve(e),before=e.state
  XCTAssertFalse(e.prepareSourceDirectWildPrefix(receiptID:"foreign",generation:plan.generation).accepted)
  XCTAssertFalse(e.prepareSourceDirectWildPrefix(receiptID:plan.id,generation:plan.generation+1).accepted);XCTAssertEqual(e.state,before)
  XCTAssertTrue(e.prepareSourceDirectWildPrefix(receiptID:plan.id,generation:plan.generation).accepted);let prefix=e.state
  XCTAssertFalse(e.prepareSourceDirectWildPrefix(receiptID:plan.id,generation:plan.generation).accepted);XCTAssertEqual(e.state,prefix)
  XCTAssertTrue(e.commitDirectWildGameplay(transactionID:plan.id).accepted);let committed=e.state
  XCTAssertFalse(e.prepareSourceDirectWildPrefix(receiptID:plan.id,generation:plan.generation).accepted);XCTAssertEqual(e.state,committed)
 }
 func testDestructivePreMainCancelConsumesPreparedPairWithoutAwardOrArrival()throws {
  let e=engine(.init(.star),destinationWild:true,final:false),plan=try reserve(e),before=e.state
  XCTAssertTrue(e.prepareSourceDirectWildPrefix(receiptID:plan.id,generation:plan.generation).accepted)
  XCTAssertTrue(e.cancelSourceMergeSixAbsorb(receiptID:plan.id,generation:plan.generation).accepted)
  XCTAssertNil(e.sourceDirectWildPrefix);XCTAssertNil(e.pendingDirectWild);XCTAssertEqual(e.state.tiles.map(\.id),["other"])
  XCTAssertEqual(e.state.score,before.score);XCTAssertEqual(e.state.moves,before.moves);XCTAssertEqual(e.state.rngState,before.rngState);XCTAssertTrue(e.pendingHUDStars.isEmpty)
  XCTAssertFalse(e.commitDirectWildGameplay(transactionID:plan.id).accepted)
 }
 func testBusyTerminalMainUsesOriginalAbortAndCapturedRecoveryWithoutPrefixScore()throws {
  let e=engine(.init(.magnet),destinationWild:true),plan=try reserve(e),before=e.state
  XCTAssertTrue(e.prepareSourceDirectWildPrefix(receiptID:plan.id,generation:plan.generation).accepted);var flags=e.flags;flags.busyEnding=true;e.setRuntimeFlags(flags)
  XCTAssertTrue(e.commitDirectWildGameplay(transactionID:plan.id).accepted)
  XCTAssertNil(e.sourceDirectWildPrefix);XCTAssertNil(e.pendingDirectWild);XCTAssertEqual(e.state.moves,before.moves);XCTAssertEqual(e.state.score,before.score);XCTAssertEqual(e.pendingWildRecoveryChecks.count,1);XCTAssertTrue(e.pendingHUDStars.isEmpty)
 }
 func testGenerationReplacementClearsPrefixAndOldCallbacksCannotTouchNewPair()throws {
  let e=engine(.init(.star)),plan=try reserve(e)
  XCTAssertTrue(e.prepareSourceDirectWildPrefix(receiptID:plan.id,generation:plan.generation).accepted)
  e.restart(state:.init(tiles:[.init(id:"dst",cell:.init(column:1,row:0),value:3)]));let replacement=e.state
  XCTAssertNil(e.sourceDirectWildPrefix);XCTAssertFalse(e.commitDirectWildGameplay(transactionID:plan.id).accepted);XCTAssertFalse(e.prepareSourceDirectWildPrefix(receiptID:plan.id,generation:plan.generation).accepted);XCTAssertEqual(e.state,replacement)
 }
 func testRejectedMainRetainsUnsavablePrefixUntilGenuineDestructiveCancellation()throws {
  let e=engine(.init(.star),final:false,meter:0.7),plan=try reserve(e)
  XCTAssertTrue(e.prepareSourceDirectWildPrefix(receiptID:plan.id,generation:plan.generation).accepted)
  e.setInputLock("external-test-owner",active:true)
  let result=e.commitDirectWildGameplay(transactionID:plan.id)
  XCTAssertFalse(result.accepted);XCTAssertNotNil(e.sourceDirectWildPrefix);XCTAssertEqual(e.pendingDirectWild,plan);XCTAssertTrue(e.hasUnsavableSourceGameplayState)
  XCTAssertTrue(e.cancelSourceMergeSixAbsorb(receiptID:plan.id,generation:plan.generation).accepted);XCTAssertNil(e.sourceDirectWildPrefix)
 }
 func testPreparedLiveTileMatchesAllLiteralSourcePrefixOracleRecords()throws {
  let url=try XCTUnwrap(Bundle.module.url(forResource:"SourceDirectWildPrefixV9Oracle",withExtension:"json"))
  let root=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(contentsOf:url)) as? [String:Any]),rows=try XCTUnwrap(root["records"] as? [[String:Any]])
  XCTAssertEqual(rows.count,34)
  for row in rows {
   let choice=try XCTUnwrap(row["choice"] as? [String:Any]),special=try XCTUnwrap(choice["special"] as? String),archetype=try XCTUnwrap(NativeWildArchetype(rawValue:special)),final=try XCTUnwrap(row["final"] as? Bool)
   let e=engine(.init(archetype,variant:choice["variant"] as? String),destinationWild:true,final:final)
   if !final && (archetype == .magnet || archetype == .tnt) {
    XCTAssertTrue(e.beginDrag(tileID:"src"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
    let special=try XCTUnwrap(e.pendingSpecial),before=e.state
    XCTAssertFalse(e.prepareSourceDirectWildPrefix(receiptID:special.id,generation:special.generation).accepted)
    XCTAssertEqual(e.state,before);continue // Separate genuine Special-main owner, never a direct receipt.
   }
   let plan=try reserve(e)
   XCTAssertTrue(e.prepareSourceDirectWildPrefix(receiptID:plan.id,generation:plan.generation).accepted)
   let actual=try XCTUnwrap(e.sourceDirectWildPrefix?.preparedDestination)
   XCTAssertEqual(actual.value,row["value"] as? Int);XCTAssertEqual(actual.stackDepth,row["depth"] as? Int);XCTAssertEqual(actual.variant,row["variant"] as? String)
   XCTAssertEqual(actual.isWild,row["isWild"] as? Bool);XCTAssertEqual(actual.visible,row["parentVisible"] as? Bool);XCTAssertEqual(actual.alpha,row["parentAlpha"] as? Double)
   XCTAssertNil(actual.archetype);XCTAssertTrue(actual.sourceWildStateCleared)
  }
 }
 func testOldNativeTileJSONDefaultsFalseAndPreparedFlagRoundTripsWithVariant()throws {
  let original=NativeTile(id:"wild",cell:.init(column:0,row:0),value:6,archetype:.star,variant:"fish")
  let encoder=JSONEncoder(),decoder=JSONDecoder()
  var json=try XCTUnwrap(JSONSerialization.jsonObject(with:encoder.encode(original)) as? [String:Any]);json.removeValue(forKey:"sourceWildStateCleared")
  let old=try decoder.decode(NativeTile.self,from:JSONSerialization.data(withJSONObject:json));XCTAssertEqual(old,original);XCTAssertFalse(old.sourceWildStateCleared);XCTAssertTrue(old.isWild)
  var cleared=original;cleared.sourceWildStateCleared=true;cleared.archetype=nil
  let restored=try decoder.decode(NativeTile.self,from:encoder.encode(cleared))
  XCTAssertEqual(restored,cleared);XCTAssertEqual(restored.variant,"fish");XCTAssertFalse(restored.isWild);XCTAssertNil(restored.gameplayArchetype)
 }
}
