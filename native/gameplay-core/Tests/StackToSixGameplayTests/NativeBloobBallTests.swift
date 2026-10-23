import XCTest
@testable import StackToSixGameplay

final class NativeBloobBallTests:XCTestCase {
    func testBloobAndLegacyStarSavesUseWholeBoardBarrelInBothModesAndDirections()throws {
        for mode in [NativeRunMode.journey,.arcade] {for reverse in [false,true] {for core in [NativeWildArchetype.star,.tnt] {
            func run(_ variant:String,_ saved:NativeWildArchetype)throws->NativeGameplayEngine {
                let wild=NativeTile(id:"wild",cell:.init(column:0,row:0),value:6,archetype:saved,variant:variant)
                let destination=NativeTile(id:"d",cell:.init(column:1,row:0),value:2)
                var tiles=[wild,destination]
                for i in 2..<43 {tiles.append(.init(id:"t\(i)",cell:.init(column:i%5,row:i/5),value:i%5+1))}
                tiles.append(.init(id:"protected",cell:.init(column:3,row:8),value:6,archetype:.star))
                tiles.append(.init(id:"locked",cell:.init(column:4,row:8),value:0,locked:true))
                let roundtrip=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(NativeBoardState(tiles:tiles,mode:mode)))
                XCTAssertEqual(roundtrip.tiles[0].archetype,saved);XCTAssertEqual(roundtrip.tiles[0].gameplayArchetype,.tnt)
                XCTAssertTrue(NativeSpecialDiceRegistry.admits(roundtrip.tiles[0],as:.tnt))
                let e=NativeGameplayEngine(state:roundtrip,recordedRandomChoices:Array(repeating:0.3,count:4000))
                XCTAssertTrue(e.beginDrag(tileID:reverse ? "d":"wild"));XCTAssertTrue(e.drop(target:reverse ? wild.cell:destination.cell).accepted)
                let plan=try XCTUnwrap(e.pendingSpecial);XCTAssertEqual(plan.targets.count,41);XCTAssertEqual(plan.archetype,.tnt)
                XCTAssertNil(e.pendingDirectWild);XCTAssertFalse(e.commitSpecialBoard(transactionID:plan.id).accepted)
                for t in plan.targets {XCTAssertTrue(e.commitSpecialImpact(transactionID:plan.id,tileID:t.id).accepted);XCTAssertNotEqual(e.state.tile(at:t.cell)?.value,t.value);XCTAssertFalse(e.commitSpecialImpact(transactionID:plan.id,tileID:t.id).accepted)}
                XCTAssertTrue(e.commitSpecialBoard(transactionID:plan.id).accepted)
                XCTAssertNil(e.pendingSpecial);XCTAssertEqual(e.state.tiles.first{$0.id=="protected"}?.archetype,.star)
                XCTAssertTrue(e.state.tiles.first{$0.id=="locked"}?.locked==true)
                XCTAssertFalse(e.commitSpecialBoard(transactionID:plan.id).accepted)
                return e
            }
            let gas=try run("bloob-ball",core),barrel=try run("barell",.tnt)
            XCTAssertEqual(gas.state.tiles,barrel.state.tiles);XCTAssertEqual(gas.state.score,barrel.state.score)
            XCTAssertEqual(gas.pendingHUDStars.map(\.batchCount),barrel.pendingHUDStars.map(\.batchCount))
        }}}
    }
    func testFinalNoTargetAndBackgroundUseTntBoundary()throws {
        for mode in [NativeRunMode.journey,.arcade] {for reverse in [false,true] {
            let wild=NativeTile(id:"w",cell:.init(column:0,row:0),value:6,archetype:.tnt,variant:"bloob-ball")
            let d=NativeTile(id:"d",cell:.init(column:1,row:0),value:1)
            let e=NativeGameplayEngine(state:.init(tiles:[wild,d],mode:mode))
            XCTAssertTrue(e.beginDrag(tileID:reverse ? "d":"w"));XCTAssertTrue(e.drop(target:reverse ? wild.cell:d.cell).accepted)
            XCTAssertEqual(e.state.terminal?.kind,.complete)
            XCTAssertFalse(e.pendingHUDStars.isEmpty);XCTAssertTrue(e.pendingHUDStars.allSatisfy{$0.archetype == .tnt})
        }}
        let old=NativeTile(id:"w",cell:.init(column:0,row:0),value:6,archetype:.star,variant:"bloob-ball")
        let d=NativeTile(id:"d",cell:.init(column:1,row:0),value:2),t=NativeTile(id:"t",cell:.init(column:2,row:0),value:3)
        let e=NativeGameplayEngine(state:.init(tiles:[old,d,t]),recordedRandomChoices:Array(repeating:0.2,count:100))
        e.stagedTntActivation=true;XCTAssertTrue(e.beginDrag(tileID:"w"));XCTAssertTrue(e.drop(target:d.cell).accepted)
        let p=try XCTUnwrap(e.pendingSpecial);XCTAssertTrue(e.commitSpecialActivation(transactionID:p.id).accepted)
        XCTAssertTrue(e.reserveTntTargets(transactionID:p.id).accepted);e.cancelForBackground();XCTAssertNil(e.pendingSpecial)
        XCTAssertTrue(e.state.validationIssues().isEmpty);XCTAssertFalse(e.commitSpecialBoard(transactionID:p.id).accepted)
    }
}
