import Foundation
import StackToSixGameplay

/// Mandatory flags read from their actual captured lifecycle/spawn owners.
/// No initializer supplies false for an absent owner. No SK action enumeration.
struct NativeSourceTileOwnerMarkers {
    let destroyed,beingRemoved,cleanupQueued,cleanupClaim:Bool
    let magnetAffected,pendingRemoval,resolutionOwned,mergeSixCleanupOwned,nonFinalMergeSix:Bool
    let wildDropping,wildHandoff,ccSpawnAnimating,spawnAnimating,isSpawning:Bool
    let spawnTweenActive,explicitFinal:Bool
}
struct NativeSourcePhysicalTileObservation {
    let tile:NativeTile
    let eventMode:String
    let pendingStackFrames:Int
}
struct NativeSourceGameplayGlobalOwners {
    let boardMeterEnabled,boardSpawnEnabled,queueInProgress,boardTransitionActive:Bool
    let mergeSixSpawnInProgress,wildMagnetPullInProgress,wildDropInProgress:Bool
}

/// Bounded read-only capture. The real Scene supplies its Source roster, physical
/// node identity reads, and registered marker owners. Missing callbacks refuse.
@MainActor final class NativeSourceGameplayRuntimeProducer {
    struct Hooks {
        let physicalRoster:()->[String]?
        let physicalTile:(NativeTile)->NativeSourcePhysicalTileObservation?
        let tileMarkers:(String)->NativeSourceTileOwnerMarkers?
        let globalOwners:()->NativeSourceGameplayGlobalOwners?
    }
    struct Snapshot {
        let observedState:NativeBoardState
        let noMovesRuntime:[String:NativeNoMovesTileRuntime]
        let eventModes:[String:NativeSourceMeterEventMode]
        let meterEnvironment:NativeSourceMeterQueueEnvironment?
        let inputReasons:[String]
        let missingOwners:[String]
        let physicalCoreDifferences:[String]
        /// Core currently classifies stored tiles. Until an actual Source overlay
        /// authority is admitted, divergent physical tiles cannot be published.
        var canPublishToCurrentCore:Bool {missingOwners.isEmpty && physicalCoreDifferences.isEmpty}
    }
    private weak var engine:NativeGameplayEngine?
    private let scope:NativeGameplaySourceRegistrySession.Scope,hooks:Hooks
    private var epoch:UInt64=0,retired=false
    init(engine:NativeGameplayEngine,scope:NativeGameplaySourceRegistrySession.Scope,hooks:Hooks) {
        self.engine=engine;self.scope=scope;self.hooks=hooks
    }
    func retire(){guard !retired else{return};retired=true;epoch &+= 1}
    func capture(isWild:Bool)->Snapshot? {
        guard !retired,scope.current,let engine else{return nil}
        epoch &+= 1;let capturedEpoch=epoch,base=engine.state
        func valid()->Bool {
            guard !retired,epoch==capturedEpoch,scope.current else{return false}
            return !retired && epoch==capturedEpoch && engine.state==base
        }
        guard valid() else{return nil}
        let roster=hooks.physicalRoster();guard valid() else{return nil}
        let global=hooks.globalOwners();guard valid() else{return nil}
        let registry=scope.snapshot(isWild:isWild);guard valid(),let registry else{return nil}
        var missing=scope.missing([.terminalNoMovesInput,.specialContactCommitRelease,.magnetGuardBeginFinally,.sourceTileLifecycle,.sourceSpawnMarkers])
        if roster==nil {missing.append("source-board-roster")}
        if global==nil {missing.append("source-global-owner-bindings")}
        let ids=roster ?? []
        if Set(ids).count != ids.count {missing.append("duplicate-source-board-owner")}
        if Set(ids) != Set(base.tiles.map(\.id)) {missing.append("source-core-roster-overlay")}
        var observed=base,tiles:[NativeTile]=[],runtime:[String:NativeNoMovesTileRuntime]=[:]
        var modes:[String:NativeSourceMeterEventMode]=[:],queueTiles:[NativeSourceMeterQueueTileMarkers]=[],differences:[String]=[]
        for model in base.tiles {
            let physical=hooks.physicalTile(model);guard valid() else{return nil}
            let marker=hooks.tileMarkers(model.id);guard valid() else{return nil}
            guard let physical else{missing.append("source-physical-node:\(model.id)");continue}
            guard let marker else{missing.append("source-tile-marker-owner:\(model.id)");continue}
            guard physical.tile.id==model.id,physical.tile.cell==model.cell,!physical.eventMode.isEmpty,
                physical.tile.alpha.isFinite,physical.pendingStackFrames>=0 else{
                missing.append("invalid-source-node-observation:\(model.id)");continue
            }
            var t=physical.tile
            t.pendingRemoval=marker.pendingRemoval;t.magnetOwned=marker.magnetAffected
            t.resolutionOwned=marker.resolutionOwned;t.merge6CleanupOwned=marker.mergeSixCleanupOwned
            t.nonFinalMerge6=marker.nonFinalMergeSix;t.transientSpawn=marker.ccSpawnAnimating
            tiles.append(t)
            var r=NativeNoMovesTileRuntime()
            r.destroyed=marker.destroyed;r.beingRemoved=marker.beingRemoved;r.cleanupQueued=marker.cleanupQueued
            r.wildDropping=marker.wildDropping;r.wildHandoff=marker.wildHandoff
            r.spawnTweenActive=marker.spawnTweenActive;r.explicitFinal=marker.explicitFinal
            r.eventMode=physical.eventMode=="none" ? .none:physical.eventMode=="passive" ? .passive:.normal
            runtime[t.id]=r;modes[t.id]=NativeSourceMeterEventMode(physical.eventMode)
            queueTiles.append(.init(tileID:t.id,destroyed:marker.destroyed,cleanupClaim:marker.cleanupClaim,
                magnetAffected:marker.magnetAffected,wildDropping:marker.wildDropping,wildHandoff:marker.wildHandoff,
                ccSpawnAnimating:marker.ccSpawnAnimating,spawnAnimating:marker.spawnAnimating,isSpawning:marker.isSpawning))
            if t != model {differences.append(t.id)}
        }
        observed.tiles=tiles
        var environment:NativeSourceMeterQueueEnvironment?
        if let global,missing.isEmpty,registry.sourceDateMilliseconds.isFinite,
            registry.sourceDateMilliseconds>=Double(Int64.min),registry.sourceDateMilliseconds<Double(Int64.max),
            registry.sourceDateMilliseconds.rounded(.towardZero)==registry.sourceDateMilliseconds {
            environment = .init(generation:base.generation,sourceDateMilliseconds:Int64(registry.sourceDateMilliseconds),
                boardMeterEnabled:global.boardMeterEnabled,boardSpawnEnabled:global.boardSpawnEnabled,
                queueInProgress:global.queueInProgress,boardTransitionActive:global.boardTransitionActive,
                failScreenPending:registry.failScreenPending,specialTransactionActive:registry.special != nil,
                endgameGuardActive:registry.endgameGuard.active,endgameGuardSources:registry.endgameGuard.sources,
                mergeSixSpawnInProgress:global.mergeSixSpawnInProgress,wildMagnetPullInProgress:global.wildMagnetPullInProgress,
                wildDropInProgress:global.wildDropInProgress,tiles:queueTiles)
        } else if missing.isEmpty {missing.append("source-integer-wall-Date")}
        guard valid() else{return nil}
        return .init(observedState:observed,noMovesRuntime:runtime,eventModes:modes,meterEnvironment:environment,
                     inputReasons:registry.inputReasons,missingOwners:missing.sorted(),physicalCoreDifferences:differences.sorted())
    }
}
