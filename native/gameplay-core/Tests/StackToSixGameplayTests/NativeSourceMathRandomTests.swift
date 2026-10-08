import XCTest
@testable import StackToSixGameplay
nonisolated final class NativeSourceMathRandomTests:XCTestCase {
 private func board(seed:UInt64=123)->NativeBoardState {.init(tiles:[.init(id:"six",cell:.init(column:0,row:0),value:6),.init(id:"other",cell:.init(column:4,row:8),value:6)],mode:.journey,board:7,stage:7,rngState:seed)}
 func testSameImmutableFunctionInterleavesActualCoreAndFXDrawsWithoutSeedMutation() {
  var index=0;let rolls=[0.1,0.4,0.8];let stream=NativeSourceMathRandomStream{defer{index+=1};return rolls[index]}
  XCTAssertEqual(stream.next(),0.1) // genuine caller-owned FX slot
  let e=NativeGameplayEngine(state:board(),sourceMathRandom:stream)
  XCTAssertTrue(e.sourceMathRandom === stream)
  let result=e.repairLingeringRegularSix(tileID:"six",generation:1,revision:0)
  XCTAssertTrue(result.accepted);XCTAssertEqual(result.events.first{$0.kind == .spawned}?.value,3)
  XCTAssertEqual(stream.next(),0.8);XCTAssertEqual(index,3);XCTAssertEqual(e.state.rngState,123)
 }
 func testSourceExternalDrawsAreNotRewoundWhenNativeRejectedPolicyRestoresModel() {
  var draws=0;let rolls=[0.11,0.22,0.33,0.44,0.55]
  let stream=NativeSourceMathRandomStream{defer{draws+=1};return rolls[draws]}
  let initial=NativeBoardState(tiles:[],wildMeter:1,rngState:123)
  var picked:[Double]=[]
  let e=NativeGameplayEngine(state:initial,rewardPicker:{_,roll in picked.append(roll);return nil},sourceMathRandom:stream)
  XCTAssertFalse(e.claimMeterReward().accepted);XCTAssertEqual(e.state,initial);XCTAssertEqual(picked,[0.22]);XCTAssertEqual(draws,2)
  XCTAssertEqual(stream.next(),0.33)
  XCTAssertFalse(e.claimMeterReward().accepted);XCTAssertEqual(picked,[0.22,0.55]);XCTAssertEqual(draws,5);XCTAssertEqual(e.state,initial)
 }
 func testNilSourceKeepsOriginalRecordedChoiceRollbackAndSeedUnchanged() {
  let initial=NativeBoardState(tiles:[],wildMeter:1,rngState:123);var picked:[Double]=[]
  let e=NativeGameplayEngine(state:initial,recordedRandomChoices:[0.11,0.22],rewardPicker:{_,roll in picked.append(roll);return nil})
  XCTAssertNil(e.sourceMathRandom);XCTAssertFalse(e.claimMeterReward().accepted);XCTAssertFalse(e.claimMeterReward().accepted)
  XCTAssertEqual(picked,[0.22,0.22]);XCTAssertEqual(e.state,initial)
 }
 func testNilSourceSeededAndRecordedBaselinesRetainExactExistingResults() {
  let a=NativeGameplayEngine(state:board()),b=NativeGameplayEngine(state:board(),sourceMathRandom:nil)
  let ra=a.repairLingeringRegularSix(tileID:"six",generation:1,revision:0),rb=b.repairLingeringRegularSix(tileID:"six",generation:1,revision:0)
  XCTAssertEqual(ra.accepted,rb.accepted);XCTAssertEqual(ra.state,rb.state);XCTAssertEqual(ra.events,rb.events);XCTAssertEqual(ra.resolution,rb.resolution)
  XCTAssertNotEqual(a.state.rngState,123)
  let recorded=NativeGameplayEngine(state:board(),recordedRandomChoices:[0.99])
  XCTAssertTrue(recorded.repairLingeringRegularSix(tileID:"six",generation:1,revision:0).accepted)
  XCTAssertEqual(recorded.state.activeTiles.first{$0.value != 6}?.value,5);XCTAssertEqual(recorded.state.rngState,123)
 }
 func testSourceIsExplicitlyAuthoritativeRatherThanForkingRecordedQueue() {
  var draws=0;let stream=NativeSourceMathRandomStream{draws+=1;return 0.25}
  let e=NativeGameplayEngine(state:board(),recordedRandomChoices:[0.99],sourceMathRandom:stream)
  XCTAssertTrue(e.repairLingeringRegularSix(tileID:"six",generation:1,revision:0).accepted)
  XCTAssertEqual(e.state.activeTiles.first{$0.value != 6}?.value,2);XCTAssertEqual(draws,1);XCTAssertEqual(e.state.rngState,123)
 }
 func testRestartAndSeparateSceneEngineKeepOneAppStreamWithoutResetOrFork() {
  var draws=0;let rolls=[0.1,0.6,0.9]
  let stream=NativeSourceMathRandomStream{defer{draws+=1};return rolls[draws]}
  let a=NativeGameplayEngine(state:board(),sourceMathRandom:stream),b=NativeGameplayEngine(state:board(seed:999),sourceMathRandom:stream)
  XCTAssertTrue(a.repairLingeringRegularSix(tileID:"six",generation:1,revision:0).accepted)
  XCTAssertTrue(b.repairLingeringRegularSix(tileID:"six",generation:1,revision:0).accepted)
  a.restart(state:board());XCTAssertTrue(a.repairLingeringRegularSix(tileID:"six",generation:a.state.generation,revision:0).accepted)
  XCTAssertEqual(draws,3);XCTAssertTrue(a.sourceMathRandom === b.sourceMathRandom);XCTAssertEqual(a.state.rngState,123);XCTAssertEqual(b.state.rngState,999)
 }
 func testRejectedInputDoesNotConsumeAppMathOrAdvancePersistedSeed() {
  var draws=0;let stream=NativeSourceMathRandomStream{draws+=1;return 0.4}
  let e=NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1)],rngState:123),sourceMathRandom:stream),before=e.state
  XCTAssertTrue(e.beginDrag(tileID:"a"));XCTAssertFalse(e.drop(target:.init(column:4,row:8)).accepted)
  XCTAssertEqual(e.state,before);XCTAssertEqual(draws,0)
 }
 func testRejectedMagnetCellPlanDoesNotRewindActualSharedShuffleDraws()throws {
  var draws=0;let stream=NativeSourceMathRandomStream{draws+=1;return 0.5}
  var tiles:[NativeTile]=[]
  for i in 0..<45 {
   let cell=NativeCell(column:i%5,row:i/5),kind:NativeWildArchetype?=i==0 ? .magnet:nil
   tiles.append(NativeTile(id:"t"+String(i),cell:cell,value:i==0 ? 6:2,archetype:kind))
  }
  let e=NativeGameplayEngine(state:.init(tiles:tiles,rngState:123),sourceMathRandom:stream)
  XCTAssertTrue(e.beginDrag(tileID:"t0"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
  let plan=try XCTUnwrap(e.pendingSpecial),before=e.state
  XCTAssertEqual(plan.targets.count,4);XCTAssertFalse(e.prepareMagnetRespawn(transactionID:plan.id).accepted)
  XCTAssertEqual(e.state,before);XCTAssertEqual(draws,4);XCTAssertEqual(e.state.rngState,123)
  XCTAssertEqual(stream.next(),0.5);XCTAssertEqual(draws,5)
 }

 func testExecutedImmutableConstructorLogicalHelperAndFaceSkinsShareOneNativeFunction()throws {
  struct Oracle:Decodable {struct Row:Decodable {struct Tile:Decodable {let c,r,value:Int;let locked:Bool;let rotation:Double;let texture:String};struct State:Decodable {let draw:Int;let tiles:[Tile]};let columns:Int;let runMode:String;let boardNumber,prefixDraws,logicalValue:Int;let chosenSkin:String;let before,after:State};let cases:[Row]}
  let rows=try JSONDecoder().decode(Oracle.self,from:Data(contentsOf:try XCTUnwrap(Bundle.module.url(forResource:"SourceAppMathSharedV9Oracle",withExtension:"json")))).cases
  XCTAssertEqual(rows.count,3)
  for row in rows {
   var draws=0;let stream=NativeSourceMathRandomStream{draws+=1;return Double((draws*37)%97)/97}
   let mode:NativeRunMode=row.runMode=="arcade" ? .arcade:.journey
   let recipe=try XCTUnwrap(NativeSourceInitialBoardRecipe.capture(mode:mode,board:row.boardNumber,columns:row.columns,random:stream.next))
   XCTAssertEqual(draws,row.prefixDraws)
   XCTAssertEqual(recipe.state.tiles.map(\.value),row.before.tiles.map(\.value));XCTAssertEqual(recipe.state.tiles.map(\.locked),row.before.tiles.map(\.locked))
   for (holder,tile) in zip(recipe.holders,row.before.tiles) {XCTAssertEqual(holder.rotation,tile.rotation,accuracy:1e-12)}
   var state=board();state.mode=mode;state.board=row.boardNumber;state.stage=row.boardNumber
   let e=NativeGameplayEngine(state:state,sourceMathRandom:stream)
   let repaired=e.repairLingeringRegularSix(tileID:"six",generation:1,revision:0)
   XCTAssertTrue(repaired.accepted);XCTAssertEqual(repaired.events.first{$0.kind == .spawned}?.value,row.logicalValue)
   XCTAssertEqual(NativeRegularStackLayout.chooseSkin(available:Set(NativeRegularStackLayout.Skin.allCases),random:stream.next).rawValue,row.chosenSkin)
   XCTAssertEqual(draws,row.before.draw)
   // Every actual opening's face helper executes in original captured order;
   // no count-based skip/seed-derived substitute consumes the APP stream.
   for opening in recipe.openings {
    let tile=try XCTUnwrap(recipe.state.tiles.first{$0.id==opening.tileID})
    let expected=try XCTUnwrap(row.after.tiles.first{$0.r==tile.cell.row && $0.c==tile.cell.column})
    XCTAssertEqual(NativeRegularStackLayout.chooseSkin(available:Set(NativeRegularStackLayout.Skin.allCases),random:stream.next).rawValue,expected.texture)
   }
   XCTAssertEqual(draws,row.after.draw);XCTAssertEqual(e.state.rngState,123)
  }
 }

}
