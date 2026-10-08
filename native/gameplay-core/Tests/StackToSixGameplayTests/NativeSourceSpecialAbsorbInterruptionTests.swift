import XCTest
@testable import StackToSixGameplay
nonisolated final class NativeSourceSpecialAbsorbInterruptionTests:XCTestCase {
 private func engine(_ choice:NativeWildRewardChoice,count:Int=4,stagedTnt:Bool=true)->NativeGameplayEngine {
  let tiles:[NativeTile]=[.init(id:"src",cell:.init(column:0,row:0),value:6,archetype:choice.archetype,variant:choice.variant),.init(id:"dst",cell:.init(column:1,row:0),value:2)]+(0..<count).map{.init(id:"pull:\($0)",cell:.init(column:$0,row:1),value:2+$0%4)}+[.init(id:"unrelated",cell:.init(column:4,row:8),value:0,locked:true)]
  let e=NativeGameplayEngine(state:.init(tiles:tiles,score:100,combo:2,wildMeter:0.25));e.stagedTntActivation=stagedTnt;e.laserTargetX={_ in 195};e.laserViewportWidth=390;return e
 }
 private func reserve(_ e:NativeGameplayEngine)throws->NativeSpecialMovePlan {
  XCTAssertTrue(e.beginDrag(tileID:"src"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted);return try XCTUnwrap(e.pendingSpecial)
 }
 private func register(_ e:NativeGameplayEngine,_ plan:NativeSpecialMovePlan)throws->NativeSourceSpecialAbsorbReceipt {try XCTUnwrap(e.registerSourceSpecialAbsorbOwner(transactionID:plan.id,generation:plan.generation))}
 private func accounting(_ s:NativeBoardState)->[Double] {[Double(s.score),Double(s.moves),Double(s.combo),Double(s.earnedComboBonus),Double(s.cubesCracked),s.wildMeter,Double(s.wildSpawnCount)]}
 func testRawCurrentSpecialHasNoImplicitMainOwnerOrTimeBasedCancellation()throws {
  let e=engine(.init(.magnet)),plan=try reserve(e),before=e.state
  XCTAssertNil(e.pendingSourceSpecialAbsorb)
  XCTAssertFalse(e.cancelSourceSpecialAbsorb(receiptID:plan.id,generation:plan.generation).accepted);XCTAssertEqual(e.state,before)
  XCTAssertFalse(e.cancelSourceMergeSixAbsorb(receiptID:plan.id,generation:plan.generation).accepted)
  XCTAssertNil(e.registerSourceSpecialAbsorbOwner(transactionID:"foreign",generation:plan.generation));XCTAssertNil(e.registerSourceSpecialAbsorbOwner(transactionID:plan.id,generation:plan.generation+1))
 }
 func testAllNineOriginalNonfinalMagnetTntSelectionsCancelOnlyRegisteredPremainPair()throws {
  let choices:[NativeWildRewardChoice]=[.init(.magnet),.init(.tnt)]+NativeSpecialDiceRegistry.variants.values.filter{[NativeWildArchetype.magnet,.tnt].contains($0.archetype)}.sorted{$0.id<$1.id}.map{.init($0.archetype,variant:$0.id)}
  XCTAssertEqual(choices.count,9)
  for choice in choices {
   let e=engine(choice),plan=try reserve(e),receipt=try register(e,plan),before=e.state
   XCTAssertEqual(receipt.transactionID,plan.id);XCTAssertEqual(receipt.sourceID,"src");XCTAssertEqual(receipt.destinationID,"dst")
   let result=e.cancelSourceSpecialAbsorb(receiptID:receipt.id,generation:receipt.generation)
   XCTAssertTrue(result.accepted,choice.variant ?? choice.archetype.rawValue);XCTAssertEqual(accounting(e.state),accounting(before));XCTAssertEqual(e.state.rngState,before.rngState);XCTAssertEqual(e.state.revision,before.revision)
   XCTAssertNil(e.pendingSpecial);XCTAssertNil(e.pendingSourceSpecialAbsorb);XCTAssertFalse(e.flags.pendingSpecialMutation);XCTAssertFalse(e.flags.wildMagnetPullInProgress);XCTAssertFalse(e.hasUnsavableSourceGameplayState)
   XCTAssertNil(e.state.tiles.first{$0.id=="src"});XCTAssertNil(e.state.tiles.first{$0.id=="dst"});XCTAssertEqual(e.state.tiles.count,5);XCTAssertNil(e.state.terminal)
   XCTAssertTrue(result.events.contains{$0.kind == .mergeSixAbsorbInterrupted && $0.reason==plan.id});XCTAssertFalse(result.events.contains{[.spawned,.specialImpact,.specialBoardCommitted,.terminal,.wildRecoveryCheckPrepared,.merged].contains($0.kind)})
   XCTAssertFalse(e.cancelSourceSpecialAbsorb(receiptID:receipt.id,generation:receipt.generation).accepted);XCTAssertFalse(e.commitSourceSpecialAbsorbMain(receiptID:receipt.id,generation:receipt.generation).accepted)
   for tile in e.state.tiles where tile.value>0 {XCTAssertFalse(tile.locked);XCTAssertFalse(tile.magnetOwned);XCTAssertFalse(tile.resolutionOwned)}
  }
 }
 func testActualMainEnteredReceiptClosesMagnetWindowBeforeConvergenceWithoutLogicalCommit()throws {
  let e=engine(.init(.magnet)),plan=try reserve(e),receipt=try register(e,plan),before=e.state
  XCTAssertNil(e.pendingMagnetRespawn);XCTAssertFalse(e.sourceSpecialAbsorbMainEntered)
  XCTAssertTrue(e.commitSourceSpecialAbsorbMain(receiptID:receipt.id,generation:receipt.generation).accepted)
  XCTAssertEqual(e.state,before);XCTAssertTrue(e.sourceSpecialAbsorbMainEntered);XCTAssertNil(e.pendingMagnetRespawn)
  XCTAssertFalse(e.cancelSourceSpecialAbsorb(receiptID:receipt.id,generation:receipt.generation).accepted);XCTAssertFalse(e.commitSourceSpecialAbsorbMain(receiptID:receipt.id,generation:receipt.generation).accepted);XCTAssertEqual(e.state,before)
  XCTAssertTrue(e.prepareMagnetRespawn(transactionID:plan.id).accepted);XCTAssertFalse(e.cancelSourceSpecialAbsorb(receiptID:receipt.id,generation:receipt.generation).accepted)
 }
 func testActualTntActivationAndImpactRejectPremainCancellation()throws {
  let e=engine(.init(.tnt)),plan=try reserve(e),receipt=try register(e,plan)
  XCTAssertTrue(e.commitSpecialActivation(transactionID:plan.id).accepted);XCTAssertTrue(e.sourceSpecialAbsorbMainEntered)
  let activated=e.state;XCTAssertFalse(e.cancelSourceSpecialAbsorb(receiptID:receipt.id,generation:receipt.generation).accepted);XCTAssertEqual(e.state,activated)
  XCTAssertTrue(e.reserveTntTargets(transactionID:plan.id).accepted)
  let current=try XCTUnwrap(e.pendingSpecial),target=try XCTUnwrap(current.targets.first)
  XCTAssertTrue(e.commitSpecialImpact(transactionID:plan.id,tileID:target.id).accepted);let impacted=e.state
  XCTAssertFalse(e.cancelSourceSpecialAbsorb(receiptID:receipt.id,generation:receipt.generation).accepted);XCTAssertEqual(e.state,impacted)
 }
 func testForeignDuplicateAndObsoleteReceiptsCannotReleaseCurrentSpecialOrTouchReplacement()throws {
  let e=engine(.init(.magnet)),plan=try reserve(e),receipt=try register(e,plan),before=e.state
  XCTAssertNil(e.registerSourceSpecialAbsorbOwner(transactionID:plan.id,generation:plan.generation))
  XCTAssertFalse(e.cancelSourceSpecialAbsorb(receiptID:"foreign",generation:receipt.generation).accepted);XCTAssertFalse(e.cancelSourceSpecialAbsorb(receiptID:receipt.id,generation:receipt.generation+1).accepted)
  XCTAssertFalse(e.commitSourceSpecialAbsorbMain(receiptID:"foreign",generation:receipt.generation).accepted);XCTAssertEqual(e.state,before)
  e.restart(state:.init(tiles:[.init(id:"dst",cell:plan.destination.cell,value:3)],wildMeter:1.25))
  XCTAssertFalse(e.cancelSourceSpecialAbsorb(receiptID:receipt.id,generation:receipt.generation).accepted);XCTAssertEqual(e.state.tiles.first?.value,3);XCTAssertEqual(e.state.wildMeter,1.25);XCTAssertNil(e.pendingSourceSpecialAbsorb)
 }
 func testOwnedPullRestorationDoesNotOverwriteDestroyedMarkersOrUnrelatedTerminalGuard()throws {
  let e=engine(.init(.magnet)),plan=try reserve(e),receipt=try register(e,plan),target=try XCTUnwrap(plan.targets.first)
  var marker=NativeNoMovesTileRuntime();marker.destroyed=true;marker.eventMode = .none;e.noMovesTileRuntime[target.id]=marker
  var flags=NativeGameplayRuntimeFlags();flags.busyEnding=true;e.setRuntimeFlags(flags)
  XCTAssertTrue(e.cancelSourceSpecialAbsorb(receiptID:receipt.id,generation:receipt.generation).accepted)
  XCTAssertTrue(e.flags.busyEnding);XCTAssertTrue(e.noMovesTileRuntime[target.id]?.destroyed==true);XCTAssertEqual(e.noMovesTileRuntime[target.id]?.eventMode,NativeNoMovesTileRuntime.EventMode.none)
  XCTAssertTrue(e.state.tiles.first{$0.id==target.id}?.locked==true)
  for other in plan.targets.dropFirst() {XCTAssertFalse(try XCTUnwrap(e.state.tiles.first{$0.id==other.id}).locked)}
 }
 func testLegacyEagerTntTargetRouteCannotRegisterUnprovenSourceMainOwner()throws {
  let e=engine(.init(.tnt),stagedTnt:false),plan=try reserve(e),before=e.state
  XCTAssertNil(e.registerSourceSpecialAbsorbOwner(transactionID:plan.id,generation:plan.generation));XCTAssertEqual(e.state,before)
  XCTAssertTrue(e.commitSpecialActivation(transactionID:plan.id).accepted)
 }
 private struct Gold:Decodable {let rows:[Row],mainRows:[MainRow]}
 private struct MainRow:Decodable {let family:String,mode:String,mainEntered:Bool,settled:Bool,interrupts:Int,removals:[String]}
 private struct Row:Decodable {let family:String,count:Int,mode:String,frameRelease:Int,idleRelease:Int,pullRelease:Int,stopped:Int,queued:Int,bindings:Int,targets:[Target]}
 private struct Target:Decodable {let id:String,destroyed:Bool,locked:Bool,magnetOwned:Bool,eventMode:String,gridOwned:Bool}
 func testOriginalFullPullCleanup32RealGsapCasesMatchOwnedModelRestoration()throws {
  let url=try XCTUnwrap(Bundle.module.url(forResource:"SourceSpecialPullInterruptOracle",withExtension:"json")),rows=try JSONDecoder().decode(Gold.self,from:Data(contentsOf:url)).rows
  XCTAssertEqual(rows.count,32)
  for row in rows {
   let e=engine(.init(.magnet,variant:row.family=="magnet" ? nil:row.family),count:row.count),plan=try reserve(e),receipt=try register(e,plan)
   if row.mode=="destroyed-first" {var m=NativeNoMovesTileRuntime();m.destroyed=true;e.noMovesTileRuntime["pull:0"]=m}
   let result=e.cancelSourceSpecialAbsorb(receiptID:receipt.id,generation:receipt.generation);XCTAssertTrue(result.accepted)
   XCTAssertEqual(row.frameRelease,1);XCTAssertEqual(row.idleRelease,1);XCTAssertEqual(row.pullRelease,1);XCTAssertEqual(row.stopped,1);XCTAssertEqual(row.queued,2)
   for target in row.targets where !target.destroyed {
    let tile=try XCTUnwrap(e.state.tiles.first{$0.id==target.id});XCTAssertEqual(tile.locked,target.locked);XCTAssertEqual(tile.magnetOwned,target.magnetOwned);XCTAssertFalse(tile.resolutionOwned);XCTAssertTrue(target.gridOwned);XCTAssertEqual(target.eventMode,"static")
   }
   XCTAssertEqual(row.bindings,row.targets.filter{!$0.destroyed}.count)
  }
 }
}


extension NativeSourceSpecialAbsorbInterruptionTests {
 func testLiteralActualGsapMainMarker27BoundariesCloseWindowEvenBeforeAssetsOrPullReady()throws {
  let url=try XCTUnwrap(Bundle.module.url(forResource:"SourceSpecialPullInterruptOracle",withExtension:"json")),gold=try JSONDecoder().decode(Gold.self,from:Data(contentsOf:url))
  XCTAssertEqual(gold.mainRows.count,27)
  for row in gold.mainRows {
   let magnet=["magnet","spaceship","bottle","honey"].contains(row.family)
   let e=engine(.init(magnet ? .magnet:.tnt,variant:["magnet","tnt"].contains(row.family) ? nil:row.family)),plan=try reserve(e),receipt=try register(e,plan),before=e.state
   if row.mainEntered {
    XCTAssertTrue(e.commitSourceSpecialAbsorbMain(receiptID:receipt.id,generation:receipt.generation).accepted)
    XCTAssertTrue(e.sourceSpecialAbsorbMainEntered);XCTAssertNil(e.pendingMagnetRespawn);XCTAssertFalse(e.specialActivationCommitted)
    XCTAssertFalse(e.cancelSourceSpecialAbsorb(receiptID:receipt.id,generation:receipt.generation).accepted);XCTAssertEqual(e.state,before)
    XCTAssertEqual(row.interrupts,0);XCTAssertTrue(row.removals.isEmpty)
   } else {
    XCTAssertTrue(e.cancelSourceSpecialAbsorb(receiptID:receipt.id,generation:receipt.generation).accepted)
    XCTAssertEqual(row.interrupts,1);XCTAssertEqual(row.removals,["src","dst"])
   }
   XCTAssertTrue(row.settled)
  }
 }
}
