import XCTest
import JavaScriptCore
import StackToSixGameplay

final class NativeSourceTntJSCOracleTests:XCTestCase {
 private struct Case:Decodable,Equatable {let n:Int,seed:UInt32,selected:[Int],draws:Int,state:UInt32}
 private func execute(_ script:String=NativeSourceTntJSCOracle.script)throws->[Case] {
  let context=try XCTUnwrap(JSContext())
  let result=context.evaluateScript(script)
  XCTAssertNil(context.exception,context.exception?.toString() ?? "")
  let json=try XCTUnwrap(result?.toString())
  return try JSONDecoder().decode([Case].self,from:Data(json.utf8))
 }
 func testIOSJavaScriptCoreExecutesOriginalSelectorAcrossEveryCandidateCount()throws {
  let actual=try execute(),reference=try JSONDecoder().decode([Case].self,from:Data(NativeSourceTntJSCOracle.reference.utf8))
  XCTAssertEqual(actual.count,320)
  for (a,b) in zip(actual,reference){XCTAssertEqual(a,b,"iOS JSC selector differs: n=\(a.n) seed=\(a.seed)")}
  for c in actual {XCTAssertEqual(c.selected.count,min(4,c.n));XCTAssertEqual(Set(c.selected).count,c.selected.count);XCTAssertTrue(c.selected.allSatisfy{$0>=0 && $0<c.n});if c.n<2{XCTAssertEqual(c.draws,0);XCTAssertEqual(c.state,c.seed)}}
 }
 func testLegacyFisherYatesChangesOriginalTargetsAndSharedMathConsumption()throws {
  let cases=try execute();var targetDifferences=0,drawDifferences=0
  for c in cases where c.n>1 {
   var state=c.seed,draws=0,tiles=Array(0..<c.n)
   for i in stride(from:c.n-1,through:1,by:-1){state=state &* 1664525 &+ 1013904223;draws+=1;let j=min(i,Int(Double(state)/4294967296*Double(i+1)));tiles.swapAt(i,j)}
   if Array(tiles.prefix(4)) != c.selected {targetDifferences+=1}
   if draws != c.draws || state != c.state {drawDifferences+=1}
  }
  XCTAssertGreaterThan(targetDifferences,0);XCTAssertGreaterThan(drawDifferences,0)
  print("[TNT_JSC_ORACLE] cases=320 targetDifferences=\(targetDifferences) mathDifferences=\(drawDifferences); legacy Fisher-Yates differs from original")
 }
 func testActualEngineTntReservationUsesIOSSelectorAndSharedMathAcrossCandidateCounts()throws {
  for c in try execute() where (2...43).contains(c.n) {
   var state=c.seed,draws=0
   let stream=NativeSourceMathRandomStream(draw:{state=state &* 1664525 &+ 1013904223;draws+=1;return Double(state)/4294967296})
   let targets=(0..<c.n).map{NativeTile(id:String($0),cell:.init(column:$0%5,row:$0/5),value:1)}
   let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"tnt",cell:.init(column:4,row:8),value:6,archetype:.tnt),.init(id:"destination",cell:.init(column:3,row:8),value:2)]+targets),sourceMathRandom:stream)
   XCTAssertTrue(engine.beginDrag(tileID:"tnt"))
   XCTAssertTrue(engine.drop(target:.init(column:3,row:8)).accepted)
   let plan=try XCTUnwrap(engine.pendingSpecial)
   XCTAssertEqual(plan.targets.map(\.id),c.selected.map(String.init),"actual engine n=\(c.n) seed=\(c.seed)")
   var expectedState=c.state
   for _ in c.selected {expectedState=expectedState &* 1664525 &+ 1013904223}
   XCTAssertEqual(draws,c.draws+c.selected.count)
   XCTAssertEqual(state,expectedState,"replacement values must follow original comparator draws on the same stream")
  }
 }
 func testActualStagedTntReturnSelectsCurrentBoardOnTheSameUnrewoundStream()throws {
  for count in [2,5,12,28,43] {
   var rng:UInt32=729,draws=0
   let stream=NativeSourceMathRandomStream(draw:{rng=rng &* 1664525 &+ 1013904223;draws+=1;return Double(rng)/4294967296})
   let targets=(0..<count).map{NativeTile(id:String($0),cell:.init(column:$0%5,row:$0/5),value:1)}
   let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"tnt",cell:.init(column:4,row:8),value:6,archetype:.tnt),.init(id:"destination",cell:.init(column:3,row:8),value:2)]+targets),sourceMathRandom:stream)
   engine.stagedTntActivation=true
   XCTAssertTrue(engine.beginDrag(tileID:"tnt"));XCTAssertTrue(engine.drop(target:.init(column:3,row:8)).accepted)
   let initial=try XCTUnwrap(engine.pendingSpecial);XCTAssertTrue(initial.targets.isEmpty)
   XCTAssertTrue(engine.commitSpecialActivation(transactionID:initial.id).accepted)
   let candidates=NativeTntRules.eligibleTargets(engine.state.tiles,excluding:["tnt","destination"])
   let seed=rng,beforeDraws=draws,n=candidates.count
   let script="JSON.stringify([(()=>{let state=\(seed),draws=0;const selected=Array.from({length:\(n)},(_,i)=>i).sort(()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;draws++;return state/4294967296-.5}).slice(0,4);return {n:\(n),seed:\(seed),selected,draws,state}})()])"
   let expected=try XCTUnwrap(execute(script).first)
   XCTAssertTrue(engine.reserveTntTargets(transactionID:initial.id).accepted)
   let reserved=try XCTUnwrap(engine.pendingSpecial)
   XCTAssertEqual(reserved.targets.map(\.id),expected.selected.map{candidates[$0].id})
   var expectedState=expected.state
   for _ in expected.selected {expectedState=expectedState &* 1664525 &+ 1013904223}
   XCTAssertEqual(draws-beforeDraws,expected.draws+expected.selected.count)
   XCTAssertEqual(rng,expectedState)
  }
 }
 func testRareLongInitialRunsMatchActualIOSJavaScriptCore()throws {
  let actual=try execute(NativeSourceTntJSCOracle.rareScript),expected=try JSONDecoder().decode([Case].self,from:Data(NativeSourceTntJSCOracle.rareReference.utf8));XCTAssertEqual(actual,expected);XCTAssertEqual(actual.count,320)
 }
 func testSwiftTranslationMatchesActualIOSSelectionsAndMathStateAcross640Cases()throws {
  let cases=try execute()+execute(NativeSourceTntJSCOracle.rareScript);XCTAssertEqual(cases.count,640)
  for c in cases {var state=c.seed,draws=0;let result=NativeSourceTntTargetSort.select(candidateIDs:(0..<c.n).map(String.init),random:{state=state &* 1664525 &+ 1013904223;draws+=1;return Double(state)/4294967296},current:{true});XCTAssertEqual(result,c.selected.map(String.init),"n=\(c.n) seed=\(c.seed)");XCTAssertEqual(draws,c.draws);XCTAssertEqual(state,c.state)}
 }
}
