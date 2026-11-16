import XCTest
@testable import StackToSixGameplay

final class NativeBallStackedFiveFinalTests:XCTestCase {
    func testLastBallOnStackedFiveNeverRefillsAcrossDirectionsDepthsModesAndLegacyFamilies() throws {
        for mode in [NativeRunMode.journey,.arcade] {
            for legacy in [NativeWildArchetype.juice,.tnt,.magnet] {
                for depth in 1...4 {for reverse in [false,true] {for physical in [false,true] {
                    let ball=NativeTile(id:"ball",cell:.init(column:0,row:0),value:6,archetype:legacy,variant:"beach-ball")
                    let five=NativeTile(id:"five",cell:.init(column:1,row:0),value:5,stackDepth:depth)
                    let engine=NativeGameplayEngine(state:.init(tiles:[ball,five],mode:mode,board:15),recordedRandomChoices:Array(repeating:0.5,count:100))
                    engine.stagedDirectWildMoves=true;engine.stagedDirectWildAssignments=true
                    if physical {
                        engine.sourceDirectPhysicalFinalSnapshotEnabled=true
                        engine.sourceFinalMergePresenceAuthority = .init(isCurrent:{true},capture:{[weak engine] in
                            guard let engine else{return nil}
                            return .init(canonicalState:engine.state,physicalTiles:engine.state.tiles,
                                runtime:Dictionary(uniqueKeysWithValues:engine.state.tiles.map{($0.id,NativeNoMovesTileRuntime())}))
                        })
                    }
                    XCTAssertTrue(engine.beginDrag(tileID:reverse ? five.id:ball.id))
                    XCTAssertTrue(engine.drop(target:reverse ? ball.cell:five.cell).accepted)
                    let plan=try XCTUnwrap(engine.pendingDirectWild)
                    XCTAssertTrue(plan.isFinal,"\(mode) \(legacy) depth\(depth) reverse\(reverse) physical\(physical)")
                    XCTAssertTrue(engine.prepareSourceDirectWildPrefix(receiptID:plan.id,generation:plan.generation).accepted)
                    if let face=engine.prepareSourceWildDestinationFace(transactionID:plan.id,generation:plan.generation) {
                        XCTAssertTrue(engine.commitSourceWildDestinationFace(receiptID:face.id,generation:face.generation).accepted)
                    }
                    let result=engine.commitDirectWildGameplay(transactionID:plan.id)
                    XCTAssertTrue(result.accepted);XCTAssertEqual(result.resolution.kind,.complete)
                    XCTAssertFalse(result.events.contains{$0.kind == .spawned})
                    XCTAssertTrue(engine.state.tiles.isEmpty)
                    XCTAssertTrue(engine.pendingWildSpawnActions.isEmpty);XCTAssertTrue(engine.pendingWildSpawnArrivals.isEmpty)
                    XCTAssertTrue(engine.pendingWildLockedBonusPresentations.isEmpty)
                    engine.cancelForBackground();XCTAssertEqual(engine.state.terminal?.kind,.complete)
                }}}
            }
        }
    }
    func testAnOlderVisibleOneBlocksFinalityButAnActuallyHiddenOneDoesNot() throws {
        for hidden in [false,true] {
            let ball=NativeTile(id:"ball",cell:.init(column:0,row:0),value:6,archetype:.juice,variant:"beach-ball")
            let five=NativeTile(id:"five",cell:.init(column:1,row:0),value:5,stackDepth:3)
            let old=NativeTile(id:"native:3:14:3:0:die:11",cell:.init(column:3,row:0),value:1)
            let engine=NativeGameplayEngine(state:.init(tiles:[ball,five,old],mode:.journey,board:15),recordedRandomChoices:Array(repeating:0.9,count:500))
            engine.stagedDirectWildMoves=true;engine.stagedDirectWildAssignments=true
            engine.sourceDirectPhysicalFinalSnapshotEnabled=true
            engine.sourceFinalMergePresenceAuthority = .init(isCurrent:{true},capture:{[weak engine] in
                guard let engine else{return nil}
                var observed=engine.state.tiles
                if hidden,let index=observed.firstIndex(where:{$0.id==old.id}) {observed[index].visible=false;observed[index].alpha=0}
                return .init(canonicalState:engine.state,physicalTiles:observed,
                    runtime:Dictionary(uniqueKeysWithValues:observed.map{($0.id,NativeNoMovesTileRuntime())}))
            })
            XCTAssertTrue(engine.beginDrag(tileID:ball.id));XCTAssertTrue(engine.drop(target:five.cell).accepted)
            let plan=try XCTUnwrap(engine.pendingDirectWild)
            XCTAssertEqual(plan.isFinal,hidden)
            let result=engine.commitDirectWildGameplay(transactionID:plan.id)
            XCTAssertTrue(result.accepted)
            if hidden {
                XCTAssertEqual(result.resolution.kind,.complete)
                XCTAssertFalse(result.events.contains{$0.kind == .spawned})
            } else {
                XCTAssertNotEqual(result.resolution.kind,.complete)
                XCTAssertTrue(engine.state.tiles.contains{$0.id==old.id})
                XCTAssertFalse(engine.pendingWildSpawnActions.isEmpty || engine.state.tiles.count<=3)
            }
        }
    }
}
