import XCTest
@testable import StackToSixGameplay

final class NativeBaloonGameplayTests: XCTestCase {
    func testFinalAndBlockedJuiceSemanticsBothModesOrientationsAndSaveRoundTrip() throws {
        for mode in [NativeRunMode.arcade, .journey] { for final in [false,true] { for reverse in [false,true] {
            let wild=NativeTile(id:"b",cell:.init(column:0,row:0),value:6,archetype:.juice,variant:"baloon")
            let regular=NativeTile(id:"r",cell:.init(column:1,row:0),value:4)
            let original=NativeBoardState(tiles:[wild,regular]+(final ? []:[.init(id:"blocker",cell:.init(column:4,row:8),value:3)]),mode:mode)
            let restored=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(original))
            XCTAssertEqual(restored,original);XCTAssertEqual(restored.tiles.first?.gameplayArchetype,.juice)
            let e=NativeGameplayEngine(state:restored,recordedRandomChoices:Array(repeating:0.5,count:100))
            e.stagedDirectWildMoves=true;e.stagedDirectWildAssignments=true
            XCTAssertTrue(e.beginDrag(tileID:reverse ? "r":"b"))
            XCTAssertTrue(e.drop(target:reverse ? wild.cell:regular.cell).accepted)
            let plan=try XCTUnwrap(e.pendingDirectWild)
            XCTAssertEqual(plan.variant,"baloon");XCTAssertEqual(plan.archetype,.juice);XCTAssertEqual(plan.isFinal,final)
            let committed=e.commitDirectWildGameplay(transactionID:plan.id)
            XCTAssertTrue(committed.accepted)
            if final {XCTAssertEqual(committed.resolution.kind,.complete);XCTAssertTrue(e.pendingWildSpawnActions.isEmpty)}
            else {XCTAssertNotEqual(committed.resolution.kind,.complete);XCTAssertTrue(e.state.tiles.contains{$0.id=="blocker"})}
            e.cancelForBackground();XCTAssertNil(e.pendingDirectWild)
            let settled=e.state;e.cancelForBackground();XCTAssertEqual(e.state,settled)
            XCTAssertFalse(e.releaseDirectWildPresentation(transactionID:plan.id,generation:plan.generation).accepted)
        }}}
    }
}
