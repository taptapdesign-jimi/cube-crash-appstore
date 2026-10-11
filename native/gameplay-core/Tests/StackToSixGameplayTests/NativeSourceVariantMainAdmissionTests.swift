import XCTest
@testable import StackToSixGameplay

nonisolated final class NativeSourceVariantMainAdmissionTests:XCTestCase {
    func testAuthoredSpecialVariantsKeepProtectedDestinationAndCancelOnlyCapturedSetup()throws {
        let variants=NativeSpecialDiceRegistry.variants.values.filter{$0.archetype == .magnet || $0.archetype == .tnt}
        XCTAssertEqual(variants.count,7)
        for variant in variants {
            let source=NativeTile(id:"source",cell:.init(column:0,row:0),value:6,stackDepth:2,
                                  archetype:variant.archetype,variant:variant.id)
            let destination=NativeTile(id:"destination",cell:.init(column:1,row:0),value:2,stackDepth:3)
            let engine=NativeGameplayEngine(state:.init(tiles:[source,destination,
                .init(id:"other",cell:.init(column:2,row:0),value:1)],score:123),
                sourceMathRandom:NativeSourceMathRandomStream(draw:{0.5}))
            engine.sourceMagnetMain80Enabled=variant.archetype == .magnet
            engine.sourceTntMain80Enabled=variant.archetype == .tnt
            engine.stagedTntActivation=variant.archetype == .tnt
            engine.laserViewportWidth=390;engine.laserTargetX={Double($0.cell.column)*60}
            let before=engine.state
            XCTAssertTrue(engine.beginDrag(tileID:source.id),variant.id)
            XCTAssertTrue(engine.drop(target:destination.cell).accepted,variant.id)
            let plan=try XCTUnwrap(engine.pendingSpecial)
            let protected=try XCTUnwrap(engine.state.tile(at:destination.cell))
            XCTAssertEqual(plan.variant,variant.id);XCTAssertEqual(protected.id,destination.id)
            XCTAssertEqual(protected.value,6);XCTAssertEqual(protected.stackDepth,4)
            XCTAssertEqual(protected.alpha,1);XCTAssertTrue(protected.visible)
            XCTAssertTrue(protected.sourceWildStateCleared);XCTAssertTrue(protected.resolutionOwned)
            let cancelled=variant.archetype == .magnet ?
                engine.cancelSourceMagnetMainSetup(transactionID:plan.id,generation:plan.generation):
                engine.cancelSourceTntMainSetup(transactionID:plan.id,generation:plan.generation)
            XCTAssertTrue(cancelled.accepted,variant.id)
            XCTAssertEqual(engine.state.score,before.score);XCTAssertEqual(engine.state.moves,before.moves)
            XCTAssertNil(engine.pendingSpecial);XCTAssertEqual(engine.state.tiles.map(\.id),["other"])
            XCTAssertFalse(engine.commitSpecialActivation(transactionID:plan.id).accepted)
        }
    }
}
