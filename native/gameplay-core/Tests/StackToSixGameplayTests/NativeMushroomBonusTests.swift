import XCTest
@testable import StackToSixGameplay

final class NativeMushroomBonusTests:XCTestCase {
    func testFourToSixExtrasAndMatchingClosedDiceAcrossModesDirectionsAndSpawnRoutes() throws {
        for mode in [NativeRunMode.journey,.arcade] {for staged in [false,true] {for reverse in [false,true] {for locked in [false,true] {for roll in [0.1,0.5,0.9] {
            let count=4+Int(roll*3)
            let mushroom=NativeTile(id:"m",cell:.init(column:0,row:0),value:6,archetype:.juice,variant:"mushroom")
            let ordinary=NativeTile(id:"d",cell:.init(column:1,row:0),value:2)
            let blocker=NativeTile(id:"other",cell:.init(column:4,row:8),value:3)
            let original=[mushroom,ordinary,blocker]+(locked ? [.init(id:"closed",cell:.init(column:3,row:8),value:0,locked:true)]:[])
            let engine=NativeGameplayEngine(state:.init(tiles:original,mode:mode),recordedRandomChoices:Array(repeating:roll,count:3000))
            engine.stagedDirectWildMoves=staged;engine.stagedDirectWildAssignments=staged
            XCTAssertTrue(engine.beginDrag(tileID:reverse ? "d":"m"))
            XCTAssertTrue(engine.drop(target:reverse ? mushroom.cell:ordinary.cell).accepted)
            if staged {
                let plan=try XCTUnwrap(engine.pendingDirectWild)
                XCTAssertTrue(engine.commitDirectWildGameplay(transactionID:plan.id).accepted)
                for _ in 0..<200 {
                    if let action=engine.pendingWildSpawnActions.first {
                        XCTAssertTrue(engine.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:action.id).accepted)
                    } else if let arrival=engine.pendingWildSpawnArrivals.first {
                        XCTAssertTrue(engine.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id).accepted)
                    } else {break}
                }
                engine.cancelForBackground()
            }
            XCTAssertEqual(engine.state.activeTiles.count,1+1+count,"\(mode)/\(staged)/\(reverse)/\(locked)/\(roll)")
            XCTAssertEqual(engine.state.tiles.filter(\.locked).count,(locked ? 1:0)+3+count)
            XCTAssertTrue(engine.state.validationIssues().isEmpty)
            let saved=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(engine.state))
            XCTAssertEqual(saved,engine.state)
        }}}}}
    }
    func testFinalMushroomMergeNeverCreatesBonusDice() {
        for mode in [NativeRunMode.arcade,.journey] {
            let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"m",cell:.init(column:0,row:0),value:6,archetype:.juice,variant:"mushroom"),.init(id:"d",cell:.init(column:1,row:0),value:2)],mode:mode))
            XCTAssertTrue(engine.beginDrag(tileID:"m"))
            let result=engine.drop(target:.init(column:1,row:0))
            XCTAssertTrue(result.accepted);XCTAssertEqual(result.resolution.kind,.complete)
            XCTAssertTrue(result.state.tiles.isEmpty)
        }
    }
    func testCrowdedBoardCapsAllocationAndInterruptedSpawnSettlesOnlyOnce() throws {
        for crowded in [false,true] {
            var tiles=[NativeTile(id:"m",cell:.init(column:0,row:0),value:6,archetype:.juice,variant:"mushroom"),NativeTile(id:"d",cell:.init(column:1,row:0),value:2)]
            tiles += (2..<(crowded ? 45:3)).map{.init(id:"other-\($0)",cell:.init(column:$0%5,row:$0/5),value:3)}
            let engine=NativeGameplayEngine(state:.init(tiles:tiles),recordedRandomChoices:Array(repeating:0.9,count:3000))
            engine.stagedDirectWildMoves=true;engine.stagedDirectWildAssignments=true
            XCTAssertTrue(engine.beginDrag(tileID:"m"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
            let plan=try XCTUnwrap(engine.pendingDirectWild)
            XCTAssertTrue(engine.commitDirectWildGameplay(transactionID:plan.id).accepted)
            engine.cancelForBackground()
            XCTAssertNil(engine.pendingDirectWild);XCTAssertTrue(engine.pendingWildSpawnActions.isEmpty)
            XCTAssertTrue(engine.state.validationIssues().isEmpty);XCTAssertLessThanOrEqual(engine.state.tiles.count,45)
            if !crowded {XCTAssertEqual(engine.state.activeTiles.count,8)}
            let settled=engine.state;engine.cancelForBackground();XCTAssertEqual(engine.state,settled)
            XCTAssertFalse(engine.releaseDirectWildPresentation(transactionID:plan.id,generation:plan.generation).accepted)
        }
    }
}
