import XCTest
@testable import StackToSixGameplay
final class NativeLaserGunTests: XCTestCase {
    func testCrossfirePlannerMatches220ActualTypeScriptCasesAndDrawCounts() throws {
        struct Row: Decodable {
            struct Shot: Decodable { let tileID: String; let shooter: String }
            let width,roll: Double; let positions: [Double]; let draws: Int; let shots: [Shot]
        }
        let rows = try JSONDecoder().decode([Row].self,from:NativeLaserOracle.data)
        XCTAssertEqual(rows.count,220)
        for row in rows {
            let tiles = row.positions.indices.map{NativeTile(id:"die-\($0)",cell:NativeCell(column:$0,row:0),value:1)}
            var draws = 0
            let result = NativeLaserGunRules.plan(targets:tiles,viewportWidth:row.width,x:{row.positions[$0.cell.column]},random:{draws += 1; return row.roll})
            XCTAssertEqual(result.map(\.tileID),row.shots.map(\.tileID)); XCTAssertEqual(result.map{$0.shooter.rawValue},row.shots.map(\.shooter)); XCTAssertEqual(draws,row.draws)
        }
    }
    func testCrossfireNeverInventsTargetAndSupportsAllFourOppositeSideGuns() {
        let tiles = (0..<4).map{NativeTile(id:"t\($0)",cell:NativeCell(column:$0,row:0),value:1)}
        let plan = NativeLaserGunRules.plan(targets:tiles,viewportWidth:390,x:{_ in 20},random:{0})
        XCTAssertEqual(plan.first?.tileID,"t0"); XCTAssertEqual(Set(plan.map(\.tileID)),Set(tiles.map(\.id)))
        XCTAssertEqual(plan.map(\.shooter),Array(repeating:.right,count:4))
        XCTAssertEqual(NativeLaserGunRules.muzzleX(.left,width:280),72)
        XCTAssertEqual(NativeLaserGunRules.muzzleX(.right,width:768),684)
    }
    func testLaserRuntimeReservesCurrentPrimaryWithCanonicalCrossfireAndStableImpactIDs() {
        let initial = NativeBoardState(tiles:[NativeTile(id:"laser",cell:.init(column:0,row:0),value:6,archetype:.tnt,variant:"laser-gun"),NativeTile(id:"d",cell:.init(column:1,row:0),value:2),NativeTile(id:"a",cell:.init(column:2,row:0),value:1),NativeTile(id:"b",cell:.init(column:3,row:0),value:3)])
        let engine = NativeGameplayEngine(state:initial,recordedRandomChoices:Array(repeating:0,count:200)); engine.stagedTntActivation = true
        XCTAssertTrue(engine.beginDrag(tileID:"laser")); XCTAssertFalse(engine.drop(target:.init(column:1,row:0)).accepted)
        XCTAssertEqual(engine.state,initial)
        engine.laserViewportWidth = 390; engine.laserTargetX = {_ in 20}
        XCTAssertTrue(engine.beginDrag(tileID:"laser")); XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
        let receipt = engine.pendingSpecial!
        XCTAssertTrue(engine.commitSpecialActivation(transactionID:receipt.id).accepted)
        let primaryID = engine.state.tile(at:receipt.destination.cell)!.id
        XCTAssertTrue(engine.reserveTntTargets(transactionID:receipt.id).accepted)
        let plan = engine.pendingSpecial!,shots = engine.pendingLaserShots
        XCTAssertEqual(shots.map(\.tileID),plan.targets.map(\.id)); XCTAssertTrue(shots.allSatisfy{$0.shooter == .right})
        XCTAssertTrue(plan.targets.contains{$0.id == primaryID})
        XCTAssertTrue(engine.releaseTntReservation(transactionID:plan.id).accepted)
        for target in plan.targets {
            let impact = engine.commitSpecialImpact(transactionID:plan.id,tileID:target.id)
            XCTAssertTrue(impact.accepted)
            XCTAssertEqual(impact.events.first(where:{$0.kind == .specialImpact})?.tileIDs,[target.id],"The stable-identity die receives one bounce/settlement receipt")
            XCTAssertEqual(engine.state.tile(at:target.cell)?.id,target.id)
        }
        XCTAssertTrue(engine.commitSpecialBoard(transactionID:plan.id).accepted)
        XCTAssertTrue(engine.pendingLaserShots.isEmpty); XCTAssertEqual(engine.state.moves,49)
    }
}
