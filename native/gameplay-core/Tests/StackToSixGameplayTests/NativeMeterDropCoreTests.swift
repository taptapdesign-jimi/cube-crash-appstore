import XCTest
@testable import StackToSixGameplay

/// PRIVATE, compiled against frozen Core114. These exercise actual engine receipts; no visual timers.
nonisolated final class NativeMeterDropCoreTests:XCTestCase {
    private func makeEngine()->NativeGameplayEngine {
        let tiles=[NativeTile(id:"a",cell:NativeCell(column:0,row:0),value:2),
                   NativeTile(id:"b",cell:NativeCell(column:1,row:0),value:3),
                   NativeTile(id:"oldWild",cell:NativeCell(column:2,row:0),value:6,archetype:.juice)]
        let engine=NativeGameplayEngine(state:NativeBoardState(tiles:tiles,wildMeter:1.25),
            recordedRandomChoices:[0,0,0],rewardPicker:{_,_ in NativeWildRewardChoice(.star)})
        engine.stagedMeterDrops=true;engine.stagedOrdinaryMoves=true;engine.stagedDirectWildMoves=true
        return engine
    }
    private func reserve(_ engine:NativeGameplayEngine)throws->NativeMeterDropReservation {
        XCTAssertTrue(engine.claimMeterReward().accepted)
        return try XCTUnwrap(engine.meterDropReservations.values.first)
    }
    private func receipt(_ value:NativeMeterDropReceipt,_ drop:NativeMeterDropReservation,_ engine:NativeGameplayEngine) {
        XCTAssertTrue(engine.applyMeterDropReceipt(id:drop.id,generation:drop.generation,receipt:value).accepted)
    }
    func testMeterOwnsResolutionAndSaveWithoutOwningUnrelatedPickupOrMove()throws {
        let engine=makeEngine(),drop=try reserve(engine)
        XCTAssertEqual(engine.state.wildMeter,0.25,accuracy:1e-10)
        XCTAssertFalse(engine.flags.wildSpawnInProgress)
        XCTAssertTrue(engine.resolutionRuntimeFlags.wildSpawnInProgress)
        XCTAssertEqual(engine.resolve().kind,.wait);XCTAssertTrue(engine.hasUnsavableSourceGameplayState)
        XCTAssertFalse(engine.beginDrag(tileID:drop.tileID))
        XCTAssertTrue(engine.beginDrag(tileID:"a"))
        XCTAssertTrue(engine.drop(target:NativeCell(column:1,row:0)).accepted)
        XCTAssertNotNil(engine.pendingOrdinaryStack)
        XCTAssertEqual(engine.state.wildSpawnCount,0)
        let other=makeEngine();_ = try reserve(other)
        XCTAssertTrue(other.beginDrag(tileID:"oldWild"))
        XCTAssertTrue(other.drop(target:NativeCell(column:0,row:0)).accepted)
        XCTAssertNotNil(other.pendingDirectWild)
    }
    func testHandoffRemainsTransientAndPickupLockedAfterQueueCompletionButAllowsDestination()throws {
        let engine=makeEngine(),drop=try reserve(engine)
        receipt(.selectedWarmupCompleted,drop,engine);receipt(.assetsPrepared,drop,engine);receipt(.revealed,drop,engine)
        receipt(.impact,drop,engine);receipt(.boardFallbackRestored,drop,engine)
        receipt(.dropPromiseCompleted,drop,engine)
        XCTAssertEqual(engine.state.wildSpawnCount,1)
        XCTAssertFalse(engine.sourceMeterSpawnInProgress);XCTAssertTrue(engine.sourceMeterHandoffInProgress)
        XCTAssertFalse(engine.resolutionRuntimeFlags.wildSpawnInProgress)
        XCTAssertEqual(engine.resolve().reason,"captured_meter_tile_handoff")
        XCTAssertTrue(engine.hasUnsavableSourceGameplayState)
        XCTAssertFalse(engine.beginDrag(tileID:drop.tileID))
        XCTAssertTrue(engine.beginDrag(tileID:"a"))
        // Literal original canDrop/target candidate does NOT reject handoff on destination.
        XCTAssertTrue(engine.drop(target:drop.cell).accepted)
    }
    func testWarmupAndWallReceiptsHaveIndependentCapturedLifetimes()throws {
        let engine=makeEngine(),drop=try reserve(engine)
        receipt(.assetsPrepared,drop,engine);receipt(.revealed,drop,engine);receipt(.impact,drop,engine)
        receipt(.boardFallbackRestored,drop,engine);receipt(.dropPromiseCompleted,drop,engine)
        receipt(.wallHandoffUnlocked,drop,engine)
        XCTAssertTrue(engine.sourceMeterSpawnInProgress);XCTAssertFalse(engine.sourceMeterHandoffInProgress)
        XCTAssertEqual(engine.state.wildSpawnCount,0);XCTAssertFalse(engine.beginDrag(tileID:drop.tileID))
        receipt(.selectedWarmupCompleted,drop,engine)
        XCTAssertEqual(engine.state.wildSpawnCount,1);XCTAssertEqual(engine.state.wildDropTypeStreak,1)
        XCTAssertTrue(engine.meterDropReservations.isEmpty);XCTAssertFalse(engine.hasUnsavableSourceGameplayState)
        XCTAssertTrue(engine.beginDrag(tileID:drop.tileID));engine.cancelDrag()
        XCTAssertFalse(engine.applyMeterDropReceipt(id:drop.id,generation:drop.generation,receipt:.selectedWarmupCompleted).accepted)
    }
    func testMeterScopeNeverClearsAnotherOwnerOrLockAndRestartRejectsOldReceipts()throws {
        for key in ["busy","spawn","merge6","magnet","special"] {
            let engine=makeEngine(),drop=try reserve(engine)
            var flags=NativeGameplayRuntimeFlags()
            switch key {case "busy":flags.busyEnding=true;case "spawn":flags.wildSpawnInProgress=true
            case "merge6":flags.merge6SpawnInProgress=true;case "magnet":flags.wildMagnetPullInProgress=true
            default:flags.pendingSpecialMutation=true}
            engine.setRuntimeFlags(flags)
            XCTAssertFalse(engine.beginDrag(tileID:"a"),key);XCTAssertFalse(engine.beginDrag(tileID:"oldWild"),key)
            receipt(.selectedWarmupCompleted,drop,engine);receipt(.assetsPrepared,drop,engine);receipt(.boardFallbackRestored,drop,engine)
            receipt(.dropPromiseCompleted,drop,engine);receipt(.wallHandoffUnlocked,drop,engine)
            XCTAssertEqual(engine.flags,flags,key)
            XCTAssertFalse(engine.beginDrag(tileID:"a"),key)
        }
        let engine=makeEngine(),drop=try reserve(engine)
        engine.setInputLock("authored-tail",active:true,wildOnly:true)
        XCTAssertTrue(engine.beginDrag(tileID:"a"));engine.cancelDrag()
        XCTAssertFalse(engine.beginDrag(tileID:"oldWild"))
        engine.restart(state:NativeBoardState(tiles:[]))
        XCTAssertFalse(engine.applyMeterDropReceipt(id:drop.id,generation:drop.generation,receipt:.impact).accepted)
        XCTAssertTrue(engine.meterDropReservations.isEmpty)
    }
    func testHeldPointerOriginRemainsExcludedAndMeterCreationDoesNotInvalidateTheDrag()throws {
        let engine=makeEngine()
        XCTAssertTrue(engine.beginDrag(tileID:"a",pointerID:23))
        XCTAssertEqual(engine.sourceMeterDropExcludedCells,[NativeCell(column:0,row:0)])
        let revision=engine.state.revision,drop=try reserve(engine)
        XCTAssertNotEqual(drop.cell,NativeCell(column:0,row:0))
        XCTAssertEqual(engine.state.revision,revision)
        XCTAssertTrue(engine.drop(target:NativeCell(column:1,row:0),pointerID:23).accepted)
    }
    func testExplicitCancelVersusBusyDetectionPreserveSourceMeterAndPromiseOrdering()throws {
        for explicit in [true,false] {
            let engine=makeEngine(),drop=try reserve(engine)
            receipt(.assetsPrepared,drop,engine);receipt(.revealed,drop,engine)
            XCTAssertTrue(engine.requestMeterDropCancellation(id:drop.id,generation:drop.generation,
                reason:explicit ? .explicitPendingContinuation:.busyEndingOrLastMerge).accepted)
            XCTAssertEqual(engine.state.wildMeter,explicit ? 0:0.25,accuracy:1e-12)
            XCTAssertEqual(engine.sourceMeterSpawnInProgress,!explicit)
            XCTAssertNotNil(engine.state.tiles.first{$0.id==drop.tileID})
            // Actual Source cleanup restores, then settles the drop Promise;
            // cancellation BEFORE finally must skip a cold selected warmup await.
            receipt(.boardFallbackRestored,drop,engine);receipt(.dropPromiseCompleted,drop,engine)
            XCTAssertTrue(engine.meterDropReservations.isEmpty)
            XCTAssertNil(engine.state.tiles.first{$0.id==drop.tileID})
            XCTAssertEqual(engine.state.wildSpawnCount,0);XCTAssertEqual(engine.state.wildDropTypeStreak,0)
            XCTAssertFalse(engine.applyMeterDropReceipt(id:drop.id,generation:drop.generation,receipt:.selectedWarmupCompleted).accepted)
        }
        let engine=makeEngine(),drop=try reserve(engine)
        receipt(.assetsPrepared,drop,engine);receipt(.revealed,drop,engine)
        receipt(.boardFallbackRestored,drop,engine);receipt(.dropPromiseCompleted,drop,engine)
        XCTAssertTrue(try XCTUnwrap(engine.meterDropReservations[drop.id]).warmupAwaitStarted)
        XCTAssertTrue(engine.requestMeterDropCancellation(id:drop.id,generation:drop.generation,reason:.explicitPendingContinuation).accepted)
        XCTAssertEqual(engine.state.wildMeter,0);XCTAssertFalse(engine.sourceMeterSpawnInProgress)
        XCTAssertTrue(engine.hasUnsavableSourceGameplayState)
        XCTAssertNotNil(engine.state.tiles.first{$0.id==drop.tileID},"Already-entered Source await remains until actual warmup receipt")
        receipt(.selectedWarmupCompleted,drop,engine)
        XCTAssertNil(engine.state.tiles.first{$0.id==drop.tileID});XCTAssertTrue(engine.meterDropReservations.isEmpty)
        XCTAssertEqual(engine.state.wildSpawnCount,0)
    }

}
