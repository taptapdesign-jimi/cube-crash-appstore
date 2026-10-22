import XCTest
@testable import StackToSixGameplay

final class NativeBarrelWholeBoardTests: XCTestCase {
    private func fixture(variant: String? = "barell", mode: NativeRunMode = .journey) -> (NativeGameplayEngine, NativeTile, [NativeTile]) {
        let barrel = NativeTile(id:"barrel",cell:.init(column:0,row:0),value:6,archetype:.tnt,variant:variant)
        let destination = NativeTile(id:"destination",cell:.init(column:1,row:0),value:2)
        let ordinary = (2..<43).map { index in
            NativeTile(id:"ordinary-\(index)",cell:.init(column:index%5,row:index/5),value:index%5+1)
        }
        let special = NativeTile(id:"protected-wild",cell:.init(column:3,row:8),value:6,archetype:.star)
        let placeholder = NativeTile(id:"placeholder",cell:.init(column:4,row:8),value:0,locked:true)
        let engine = NativeGameplayEngine(state:.init(tiles:[barrel,destination]+ordinary+[special,placeholder],mode:mode),recordedRandomChoices:Array(repeating:0.2,count:3000))
        return (engine,destination,ordinary)
    }

    func testEveryOrdinaryTargetChangesExactlyOnceAndEndWaitsForLastImpactInBothModes() throws {
        for mode in [NativeRunMode.journey,.arcade] {
            let (engine,destination,ordinary) = fixture(mode:mode)
            XCTAssertTrue(engine.beginDrag(tileID:"barrel"))
            XCTAssertTrue(engine.drop(target:destination.cell,now:1).accepted)
            let plan = try XCTUnwrap(engine.pendingSpecial)
            XCTAssertEqual(Set(plan.targets.map(\.id)),Set(ordinary.map(\.id)))
            XCTAssertFalse(engine.commitSpecialBoard(transactionID:plan.id).accepted)
            for target in plan.targets {
                XCTAssertTrue(engine.commitSpecialImpact(transactionID:plan.id,tileID:target.id).accepted)
                XCTAssertNotEqual(engine.state.tile(at:target.cell)?.value,target.value)
                XCTAssertNil(engine.state.terminal)
                XCTAssertEqual(engine.resolve().kind,.wait)
                XCTAssertFalse(engine.commitSpecialImpact(transactionID:plan.id,tileID:target.id).accepted)
            }
            XCTAssertTrue(engine.commitSpecialBoard(transactionID:plan.id).accepted)
            XCTAssertNil(engine.pendingSpecial)
            XCTAssertTrue(engine.state.validationIssues().isEmpty)
            XCTAssertEqual(engine.state.tiles.first{$0.id=="protected-wild"}?.archetype,.star)
            XCTAssertEqual(engine.state.tiles.first{$0.id=="placeholder"}?.value,0)
        }
    }

    func testOtherTntVariantsRetainFourTargetLimit() throws {
        for variant in [nil,"flower","beach-ball","laser-gun"] as [String?] {
            let (engine,destination,_) = fixture(variant:variant)
            XCTAssertTrue(engine.beginDrag(tileID:"barrel"))
            XCTAssertTrue(engine.drop(target:destination.cell,now:1).accepted)
            XCTAssertEqual(try XCTUnwrap(engine.pendingSpecial).targets.count,4,variant ?? "core")
        }
    }

    func testStagedReservationAndBackgroundDrainWholeBoardWithoutStaleCallbacks() throws {
        let (engine,destination,ordinary) = fixture()
        engine.stagedTntActivation=true
        XCTAssertTrue(engine.beginDrag(tileID:"barrel"))
        XCTAssertTrue(engine.drop(target:destination.cell,now:1).accepted)
        let initial = try XCTUnwrap(engine.pendingSpecial)
        XCTAssertTrue(initial.targets.isEmpty)
        XCTAssertTrue(engine.commitSpecialActivation(transactionID:initial.id).accepted)
        XCTAssertTrue(engine.reserveTntTargets(transactionID:initial.id).accepted)
        let plan = try XCTUnwrap(engine.pendingSpecial)
        XCTAssertTrue(Set(ordinary.map(\.id)).isSubset(of:Set(plan.targets.map(\.id))))
        engine.cancelForBackground()
        XCTAssertNil(engine.pendingSpecial)
        XCTAssertTrue(engine.pendingMeterRewards.isEmpty)
        XCTAssertTrue(engine.state.validationIssues().isEmpty)
        for target in ordinary { XCTAssertNotEqual(engine.state.tile(at:target.cell)?.value,target.value) }
        let settled=engine.state
        XCTAssertFalse(engine.commitSpecialImpact(transactionID:plan.id,tileID:plan.targets[0].id).accepted)
        XCTAssertEqual(engine.state,settled)
        engine.restart(state:.init(tiles:[.init(id:"new",cell:.init(column:0,row:0),value:3)]))
        let restarted=engine.state
        XCTAssertFalse(engine.commitSpecialBoard(transactionID:plan.id).accepted)
        XCTAssertEqual(engine.state,restarted)
    }
}
