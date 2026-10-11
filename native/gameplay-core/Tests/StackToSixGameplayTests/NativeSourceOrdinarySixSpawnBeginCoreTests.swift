import XCTest
import StackToSixGameplay

@MainActor final class NativeSourceOrdinarySixSpawnBeginCoreTests:XCTestCase {
    func make(moves:Int=10,final:Bool=false,enabled:Bool=true,normalWithOneLocked:Bool=false)->NativeGameplayEngine {
        var tiles:[NativeTile]=[.init(id:"s",cell:.init(column:0,row:0),value:1),.init(id:"d",cell:.init(column:1,row:0),value:5)]+(final ? []:[.init(id:"o",cell:.init(column:2,row:0),value:4)])
        if normalWithOneLocked {tiles.append(.init(id:"normal-locked",cell:.init(column:3,row:1),value:0,locked:true))}
        let e=NativeGameplayEngine(state:.init(tiles:tiles,moves:moves));e.stagedOrdinaryMoves=true;e.stagedOrdinaryAssignments=true
        e.sourceOrdinarySixSpawnBeginReceiptsEnabled=enabled;return e
    }
    func main(_ e:NativeGameplayEngine)throws->(NativeOrdinaryMovePlan,NativeMoveResult) {
        XCTAssertTrue(e.beginDrag(tileID:"s"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
        XCTAssertTrue(e.pendingSourceOrdinarySixSpawnBeginReceipts.isEmpty)
        let p=try XCTUnwrap(e.pendingOrdinarySix);return(p,e.commitOrdinarySix(receiptID:p.id,generation:p.generation))
    }
    func testActualEnteredReplacementRequestsOnceAfterMergedPrefixBeforePreparation()throws {
        let e=make(),(p,result)=try main(e);let receipt=try XCTUnwrap(e.pendingSourceOrdinarySixSpawnBeginReceipts.first)
        XCTAssertEqual(receipt.ownerID,p.id);XCTAssertEqual(receipt.generation,p.generation)
        let merged=try XCTUnwrap(result.events.firstIndex{$0.kind == .merged}),begin=try XCTUnwrap(result.events.firstIndex{$0.kind == .sourceOrdinarySixSpawnOwnerBeginRequested}),prepare=try XCTUnwrap(result.events.firstIndex{$0.kind == .ordinarySpawnsPrepareRequested})
        XCTAssertLessThan(merged,begin);XCTAssertLessThan(begin,prepare)
        XCTAssertEqual(result.events[begin].reason,receipt.id.uuidString)
        XCTAssertFalse(e.commitOrdinarySix(receiptID:p.id,generation:p.generation).accepted)
        XCTAssertTrue(e.acknowledgeSourceOrdinarySixSpawnBegin(receipt));XCTAssertFalse(e.acknowledgeSourceOrdinarySixSpawnBegin(receipt))
    }
    func testFinalAndRawDefaultCannotManufactureSourceAcquisition()throws {
        for e in [make(final:true),make(enabled:false)] {
            let (_,result)=try main(e)
            XCTAssertTrue(e.pendingSourceOrdinarySixSpawnBeginReceipts.isEmpty)
            XCTAssertFalse(result.events.contains{$0.kind == .sourceOrdinarySixSpawnOwnerBeginRequested})
        }
    }
    func testPreSpawnEarlyReturnDoesNotMintUntilGenuineContinueReceipt()throws {
        let e=make(moves:1);e.stagedSourceNoMoves=true;e.sourceNoMovesCallerReceiptsEnabled=true
        e.sourceNoMovesCallerAdmission = .init(generation:e.state.generation,kinds:[.mergeMovesDepleted])
        e.sourceNoMovesRuntimeAuthority = .init(isCurrent:{true},capture:{[weak e] in
            guard let e else{return nil};return .init(state:e.state,tiles:Dictionary(uniqueKeysWithValues:e.state.tiles.map{($0.id,.init())}),wildContinuationPending:false,gameplayTransactionActive:false,livingDragActive:false,endgameGuardActive:false,nonFinalMergeSixGuardActive:false,freshResult:.init(.fail,reason:"controlled-source-boundary"),capabilities:Set(NativeSourceNoMovesRuntimeSnapshot.Capability.allCases))
        })
        let(p,main)=try main(e);XCTAssertTrue(e.pendingSourceOrdinarySixSpawnBeginReceipts.isEmpty)
        XCTAssertFalse(main.events.contains{$0.kind == .sourceOrdinarySixSpawnOwnerBeginRequested})
        let caller=try XCTUnwrap(e.sourceNoMovesCaller(ownerID:p.id,generation:p.generation,kind:.mergeMovesDepleted)),result=e.continueSourceMergeSixAfterNoMovesCaller(caller)
        XCTAssertTrue(result.accepted);XCTAssertEqual(e.pendingSourceOrdinarySixSpawnBeginReceipts.count,1)
        XCTAssertFalse(e.continueSourceMergeSixAfterNoMovesCaller(caller).accepted)
    }
    func testRestartInvalidatesRequestWithoutWritingDateSettlingSpawnsOrPersistingReceipt()throws {
        let e=make();_=try main(e);let receipt=try XCTUnwrap(e.pendingSourceOrdinarySixSpawnBeginReceipts.first)
        let encoded=try JSONEncoder().encode(e.state);XCTAssertFalse(String(decoding:encoded,as:UTF8.self).contains(receipt.id.uuidString))
        e.restart(state:e.state);XCTAssertTrue(e.pendingSourceOrdinarySixSpawnBeginReceipts.isEmpty)
        XCTAssertFalse(e.sourceOrdinarySixSpawnBeginIsCurrent(receipt));XCTAssertFalse(e.acknowledgeSourceOrdinarySixSpawnBegin(receipt))
    }
}

extension NativeSourceOrdinarySixSpawnBeginCoreTests {
 func testActualLockedUnlockDefersRemainderSelectionUntilExactPromiseReceipt()throws {
  let e=NativeGameplayEngine(state:.init(columns:5,rows:9,tiles:[.init(id:"s",cell:.init(column:0,row:0),value:1),.init(id:"d",cell:.init(column:1,row:0),value:5),.init(id:"other",cell:.init(column:2,row:0),value:3),.init(id:"locked",cell:.init(column:3,row:0),value:0,locked:true)]))
  e.stagedOrdinaryMoves=true;e.stagedOrdinaryAssignments=true;e.sourceOrdinaryLockedSettlementsEnabled=true
  XCTAssertTrue(e.beginDrag(tileID:"s"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
  let plan=try XCTUnwrap(e.pendingOrdinarySix)
  XCTAssertTrue(e.commitOrdinarySix(receiptID:plan.id,generation:plan.generation).accepted)
  XCTAssertTrue(e.prepareOrdinarySpawns(receiptID:plan.id,generation:plan.generation).accepted)
  let assignment=try XCTUnwrap(e.pendingOrdinaryAssignments.first)
  let unlock=e.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:assignment.id)
  XCTAssertTrue(unlock.accepted);XCTAssertFalse(try XCTUnwrap(e.state.tiles.first{$0.id=="locked"}).locked)
  let receipt=try XCTUnwrap(e.pendingSourceOrdinaryLockedSettlement),before=e.state
  XCTAssertTrue(e.pendingOrdinaryAssignments.isEmpty)
  XCTAssertTrue(unlock.events.contains{$0.kind == .sourceOrdinaryLockedSettlementPrepared && $0.reason==receipt.id.uuidString})
  XCTAssertFalse(unlock.events.contains{$0.kind == .ordinaryAssignmentsPrepared})
  XCTAssertEqual(e.state,before)
  e.cancelForBackground()
  XCTAssertEqual(e.state,before,"background must not run the Source coroutine continuation")
  XCTAssertEqual(e.pendingSourceOrdinaryLockedSettlement,receipt)
  XCTAssertTrue(e.pendingOrdinaryAssignments.isEmpty)
  XCTAssertNotNil(e.pendingOrdinarySix)
  let continuation=e.continueSourceOrdinaryLockedSettlement(receipt)
  XCTAssertTrue(continuation.accepted);XCTAssertNil(e.pendingSourceOrdinaryLockedSettlement)
  XCTAssertEqual(e.pendingOrdinaryAssignments.first?.kind,.remainderPrimary)
  let settled=e.state
  XCTAssertFalse(e.continueSourceOrdinaryLockedSettlement(receipt).accepted);XCTAssertEqual(e.state,settled)
  e.restart(state:before);XCTAssertFalse(e.continueSourceOrdinaryLockedSettlement(receipt).accepted)
 }
}

extension NativeSourceOrdinarySixSpawnBeginCoreTests {
 func testMinimumCountRequiresCompleteCurrentPhysicalAuthorityAndSettledPrimary()throws {
  let e=make(normalWithOneLocked:true);e.sourceOrdinaryLockedSettlementsEnabled=true;e.sourceOrdinaryMinimumPhaseEnabled=true
  let(plan,_)=try main(e)
  XCTAssertNil(e.captureSourceOrdinaryMinimumActiveCount(ownerID:plan.id,generation:plan.generation))
  XCTAssertTrue(e.prepareOrdinarySpawns(receiptID:plan.id,generation:plan.generation).accepted)
  let locked=try XCTUnwrap(e.pendingOrdinaryAssignments.first)
  XCTAssertEqual(locked.kind,.locked)
  XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:locked.id).accepted)
  XCTAssertTrue(e.continueSourceOrdinaryLockedSettlement(try XCTUnwrap(e.pendingSourceOrdinaryLockedSettlement)).accepted)
  let slot=try XCTUnwrap(e.pendingOrdinaryAssignments.first)
  XCTAssertEqual(slot.kind,.remainderPrimary)
  XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:slot.id).accepted)
  var captures=0
  var complete=true,mutate=false,paintedZero=false,paintedHidden=false,changeValue=false
  e.sourceNoMovesRuntimeAuthority = .init(isCurrent:{true},capture:{
   captures+=1
   if mutate {e.restart(state:.init(tiles:[.init(id:"fresh",cell:.init(column:0,row:0),value:3)]))}
   let runtime=Dictionary(uniqueKeysWithValues:e.state.tiles.map{($0.id,NativeNoMovesTileRuntime())})
   var physical=e.state
   if paintedZero {for index in physical.tiles.indices {physical.tiles[index].alpha=0}}
   if paintedHidden {for index in physical.tiles.indices {physical.tiles[index].visible=false}}
   if changeValue {physical.tiles[0].value += 1}
   return .init(state:physical,tiles:runtime,wildContinuationPending:false,gameplayTransactionActive:false,livingDragActive:false,endgameGuardActive:false,nonFinalMergeSixGuardActive:false,freshResult:NativeSourceEndgameChecker.check(state:physical,runtime:runtime),capabilities:complete ? Set(NativeSourceNoMovesRuntimeSnapshot.Capability.allCases):[])
  })
  XCTAssertNil(e.captureSourceOrdinaryMinimumActiveCount(ownerID:plan.id,generation:plan.generation),"actual primary arrival still pending")
  XCTAssertTrue(e.finishOrdinaryPrimarySpawn(receiptID:plan.id,generation:plan.generation,assignmentID:slot.id).accepted)
  XCTAssertEqual(e.captureSourceOrdinaryMinimumActiveCount(ownerID:plan.id,generation:plan.generation),3)
  let minimum=try XCTUnwrap(e.pendingSourceOrdinaryMinimumPhase)
  let canonical=e.state
  paintedZero=true;XCTAssertEqual(e.captureSourceOrdinaryMinimumActiveCount(ownerID:plan.id,generation:plan.generation),3,"Source regular active count ignores painted alpha")
  XCTAssertEqual(e.state,canonical)
  changeValue=true;XCTAssertNil(e.captureSourceOrdinaryMinimumActiveCount(ownerID:plan.id,generation:plan.generation));changeValue=false
  complete=false;XCTAssertNil(e.captureSourceOrdinaryMinimumActiveCount(ownerID:plan.id,generation:plan.generation))
  complete=true;paintedHidden=true
  XCTAssertEqual(e.captureSourceOrdinaryMinimumActiveCount(ownerID:plan.id,generation:plan.generation),0)
  XCTAssertFalse(e.acknowledgeSourceOrdinaryMinimumSatisfied(minimum))
  XCTAssertEqual(e.pendingSourceOrdinaryMinimumPhase,minimum);XCTAssertEqual(e.state,canonical)
  paintedHidden=false
  let beforeCapture=captures
  XCTAssertTrue(e.advanceSourceOrdinaryMinimumPhase(minimum).accepted);XCTAssertNil(e.pendingSourceOrdinaryMinimumPhase)
  XCTAssertEqual(captures-beforeCapture,1,"one physical capture per Source phase decision")
  XCTAssertFalse(e.acknowledgeSourceOrdinaryMinimumSatisfied(minimum));XCTAssertEqual(e.state,canonical)
  mutate=true;XCTAssertNil(e.captureSourceOrdinaryMinimumActiveCount(ownerID:plan.id,generation:plan.generation))
  XCTAssertEqual(e.state.tiles.map(\.id),["fresh"])
 }
}

