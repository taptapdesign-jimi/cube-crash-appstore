import XCTest
@testable import StackToSixGameplay
final class NativeOrdinaryAssignmentSourceTests:XCTestCase {
    struct Oracle:Decodable {let locked:[Batch],primary:[Primary],cleanup:[Cleanup],forced:[Forced]}
    struct Batch:Decodable {let count,k:Int,roll:Double,invalidate:Bool,opened,faceDraws:Int,logicalDoneBeforeDecorativeCompletion:Bool,assignments:[Assignment],final:[Die]}
    struct Assignment:Decodable {let time:Int,id:String,value:Int,locked:Bool,bound:Int}
    struct Die:Decodable {let id:String,value:Int,locked:Bool}
    struct Primary:Decodable {let interrupted:Bool,assignedBeforeCompletion:Before}
    struct Forced:Decodable {let count,k:Int,prefer,rejected:Bool,opened,faceDraws:Int,assignments:[ForcedAssignment]}
    struct ForcedAssignment:Decodable {let id:String,time:Int}
    struct Cleanup:Decodable {let fresh,destroyed:Bool,removed,released:Int,cellID:String?}
    struct Before:Decodable {let value:Int,locked:Bool,bound:Int,settled:Bool,faceDraws:Int}
    func testSixtyActualSourceLockedBatchesMatchNativeSelectionIdentityTimingAndEpochBoundary()throws {
        let oracle=try JSONDecoder().decode(Oracle.self,from:NativeOrdinaryAssignmentOracle.data)
        XCTAssertEqual(oracle.locked.count,60)
        for row in oracle.locked {
            var tiles=[NativeTile(id:"a",cell:.init(column:0,row:0),value:1,stackDepth:row.k == 3 ? 4:1),NativeTile(id:"b",cell:.init(column:1,row:0),value:5),NativeTile(id:"c",cell:.init(column:2,row:0),value:1),NativeTile(id:"d",cell:.init(column:3,row:0),value:1)]
            tiles += (0..<row.count).map{NativeTile(id:"l\($0)",cell:.init(column:$0%5,row:1+$0/5),value:0,locked:true)}
            let choices=Array(repeating:row.roll,count:max(0,row.count-1))+Array(repeating:0.0,count:50)
            let e=NativeGameplayEngine(state:NativeBoardState(tiles:tiles,board:10),recordedRandomChoices:choices);e.stagedOrdinaryMoves=true;e.stagedOrdinaryAssignments=true
            XCTAssertTrue(e.beginDrag(tileID:"a"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
            let p=try XCTUnwrap(e.pendingOrdinarySix);XCTAssertTrue(e.commitOrdinarySix(receiptID:p.id,generation:p.generation).accepted)
            XCTAssertTrue(e.prepareOrdinarySpawns(receiptID:p.id,generation:p.generation).accepted)
            let slots=e.pendingOrdinaryAssignments
            var assignments:[(String,Int)]=[]
            for slot in slots {
                let result=e.commitOrdinaryAssignment(receiptID:p.id,generation:p.generation,assignmentID:slot.id);XCTAssertTrue(result.accepted)
                if let spawned=result.events.first(where:{$0.kind == .spawned}) {
                    assignments.append((spawned.tileIDs[0],80+50+slot.delayMilliseconds))
                    if row.invalidate && assignments.count==1 {XCTAssertTrue(e.beginDrag(tileID:"c"));XCTAssertTrue(e.drop(target:.init(column:3,row:0)).accepted)}
                }
            }
            XCTAssertEqual(assignments.map(\.0),row.assignments.map(\.id));XCTAssertEqual(assignments.map(\.1),row.assignments.map(\.time))
            XCTAssertEqual(assignments.count,row.opened);XCTAssertEqual(row.faceDraws,row.opened);XCTAssertTrue(row.logicalDoneBeforeDecorativeCompletion)
            for die in row.final {let tile=try XCTUnwrap(e.state.tiles.first{$0.id==die.id});XCTAssertEqual(tile.value,die.value);XCTAssertEqual(tile.locked,die.locked)}
        }
    }
    func testOriginalForcedUnlock136CasesPreserveStableMergeCellPriorityAndGuardBeforeMutation()throws {
        let oracle=try JSONDecoder().decode(Oracle.self,from:NativeOrdinaryAssignmentOracle.data);XCTAssertEqual(oracle.forced.count,136)
        for row in oracle.forced {
            XCTAssertEqual(row.faceDraws,row.opened)
            if row.rejected {XCTAssertEqual(row.opened,0);XCTAssertTrue(row.assignments.isEmpty)}
            else {
                XCTAssertEqual(row.opened,min(row.count,row.k))
                XCTAssertEqual(row.assignments.map(\.time),(0..<row.opened).map{$0*100})
                if row.count>0 {XCTAssertEqual(row.assignments.first?.id,"l\(row.prefer ? row.count-1:0)")}
            }
        }
    }
    func testExecutedOriginalDestinationCleanupPreservesFreshSameCellOwner()throws {
        let oracle=try JSONDecoder().decode(Oracle.self,from:NativeOrdinaryAssignmentOracle.data)
        XCTAssertEqual(oracle.cleanup.count,4)
        for row in oracle.cleanup {
            if row.destroyed {XCTAssertEqual(row.removed,0);XCTAssertEqual(row.released,0);continue}
            let tiles=[NativeTile(id:"a",cell:.init(column:0,row:0),value:1),NativeTile(id:"destination",cell:.init(column:1,row:0),value:5),NativeTile(id:"c",cell:.init(column:2,row:0),value:1)]
            let e=NativeGameplayEngine(state:NativeBoardState(tiles:tiles,board:10),recordedRandomChoices:Array(repeating:0,count:10));e.stagedOrdinaryMoves=true;e.stagedOrdinaryAssignments=true
            XCTAssertTrue(e.beginDrag(tileID:"a"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted);let p=try XCTUnwrap(e.pendingOrdinarySix)
            XCTAssertTrue(e.commitOrdinarySix(receiptID:p.id,generation:p.generation).accepted)
            if row.fresh {
                XCTAssertTrue(e.prepareOrdinarySpawns(receiptID:p.id,generation:p.generation).accepted);let slot=try XCTUnwrap(e.pendingOrdinaryAssignments.first)
                XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:p.id,generation:p.generation,assignmentID:slot.id).accepted)
            }
            XCTAssertTrue(e.commitOrdinaryDestinationCleanup(receiptID:p.id,generation:p.generation).accepted)
            XCTAssertEqual(row.removed,1);XCTAssertEqual(row.released,1)
            if row.fresh {XCTAssertEqual(row.cellID,"fresh");XCTAssertEqual(e.state.tile(at:p.destination.cell)?.value,1)}
            else{XCTAssertNil(row.cellID);XCTAssertNil(e.state.tile(at:p.destination.cell))}
        }
    }
    func testOriginalPrimaryAssignsPlayableBeforeItsSeparateBouncePromiseCompletion()throws {
        let oracle=try JSONDecoder().decode(Oracle.self,from:NativeOrdinaryAssignmentOracle.data)
        XCTAssertEqual(oracle.primary.count,2)
        for row in oracle.primary {
            let tiles=[NativeTile(id:"a",cell:.init(column:0,row:0),value:1),NativeTile(id:"b",cell:.init(column:1,row:0),value:5),NativeTile(id:"c",cell:.init(column:2,row:0),value:1)]
            let e=NativeGameplayEngine(state:NativeBoardState(tiles:tiles,board:10),recordedRandomChoices:Array(repeating:0,count:10));e.stagedOrdinaryMoves=true;e.stagedOrdinaryAssignments=true
            XCTAssertTrue(e.beginDrag(tileID:"a"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted);let p=try XCTUnwrap(e.pendingOrdinarySix)
            XCTAssertTrue(e.commitOrdinarySix(receiptID:p.id,generation:p.generation).accepted);XCTAssertTrue(e.prepareOrdinarySpawns(receiptID:p.id,generation:p.generation).accepted)
            let slot=try XCTUnwrap(e.pendingOrdinaryAssignments.first);XCTAssertTrue(e.commitOrdinaryAssignment(receiptID:p.id,generation:p.generation,assignmentID:slot.id).accepted)
            let tile=try XCTUnwrap(e.state.tile(at:p.destination.cell));XCTAssertEqual(tile.value,row.assignedBeforeCompletion.value);XCTAssertEqual(tile.locked,row.assignedBeforeCompletion.locked)
            XCTAssertTrue(e.beginDrag(tileID:tile.id));e.cancelDrag();XCTAssertFalse(row.assignedBeforeCompletion.settled)
            XCTAssertNotNil(e.pendingOrdinaryPrimaryArrival);if e.pendingOrdinaryDestinationCleanup != nil {XCTAssertTrue(e.commitOrdinaryDestinationCleanup(receiptID:p.id,generation:p.generation).accepted)}
        XCTAssertTrue(e.finishOrdinaryPrimarySpawn(receiptID:p.id,generation:p.generation,assignmentID:slot.id,interrupted:row.interrupted).accepted)
            XCTAssertNil(e.pendingOrdinaryPrimaryArrival);XCTAssertTrue(e.releaseOrdinarySixHandoff(receiptID:p.id,generation:p.generation).accepted)
        }
    }
}
