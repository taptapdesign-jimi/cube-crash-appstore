import XCTest
@testable import StackToSixGameplay
final class NativeOrdinarySourceTests:XCTestCase {
    struct Oracle:Decodable {let flow:[Flow],admission:[Admission];let epochs:Epochs}
    struct Flow:Decodable {let scenario:String,moves:Int,releaseAt:Int,waitMilliseconds:Int?,moveDebitAt:Int?}
    struct Admission:Decodable {let sourceValue,destinationValue:Int,sourceStableOrdinary,destinationStableOrdinary,allowed:Bool}
    struct Epochs:Decodable {let currentBefore,currentAfter:Bool}
    func die(_ id:String,_ value:Int,_ column:Int,_ stable:Bool=true)->NativeTile{NativeTile(id:id,cell:NativeCell(column:column,row:0),value:value,resolutionOwned:!stable)}
    func testActualSource196SubSixHandoffAdmissionCases()throws {
        let rows=try JSONDecoder().decode(Oracle.self,from:NativeOrdinarySourceOracle.data)
        XCTAssertEqual(rows.admission.count,196)
        XCTAssertTrue(rows.epochs.currentBefore);XCTAssertFalse(rows.epochs.currentAfter)
        for r in rows.admission {
            let e=NativeGameplayEngine(state:NativeBoardState(tiles:[die("s",1,0),die("d",5,1),die("a",r.sourceValue,2,r.sourceStableOrdinary),die("b",r.destinationValue,3,r.destinationStableOrdinary)]))
            e.stagedOrdinaryMoves=true;XCTAssertTrue(e.beginDrag(tileID:"s"));XCTAssertTrue(e.drop(target:NativeCell(column:1,row:0)).accepted)
            let picked=e.beginDrag(tileID:"a"),accepted=picked && e.drop(target:NativeCell(column:3,row:0)).accepted
            XCTAssertEqual(accepted,r.allowed,"\(r.sourceValue)+\(r.destinationValue), stability \(r.sourceStableOrdinary)/\(r.destinationStableOrdinary)")
        }
    }
    func testMoveDebitMatchesExecutedOriginalAbsorbCallbackControlFlow()throws {
        let rows=try JSONDecoder().decode(Oracle.self,from:NativeOrdinarySourceOracle.data)
        XCTAssertEqual(rows.flow.count,8)
        for row in rows.flow {
            let continues=row.scenario=="continue" || row.scenario=="busy-at-absorb" || row.scenario=="source-error"
            let tiles=continues ? [die("s",1,0),die("d",2,1),die("a",1,2)]:[die("s",3,0),die("d",2,1)]
            let e=NativeGameplayEngine(state:NativeBoardState(tiles:tiles))
            e.stagedOrdinaryMoves=true;XCTAssertTrue(e.beginDrag(tileID:"s"));XCTAssertTrue(e.drop(target:NativeCell(column:1,row:0)).accepted)
            let p=try XCTUnwrap(e.pendingOrdinaryStack);XCTAssertEqual(e.state.moves,50)
            if row.scenario=="busy-at-absorb" {var flags=e.flags;flags.busyEnding=true;e.setRuntimeFlags(flags)}
            XCTAssertEqual(row.releaseAt,80);XCTAssertTrue(e.finishOrdinaryStackAbsorb(receiptID:p.id,generation:p.generation).accepted)
            XCTAssertEqual(e.pendingOrdinaryPostchecks.first?.delayMilliseconds,row.waitMilliseconds ?? 0)
            if row.scenario=="busy-during-await" {var flags=e.flags;flags.busyEnding=true;e.setRuntimeFlags(flags)}
            if row.scenario=="cancelled-await" || row.scenario=="source-error" {XCTAssertTrue(e.cancelOrdinaryPostcheck(receiptID:p.id,generation:p.generation).accepted)}
            else {XCTAssertTrue(e.commitOrdinaryPostcheck(receiptID:p.id,generation:p.generation).accepted)}
            XCTAssertEqual(e.state.moves,row.moves,row.scenario)
            XCTAssertFalse(e.commitOrdinaryPostcheck(receiptID:p.id,generation:p.generation).accepted)
            if let debit=row.moveDebitAt {XCTAssertEqual(debit,row.scenario=="busy-at-absorb" ? 80:180)}
        }
    }
}