extension NativeSourceOrdinarySixSpawnBeginCoreTests {
 func testEmptyEmergencyHelperStillWaitsForPromiseThenFinishesWithoutInventingTiles()throws {
  let e=make(normalWithOneLocked:true);e.sourceOrdinaryLockedSettlementsEnabled=true;e.sourceOrdinaryMinimumPhaseEnabled=true
  let(plan,_)=try main(e)
  XCTAssertTrue(e.prepareOrdinarySpawns(receiptID:plan.id,generation:plan.generation).accepted)
  let locked=try XCTUnwrap(e.pendingOrdinaryAssignments.first)
  XCTAssertEqual(locked.kind,.locked)
  XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:locked.id).accepted)
  XCTAssertTrue(e.continueSourceOrdinaryLockedSettlement(try XCTUnwrap(e.pendingSourceOrdinaryLockedSettlement)).accepted)
  let slot=try XCTUnwrap(e.pendingOrdinaryAssignments.first)
  XCTAssertEqual(slot.kind,.remainderPrimary)
  XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:slot.id).accepted)
  XCTAssertTrue(e.finishOrdinaryPrimarySpawn(receiptID:plan.id,generation:plan.generation,assignmentID:slot.id).accepted)
  var complete=true
  e.sourceNoMovesRuntimeAuthority = .init(isCurrent:{true},capture:{
   var physical=e.state;for i in physical.tiles.indices {physical.tiles[i].visible=false}
   let runtime=Dictionary(uniqueKeysWithValues:physical.tiles.map{($0.id,NativeNoMovesTileRuntime())})
   return .init(state:physical,tiles:runtime,wildContinuationPending:false,gameplayTransactionActive:false,livingDragActive:false,endgameGuardActive:false,nonFinalMergeSixGuardActive:false,freshResult:NativeSourceEndgameChecker.check(state:physical,runtime:runtime),capabilities:complete ? Set(NativeSourceNoMovesRuntimeSnapshot.Capability.allCases):[])
  })
  let minimum=try XCTUnwrap(e.pendingSourceOrdinaryMinimumPhase),before=e.state
  let result=e.prepareSourceOrdinaryMinimumRescue(minimum)
  XCTAssertTrue(result.accepted);XCTAssertTrue(e.pendingOrdinaryAssignments.isEmpty)
  let helper=try XCTUnwrap(e.pendingSourceOrdinaryLockedSettlement)
  XCTAssertEqual(e.pendingSourceOrdinaryMinimumPhase,minimum);XCTAssertEqual(e.state,before)
  XCTAssertFalse(e.prepareSourceOrdinaryMinimumRescue(minimum).accepted)
  complete=false
  XCTAssertFalse(e.continueSourceOrdinaryLockedSettlement(helper).accepted)
  XCTAssertEqual(e.pendingSourceOrdinaryLockedSettlement,helper);XCTAssertEqual(e.pendingSourceOrdinaryMinimumPhase,minimum);XCTAssertEqual(e.state,before)
  complete=true
  XCTAssertTrue(e.continueSourceOrdinaryLockedSettlement(helper).accepted)
  XCTAssertNil(e.pendingSourceOrdinaryMinimumPhase);XCTAssertNil(e.pendingSourceOrdinaryLockedSettlement)
  XCTAssertEqual(e.state,before);XCTAssertFalse(e.continueSourceOrdinaryLockedSettlement(helper).accepted)
 }
}

