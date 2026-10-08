import XCTest
import StackToSixGameplay

@MainActor final class NativeSourceOrdinarySixSpawnBeginCoreTests:XCTestCase {
    func make(moves:Int=10,final:Bool=false,enabled:Bool=true)->NativeGameplayEngine {
        let tiles:[NativeTile]=[.init(id:"s",cell:.init(column:0,row:0),value:1),.init(id:"d",cell:.init(column:1,row:0),value:5)]+(final ? []:[.init(id:"o",cell:.init(column:2,row:0),value:4)])
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
