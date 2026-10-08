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
        XCTAssertEqual(e.state.tiles[0].stackDepth,2);XCTAssertEqual(e.state.tiles[0].alpha,1)
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