extension NativeSourceOrdinarySixSpawnBeginCoreTests {
 func testPositiveEmergencyUnlockCommitsOnlyAtAssignmentAndSettlesOnce()throws {
  let tiles:[NativeTile]=[.init(id:"s",cell:.init(column:0,row:0),value:1),.init(id:"d",cell:.init(column:1,row:0),value:5),.init(id:"other",cell:.init(column:2,row:0),value:3)]+(0..<3).map{.init(id:"locked-\($0)",cell:.init(column:$0,row:1),value:0,locked:true)}
  let e=NativeGameplayEngine(state:.init(columns:5,rows:9,tiles:tiles),recordedRandomChoices:Array(repeating:0.25,count:40))
  e.stagedOrdinaryMoves=true;e.stagedOrdinaryAssignments=true;e.sourceOrdinaryLockedSettlementsEnabled=true;e.sourceOrdinaryMinimumPhaseEnabled=true
  let(plan,_)=try main(e)
  XCTAssertTrue(e.prepareOrdinarySpawns(receiptID:plan.id,generation:plan.generation).accepted)
  while let slot=e.pendingOrdinaryAssignments.first {XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:slot.id).accepted)}
  let batch=try XCTUnwrap(e.pendingSourceOrdinaryLockedSettlement)
  XCTAssertTrue(e.continueSourceOrdinaryLockedSettlement(batch).accepted)
  e.sourceNoMovesRuntimeAuthority = .init(isCurrent:{true},capture:{
   var physical=e.state;for i in physical.tiles.indices {physical.tiles[i].visible=false}
   let runtime=Dictionary(uniqueKeysWithValues:physical.tiles.map{($0.id,NativeNoMovesTileRuntime())})
   return .init(state:physical,tiles:runtime,wildContinuationPending:false,gameplayTransactionActive:false,livingDragActive:false,endgameGuardActive:false,nonFinalMergeSixGuardActive:false,freshResult:NativeSourceEndgameChecker.check(state:physical,runtime:runtime),capabilities:Set(NativeSourceNoMovesRuntimeSnapshot.Capability.allCases))
  })
  let minimum=try XCTUnwrap(e.pendingSourceOrdinaryMinimumPhase),before=e.state
  XCTAssertTrue(e.prepareSourceOrdinaryMinimumRescue(minimum).accepted)
  let emergency=try XCTUnwrap(e.pendingOrdinaryAssignments.first),id=try XCTUnwrap(emergency.tileID)
  XCTAssertEqual(emergency.kind,.emergencyLocked);XCTAssertEqual(emergency.delayMilliseconds,50)
  XCTAssertEqual(e.state,before,"single candidate selection draws no value and does not unlock")
  XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:emergency.id).accepted)
  XCTAssertFalse(try XCTUnwrap(e.state.tiles.first{$0.id==id}).locked)
  XCTAssertEqual(e.state.moves,before.moves);XCTAssertEqual(e.state.score,before.score)
  let helper=try XCTUnwrap(e.pendingSourceOrdinaryLockedSettlement),opened=e.state
  XCTAssertEqual(e.pendingSourceOrdinaryMinimumPhase,minimum)
  XCTAssertTrue(e.continueSourceOrdinaryLockedSettlement(helper).accepted)
  XCTAssertNil(e.pendingSourceOrdinaryMinimumPhase);XCTAssertTrue(e.pendingOrdinaryAssignments.isEmpty);XCTAssertEqual(e.state,opened)
  XCTAssertFalse(e.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:emergency.id).accepted)
  XCTAssertFalse(e.continueSourceOrdinaryLockedSettlement(helper).accepted);XCTAssertEqual(e.state,opened)
 }
}

