import XCTest
@testable import StackToSixGameplay
nonisolated final class NativeSourceWildDestinationFaceTests:XCTestCase {
 private func engine(_ kind:NativeWildArchetype,final:Bool=true,variant:String?=nil,destinationWild:Bool=true)->NativeGameplayEngine {
  let src=NativeTile(id:"src",cell:.init(column:0,row:0),value:destinationWild ? 4:6,stackDepth:4,archetype:destinationWild ? nil:kind)
  let dst=NativeTile(id:"dst",cell:.init(column:1,row:0),value:destinationWild ? 6:4,archetype:destinationWild ? kind:nil,variant:variant)
  let e=NativeGameplayEngine(state:.init(tiles:[src,dst]+(final ? []:[.init(id:"other",cell:.init(column:4,row:8),value:3)])),recordedRandomChoices:Array(repeating:0.2,count:100))
  e.stagedDirectWildMoves=true;e.stagedDirectWildAssignments=true
  return e
 }
 private func prefix(_ e:NativeGameplayEngine)throws->NativeDirectWildMovePlan {
  XCTAssertTrue(e.beginDrag(tileID:"src"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
  let p=try XCTUnwrap(e.pendingDirectWild);XCTAssertTrue(e.prepareSourceDirectWildPrefix(receiptID:p.id,generation:p.generation).accepted);return p
 }
 func testGenuineFirstFaceReassertsPresenceAndDepthWithSpecialStillNilAndNoAccounting()throws {
  for kind in [NativeWildArchetype.star,.juice] {for final in [false,true] {
   let e=engine(kind,final:final),p=try prefix(e),before=e.state,r=try XCTUnwrap(e.prepareSourceWildDestinationFace(transactionID:p.id,generation:p.generation))
   XCTAssertEqual(e.state,before);XCTAssertEqual(r.originalDestination,p.destination);XCTAssertEqual(r.assetPath,"assets/wild.png")
   XCTAssertTrue(e.commitSourceWildDestinationFace(receiptID:r.id,generation:r.generation).accepted)
   let t=try XCTUnwrap(e.state.tiles.first{$0.id=="dst"});XCTAssertEqual(t.stackDepth,1);XCTAssertTrue(t.isWild);XCTAssertTrue(t.sourceResidualWildPresence);XCTAssertTrue(t.sourceWildStateCleared);XCTAssertNil(t.gameplayArchetype);XCTAssertNil(t.archetype);XCTAssertTrue(t.visible)
   XCTAssertEqual(e.state.moves,before.moves);XCTAssertEqual(e.state.score,before.score);XCTAssertEqual(e.state.rngState,before.rngState);XCTAssertEqual(e.state.revision,before.revision);XCTAssertEqual(e.state.wildMeter,before.wildMeter)
   XCTAssertTrue(e.hasUnsavableSourceGameplayState);XCTAssertEqual(e.resolve().kind,.wait);XCTAssertEqual(e.sourceGameplaySignature.entries.first{$0.gridX==1}?.special,nil)
   XCTAssertFalse(e.commitSourceWildDestinationFace(receiptID:r.id,generation:r.generation).accepted)
  }}
 }
 func testCapturedMainUsesOriginalJuiceFamilyEvenAfterDefaultStarPhysicalFaceAndObserversSeeLiveState()throws {
  for kind in [NativeWildArchetype.star,.juice] {for final in [false,true] {
   let a=engine(kind,final:final),b=engine(kind,final:final),pa=try prefix(a),pb=try prefix(b)
   let r=try XCTUnwrap(b.prepareSourceWildDestinationFace(transactionID:pb.id,generation:pb.generation));XCTAssertTrue(b.commitSourceWildDestinationFace(receiptID:r.id,generation:r.generation).accepted)
   var seen=false
   if final {b.finalePresentationAdmitted={family,_ in seen=true;XCTAssertEqual(family,kind);XCTAssertEqual(b.state.tiles.first{$0.id=="dst"},r.afterFace);return true}}
   let baseline=a.commitDirectWildGameplay(transactionID:pa.id),actual=b.commitDirectWildGameplay(transactionID:pb.id)
   XCTAssertTrue(actual.accepted);XCTAssertEqual(actual.state,baseline.state);XCTAssertEqual(actual.events,baseline.events);XCTAssertEqual(actual.resolution,baseline.resolution);XCTAssertEqual(b.pendingHUDStars,a.pendingHUDStars)
   if final {XCTAssertTrue(seen)};XCTAssertNil(b.pendingSourceWildDestinationFace);XCTAssertNil(b.completedSourceWildDestinationFace)
  }}
 }
 func testActualDestructiveCancelRetiresOnlyCapturedPairAndStaleFaceCannotRevive()throws {
  for delivered in [false,true] {
   let e=engine(.juice,final:false),p=try prefix(e),r=try XCTUnwrap(e.prepareSourceWildDestinationFace(transactionID:p.id,generation:p.generation)),before=e.state
   if delivered {XCTAssertTrue(e.commitSourceWildDestinationFace(receiptID:r.id,generation:r.generation).accepted)}
   XCTAssertTrue(e.cancelSourceMergeSixAbsorb(receiptID:p.id,generation:p.generation).accepted);XCTAssertEqual(e.state.tiles.map(\.id),["other"])
   XCTAssertEqual(e.state.moves,before.moves);XCTAssertEqual(e.state.score,before.score);XCTAssertEqual(e.state.rngState,before.rngState);XCTAssertNil(e.pendingSourceWildDestinationFace);XCTAssertNil(e.completedSourceWildDestinationFace)
   XCTAssertFalse(e.commitSourceWildDestinationFace(receiptID:r.id,generation:r.generation).accepted)
  }
 }
 func testRealMainBeforeQueuedFaceRetiresReceiptRatherThanManufacturePaint()throws {
  let e=engine(.star),p=try prefix(e),r=try XCTUnwrap(e.prepareSourceWildDestinationFace(transactionID:p.id,generation:p.generation))
  XCTAssertTrue(e.commitDirectWildGameplay(transactionID:p.id).accepted);let settled=e.state
  XCTAssertNil(e.pendingSourceWildDestinationFace);XCTAssertFalse(e.commitSourceWildDestinationFace(receiptID:r.id,generation:r.generation).accepted);XCTAssertEqual(e.state,settled)
 }
 func testUnprovenVariantsRegularDestinationAndDuplicatePreparationFailClosed()throws {
  for variant in [nil,"bee"] {
   let e=engine(.star,variant:variant,destinationWild:variant != nil),p=try prefix(e)
   XCTAssertNil(e.prepareSourceWildDestinationFace(transactionID:p.id,generation:p.generation))
  }
  let e=engine(.star),p=try prefix(e);XCTAssertNotNil(e.prepareSourceWildDestinationFace(transactionID:p.id,generation:p.generation));XCTAssertNil(e.prepareSourceWildDestinationFace(transactionID:p.id,generation:p.generation))
  e.restart(state:.init(tiles:[]));XCTAssertNil(e.pendingSourceWildDestinationFace);XCTAssertNil(e.completedSourceWildDestinationFace)
 }
 func testMissingOldNativeFieldDefaultsFalseAndTrueRoundtripRetainsClearedSpecial()throws {
  var tile=NativeTile(id:"t",cell:.init(column:0,row:0),value:6,archetype:.juice,sourceWildStateCleared:true)
  let encoded=try JSONEncoder().encode(tile);var object=try XCTUnwrap(JSONSerialization.jsonObject(with:encoded) as? [String:Any]);object.removeValue(forKey:"sourceResidualWildPresence")
  XCTAssertFalse(try JSONDecoder().decode(NativeTile.self,from:JSONSerialization.data(withJSONObject:object)).sourceResidualWildPresence)
  tile.archetype=nil;tile.sourceResidualWildPresence=true;let saved=try JSONDecoder().decode(NativeTile.self,from:JSONEncoder().encode(tile));XCTAssertEqual(saved,tile);XCTAssertTrue(saved.isWild);XCTAssertNil(saved.gameplayArchetype)
 }
 func testTypedCallbackMatchesExecutedLiteralSourceConstructionRatherThanManualPrefixAssumption()throws {
  struct Oracle:Decodable {struct Row:Decodable {struct Face:Decodable {let isWild,isWildFace:Bool;let depth:Int;let asset:String;let parentVisible:Bool};let special:String;let final:Bool;let afterFirst:Face};let cases:[Row]}
  let data=try Data(contentsOf:try XCTUnwrap(Bundle.module.url(forResource:"SourceWildDestinationBackingV9Oracle",withExtension:"json")))
  let rows=try JSONDecoder().decode(Oracle.self,from:data).cases;XCTAssertEqual(rows.count,4)
  for row in rows {
   let e=engine(row.special=="wild" ? .star:.juice,final:row.final),p=try prefix(e),r=try XCTUnwrap(e.prepareSourceWildDestinationFace(transactionID:p.id,generation:p.generation))
   XCTAssertTrue(e.commitSourceWildDestinationFace(receiptID:r.id,generation:r.generation).accepted)
   XCTAssertEqual(r.afterFace.stackDepth,row.afterFirst.depth);XCTAssertEqual(r.afterFace.isWild,row.afterFirst.isWild);XCTAssertTrue(row.afterFirst.isWildFace);XCTAssertEqual(r.afterFace.visible,row.afterFirst.parentVisible)
   XCTAssertEqual(r.assetPath,row.afterFirst.asset.replacingOccurrences(of:"./",with:""));XCTAssertNil(r.afterFace.archetype)
  }
 }

}
