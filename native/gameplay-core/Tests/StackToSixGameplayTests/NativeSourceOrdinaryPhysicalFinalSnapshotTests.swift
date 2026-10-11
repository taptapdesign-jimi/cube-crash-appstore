import XCTest
@testable import StackToSixGameplay

final class NativeSourceOrdinaryPhysicalFinalSnapshotTests:XCTestCase {
    private func make()->NativeGameplayEngine {
        let e=NativeGameplayEngine(state:.init(tiles:[
            .init(id:"source",cell:.init(column:0,row:0),value:3),
            .init(id:"destination",cell:.init(column:1,row:0),value:3),
            .init(id:"other",cell:.init(column:2,row:0),value:2)],board:7))
        e.stagedOrdinaryMoves=true;e.sourceOrdinaryPhysicalFinalSnapshotEnabled=true
        return e
    }
    func testActualDropCapturesPhysicalVisibilityBeforeImmutableOrdinarySixFinality()throws {
        let e=make()
        e.sourceOrdinaryMinimumTileAuthority = .init(isCurrent:{true},capture:{
            var physical=e.state;physical.tiles[2].alpha=0.01
            guard let paint=NativeSourceNoMovesRuntimeSnapshot.PaintedStateReceipt(canonicalState:e.state,paintedState:physical) else{return nil}
            return .init(paint:paint,tiles:Dictionary(uniqueKeysWithValues:e.state.tiles.map{($0.id,NativeNoMovesTileRuntime())}))
        })
        XCTAssertFalse(NativeGameplayResolver.finalMerge(e.state.tiles,source:e.state.tiles[0],destination:e.state.tiles[1],effectiveSum:6).isFinalMerge)
        XCTAssertTrue(e.beginDrag(tileID:"source"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
        let plan=try XCTUnwrap(e.pendingOrdinarySix)
        XCTAssertTrue(plan.isFinal);XCTAssertEqual(e.sourceOrdinaryPhysicalFinalCaptureCount,1)
        // Later paint cannot revoke the genuinely captured immutable decision.
        e.sourceOrdinaryMinimumTileAuthority=nil
        let result=e.commitOrdinarySix(receiptID:plan.id,generation:plan.generation)
        XCTAssertTrue(result.accepted);XCTAssertEqual(result.resolution.kind,.complete)
        XCTAssertTrue(e.pendingOrdinaryAssignments.isEmpty);XCTAssertEqual(e.state.moves,49)
        XCTAssertNil(e.sourceNoMovesRuntimeAuthority)
    }
    func testMissingPhysicalAuthorityCannotStageOrDebitOrCertifyCanonicalOnlyFinality()throws {
        let e=make(),before=e.state
        XCTAssertTrue(e.beginDrag(tileID:"source"));XCTAssertFalse(e.drop(target:.init(column:1,row:0)).accepted)
        XCTAssertEqual(e.state,before);XCTAssertNil(e.pendingOrdinarySix)
        XCTAssertEqual(e.sourceOrdinaryPhysicalFinalCaptureCount,0)
    }
    func testPhysicalCaptureRestartCannotStageOldPairInSuccessor()throws {
        let e=make()
        e.sourceOrdinaryMinimumTileAuthority = .init(isCurrent:{true},capture:{
            let captured=e.state
            let paint=NativeSourceNoMovesRuntimeSnapshot.PaintedStateReceipt(canonicalState:captured,paintedState:captured)
            e.restart(state:.init(tiles:[.init(id:"successor",cell:.init(column:0,row:0),value:4)]))
            return paint.flatMap{.init(paint:$0,tiles:Dictionary(uniqueKeysWithValues:captured.tiles.map{($0.id,NativeNoMovesTileRuntime())}))}
        })
        XCTAssertTrue(e.beginDrag(tileID:"source"));XCTAssertFalse(e.drop(target:.init(column:1,row:0)).accepted)
        XCTAssertEqual(e.state.tiles.map(\.id),["successor"]);XCTAssertNil(e.pendingOrdinarySix)
        XCTAssertEqual(e.sourceOrdinaryPhysicalFinalCaptureCount,0)
    }
}