extension NativeSourceOrdinarySixSpawnBeginCoreTests {
 func testEmergencyEpochRejectionStillSettlesHelperAndFallbackWithoutDrawingFaces()throws {
  let tiles:[NativeTile]=[.init(id:"s",cell:.init(column:0,row:0),value:1),.init(id:"d",cell:.init(column:1,row:0),value:5),.init(id:"other",cell:.init(column:2,row:0),value:3)]+(0..<3).map{.init(id:"locked-\($0)",cell:.init(column:$0,row:1),value:0,locked:true)}
  let e=NativeGameplayEngine(state:.init(columns:5,rows:9,tiles:tiles),recordedRandomChoices:Array(repeating:0.25,count:40))
  e.stagedOrdinaryMoves=true;e.stagedOrdinaryAssignments=true;e.sourceOrdinaryLockedSettlementsEnabled=true;e.sourceOrdinaryMinimumPhaseEnabled=true
  let(plan,_)=try main(e)
  XCTAssertTrue(e.prepareOrdinarySpawns(receiptID:plan.id,generation:plan.generation).accepted)
  while let slot=e.pendingOrdinaryAssignments.first {XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:slot.id).accepted)}
  let batch=try XCTUnwrap(e.pendingSourceOrdinaryLockedSettlement)
  XCTAssertTrue(e.continueSourceOrdinaryLockedSettlement(batch).accepted)
  e.sourceNoMovesRuntimeAuthority = .init(isCurrent:{true},capture:{
   var physical=e.state;for i in physical.tiles.indices {physical.tiles[i].visible=false}
   let runtime=Dictionary(uniqueKeysWithValues:physical.tiles.map{($0.id,NativeNoMovesTileRuntime())})
   return .init(state:physical,tiles:runtime,wildContinuationPending:false,gameplayTransactionActive:false,livingDragActive:false,endgameGuardActive:false,nonFinalMergeSixGuardActive:false,freshResult:NativeSourceEndgameChecker.check(state:physical,runtime:runtime),capabilities:Set(NativeSourceNoMovesRuntimeSnapshot.Capability.allCases))
  })
  let minimum=try XCTUnwrap(e.pendingSourceOrdinaryMinimumPhase),before=e.state
  XCTAssertTrue(e.prepareSourceOrdinaryMinimumRescue(minimum).accepted)
  let emergency=try XCTUnwrap(e.pendingOrdinaryAssignments.first),id=try XCTUnwrap(emergency.tileID)
  XCTAssertEqual(emergency.kind,.emergencyLocked);XCTAssertEqual(emergency.delayMilliseconds,50)
  XCTAssertEqual(e.state,before,"single candidate selection draws no value and does not unlock")

  let sibling=try XCTUnwrap(e.state.tiles.first{$0.id.hasPrefix("locked-") && !$0.locked})
  e.stagedOrdinaryMoves=false
  XCTAssertTrue(e.beginDrag(tileID:"other"));XCTAssertTrue(e.drop(target:sibling.cell).accepted)
  XCTAssertNotEqual(e.state.revision,plan.revision)
  let changed=e.state
  XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:emergency.id).accepted)
  XCTAssertEqual(e.state,changed);XCTAssertTrue(try XCTUnwrap(e.state.tiles.first{$0.id==id}).locked)
  let helper=try XCTUnwrap(e.pendingSourceOrdinaryLockedSettlement)
  XCTAssertTrue(e.continueSourceOrdinaryLockedSettlement(helper).accepted)
  let fallback=try XCTUnwrap(e.pendingOrdinaryAssignments.first)
  XCTAssertEqual(fallback.kind,.emergencyForced);XCTAssertEqual(fallback.delayMilliseconds,0)
  XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:fallback.id).accepted)
  let final=try XCTUnwrap(e.pendingSourceOrdinaryLockedSettlement)
  XCTAssertTrue(e.continueSourceOrdinaryLockedSettlement(final).accepted)
  XCTAssertNil(e.pendingSourceOrdinaryMinimumPhase);XCTAssertEqual(e.state,changed)
 }
}

