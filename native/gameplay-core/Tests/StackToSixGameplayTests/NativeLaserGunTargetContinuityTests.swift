import XCTest
@testable import StackToSixGameplay

final class NativeLaserGunTargetContinuityTests: XCTestCase {
    private func reservedFixture(mode: NativeRunMode, locked: Bool) throws -> (NativeGameplayEngine, NativeSpecialMovePlan) {
        let laser = NativeTile(id:"laser",cell:.init(column:0,row:0),value:6,archetype:.tnt,variant:"laser-gun")
        let destination = NativeTile(id:"destination",cell:.init(column:1,row:0),value:2)
        let ordinary = (2...6).map { index in
            NativeTile(id:"ordinary-\(index)",cell:.init(column:index%5,row:index/5),value:index%5+1,stackDepth:index%3+1)
        }
        let placeholders: [NativeTile] = locked ? [.init(id:"locked",cell:.init(column:4,row:8),value:0,locked:true,alpha:0.2)] : []
        let engine = NativeGameplayEngine(state:.init(tiles:[laser,destination]+ordinary+placeholders,mode:mode),recordedRandomChoices:Array(repeating:0.23,count:500))
        engine.stagedTntActivation = true
        engine.laserViewportWidth = 390
        engine.laserTargetX = { Double($0.cell.column)*65+65 }
        XCTAssertTrue(engine.beginDrag(tileID:laser.id))
        XCTAssertTrue(engine.drop(target:destination.cell,now:1).accepted)
        let initial = try XCTUnwrap(engine.pendingSpecial)
        XCTAssertTrue(initial.targets.isEmpty)
        XCTAssertEqual(engine.state.tiles.contains(where:{$0.locked}),locked)
        XCTAssertTrue(engine.commitSpecialActivation(transactionID:initial.id).accepted)

        let before = engine.state
        XCTAssertTrue(engine.reserveTntTargets(transactionID:initial.id).accepted)
        let plan = try XCTUnwrap(engine.pendingSpecial)
        XCTAssertEqual(plan.targets.count,4)
        XCTAssertEqual(engine.pendingLaserShots.map(\.tileID),plan.targets.map(\.id))
        let reservedIDs = Set(plan.targets.map(\.id))
        var expectedTiles = before.tiles
        for index in expectedTiles.indices where reservedIDs.contains(expectedTiles[index].id) {
            expectedTiles[index].resolutionOwned = true
        }
        // Reservation may consume RNG, but must preserve every physical die,
        // including faces, stacks, visibility and non-target ownership.
        XCTAssertEqual(engine.state.tiles,expectedTiles)
        XCTAssertEqual(engine.state.revision,before.revision)
        XCTAssertEqual(engine.state.moves,before.moves)
        XCTAssertEqual(engine.state.score,before.score)
        XCTAssertEqual(engine.state.combo,before.combo)
        XCTAssertEqual(engine.state.wildMeter,before.wildMeter)
        let reservedState = engine.state
        XCTAssertFalse(engine.reserveTntTargets(transactionID:plan.id).accepted)
        XCTAssertEqual(engine.state,reservedState)
        XCTAssertTrue(engine.releaseTntReservation(transactionID:plan.id).accepted)
        return (engine,plan)
    }

    private func assertContinuity(mode: NativeRunMode, locked: Bool) throws {
        let (engine,plan) = try reservedFixture(mode:mode,locked:locked)
        for (index,target) in plan.targets.enumerated() {
            let before = engine.state
            let impact = engine.commitSpecialImpact(transactionID:plan.id,tileID:target.id)
            XCTAssertTrue(impact.accepted)
            XCTAssertEqual(engine.state.tiles.count,before.tiles.count)
            XCTAssertEqual(engine.state.tiles.map(\.id),before.tiles.map(\.id))
            XCTAssertEqual(engine.state.tiles.map(\.cell),before.tiles.map(\.cell))
            for tile in before.tiles where tile.id != target.id {
                XCTAssertEqual(engine.state.tiles.first(where:{$0.id==tile.id}),tile,"Non-hit die changed during impact \(index): \(tile.id)")
            }
            let replacement = try XCTUnwrap(engine.state.tiles.first(where:{$0.id==target.id}))
            XCTAssertEqual(replacement,NativeTile(id:target.id,cell:target.cell,value:plan.replacementValues[index]))
            XCTAssertNotEqual(replacement.value,target.value)
            XCTAssertEqual(impact.events.first(where:{$0.kind == .specialImpact})?.tileIDs,[target.id])
            XCTAssertNil(engine.state.terminal)
            let settledImpact = engine.state
            XCTAssertFalse(engine.commitSpecialImpact(transactionID:plan.id,tileID:target.id).accepted)
            XCTAssertEqual(engine.state,settledImpact)
        }
        XCTAssertTrue(engine.state.validationIssues().isEmpty)
    }

    func testJourneyWithoutLockedTilesChangesOnlyTheCurrentLaserTarget() throws {
        try assertContinuity(mode:.journey,locked:false)
    }

    func testJourneyWithLockedTilesChangesOnlyTheCurrentLaserTarget() throws {
        try assertContinuity(mode:.journey,locked:true)
    }

    func testArcadeWithoutLockedTilesChangesOnlyTheCurrentLaserTarget() throws {
        try assertContinuity(mode:.arcade,locked:false)
    }

    func testArcadeWithLockedTilesChangesOnlyTheCurrentLaserTarget() throws {
        try assertContinuity(mode:.arcade,locked:true)
    }
}
