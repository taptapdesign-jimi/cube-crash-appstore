import XCTest
@testable import StackToSixGameplay
final class NativeWildReinforcementTests:XCTestCase {
    func testExactLevelFlowTransportFlagExcludesAwaitedPrimaryAndHardFallback()throws {
        for hard in [false,true] {
            var tiles=[NativeTile(id:"w",cell:.init(column:0,row:0),value:6,starOrbitCount:1,archetype:.star),NativeTile(id:"d",cell:.init(column:1,row:0),value:5),NativeTile(id:"survivor",cell:.init(column:4,row:8),value:2)]
            if !hard {tiles.append(NativeTile(id:"locked",cell:.init(column:0,row:1),value:0,locked:true))}
            let e=NativeGameplayEngine(state:NativeBoardState(tiles:tiles,board:10),recordedRandomChoices:Array(repeating:0.2,count:1000))
            e.stagedDirectWildMoves=true;e.stagedDirectWildAssignments=true
            if hard {e.wildSpawnPermitAdmission={purpose in if case .primary=purpose{return false};return true}}
            XCTAssertTrue(e.beginDrag(tileID:"w"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
            let plan=try XCTUnwrap(e.pendingDirectWild);XCTAssertTrue(e.commitDirectWildGameplay(transactionID:plan.id).accepted)
            for presentation in e.pendingWildSpawnPresentations {XCTAssertFalse(presentation.sourceLevelFlowReinforcement)}
            // Source normal primary already assigns synchronously in actual main80.
            if let arrival=e.pendingWildSpawnArrivals.first {XCTAssertTrue(e.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id).accepted)}
            for _ in 0..<3 {
                guard let action=e.pendingWildSpawnActions.first,action.kind != .locked else{break}
                XCTAssertTrue(e.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:action.id).accepted)
                for presentation in e.pendingWildSpawnPresentations {XCTAssertFalse(presentation.sourceLevelFlowReinforcement)}
                if let arrival=e.pendingWildSpawnArrivals.first {XCTAssertTrue(e.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id).accepted)}
            }
            let locked=try XCTUnwrap(e.pendingWildSpawnActions.first);XCTAssertEqual(locked.kind,.locked)
            XCTAssertTrue(e.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:locked.id).accepted)
            let presentation=try XCTUnwrap(e.pendingWildSpawnPresentations.first{$0.tileID==locked.tileID})
            XCTAssertTrue(presentation.sourceLevelFlowReinforcement)
        }
    }
}
