import XCTest
@testable import StackToSixGameplay

final class NativeSourceMagnetFallbackTests: XCTestCase {
    private func captured(enabled: Bool = true) throws -> (NativeGameplayEngine, NativeSpecialMovePlan) {
        let tiles = [NativeTile(id:"m",cell:.init(column:0,row:0),value:6,archetype:.magnet),
                     NativeTile(id:"d",cell:.init(column:1,row:0),value:2),
                     NativeTile(id:"a",cell:.init(column:2,row:0),value:1),
                     NativeTile(id:"b",cell:.init(column:3,row:0),value:3)]
        let engine = NativeGameplayEngine(state:.init(tiles:tiles),recordedRandomChoices:Array(repeating:0,count:300))
        engine.sourceMagnetFallbacksEnabled = enabled
        XCTAssertTrue(engine.beginDrag(tileID:"m"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
        let plan = try XCTUnwrap(engine.pendingSpecial)
        XCTAssertTrue(engine.prepareMagnetRespawn(transactionID:plan.id).accepted)
        let count = try XCTUnwrap(engine.pendingMagnetRespawn).replacements.count
        for index in 0..<count { XCTAssertTrue(engine.commitMagnetReplacement(transactionID:plan.id,index:index).accepted) }
        XCTAssertTrue(engine.commitSpecialBoard(transactionID:plan.id).accepted)
        return (engine,plan)
    }
    func testDefaultOffCannotManufacturePostCommitOrFallbackPlan() throws {
        let (engine,transaction) = try captured(enabled:false)
        XCTAssertNil(engine.sourceMagnetPostCommit)
        var draws=0
        XCTAssertNil(engine.prepareSourceMagnetFallback(transactionID:transaction.id,generation:1,sourceCurrent:{true},sourceRandom:{draws += 1;return 0}))
        XCTAssertEqual(draws,0)
    }
    func testActualCapturedRespawnOwnsFallbackCellsAndExactSourceRandomSlot() throws {
        let (engine,transaction) = try captured()
        let receipt = try XCTUnwrap(engine.sourceMagnetPostCommit)
        XCTAssertEqual(receipt.spawnCount,transaction.targets.count)
        let before=engine.state
        var draws:[Double]=[]
        let plan = try XCTUnwrap(engine.prepareSourceMagnetFallback(transactionID:transaction.id,generation:1,sourceCurrent:{true},sourceRandom:{let r=Double((draws.count*17+3)%97)/97;draws.append(r);return r}))
        XCTAssertEqual(plan.cells.count,2);XCTAssertEqual(Set(plan.cells).count,2)
        XCTAssertTrue(plan.cells.allSatisfy{!receipt.reserved.contains($0) && (before.tile(at:$0)==nil || before.tile(at:$0)?.locked==true)})
        XCTAssertEqual(engine.state,before)
        var duplicateDraws=0
        XCTAssertNil(engine.prepareSourceMagnetFallback(transactionID:transaction.id,generation:1,sourceCurrent:{true},sourceRandom:{duplicateDraws+=1;return 0}))
        XCTAssertEqual(duplicateDraws,0)
        // Executed literal original function receives this genuine native state,
        // captured reserved cells and recorded shared draws in the Node verifier.
        let artifact: [String:Any] = ["columns":before.columns,"rows":before.rows,"tiles":try JSONSerialization.jsonObject(with:JSONEncoder().encode(before.tiles)),"reserved":try JSONSerialization.jsonObject(with:JSONEncoder().encode(receipt.reserved)),"spawnCount":receipt.spawnCount,"draws":draws,"cells":try JSONSerialization.jsonObject(with:JSONEncoder().encode(plan.cells))]
        let data=try JSONSerialization.data(withJSONObject:artifact,options:[.sortedKeys])
        // Optional proof export belongs to the invoking QA run. Ordinary
        // tests must work on a clean checkout and leave frozen packets intact.
        if let artifactPath=ProcessInfo.processInfo.environment["STACK_NATIVE_MAGNET_PROOF_OUTPUT"] {
            try data.write(to:URL(fileURLWithPath:artifactPath))
        }
    }
    func testFreshHolderValueAndRealArrivalAcknowledgeOnceWithoutScoreMoveChanges() throws {
        let (engine,transaction) = try captured()
        let plan=try XCTUnwrap(engine.prepareSourceMagnetFallback(transactionID:transaction.id,generation:1,sourceCurrent:{true},sourceRandom:{0.9}))
        let before=engine.state
        for index in plan.cells.indices {
            let opening=try XCTUnwrap(engine.beginSourceMagnetFallbackOpen(planID:plan.id,generation:1,index:index,sourceCurrent:{true},sourceRandom:{0.8}))
            XCTAssertEqual(opening.value,3);XCTAssertFalse(opening.skipped);XCTAssertTrue(opening.createdHolder)
            let holder=try XCTUnwrap(opening.holder)
            XCTAssertEqual(holder.value,0);XCTAssertTrue(holder.locked)
            XCTAssertTrue(engine.hasUnsavableSourceGameplayState)
            XCTAssertFalse(engine.finishSourceMagnetFallbackOpen(openID:opening.id,generation:1,interrupted:false))
            let commit=engine.commitSourceMagnetFallbackValue(openID:opening.id,generation:1)
            XCTAssertTrue(commit.accepted);XCTAssertEqual(commit.events.first?.reason,opening.id)
            XCTAssertEqual(engine.state.tile(at:opening.cell)?.value,3)
            XCTAssertFalse(engine.commitSourceMagnetFallbackValue(openID:opening.id,generation:1).accepted)
            XCTAssertNil(engine.beginSourceMagnetFallbackOpen(planID:plan.id,generation:1,index:index+1,sourceCurrent:{true},sourceRandom:{0}))
            XCTAssertTrue(engine.finishSourceMagnetFallbackOpen(openID:opening.id,generation:1,interrupted:false))
            XCTAssertFalse(engine.finishSourceMagnetFallbackOpen(openID:opening.id,generation:1,interrupted:false))
        }
        XCTAssertTrue(engine.finishSourceMagnetFallback(planID:plan.id,generation:1));XCTAssertFalse(engine.finishSourceMagnetFallback(planID:plan.id,generation:1))
        XCTAssertEqual(engine.state.score,before.score);XCTAssertEqual(engine.state.moves,before.moves)
        XCTAssertEqual(engine.state.wildMeter,before.wildMeter);XCTAssertEqual(engine.state.revision,before.revision)
        XCTAssertTrue(engine.state.validationIssues().isEmpty)
    }
    func testReentrantRandomRestartCannotPublishOldPlanOrOverwriteNewBoard() throws {
        let (engine,transaction)=try captured();let before=engine.state
        var calls=0
        let plan=engine.prepareSourceMagnetFallback(transactionID:transaction.id,generation:1,sourceCurrent:{true},sourceRandom:{calls+=1;engine.restart(state:before);return 0})
        XCTAssertNil(plan);XCTAssertEqual(calls,1);XCTAssertNil(engine.pendingSourceMagnetFallback)
        XCTAssertEqual(engine.state.generation,2)
    }
    func testInterruptedOpenKeepsAssignedDieAndRestartRejectsEveryStaleCapture() throws {
        let (engine,transaction)=try captured()
        let plan=try XCTUnwrap(engine.prepareSourceMagnetFallback(transactionID:transaction.id,generation:1,sourceCurrent:{true},sourceRandom:{0.9}))
        let open=try XCTUnwrap(engine.beginSourceMagnetFallbackOpen(planID:plan.id,generation:1,index:0,sourceCurrent:{true},sourceRandom:{0.5}))
        XCTAssertTrue(engine.commitSourceMagnetFallbackValue(openID:open.id,generation:1).accepted)
        let assigned=engine.state.tile(at:open.cell)
        XCTAssertTrue(engine.finishSourceMagnetFallbackOpen(openID:open.id,generation:1,interrupted:true))
        XCTAssertEqual(engine.state.tile(at:open.cell),assigned);XCTAssertNil(engine.sourceMagnetPostCommit)
        let state=engine.state;engine.restart(state:state)
        XCTAssertFalse(engine.commitSourceMagnetFallbackValue(openID:open.id,generation:1).accepted)
        XCTAssertFalse(engine.finishSourceMagnetFallbackOpen(openID:open.id,generation:1,interrupted:false))
        XCTAssertFalse(engine.retireSourceMagnetPostCommit(transactionID:transaction.id,generation:1))
    }
}
