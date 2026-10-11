import XCTest
@testable import StackToSixGameplay

nonisolated final class NativeSourceMeterCancellationQueryTests:XCTestCase {
    private struct Packet:Decodable {let rows:[Row]}
    private struct Row:Decodable {let name:String,tiles:[Tile],spawnToken:UInt64,liveToken:UInt64,busy:Bool,expected:String?}
    private struct Tile:Decodable {
        let id:String,value:Int,special:String?,visible:Bool,alpha:Double,locked:Bool,eventMode:String,gridX:Int,gridY:Int
        let destroyed:Bool?,_isLastMerge:Bool?,_isBeingSpawned:Bool?,_wildMagnetAffected:Bool?,_pendingRemoval:Bool?,_beingRemoved:Bool?,_cleanupQueued:Bool?,_ccWildSpawnHandoffLock:Bool?
        let _spawnTween:[String:String]?
    }
    private func engine()->NativeGameplayEngine {
        let e=NativeGameplayEngine(state:.init(tiles:[
            .init(id:"a",cell:.init(column:0,row:0),value:4),.init(id:"b",cell:.init(column:1,row:0),value:3)],wildMeter:1.25),
            recordedRandomChoices:[0,0,0],rewardPicker:{_,_ in .init(.star)})
        e.stagedMeterDrops=true;e.stagedMeterOpen=true;return e
    }
    private func drop(_ e:NativeGameplayEngine)throws->(NativeMeterOpenRequest,NativeMeterDropReservation) {
        XCTAssertTrue(e.claimMeterReward().accepted)
        let request=try XCTUnwrap(e.pendingMeterOpen)
        XCTAssertTrue(e.completeMeterOpen(id:request.id,generation:request.generation,receipt:.created(tileID:request.tile.id)).accepted)
        return (request,try XCTUnwrap(e.meterDropReservations.values.first))
    }
    func testExecutedOriginalSourcePredicateAndActualHasLastMerge100Cases()throws {
        let url=try XCTUnwrap(Bundle.module.url(forResource:"SourceMeterCancellationOracle",withExtension:"json"))
        let rows=try JSONDecoder().decode(Packet.self,from:Data(contentsOf:url)).rows;XCTAssertEqual(rows.count,100)
        for r in rows {
            let tiles=r.tiles.map {t -> NativeTile in
                let archetype:NativeWildArchetype?=t.special=="wild" ? .star:t.special=="wild-juice" ? .juice:t.special=="wild-tnt" ? .tnt:t.special=="wild-magnet" ? .magnet:nil
                var n=NativeTile(id:t.id,cell:.init(column:t.gridX,row:t.gridY),value:t.value,archetype:archetype,locked:t.locked)
                n.visible=t.visible;n.alpha=t.alpha;n.transientSpawn=t._isBeingSpawned==true
                n.magnetOwned=t._wildMagnetAffected==true;n.pendingRemoval=t._pendingRemoval==true;return n
            }
            let e=NativeGameplayEngine(state:.init(tiles:tiles));e.stagedMeterDrops=true;e.stagedMeterOpen=true
            if r.liveToken != r.spawnToken {XCTAssertTrue(e.cancelMeterSourceContinuation().accepted)}
            var flags=NativeGameplayRuntimeFlags();flags.busyEnding=r.busy;e.setRuntimeFlags(flags)
            e.sourceMeterLastMergeTileIDs=Set(r.tiles.filter{$0._isLastMerge==true}.map(\.id))
            for t in r.tiles {
                var m=NativeNoMovesTileRuntime();m.destroyed=t.destroyed==true;m.beingRemoved=t._beingRemoved==true;m.cleanupQueued=t._cleanupQueued==true
                m.wildHandoff=t._ccWildSpawnHandoffLock==true;m.spawnTweenActive=t._spawnTween != nil
                m.eventMode=t.eventMode=="none" ? .none:t.eventMode=="passive" ? .passive:.normal;e.noMovesTileRuntime[t.id]=m
            }
            let before=e.state,priorFlags=e.flags,rng=e.state.rngState
            let result=e.meterDropSourceCancellation(generation:e.state.generation,spawnToken:r.spawnToken,dropID:"completed-original-source-capture")
            XCTAssertEqual(result,r.expected=="explicitPendingContinuation" ? .explicitPendingContinuation:r.expected=="busyEndingOrLastMerge" ? .busyEndingOrLastMerge:nil,r.name)
            XCTAssertEqual(e.state,before,r.name);XCTAssertEqual(e.flags,priorFlags,r.name);XCTAssertEqual(e.state.rngState,rng,r.name)
        }
    }
    func testTravelQueryDoesNotLatchTransientBusyAndFinallyCanStillStartIdle()throws {
        let e=engine(),(open,reservation)=try drop(e)
        XCTAssertNil(e.meterDropSourceCancellation(generation:open.generation,spawnToken:open.spawnToken,dropID:reservation.id))
        var f=NativeGameplayRuntimeFlags();f.busyEnding=true;e.setRuntimeFlags(f)
        XCTAssertEqual(e.meterDropSourceCancellation(generation:open.generation,spawnToken:open.spawnToken,dropID:reservation.id),.busyEndingOrLastMerge)
        XCTAssertFalse(try XCTUnwrap(e.meterDropReservations[reservation.id]).cancellationRequested)
        e.setRuntimeFlags(.init())
        XCTAssertNil(e.meterDropSourceCancellation(generation:open.generation,spawnToken:open.spawnToken,dropID:reservation.id))
        XCTAssertEqual(e.state.wildMeter,0.25,accuracy:1e-10);XCTAssertEqual(e.state.wildSpawnCount,0)
    }
    func testActualWarmupWallRetirementStillAuthorizesCapturedFinallyIdle()throws {
        let e=engine(),(open,r)=try drop(e)
        for receipt:NativeMeterDropReceipt in [.assetsPrepared,.revealed,.boardFallbackRestored,.dropPromiseCompleted,.wallHandoffUnlocked,.selectedWarmupCompleted] {
            XCTAssertTrue(e.applyMeterDropReceipt(id:r.id,generation:r.generation,receipt:receipt).accepted)
        }
        XCTAssertNil(e.meterDropReservations[r.id]);XCTAssertEqual(e.state.wildSpawnCount,1)
        XCTAssertNil(e.meterDropSourceCancellation(generation:open.generation,spawnToken:open.spawnToken,dropID:r.id),"Missing reservation is not a Source cancellation")
        XCTAssertTrue(e.cancelMeterSourceContinuation().accepted)
        XCTAssertEqual(e.meterDropSourceCancellation(generation:open.generation,spawnToken:open.spawnToken,dropID:r.id),.explicitPendingContinuation)
    }
    func testActualLastMergeMarkersHonorDestroyedAndHiddenAuthoritativeFlag()throws {
        let e=engine(),(open,r)=try drop(e)
        e.sourceMeterLastMergeTileIDs=["a"]
        XCTAssertEqual(e.meterDropSourceCancellation(generation:open.generation,spawnToken:open.spawnToken,dropID:r.id),.busyEndingOrLastMerge)
        var m=NativeNoMovesTileRuntime();m.destroyed=true;e.noMovesTileRuntime["a"]=m
        XCTAssertNil(e.meterDropSourceCancellation(generation:open.generation,spawnToken:open.spawnToken,dropID:r.id))
        XCTAssertFalse(try XCTUnwrap(e.meterDropReservations[r.id]).cancellationRequested)
    }
    func testExplicitCancelAndGenerationReplacementInvalidateCapturedToken()throws {
        let e=engine(),(open,r)=try drop(e)
        XCTAssertTrue(e.cancelMeterSourceContinuation().accepted)
        XCTAssertEqual(e.meterDropSourceCancellation(generation:open.generation,spawnToken:open.spawnToken,dropID:r.id),.explicitPendingContinuation)
        e.restart(state:.init(tiles:[.init(id:"new",cell:.init(column:0,row:0),value:4)]))
        XCTAssertEqual(e.meterDropSourceCancellation(generation:open.generation,spawnToken:open.spawnToken,dropID:r.id),.explicitPendingContinuation)
        XCTAssertTrue(e.meterDropReservations.isEmpty)
    }
}