extension NativeSourceOrdinarySixSpawnBeginCoreTests {
 func testNormalForcedUnlockReturnsAfterFirstObsoletePermitWithoutRetryingCandidates()throws {
  let tiles:[NativeTile]=[.init(id:"s",cell:.init(column:0,row:0),value:1),.init(id:"d",cell:.init(column:1,row:0),value:5),.init(id:"a",cell:.init(column:2,row:0),value:1),.init(id:"b",cell:.init(column:3,row:0),value:1)]+(0..<3).map{.init(id:"locked-\($0)",cell:.init(column:$0,row:1),value:0,locked:true)}
  let e=NativeGameplayEngine(state:.init(columns:5,rows:9,tiles:tiles),recordedRandomChoices:Array(repeating:0.25,count:40))
  e.stagedOrdinaryMoves=true;e.stagedOrdinaryAssignments=true;e.sourceOrdinaryLockedSettlementsEnabled=true;e.sourceOrdinaryMinimumPhaseEnabled=true
  let(plan,_)=try main(e);XCTAssertTrue(e.prepareOrdinarySpawns(receiptID:plan.id,generation:plan.generation).accepted)
  e.stagedOrdinaryMoves=false;XCTAssertTrue(e.beginDrag(tileID:"a"));XCTAssertTrue(e.drop(target:.init(column:3,row:0)).accepted)
  let changed=e.state
  while let slot=e.pendingOrdinaryAssignments.first {XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:slot.id).accepted)}
  XCTAssertTrue(e.continueSourceOrdinaryLockedSettlement(try XCTUnwrap(e.pendingSourceOrdinaryLockedSettlement)).accepted)
  let forced=try XCTUnwrap(e.pendingOrdinaryAssignments.first);XCTAssertEqual(forced.kind,.forcedLocked)
  XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:forced.id).accepted)
  XCTAssertTrue(e.continueSourceOrdinaryLockedSettlement(try XCTUnwrap(e.pendingSourceOrdinaryLockedSettlement)).accepted)
  XCTAssertTrue(e.pendingOrdinaryAssignments.isEmpty,"Source returns from forced loop; no second obsolete candidate")
  XCTAssertNotNil(e.pendingSourceOrdinaryMinimumPhase);XCTAssertEqual(e.state,changed)
 }
}

