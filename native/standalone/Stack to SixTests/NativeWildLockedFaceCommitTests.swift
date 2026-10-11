import XCTest
@testable import StackToSixGameplay
nonisolated final class NativeWildLockedFaceCommitTests:XCTestCase {
    private func prepared() throws -> (NativeGameplayEngine,NativeDirectWildMovePlan,NativeWildSpawnAction) {
        let tiles=[NativeTile(id:"w",cell:.init(column:0,row:0),value:6,starOrbitCount:1,archetype:.star),NativeTile(id:"d",cell:.init(column:1,row:0),value:5),NativeTile(id:"other",cell:.init(column:4,row:8),value:2),NativeTile(id:"locked",cell:.init(column:0,row:1),value:0,locked:true)]
        let e=NativeGameplayEngine(state:.init(tiles:tiles,board:10),recordedRandomChoices:Array(repeating:0.2,count:1000))
        e.stagedDirectWildMoves=true;e.stagedDirectWildAssignments=true
        XCTAssertTrue(e.beginDrag(tileID:"w"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
        let p=try XCTUnwrap(e.pendingDirectWild);XCTAssertTrue(e.commitDirectWildGameplay(transactionID:p.id).accepted)
        let arrival=try XCTUnwrap(e.pendingWildSpawnArrivals.first)
        XCTAssertTrue(e.finishWildSpawnArrival(transactionID:p.id,generation:p.generation,arrivalID:arrival.id).accepted)
        let a=try XCTUnwrap(e.pendingWildSpawnActions.first);XCTAssertEqual(a.kind,.locked)
        return (e,p,a)
    }
    func testRetainedFaceCommitsBeforeBouncePublicationAndOnceOnly() throws {
        let(e,p,a)=try prepared();var calls=0
        e.sourceWildLockedFaceCommit={action,tile in
            calls+=1;XCTAssertEqual(action,a);XCTAssertFalse(tile.locked);XCTAssertGreaterThan(tile.value,0)
            XCTAssertEqual(e.state.tiles.first{$0.id==tile.id},tile)
            XCTAssertFalse(e.pendingWildSpawnPresentations.contains{$0.tileID==tile.id})
            return true
        }
        XCTAssertTrue(e.commitWildSpawnAction(transactionID:p.id,generation:p.generation,actionID:a.id).accepted)
        XCTAssertEqual(calls,1);XCTAssertTrue(e.pendingWildSpawnPresentations.contains{$0.tileID==a.tileID})
        XCTAssertFalse(e.commitWildSpawnAction(transactionID:p.id,generation:p.generation,actionID:a.id).accepted)
        XCTAssertEqual(calls,1)
    }
    func testRefusedFaceCannotPublishBounceOrAcknowledgeItsLockedPhase() throws {
        let(e,p,a)=try prepared()
        let boundary=e.hasReachedWildSourceResolutionBoundary(transactionID:p.id,generation:p.generation)
        e.sourceWildLockedFaceCommit={_,_ in false}
        XCTAssertFalse(e.commitWildSpawnAction(transactionID:p.id,generation:p.generation,actionID:a.id).accepted)
        XCTAssertFalse(e.pendingWildSpawnPresentations.contains{$0.tileID==a.tileID})
        XCTAssertEqual(e.hasReachedWildSourceResolutionBoundary(transactionID:p.id,generation:p.generation),boundary)
        XCTAssertNotNil(e.pendingDirectWild)
        XCTAssertTrue(e.hasUnsavableSourceGameplayState)
    }
}
