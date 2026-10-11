import XCTest
@testable import Stack_to_Six
import StackToSixGameplay

nonisolated final class NativeSourceGameplayRuntimeProducerTests:XCTestCase {
    @MainActor func scope(_ session:NativeGameplaySourceRegistrySession,mounted:Bool=true)->NativeGameplaySourceRegistrySession.Scope {
        let scope=session.beginScope(epoch:1);scope.bindParentCurrent{return true}
        if mounted {for cap in NativeGameplaySourceRegistrySession.Capability.allCases {scope.endpointMounted(cap)}}
        return scope
    }
    @MainActor func markers(wildHandoff:Bool=false,cleanup:Bool=false)->NativeSourceTileOwnerMarkers {
        .init(destroyed:false,beingRemoved:false,cleanupQueued:cleanup,cleanupClaim:cleanup,
              magnetAffected:false,pendingRemoval:false,resolutionOwned:false,mergeSixCleanupOwned:false,nonFinalMergeSix:false,
              wildDropping:false,wildHandoff:wildHandoff,ccSpawnAnimating:false,spawnAnimating:false,isSpawning:false,
              spawnTweenActive:false,explicitFinal:false)
    }
    @MainActor var globals:NativeSourceGameplayGlobalOwners {
        .init(boardMeterEnabled:true,boardSpawnEnabled:true,queueInProgress:false,boardTransitionActive:false,
              mergeSixSpawnInProgress:false,wildMagnetPullInProgress:false,wildDropInProgress:false)
    }
    @MainActor func engine()->NativeGameplayEngine {NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:3,stackDepth:2)]))}
    @MainActor func testCompleteCapturedObservationExposesOrderedRegistriesAndLiteralEventMode() async throws {
        let e=engine(),session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{1234}),s=scope(session)
        _ = s.claimSpecial(kind:.star);_ = s.beginMagnetGuard()
        let p=NativeSourceGameplayRuntimeProducer(engine:e,scope:s,hooks:.init(physicalRoster:{["a"]},
            physicalTile:{.init(tile:$0,eventMode:"dynamic",pendingStackFrames:0)},tileMarkers:{_ in self.markers()},globalOwners:{self.globals}))
        let result=try XCTUnwrap(p.capture(isWild:true))
        XCTAssertTrue(result.canPublishToCurrentCore);XCTAssertEqual(result.eventModes["a"]?.name,"dynamic")
        XCTAssertEqual(result.noMovesRuntime["a"]?.eventMode,.normal)
        XCTAssertEqual(result.meterEnvironment?.sourceDateMilliseconds,1234)
        XCTAssertEqual(result.meterEnvironment?.endgameGuardSources,["mergePulledTilesIntoMerge6"])
        XCTAssertEqual(result.meterEnvironment?.specialTransactionActive,true)
        XCTAssertEqual(result.inputReasons,["special-transaction"])
    }
    func testBoardPoliciesMatchImmutableSourceConfigurationAcrossAllJourneyBoards()throws {
        struct Row:Decodable {let board:Int,meter:Bool,spawn:Bool}
        // Actual immutable v9 board-specific-rules module, not copied Swift logic.
        let json=#"""
[{"board":1,"meter":true,"spawn":true},{"board":2,"meter":true,"spawn":true},{"board":3,"meter":true,"spawn":true},{"board":4,"meter":true,"spawn":true},{"board":5,"meter":true,"spawn":true},{"board":6,"meter":true,"spawn":true},{"board":7,"meter":true,"spawn":true},{"board":8,"meter":true,"spawn":true},{"board":9,"meter":true,"spawn":true},{"board":10,"meter":true,"spawn":true},{"board":11,"meter":true,"spawn":true},{"board":12,"meter":true,"spawn":true},{"board":13,"meter":true,"spawn":true},{"board":14,"meter":true,"spawn":true},{"board":15,"meter":true,"spawn":true},{"board":16,"meter":true,"spawn":true},{"board":17,"meter":true,"spawn":true},{"board":18,"meter":true,"spawn":true},{"board":19,"meter":true,"spawn":true},{"board":20,"meter":true,"spawn":true},{"board":21,"meter":true,"spawn":true},{"board":22,"meter":true,"spawn":true},{"board":23,"meter":true,"spawn":true},{"board":24,"meter":true,"spawn":true},{"board":25,"meter":true,"spawn":true},{"board":26,"meter":true,"spawn":true},{"board":27,"meter":true,"spawn":true},{"board":28,"meter":true,"spawn":true},{"board":29,"meter":true,"spawn":true},{"board":30,"meter":true,"spawn":true},{"board":31,"meter":true,"spawn":true},{"board":32,"meter":true,"spawn":true},{"board":33,"meter":true,"spawn":true},{"board":34,"meter":true,"spawn":true},{"board":35,"meter":true,"spawn":true},{"board":36,"meter":true,"spawn":true},{"board":37,"meter":true,"spawn":true},{"board":38,"meter":true,"spawn":true},{"board":39,"meter":true,"spawn":true},{"board":40,"meter":true,"spawn":true},{"board":41,"meter":true,"spawn":true},{"board":42,"meter":true,"spawn":true},{"board":43,"meter":true,"spawn":true},{"board":44,"meter":true,"spawn":true},{"board":45,"meter":true,"spawn":true},{"board":46,"meter":true,"spawn":true},{"board":47,"meter":true,"spawn":true},{"board":48,"meter":true,"spawn":true},{"board":49,"meter":true,"spawn":true},{"board":50,"meter":true,"spawn":true},{"board":51,"meter":true,"spawn":true},{"board":52,"meter":true,"spawn":true},{"board":53,"meter":true,"spawn":true},{"board":54,"meter":true,"spawn":true},{"board":55,"meter":true,"spawn":true},{"board":56,"meter":true,"spawn":true},{"board":57,"meter":true,"spawn":true},{"board":58,"meter":true,"spawn":true},{"board":59,"meter":true,"spawn":true},{"board":60,"meter":true,"spawn":true}]
"""#
        let rows=try JSONDecoder().decode([Row].self,from:Data(json.utf8))
        XCTAssertEqual(rows.count,60)
        for row in rows {
            let policy=NativeSourceBoardWildPolicy(board:row.board)
            XCTAssertEqual(policy.board,row.board)
            XCTAssertEqual(policy.meterEnabled,row.meter)
            XCTAssertEqual(policy.spawnEnabled,row.spawn)
        }
    }
    @MainActor func testKnownBoardPoliciesAndActualQueueNeverSupplyAbsentCoroutineOwners() async throws {
        let e=engine(),session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{100}),s=scope(session)
        var queue:Bool?=nil
        let p=NativeSourceGameplayRuntimeProducer(engine:e,scope:s,hooks:.init(physicalRoster:{["a"]},
            physicalTile:{.init(tile:$0,eventMode:"static",pendingStackFrames:0)},tileMarkers:{_ in self.markers()},
            globalOwners:{.init(boardMeterEnabled:true,boardSpawnEnabled:true,queueInProgress:queue,
                boardTransitionActive:nil,mergeSixSpawnInProgress:nil,wildMagnetPullInProgress:nil,wildDropInProgress:nil)}))
        let before=e.state
        let unknown=try XCTUnwrap(p.capture(isWild:false))
        XCTAssertEqual(unknown.observedGlobalOwners?.boardMeterEnabled,true)
        XCTAssertNil(unknown.observedGlobalOwners?.queueInProgress)
        XCTAssertTrue(unknown.missingOwners.contains("source-queue-in-progress"))
        for value in [false,true] {
            queue=value
            let actual=try XCTUnwrap(p.capture(isWild:false))
            XCTAssertEqual(actual.observedGlobalOwners?.queueInProgress,value)
            XCTAssertFalse(actual.missingOwners.contains("source-queue-in-progress"))
            XCTAssertTrue(actual.missingOwners.contains("source-board-transition"))
            XCTAssertTrue(actual.missingOwners.contains("source-merge-six-spawn"))
            XCTAssertTrue(actual.missingOwners.contains("source-magnet-pull"))
            XCTAssertTrue(actual.missingOwners.contains("source-wild-drop"))
            XCTAssertFalse(actual.canPublishToCurrentCore);XCTAssertNil(actual.meterEnvironment)
        }
        XCTAssertEqual(e.state,before)
        p.retire();XCTAssertNil(p.capture(isWild:false))
    }
    @MainActor func testActualPendingFramePhysicalDepthAndAlphaRemainReadOnlyRefusal() async throws {
        let e=engine(),session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{100}),s=scope(session)
        let p=NativeSourceGameplayRuntimeProducer(engine:e,scope:s,hooks:.init(physicalRoster:{["a"]},physicalTile:{t in
            var physical=t;physical.stackDepth=1;physical.alpha=0
            return .init(tile:physical,eventMode:"static",pendingStackFrames:1)
        },tileMarkers:{_ in self.markers()},globalOwners:{self.globals}))
        let result=try XCTUnwrap(p.capture(isWild:false))
        XCTAssertEqual(result.observedState.tiles.first?.stackDepth,1);XCTAssertEqual(result.observedState.tiles.first?.alpha,0)
        XCTAssertTrue(NativeSourceEndgameChecker.active(result.observedState.tiles[0],runtime:result.noMovesRuntime["a"]!))
        XCTAssertFalse(result.canPublishToCurrentCore);XCTAssertEqual(result.physicalCoreDifferences,["a"])
        XCTAssertNil(result.paintedStateReceipt,"Pending face depth cannot become a paint-only receipt")
        XCTAssertEqual(e.state.tiles[0].stackDepth,2);XCTAssertEqual(e.state.tiles[0].alpha,1)
    }
    @MainActor func testPaintOnlyReceiptRetainsExactCoreButNeverSuppliesMissingMarkers() async throws {
        for mounted in [false,true] {
            let e=engine(),session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{100}),s=scope(session,mounted:mounted)
            let before=e.state
            let p=NativeSourceGameplayRuntimeProducer(engine:e,scope:s,hooks:.init(physicalRoster:{["a"]},physicalTile:{t in
                var physical=t;physical.alpha=0.2;physical.visible=false
                return .init(tile:physical,eventMode:"static",pendingStackFrames:0)
            },tileMarkers:{_ in self.markers()},globalOwners:{self.globals}))
            let result=try XCTUnwrap(p.capture(isWild:false))
            XCTAssertEqual(result.canonicalState,before);XCTAssertEqual(e.state,before)
            XCTAssertFalse(result.canPublishToCurrentCore)
            if mounted {
                let receipt=try XCTUnwrap(result.paintedStateReceipt)
                XCTAssertEqual(receipt.canonicalState,before)
                XCTAssertEqual(receipt.paintedState.tiles[0].alpha,0.2)
                XCTAssertFalse(receipt.paintedState.tiles[0].visible)
            } else {XCTAssertNil(result.paintedStateReceipt)}
        }
    }
    @MainActor func testMissingRealOwnerRefusesRatherThanSupplyingFalse() async throws {
        let e=engine(),session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{100}),s=scope(session,mounted:false)
        let p=NativeSourceGameplayRuntimeProducer(engine:e,scope:s,hooks:.init(physicalRoster:{["a"]},physicalTile:{.init(tile:$0,eventMode:"static",pendingStackFrames:0)},tileMarkers:{_ in nil},globalOwners:{nil}))
        let result=try XCTUnwrap(p.capture(isWild:false))
        XCTAssertFalse(result.canPublishToCurrentCore);XCTAssertNil(result.meterEnvironment)
        XCTAssertTrue(result.missingOwners.contains("source-tile-marker-owner:a"))
        XCTAssertTrue(result.missingOwners.contains("source-global-owner-bindings"))
        XCTAssertTrue(result.missingOwners.contains("specialContactCommitRelease"));XCTAssertTrue(result.noMovesRuntime.isEmpty)
    }
    @MainActor func testMissingPhysicalNodeIsNotSynthesizedAsDestroyed() async throws {
        let e=engine(),session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{100}),s=scope(session)
        let p=NativeSourceGameplayRuntimeProducer(engine:e,scope:s,hooks:.init(physicalRoster:{["a"]},physicalTile:{_ in nil},tileMarkers:{_ in self.markers()},globalOwners:{self.globals}))
        let result=try XCTUnwrap(p.capture(isWild:false));XCTAssertEqual(result.missingOwners,["source-physical-node:a"])
        XCTAssertNil(result.noMovesRuntime["a"]);XCTAssertEqual(e.state.tiles.count,1)
    }
    @MainActor func testActualMarkerAndPassiveEventModeAreSeparateFromCorePendingRemoval() async throws {
        let e=engine(),session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{100}),s=scope(session)
        let p=NativeSourceGameplayRuntimeProducer(engine:e,scope:s,hooks:.init(physicalRoster:{["a"]},physicalTile:{.init(tile:$0,eventMode:"passive",pendingStackFrames:0)},tileMarkers:{_ in self.markers(wildHandoff:true,cleanup:true)},globalOwners:{self.globals}))
        let result=try XCTUnwrap(p.capture(isWild:true))
        XCTAssertEqual(result.noMovesRuntime["a"]?.cleanupQueued,true);XCTAssertEqual(result.noMovesRuntime["a"]?.eventMode,.passive)
        XCTAssertEqual(result.meterEnvironment?.tiles[0].cleanupClaim,true);XCTAssertEqual(result.meterEnvironment?.tiles[0].wildHandoff,true)
        XCTAssertFalse(result.observedState.tiles[0].pendingRemoval)
    }
    @MainActor func testCoreMutationDuringPhysicalGetterRejectsWholeCapturedRead() async throws {
        let e=engine(),session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{100}),s=scope(session)
        let p=NativeSourceGameplayRuntimeProducer(engine:e,scope:s,hooks:.init(physicalRoster:{["a"]},physicalTile:{t in
            e.restart(state:e.state);return .init(tile:t,eventMode:"static",pendingStackFrames:0)
        },tileMarkers:{_ in self.markers()},globalOwners:{self.globals}))
        XCTAssertNil(p.capture(isWild:false))
    }
    @MainActor func testRetireDuringActualOwnerReadRejectsCapturedPublication() async throws {
        let e=engine(),session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{100}),s=scope(session)
        var producer:NativeSourceGameplayRuntimeProducer!
        producer=NativeSourceGameplayRuntimeProducer(engine:e,scope:s,hooks:.init(physicalRoster:{["a"]},physicalTile:{.init(tile:$0,eventMode:"static",pendingStackFrames:0)},tileMarkers:{_ in producer.retire();return self.markers()},globalOwners:{self.globals}))
        XCTAssertNil(producer.capture(isWild:false));XCTAssertNil(producer.capture(isWild:false))
    }
    @MainActor func testRosterAndNonIntegerWallDateDoNotInferSceneReady() async throws {
        let e=engine(),session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{100.5}),s=scope(session)
        let p=NativeSourceGameplayRuntimeProducer(engine:e,scope:s,hooks:.init(physicalRoster:{["a"]},physicalTile:{.init(tile:$0,eventMode:"static",pendingStackFrames:0)},tileMarkers:{_ in self.markers()},globalOwners:{self.globals}))
        let result=try XCTUnwrap(p.capture(isWild:false));XCTAssertNil(result.meterEnvironment)
        XCTAssertEqual(result.missingOwners,["source-integer-wall-Date"])
        let q=NativeSourceGameplayRuntimeProducer(engine:e,scope:s,hooks:.init(physicalRoster:{[]},physicalTile:{.init(tile:$0,eventMode:"static",pendingStackFrames:0)},tileMarkers:{_ in self.markers()},globalOwners:{self.globals}))
        XCTAssertEqual(q.capture(isWild:false)?.missingOwners,["source-core-roster-overlay"])
    }
}
