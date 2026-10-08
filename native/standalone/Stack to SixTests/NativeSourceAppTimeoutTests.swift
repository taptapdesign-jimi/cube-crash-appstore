import XCTest
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeSourceAppTimeoutTests:XCTestCase {
    func testLogicalTimeoutRunsDuringAnimationPauseAndRetiresBeforeReentrantCleanup() async throws {
        let owner=NativeSourceAppTimeoutOwner(),done=expectation(description:"Source50 wall-time callback")
        var elapsed=0,cancelled=0
        owner.schedule(sourceID:"original-trackAppTimeout50",generation:1,delayMilliseconds:50,elapsed:{
            elapsed+=1;XCTAssertEqual(owner.pendingCount,0)
            owner.cancelAll();done.fulfill()
        },cancelled:{cancelled+=1})
        // This finite owner has no pause operation: source pauseGame affects
        // GSAP/ticker only. Actual Scene pause behavior is tested separately.
        await fulfillment(of:[done],timeout:1)
        XCTAssertEqual(elapsed,1);XCTAssertEqual(cancelled,0)
    }
    func testCapturedGenerationCancellationSettlesExactlyOnceWithoutStaleDelivery() async throws {
        let owner=NativeSourceAppTimeoutOwner();var elapsed=0,cancelled=0
        let old=owner.schedule(sourceID:"old-generation",generation:1,delayMilliseconds:50,elapsed:{elapsed+=1},cancelled:{cancelled+=1})
        let current=expectation(description:"New generation delivery retained")
        owner.schedule(sourceID:"new-generation",generation:2,delayMilliseconds:50,elapsed:{current.fulfill()})
        owner.cancelGeneration(1);XCTAssertFalse(owner.cancel(old))
        XCTAssertEqual(owner.pendingCount,1)
        await fulfillment(of:[current],timeout:1)
        try await Task.sleep(for:.milliseconds(100))
        XCTAssertEqual(elapsed,0);XCTAssertEqual(cancelled,1);XCTAssertEqual(owner.pendingCount,0)
    }
    func testGlobalCleanupCancelsCapturedCallbacksBeforeAnyUserCancellationReentry() async throws {
        let owner=NativeSourceAppTimeoutOwner();var elapsed=0,order:[Int]=[]
        for index in 0..<3 {
            owner.schedule(sourceID:"source-map-\(index)",generation:1,delayMilliseconds:50,elapsed:{elapsed+=1},cancelled:{
                XCTAssertEqual(owner.pendingCount,0);order.append(index);owner.cancelAll()
            })
        }
        owner.cancelAll();owner.cancelAll()
        try await Task.sleep(for:.milliseconds(100))
        XCTAssertEqual(elapsed,0);XCTAssertEqual(order,[0,1,2])
    }
    func testActualTimeoutCancellationReturnsBeforeCapturedOrdinary100MoveDebit() async throws {
        let engine=NativeGameplayEngine(state:NativeBoardState(tiles:[NativeTile(id:"a",cell:.init(column:0,row:0),value:1),NativeTile(id:"b",cell:.init(column:1,row:0),value:2),NativeTile(id:"c",cell:.init(column:2,row:0),value:1),NativeTile(id:"d",cell:.init(column:3,row:0),value:1)]))
        engine.stagedOrdinaryMoves=true
        XCTAssertTrue(engine.beginDrag(tileID:"a"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
        let plan=try XCTUnwrap(engine.pendingOrdinaryStack)
        XCTAssertTrue(engine.finishOrdinaryStackAbsorb(receiptID:plan.id,generation:plan.generation).accepted)
        let receipt=try XCTUnwrap(engine.pendingOrdinaryPostchecks.first),before=engine.state
        let owner=NativeSourceAppTimeoutOwner();var elapsed=0,cancelled=0
        owner.schedule(sourceID:receipt.id,generation:receipt.generation,delayMilliseconds:100,elapsed:{
            elapsed+=1;_=engine.commitOrdinaryPostcheck(receiptID:receipt.id,generation:receipt.generation)
        },cancelled:{cancelled+=1;XCTAssertTrue(engine.cancelOrdinaryPostcheck(receiptID:receipt.id,generation:receipt.generation).accepted)})
        owner.cancelGeneration(receipt.generation);owner.cancelAll()
        try await Task.sleep(for:.milliseconds(200))
        XCTAssertEqual(elapsed,0);XCTAssertEqual(cancelled,1);XCTAssertTrue(engine.pendingOrdinaryPostchecks.isEmpty)
        XCTAssertEqual(engine.state,before);XCTAssertEqual(engine.state.moves,50)
    }
    func testActualForcedWaitCancellationKeepsSourceRemainderAwaitAndNeverManufacturesArrival() async throws {
        var tiles=[NativeTile(id:"t",cell:.init(column:0,row:0),value:6,archetype:.tnt),NativeTile(id:"merge",cell:.init(column:1,row:0),value:2)]
        tiles += (0..<4).map{NativeTile(id:"l\($0)",cell:.init(column:$0,row:1),value:1,locked:true)}
        tiles += (0..<10).map{NativeTile(id:"o\($0)",cell:.init(column:$0%5,row:2+$0/5),value:$0%2 == 0 ? 1:5)}
        let e=NativeGameplayEngine(state:NativeBoardState(tiles:tiles,board:10),recordedRandomChoices:Array(repeating:0,count:200));e.stagedOrdinaryMoves=true;e.stagedOrdinaryAssignments=true
        XCTAssertTrue(e.beginDrag(tileID:"t"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
        let tnt=try XCTUnwrap(e.pendingSpecial);XCTAssertTrue(e.releaseTntReservation(transactionID:tnt.id).accepted)
        let ordinary=e.state.tiles.filter{$0.isPlayable && !$0.isWild}
        let pair=try XCTUnwrap(ordinary.compactMap{a in ordinary.first{$0.id != a.id && a.value+$0.value == 6}.map{(a,$0)}}.first)
        XCTAssertTrue(e.beginDrag(tileID:pair.0.id));XCTAssertTrue(e.drop(target:pair.1.cell).accepted);let p=try XCTUnwrap(e.pendingOrdinarySix)
        XCTAssertTrue(e.commitOrdinarySix(receiptID:p.id,generation:p.generation).accepted);XCTAssertTrue(e.prepareOrdinarySpawns(receiptID:p.id,generation:p.generation).accepted)
        let slots=e.pendingOrdinaryAssignments
        XCTAssertTrue(slots.allSatisfy{slot in tnt.targets.contains{$0.id==slot.tileID}})
        for target in tnt.targets {XCTAssertTrue(e.commitSpecialImpact(transactionID:tnt.id,tileID:target.id).accepted)}
        for slot in slots {XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:p.id,generation:p.generation,assignmentID:slot.id).accepted)}
        let first=try XCTUnwrap(e.pendingOrdinaryAssignments.first)
        XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:p.id,generation:p.generation,assignmentID:first.id).accepted)
        let wait=try XCTUnwrap(e.pendingOrdinaryAssignments.first),before=e.state
        XCTAssertEqual(wait.kind,.forcedLocked);XCTAssertEqual(wait.delayMilliseconds,100)
        let owner=NativeSourceAppTimeoutOwner();var elapsed=0,cancelled=0
        owner.schedule(sourceID:wait.id,generation:wait.generation,delayMilliseconds:100,elapsed:{
            elapsed+=1;_=e.commitOrdinaryAssignment(receiptID:p.id,generation:p.generation,assignmentID:wait.id)
        },cancelled:{
            cancelled+=1;XCTAssertTrue(e.cancelOrdinarySpawnWait(receiptID:p.id,generation:p.generation,assignmentID:wait.id).accepted)
        })
        owner.cancelAll();owner.cancelAll();try await Task.sleep(for:.milliseconds(200))
        XCTAssertEqual(elapsed,0);XCTAssertEqual(cancelled,1);XCTAssertEqual(e.state,before)
        XCTAssertNil(e.pendingOrdinaryPrimaryArrival)
        XCTAssertEqual(e.pendingOrdinaryAssignments.first?.kind,.remainderPrimary)
        XCTAssertEqual(e.state.tiles.first{$0.id==wait.tileID}?.value,0)
    }
}
