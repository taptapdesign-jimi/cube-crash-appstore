import Foundation

public struct NativeFinalMergeSnapshot: Equatable, Codable, Sendable {
    public var activeSnapshotWasOnlyMergePair: Bool
    public var activePhysicalTileCount: Int
    public var mergePhysicalTileCount: Int
    public var isFinalRegularMerge6: Bool
    public var isFinalWildLastTwo: Bool
    public var isFinalMerge: Bool { isFinalRegularMerge6 || isFinalWildLastTwo }
}
public struct NativeGameplayRuntimeFlags: Equatable, Sendable {
    public var busyEnding = false
    public var wildSpawnInProgress = false
    public var merge6SpawnInProgress = false
    public var wildMagnetPullInProgress = false
    /// Gameplay mutation only. An authored decorative visual tail must not set this flag.
    public var pendingSpecialMutation = false
    public var willPulledTilesMerge = false
    public var hasTilesToPull = false
    public var endgameGuardActive = false
    public init() {}
    public var isWaiting: Bool { busyEnding || wildSpawnInProgress || merge6SpawnInProgress || wildMagnetPullInProgress || pendingSpecialMutation }
}
public enum NativeGameplayResolver {
    public static func canDrop(_ source: NativeTile, onto destination: NativeTile) -> Bool {
        guard source.id != destination.id, source.isPlayable, destination.isPlayable else { return false }
        if source.isWild && destination.isWild { return false }
        if source.isWild || destination.isWild { return source.value > 0 && destination.value > 0 }
        if source.value == destination.value { return source.value + destination.value <= 6 }
        if source.value == 6 && (1...5).contains(destination.value) { return true }
        if destination.value == 6 && (1...5).contains(source.value) { return true }
        return source.value > 0 && destination.value > 0 && source.value + destination.value <= 6
    }
    public static func anyMergePossible(_ tiles: [NativeTile]) -> Bool {
        let playable = tiles.filter(\.isPlayable)
        for (index, source) in playable.enumerated() {
            if playable.dropFirst(index + 1).contains(where: { canDrop(source, onto: $0) }) { return true }
        }
        return false
    }
    public static func magnetCandidates(_ tiles: [NativeTile], source: NativeTile, destination: NativeTile) -> [NativeTile] {
        tiles.filter { $0.id != source.id && $0.id != destination.id && $0.countsAsFinalMergeActive && !$0.magnetOwned && !$0.transientSpawn && !$0.merge6CleanupOwned }
    }
    public static func finalMerge(_ tiles: [NativeTile], source: NativeTile, destination: NativeTile, effectiveSum: Int, hasTilesToPull: Bool = false) -> NativeFinalMergeSnapshot {
        let active = tiles.filter(\.countsAsFinalMergeActive)
        let onlyPair = active.count == 2 && active.contains { $0.id == source.id } && active.contains { $0.id == destination.id }
        let blockers = active.filter { $0.id != source.id && $0.id != destination.id }
        let magnet = source.gameplayArchetype == .magnet || destination.gameplayArchetype == .magnet
        let wildFinal = onlyPair && blockers.isEmpty && !(magnet && hasTilesToPull) && source.isWild != destination.isWild
        let regularFinal = onlyPair && blockers.isEmpty && !source.isWild && !destination.isWild && source.value > 0 && destination.value > 0 && (source.value + destination.value == 6 || effectiveSum == 6)
        return NativeFinalMergeSnapshot(activeSnapshotWasOnlyMergePair: onlyPair, activePhysicalTileCount: active.reduce(0) { $0 + max(1, $1.stackDepth) }, mergePhysicalTileCount: max(1, source.stackDepth) + max(1, destination.stackDepth), isFinalRegularMerge6: regularFinal, isFinalWildLastTwo: wildFinal)
    }
    public static func resolve(state: NativeBoardState, flags: NativeGameplayRuntimeFlags = NativeGameplayRuntimeFlags(), phase: String = "manual-check", finalMerge: NativeFinalMergeSnapshot? = nil, effectiveSum: Int = 0) -> NativeResolution {
        guard state.validationIssues().isEmpty else { return NativeResolution(.wait, reason: "invalid_authoritative_board") }
        if let terminal = state.terminal { return terminal }
        if flags.isWaiting || state.tiles.contains(where: \.transientSpawn) { return NativeResolution(.wait, reason: "runtime_transition_active") }
        let target = state.mode == .arcade ? "arcade-stage" : "journey-board"
        if let finalMerge, finalMerge.isFinalMerge && !flags.willPulledTilesMerge {
            return NativeResolution(.complete, reason: finalMerge.isFinalRegularMerge6 ? "final_regular_merge6" : "final_wild_merge6", target: target)
        }
        let wilds = state.tiles.filter { $0.isWild && $0.countsAsFinalMergeActive }
        if flags.willPulledTilesMerge || flags.hasTilesToPull || (!wilds.isEmpty && !(finalMerge?.isFinalMerge ?? false)) { return NativeResolution(.continue, reason: "wild_continuation_available") }
        if flags.endgameGuardActive { return NativeResolution(.continue, reason: "external_guard_active") }
        let active = state.activeTiles
        if active.isEmpty { return NativeResolution(.complete, reason: "clean_board", target: target) }
        if active.count == 1 && active[0].value == 6 {
            if active[0].nonFinalMerge6 { return NativeResolution(.continue, reason: "non_final_merge6_guard") }
            return NativeResolution(.complete, reason: "only_merge6_remains", target: target)
        }
        if phase == "after-merge" && effectiveSum == 6 { return NativeResolution(.spawn, reason: "merge6_spawn_required") }
        if anyMergePossible(state.tiles) { return NativeResolution(.continue, reason: "merges_possible") }
        return NativeResolution(.fail, reason: active.count == 1 && active[0].value != 6 ? "single_non_6_tile" : "no_merges_possible")
    }
}
