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
