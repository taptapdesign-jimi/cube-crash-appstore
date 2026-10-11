import XCTest
@testable import StackToSixGameplay
final class NativeSourceNoMovesOracleTransportTests:XCTestCase {
 func tile(_ id:String,_ value:Int,_ x:Int,_ depth:Int=1,_ wild:NativeWildArchetype?=nil)->NativeTile {NativeTile(id:id,cell:.init(column:x,row:0),value:value,stackDepth:depth,archetype:wild)}
 func ordinary(_ row:Int)->(NativeBoardState,NativeNoMovesStackContext) {
 switch row {
 case 0:let before=NativeBoardState(tiles:[tile("b0",2,0,1),tile("b1",3,1,1)]);return (NativeBoardState(tiles:[tile("b1",5,1,2)]),NativeNoMovesStackContext(before:before,source:before.tiles[0],destination:before.tiles[1],effectiveSum:5,destinationDepthAfterCommit:2))
 case 1:let before=NativeBoardState(tiles:[tile("b0",1,0,1),tile("b1",2,1,1)]);return (NativeBoardState(tiles:[tile("b1",3,1,2)]),NativeNoMovesStackContext(before:before,source:before.tiles[0],destination:before.tiles[1],effectiveSum:3,destinationDepthAfterCommit:2))
 case 2:let before=NativeBoardState(tiles:[tile("b0",1,0,1),tile("b1",2,1,1),tile("b2",3,2,1)]);return (NativeBoardState(tiles:[tile("b1",5,1,3)]),NativeNoMovesStackContext(before:before,source:before.tiles[0],destination:before.tiles[1],effectiveSum:5,destinationDepthAfterCommit:3))
 case 3:let before=NativeBoardState(tiles:[tile("b0",1,0,1),tile("b1",1,1,1),tile("b2",1,2,1)]);return (NativeBoardState(tiles:[tile("b1",3,1,2)]),NativeNoMovesStackContext(before:before,source:before.tiles[0],destination:before.tiles[1],effectiveSum:3,destinationDepthAfterCommit:2))
 case 4:let before=NativeBoardState(tiles:[tile("b0",1,0,1),tile("b1",1,1,1),tile("b2",1,2,1)]);return (NativeBoardState(tiles:[tile("b1",4,1,1)]),NativeNoMovesStackContext(before:before,source:before.tiles[0],destination:before.tiles[1],effectiveSum:4,destinationDepthAfterCommit:1))
 case 5:let before=NativeBoardState(tiles:[tile("b0",1,0,1),tile("b1",1,1,1),tile("b2",4,2,1)]);return (NativeBoardState(tiles:[tile("b1",2,1,2)]),NativeNoMovesStackContext(before:before,source:before.tiles[0],destination:before.tiles[1],effectiveSum:2,destinationDepthAfterCommit:2))
 default:fatalError()
 }
 }
 func testExecutedSixLiteralPostStackBranches() {
 do {let (state,context)=ordinary(0);XCTAssertEqual(NativeNoMovesTriggerClassifier.classify(state:state,origin:.ordinaryPostcheck(context))?.rawValue,"last_two_regular_stack_dead_end")}
 do {let (state,context)=ordinary(1);XCTAssertEqual(NativeNoMovesTriggerClassifier.classify(state:state,origin:.ordinaryPostcheck(context))?.rawValue,"last_two_self_merge_dead_end")}
 do {let (state,context)=ordinary(2);XCTAssertEqual(NativeNoMovesTriggerClassifier.classify(state:state,origin:.ordinaryPostcheck(context))?.rawValue,"last_three_regular_stack_dead_end")}
 do {let (state,context)=ordinary(3);XCTAssertEqual(NativeNoMovesTriggerClassifier.classify(state:state,origin:.ordinaryPostcheck(context))?.rawValue,"last_three_self_merge_dead_end")}
 do {let (state,context)=ordinary(4);XCTAssertEqual(NativeNoMovesTriggerClassifier.classify(state:state,origin:.ordinaryPostcheck(context))?.rawValue,"single_regular_tile_safety_net")}
 do {let (state,context)=ordinary(5);XCTAssertEqual(NativeNoMovesTriggerClassifier.classify(state:state,origin:.ordinaryPostcheck(context))?.rawValue,"post_merge_stuck")}
 }
 func testExecutedOriginal23PhaseTransports() {
  let names=[
"last_two_regular_stack_dead_end","last_two_self_merge_dead_end","last_three_regular_stack_dead_end","last_three_self_merge_dead_end","single_regular_tile_safety_net","post_merge_stuck","merge_moves_depleted_stuck","moves_depleted_stuck","check_level_end_stuck","fresh-clean-at-phase1","fresh-clean-at-phase2","fresh-clean-at-phase3","fresh-clean-at-phase4","duplicate","wild-preflight","initial-wait-cancel","signature-change","pointer-start-after-lock","actual-exit-wall-timeout","actual-exit-wall-cancel","actual-exit-rejected","extra-clamped-negative","extra-positive" ]
  var completed=0
  for (index,name) in names.enumerated() {
   var state=NativeBoardState(tiles:[tile("a",6,0,1,.star),tile("b",6,1,1,.star)])
   var origin:NativeNoMovesOrigin = .levelEnd
   if index<6 {let pair=ordinary(index);state=pair.0;origin = .ordinaryPostcheck(pair.1)}
   if index==6 {state.moves=0;origin = .mergeMovesDepleted}
   if index==7 {state.moves=0;origin = .movesDepleted}
   if index>=21 {let pair=ordinary(4);state=pair.0;origin = .ordinaryPostcheck(pair.1)}
   let e=NativeGameplayEngine(state:state);e.stagedSourceNoMoves=true
   func clean() {var r=NativeNoMovesTileRuntime();r.eventMode = .none;e.noMovesTileRuntime=["a":r,"b":r]}
   if index==9 {clean()}
   if index==13 {var f=NativeGameplayRuntimeFlags();f.busyEnding=true;e.setRuntimeFlags(f)}
   if index==14 {e.sourceWildRetryPending=true}
   let initial=e.beginSourceNoMoves(origin:origin,extraWaitMilliseconds:index==21 ? -100:index==22 ? 70:0)
   if [9,13,14].contains(index) {XCTAssertNil(e.pendingSourceNoMoves,name);completed+=1;continue}
   guard case .candidate(let p)=initial else{XCTFail(name);continue}
   let expectedWait=index==4 || index>=21 ? (index==22 ? 570:500):1500
   XCTAssertEqual(p.waitMilliseconds,expectedWait,name)
   if index==10 {clean()}
   if index==16 {var r=NativeNoMovesTileRuntime();r.destroyed=true;e.noMovesTileRuntime["a"]=r}
   let waited=e.deliverSourceNoMovesWait(plan:p,generation:1,cancelled:index==15)
   if [10,15,16].contains(index) {guard case .rollback=waited else{XCTFail(name);continue};completed+=1;continue}
   XCTAssertEqual(waited,.exit(p),name)
   if index==11 {clean()}
   let exitDelivery:NativeNoMovesCandidateOwner.ExitDelivery=index==18 ? .timedOut:index==19 ? .cancelled:index==20 ? .rejected:.exited
   let exited=e.deliverSourceNoMovesTextExit(plan:p,generation:1,delivery:exitDelivery)
   if [11,19].contains(index) {guard case .rollback=exited else{XCTFail(name);continue};completed+=1;continue}
   XCTAssertEqual(exited,.acquireInputLock(p),name)
   let locked=e.acquireSourceNoMovesLock(plan:p,generation:1,afterLock:{if index==12 {clean()};if index==17 {e.sourceSaveRuntime.activeDrag=true}})
   if [12,17].contains(index) {guard case .rollback(_,_,let release)=locked else{XCTFail(name);continue};XCTAssertTrue(release,name);completed+=1;continue}
   XCTAssertEqual(locked,.confirmedFinal(p),name);XCTAssertNil(e.state.terminal,name)
   XCTAssertTrue(e.finishSourceNoMovesBoardExit(plan:p,generation:1).accepted,name);completed+=1
  }
  XCTAssertEqual(completed,23)
 }
 func testCapturedPostcheckContextIsOwnedAndOnce() {
    let before=NativeBoardState(tiles:[tile("s",2,0),tile("d",3,1)])
    let e=NativeGameplayEngine(state:before);e.stagedSourceNoMoves=true;e.stagedOrdinaryMoves=true
    XCTAssertTrue(e.beginDrag(tileID:"s"));XCTAssertTrue(e.drop(target:before.tiles[1].cell).accepted)
    guard let p=e.pendingOrdinaryStack else{return XCTFail()}
    XCTAssertTrue(e.finishOrdinaryStackAbsorb(receiptID:p.id,generation:1).accepted)
    XCTAssertTrue(e.commitOrdinaryPostcheck(receiptID:p.id,generation:1).accepted)
    guard case .candidate(let candidate)=e.beginSourceNoMovesForOrdinaryPostcheck(receiptID:p.id,generation:1) else{return XCTFail()}
    XCTAssertEqual(candidate.trigger,.lastTwoRegular)
    XCTAssertEqual(e.beginSourceNoMovesForOrdinaryPostcheck(receiptID:p.id,generation:1),.ignored)
 }
}
