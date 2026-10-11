import XCTest
@testable import StackToSixGameplay

final class NativeSourceFinalMergeBlockersTests:XCTestCase {
    struct Fixture:Decodable {let sourceReference:String;let cases:[Case];let snapshots:[SnapshotCase]}
    struct Case:Decodable {
        let wild:Bool,value:Int,depth:Int,alpha:Double,visible:Bool,locked:Bool,destroyed:Bool
        let pendingRemoval:Bool,beingRemoved:Bool,cleanupQueued:Bool,magnetAffected:Bool,wildDropping:Bool,excluded:Bool,blocks:Bool,active:Bool
    }
    func testPhysicalBlockerPredicateMatchesImmutableSourceAcross640CapturedMarkerCases()throws {
        let url=try XCTUnwrap(Bundle.module.url(forResource:"SourceFinalMergeBlockersOracle",withExtension:"json"))
        let fixture=try JSONDecoder().decode(Fixture.self,from:Data(contentsOf:url))
        XCTAssertEqual(fixture.sourceReference,"8e4364e8ee571f16c6322727a9ae79fee5a982eb");XCTAssertEqual(fixture.cases.count,640)
        for (index,c) in fixture.cases.enumerated() {
            let tile=NativeTile(id:"observed",cell:.init(column:0,row:0),value:c.value,stackDepth:c.depth,archetype:c.wild ? .star:nil,
                locked:c.locked,visible:c.visible,alpha:c.alpha,pendingRemoval:c.pendingRemoval,magnetOwned:c.magnetAffected)
            var runtime=NativeNoMovesTileRuntime();runtime.destroyed=c.destroyed;runtime.beingRemoved=c.beingRemoved
            runtime.cleanupQueued=c.cleanupQueued;runtime.wildDropping=c.wildDropping
            XCTAssertEqual(NativeSourceFinalMergeBlockers.blocks(tile,runtime:runtime,excluding:c.excluded ? [tile.id]:[]),c.blocks,"actual Source case \(index)")
            XCTAssertEqual(NativeSourceFinalMergeBlockers.countsAsActive(tile,runtime:runtime),c.active,"actual active Source case \(index)")
        }
    }
    func testVisibleWildDropBlocksEvenWhenItsInputEventModeIsNone() {
        let tile=NativeTile(id:"wild",cell:.init(column:0,row:0),value:6,archetype:.juice,locked:true,alpha:0.36)
        var runtime=NativeNoMovesTileRuntime();runtime.wildDropping=true;runtime.eventMode = .none
        XCTAssertTrue(NativeSourceFinalMergeBlockers.blocks(tile,runtime:runtime,excluding:[]))
        XCTAssertFalse(NativeSourceEndgameChecker.active(tile,runtime:runtime),"Final-merge blocker and minimum-active predicates are distinct Source recipes")
    }
    func testDetachedGridPresenceStillBlocksAndSingleSixRequiresCompleteActualRoster()throws {
        let dst=NativeTile(id:"dst",cell:.init(column:0,row:0),value:6)
        let detached=NativeTile(id:"detached",cell:dst.cell,value:2)
        let state=NativeBoardState(tiles:[dst,detached],sourceDetachedGridTileIDs:[detached.id])
        let runtime=Dictionary(uniqueKeysWithValues:state.tiles.map{($0.id,NativeNoMovesTileRuntime())})
        XCTAssertNotNil(NativeSourceFinalMergePresenceAuthority.Snapshot(canonicalState:state,physicalTiles:state.tiles,runtime:runtime))
        XCTAssertEqual(NativeSourceFinalMergeBlockers.singleMergeSixCompletion(tiles:state.tiles,runtime:runtime,sourceID:"src",destinationID:"dst"),false)
        var hidden=state.tiles;hidden[1].visible=false
        XCTAssertEqual(NativeSourceFinalMergeBlockers.singleMergeSixCompletion(tiles:hidden,runtime:runtime,sourceID:"src",destinationID:"dst"),true)
        XCTAssertNil(NativeSourceFinalMergeBlockers.singleMergeSixCompletion(tiles:hidden,runtime:["dst":.init()],sourceID:"src",destinationID:"dst"))
    }
    struct SnapshotCase:Decodable {
        let source:Case,destination:Case,other:Case,effectiveSum:Int,magnetWillPull:Bool,expected:NativeFinalMergeSnapshot
    }
    func testImmutablePhysicalSnapshotFieldsMatchActualSourceAcross256Cases()throws {
        let url=try XCTUnwrap(Bundle.module.url(forResource:"SourceFinalMergeBlockersOracle",withExtension:"json"))
        let fixture=try JSONDecoder().decode(Fixture.self,from:Data(contentsOf:url))
        XCTAssertEqual(fixture.snapshots.count,256)
        for (index,c) in fixture.snapshots.enumerated() {
            let recipes=[c.source,c.destination,c.other]
            let tiles=recipes.enumerated().map{offset,r in NativeTile(id:"tile-\(offset)",cell:.init(column:offset,row:0),value:r.value,
                stackDepth:r.depth,archetype:r.wild ? .star:nil,locked:r.locked,visible:r.visible,alpha:r.alpha,pendingRemoval:r.pendingRemoval,magnetOwned:r.magnetAffected)}
            let runtime=Dictionary(uniqueKeysWithValues:recipes.enumerated().map{offset,r in
                var value=NativeNoMovesTileRuntime();value.destroyed=r.destroyed;value.beingRemoved=r.beingRemoved
                value.cleanupQueued=r.cleanupQueued;value.wildDropping=r.wildDropping
                return (tiles[offset].id,value)
            })
            XCTAssertEqual(NativeSourceFinalMergeBlockers.finalSnapshot(tiles:tiles,runtime:runtime,source:tiles[0],destination:tiles[1],effectiveSum:c.effectiveSum,magnetWillPull:c.magnetWillPull),c.expected,"actual snapshot \(index)")
        }
    }
}
