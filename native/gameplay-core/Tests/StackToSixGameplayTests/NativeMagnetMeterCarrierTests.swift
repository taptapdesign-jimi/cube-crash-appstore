import XCTest
@testable import StackToSixGameplay

nonisolated final class NativeMagnetMeterCarrierTests:XCTestCase {
    private func fixture(variant:String?,lazy:Bool,donor:Bool=true)throws->(NativeGameplayEngine,NativeMeterDropReservation) {
        let tiles:[NativeTile]=[
            .init(id:"magnet",cell:.init(column:0,row:0),value:6,archetype:.magnet,variant:variant),
            .init(id:"destination",cell:.init(column:1,row:0),value:2),
            .init(id:"donor",cell:.init(column:2,row:0),value:1)]
        let e=NativeGameplayEngine(state:.init(columns:5,rows:5,tiles:donor ? tiles:Array(tiles.prefix(2)),board:28,wildMeter:1),
            rewardPicker:{_,_ in .init(.tnt,variant:"laser-gun")},sourceMathRandom:.init(draw:{0.2}))
        e.stagedMeterDrops=true;e.sourceMagnetLazyRespawnEnabled=lazy
        if lazy {e.sourceMagnetPullSelection = .init{_,_,_,candidates in candidates.map(\.id)}}
        XCTAssertTrue(e.claimMeterReward().accepted)
        let drop=try XCTUnwrap(e.meterDropReservations.values.first)
        for receipt:NativeMeterDropReceipt in [.assetsPrepared,.revealed,.impact,.boardFallbackRestored,.selectedWarmupCompleted] {
            XCTAssertTrue(e.applyMeterDropReceipt(id:drop.id,generation:drop.generation,receipt:receipt).accepted)
        }
        return(e,drop)
    }
    func testEveryMagnetBackingPreservesLandedUnsettledCarrierThroughPullAndNextStack()throws {
        for lazy in [false,true] {for variant:String? in [nil,"honey","bottle","spaceship"] {
            let(e,drop)=try fixture(variant:variant,lazy:lazy)
            XCTAssertTrue(e.beginDrag(tileID:"magnet"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
            let p=try XCTUnwrap(e.pendingSpecial)
            XCTAssertEqual(p.targets.map(\.id),["donor"])
            if lazy {
                let absorb=try XCTUnwrap(e.registerSourceSpecialAbsorbOwner(transactionID:p.id,generation:p.generation))
                XCTAssertTrue(e.commitSourceSpecialAbsorbMain(receiptID:absorb.id,generation:p.generation).accepted)
                XCTAssertTrue(e.prepareSourceMagnetLazyRespawn(transactionID:p.id,generation:p.generation,sourceCurrent:{true}).accepted)
                let plan=try XCTUnwrap(e.pendingSourceMagnetLazyRespawn)
                for slot in plan.slots {
                    let open=try XCTUnwrap(e.beginSourceMagnetLazyOpen(transactionID:p.id,generation:p.generation,index:slot.index,sourceCurrent:{true}))
                    XCTAssertTrue(e.commitSourceMagnetLazyOpenValue(openID:open.id,generation:p.generation,sourceCurrent:{true}).accepted)
                    XCTAssertTrue(e.finishSourceMagnetLazyOpen(openID:open.id,generation:p.generation,verifiedTileID:open.holder?.id,sourceCurrent:{true}))
                }
                let fill=try XCTUnwrap(e.prepareSourceMagnetLazyReserveFill(transactionID:p.id,generation:p.generation,sourceCurrent:{true}))
                for index in fill.holders.indices {XCTAssertTrue(e.commitSourceMagnetLazyReserve(transactionID:p.id,generation:p.generation,index:index,sourceCurrent:{true}).accepted)}
                XCTAssertNotNil(e.prepareSourceMagnetLazySurvivor(transactionID:p.id,generation:p.generation,sourceCurrent:{true}))
                XCTAssertTrue(e.commitSourceMagnetLazySurvivorValue(transactionID:p.id,generation:p.generation,sourceCurrent:{true}).accepted)
                XCTAssertTrue(e.releaseSourceMagnetLazySurvivorResolution(transactionID:p.id,generation:p.generation,sourceCurrent:{true}))
            }
            XCTAssertTrue(e.commitSpecialBoard(transactionID:p.id).accepted)
            let carrier=try XCTUnwrap(e.state.tiles.first{$0.id==drop.tileID})
            XCTAssertEqual(carrier.variant,"laser-gun");XCTAssertFalse(carrier.locked)
            for receipt:NativeMeterDropReceipt in [.dropPromiseCompleted,.wallHandoffUnlocked] {
                XCTAssertTrue(e.applyMeterDropReceipt(id:drop.id,generation:drop.generation,receipt:receipt).accepted)
            }
            XCTAssertEqual(e.state.wildSpawnCount,1);XCTAssertTrue(e.meterDropReservations.isEmpty)
            let ordinary=e.state.activeTiles.filter{!$0.isWild && $0.value<6}
            let pair=try XCTUnwrap(ordinary.enumerated().compactMap{index,a in ordinary.dropFirst(index+1).first{a.value+$0.value<=6}.map{(a,$0)}}.first)
            XCTAssertTrue(e.beginDrag(tileID:pair.0.id));XCTAssertTrue(e.drop(target:pair.1.cell).accepted)
        }}
    }
    func testCarrierEligibilityWaitsForBothPromiseAndWallThenAllowsPull()throws {
        let(e,drop)=try fixture(variant:"spaceship",lazy:true)
        let source=try XCTUnwrap(e.state.tiles.first{$0.id=="magnet"}),destination=try XCTUnwrap(e.state.tiles.first{$0.id=="destination"})
        func ids()->[String]{e.magnetPullCandidates(e.state.tiles,source:source,destination:destination).map(\.id)}
        XCTAssertFalse(ids().contains(drop.tileID))
        XCTAssertTrue(e.applyMeterDropReceipt(id:drop.id,generation:drop.generation,receipt:.dropPromiseCompleted).accepted)
        XCTAssertFalse(ids().contains(drop.tileID))
        XCTAssertTrue(e.applyMeterDropReceipt(id:drop.id,generation:drop.generation,receipt:.wallHandoffUnlocked).accepted)
        XCTAssertTrue(ids().contains(drop.tileID))
    }
    func testCarrierWallCancellationRestartAndNoDonorFinalityRemainScoped()throws {
        let(e,drop)=try fixture(variant:"spaceship",lazy:true)
        let source=try XCTUnwrap(e.state.tiles.first{$0.id=="magnet"}),destination=try XCTUnwrap(e.state.tiles.first{$0.id=="destination"})
        let carrier=try XCTUnwrap(e.state.tiles.first{$0.id==drop.tileID})
        func eligible()->Bool{e.magnetPullCandidates(e.state.tiles,source:source,destination:destination).contains{$0.id==drop.tileID}}
        XCTAssertTrue(e.applyMeterDropReceipt(id:drop.id,generation:drop.generation,receipt:.wallHandoffUnlocked).accepted)
        XCTAssertFalse(eligible(),"Wall release cannot consume the pending travel Promise")
        XCTAssertTrue(e.requestMeterDropCancellation(id:drop.id,generation:drop.generation,reason:.explicitPendingContinuation).accepted)
        XCTAssertFalse(eligible(),"Canceled carrier remains protected until its real retirement")
        XCTAssertTrue(e.applyMeterDropReceipt(id:drop.id,generation:drop.generation,receipt:.dropPromiseCompleted).accepted)
        XCTAssertTrue(e.meterDropReservations.isEmpty);XCTAssertFalse(e.state.tiles.contains{$0.id==drop.tileID})
        e.restart(state:.init(tiles:[source,destination,carrier]))
        XCTAssertTrue(eligible(),"Same ID in a new generation must not inherit carrier protection")
        XCTAssertFalse(e.applyMeterDropReceipt(id:drop.id,generation:drop.generation,receipt:.dropPromiseCompleted).accepted)
        let(n,only)=try fixture(variant:"spaceship",lazy:true,donor:false)
        n.stagedDirectWildMoves=true;n.stagedDirectWildAssignments=true
        XCTAssertTrue(n.beginDrag(tileID:"magnet"));XCTAssertTrue(n.drop(target:.init(column:1,row:0)).accepted)
        let direct=try XCTUnwrap(n.pendingDirectWild)
        XCTAssertFalse(direct.isFinal,"Pending carrier is still a finality blocker even though it cannot be pulled")
        XCTAssertNil(n.pendingSpecial);XCTAssertNotNil(n.state.tiles.first{$0.id==only.tileID})
    }

}