extension NativeSourceOrdinarySixSpawnBeginCoreTests {
 func testEndgamePrimaryDoesNotMintNormalMinimumRescuePhase()throws {
  let e=make();e.sourceOrdinaryLockedSettlementsEnabled=true;e.sourceOrdinaryMinimumPhaseEnabled=true
  let(plan,_)=try main(e);XCTAssertTrue(e.prepareOrdinarySpawns(receiptID:plan.id,generation:plan.generation).accepted)
  let primary=try XCTUnwrap(e.pendingOrdinaryAssignments.first);XCTAssertEqual(primary.kind,.endgamePrimary)
  XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:primary.id).accepted)
  let finished=e.finishOrdinaryPrimarySpawn(receiptID:plan.id,generation:plan.generation,assignmentID:primary.id)
  XCTAssertTrue(finished.accepted);XCTAssertNil(e.pendingSourceOrdinaryMinimumPhase)
  XCTAssertFalse(finished.events.contains{$0.kind == .sourceOrdinaryMinimumPhasePrepared})
 }
}


extension NativeSourceOrdinarySixSpawnBeginCoreTests {
 func testTileOnlyMinimumUsesActualPaintAndMarkersWithoutGlobalNoMovesAdmission()throws {
  let e=make(normalWithOneLocked:true);e.sourceOrdinaryLockedSettlementsEnabled=true;e.sourceOrdinaryMinimumPhaseEnabled=true
  let(plan,_)=try main(e)
  XCTAssertTrue(e.prepareOrdinarySpawns(receiptID:plan.id,generation:plan.generation).accepted)
  let locked=try XCTUnwrap(e.pendingOrdinaryAssignments.first)
  XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:locked.id).accepted)
  XCTAssertTrue(e.continueSourceOrdinaryLockedSettlement(try XCTUnwrap(e.pendingSourceOrdinaryLockedSettlement)).accepted)
  let primary=try XCTUnwrap(e.pendingOrdinaryAssignments.first)
  XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:primary.id).accepted)
  var hidden=false,reenter=false,captures=0
  e.sourceOrdinaryMinimumTileAuthority = .init(isCurrent:{true},capture:{
   captures+=1;let canonical=e.state
   if reenter {e.restart(state:.init(tiles:[.init(id:"successor",cell:.init(column:0,row:0),value:3)]))}
   var painted=canonical
   if hidden {for index in painted.tiles.indices{painted.tiles[index].visible=false}}
   guard let paint=NativeSourceNoMovesRuntimeSnapshot.PaintedStateReceipt(canonicalState:canonical,paintedState:painted) else{return nil}
   return .init(paint:paint,tiles:Dictionary(uniqueKeysWithValues:canonical.tiles.map{($0.id,NativeNoMovesTileRuntime())}))
  })
  XCTAssertNil(e.captureSourceOrdinaryMinimumActiveCount(ownerID:plan.id,generation:plan.generation));XCTAssertEqual(captures,0)
  XCTAssertTrue(e.finishOrdinaryPrimarySpawn(receiptID:plan.id,generation:plan.generation,assignmentID:primary.id).accepted)
  let minimum=try XCTUnwrap(e.pendingSourceOrdinaryMinimumPhase),canonical=e.state
  XCTAssertNil(e.sourceNoMovesRuntimeAuthority)
  XCTAssertEqual(e.captureSourceOrdinaryMinimumActiveCount(ownerID:plan.id,generation:plan.generation),3)
  hidden=true;XCTAssertEqual(e.captureSourceOrdinaryMinimumActiveCount(ownerID:plan.id,generation:plan.generation),0)
  XCTAssertFalse(e.acknowledgeSourceOrdinaryMinimumSatisfied(minimum));XCTAssertEqual(e.state,canonical)
  hidden=false;let before=captures
  XCTAssertTrue(e.advanceSourceOrdinaryMinimumPhase(minimum).accepted);XCTAssertEqual(captures,before+1)
  XCTAssertNil(e.pendingSourceOrdinaryMinimumPhase);XCTAssertEqual(e.state,canonical)
  reenter=true;XCTAssertNil(e.captureSourceOrdinaryMinimumActiveCount(ownerID:plan.id,generation:plan.generation))
  XCTAssertEqual(e.state.tiles.map(\.id),["successor"])
 }
 func testTileOnlyMinimumSnapshotRefusesMissingMarkersAndLogicalPaintMutation()throws {
  let state=NativeBoardState(tiles:[.init(id:"tile",cell:.init(column:0,row:0),value:3)])
  let paint=try XCTUnwrap(NativeSourceNoMovesRuntimeSnapshot.PaintedStateReceipt(canonicalState:state,paintedState:state))
  XCTAssertNil(NativeSourceOrdinaryMinimumTileAuthority.Snapshot(paint:paint,tiles:[:]))
  XCTAssertNil(NativeSourceOrdinaryMinimumTileAuthority.Snapshot(paint:paint,tiles:["other":.init()]))
  var mutated=state;mutated.tiles[0].value=4
  XCTAssertNil(NativeSourceNoMovesRuntimeSnapshot.PaintedStateReceipt(canonicalState:state,paintedState:mutated))
 }
}
