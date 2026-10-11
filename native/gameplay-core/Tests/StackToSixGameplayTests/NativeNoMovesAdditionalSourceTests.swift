import XCTest
@testable import StackToSixGameplay
final class NativeNoMovesAdditionalSourceTests:XCTestCase {
 func testPreservedOriginalInputsAndAllVariants285() throws {
  let url=try XCTUnwrap(Bundle.module.url(forResource:"NativeNoMovesFreshOracle",withExtension:"json"))
  let root=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(contentsOf:url)) as? [String:Any])
  let cases=try XCTUnwrap(root["cases"] as? [[String:Any]])
  XCTAssertEqual(cases.count,285)
  for row in cases {
   let input=try XCTUnwrap(row["tiles"] as? [[String:Any]]),expected=try XCTUnwrap(row["expected"] as? [String:String])
   var runtime:[String:NativeNoMovesTileRuntime]=[:]
   let tiles=input.map {d->NativeTile in
    var t=NativeTile(id:d["id"] as! String,cell:.init(column:d["gridX"] as! Int,row:d["gridY"] as! Int),value:d["value"] as! Int,stackDepth:d["stackDepth"] as! Int,archetype:(d["special"] as? String).flatMap(NativeWildArchetype.init(rawValue:)),variant:d["_ccSpecialDiceVariant"] as? String,locked:d["locked"] as! Bool,visible:d["visible"] as! Bool,alpha:d["alpha"] as! Double)
    t.transientSpawn=d["_isBeingSpawned"] as? Bool ?? false;t.pendingRemoval=d["_pendingRemoval"] as? Bool ?? false;t.magnetOwned=d["_wildMagnetAffected"] as? Bool ?? false
    var r=NativeNoMovesTileRuntime();r.eventMode=NativeNoMovesTileRuntime.EventMode(rawValue:d["eventMode"] as! String) ?? .normal;r.wildHandoff=d["_ccWildSpawnHandoffLock"] as? Bool ?? false;r.wildDropping=d["_ccWildSpawnDropping"] as? Bool ?? false;runtime[t.id]=r;return t
   }
   let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime)
   let kind:NativeResolution.Kind=expected["type"]=="stuck" ? .fail:expected["type"]=="clean" ? .complete:.continue
   XCTAssertEqual(result.kind,kind,row["label"] as! String);XCTAssertEqual(result.reason,expected["reason"],row["label"] as! String)
  }
 }
 func testForcedFreshQueryRetiresOnlyActualInteractiveStaleFlag() {
  let a=NativeTile(id:"a",cell:.init(column:0,row:0),value:4,transientSpawn:true)
  let b=NativeTile(id:"b",cell:.init(column:1,row:0),value:3)
  let e=NativeGameplayEngine(state:.init(tiles:[a,b]));e.stagedSourceNoMoves=true
  guard case .candidate=e.beginSourceNoMoves(origin:.levelEnd) else{return XCTFail()}
  XCTAssertFalse(e.state.tiles[0].transientSpawn);XCTAssertEqual(e.state.moves,50);XCTAssertEqual(e.state.rngState,1)
 }
 func testLockedSpawnFlagRemainsAndDefers() {
  let a=NativeTile(id:"a",cell:.init(column:0,row:0),value:4,locked:true,transientSpawn:true)
  let e=NativeGameplayEngine(state:.init(tiles:[a]));e.stagedSourceNoMoves=true
  XCTAssertEqual(e.beginSourceNoMoves(origin:.levelEnd),.deferred("fresh-result:continue"));XCTAssertTrue(e.state.tiles[0].transientSpawn)
 }
 func testOptInCannotBypassSourceExitThroughLegacyConfirm() {
  let e=NativeGameplayEngine(state:.init(tiles:[NativeTile(id:"a",cell:.init(column:0,row:0),value:4)]))
  let signature=e.beginNoMovesConfirmation()!;e.stagedSourceNoMoves=true
  XCTAssertNil(e.beginNoMovesConfirmation());XCTAssertFalse(e.confirmNoMoves(signature:signature,generation:1).accepted);XCTAssertNil(e.state.terminal)
 }
 func testPostcheckCandidateRequiresRealOwnedDelivery() {
  let state=NativeBoardState(tiles:[NativeTile(id:"a",cell:.init(column:0,row:0),value:2),NativeTile(id:"b",cell:.init(column:1,row:0),value:3)])
  let e=NativeGameplayEngine(state:state);e.stagedSourceNoMoves=true;e.stagedOrdinaryMoves=true
  XCTAssertTrue(e.beginDrag(tileID:"a"));XCTAssertTrue(e.drop(target:state.tiles[1].cell).accepted)
  let receipt=e.pendingOrdinaryStack!
  XCTAssertEqual(e.beginSourceNoMovesForOrdinaryPostcheck(receiptID:receipt.id,generation:1),.ignored)
  _ = e.finishOrdinaryStackAbsorb(receiptID:receipt.id,generation:1)
  XCTAssertEqual(e.beginSourceNoMovesForOrdinaryPostcheck(receiptID:receipt.id,generation:1),.ignored)
  XCTAssertTrue(e.commitOrdinaryPostcheck(receiptID:receipt.id,generation:1).accepted)
  guard case .candidate=e.beginSourceNoMovesForOrdinaryPostcheck(receiptID:receipt.id,generation:1) else{return XCTFail()}
 }
}
