import Foundation

/// Literal v9 tileBlocksFinalMerge. This is distinct from tileIsActive and
/// cannot certify immutable finality, a clean-board handoff or global owners.
public enum NativeSourceFinalMergeBlockers {
    public static func blocks(_ tile:NativeTile,runtime:NativeNoMovesTileRuntime,excluding:Set<String>)->Bool {
        guard !excluding.contains(tile.id),!runtime.destroyed,!tile.pendingRemoval,
              !runtime.beingRemoved,!runtime.cleanupQueued,!tile.magnetOwned else{return false}
        let visible=tile.visible && tile.alpha>0.01
        if runtime.wildDropping && !(tile.isWild && visible) {return false}
        if tile.isWild {return visible && (!tile.locked || tile.alpha>0.35)}
        return !tile.locked && visible && tile.value>0
    }
    public static func countsAsActive(_ tile:NativeTile,runtime:NativeNoMovesTileRuntime)->Bool {
        guard !runtime.destroyed,!tile.pendingRemoval,!runtime.beingRemoved,!runtime.cleanupQueued,
              tile.visible,tile.alpha>0.01 else{return false}
        if runtime.wildDropping && !tile.isWild {return false}
        if tile.isWild {return !tile.magnetOwned && (!tile.locked || tile.alpha>0.35)}
        return !tile.locked && tile.value>0
    }
    /// Both false guard results are known only after the complete physical
    /// roster was captured. Detached grid membership does not erase presence.
    public static func singleMergeSixCompletion(tiles:[NativeTile],runtime:[String:NativeNoMovesTileRuntime],
        sourceID:String,destinationID:String)->Bool? {
        guard Set(tiles.map(\.id)).count==tiles.count,Set(runtime.keys)==Set(tiles.map(\.id)) else{return nil}
        guard !tiles.contains(where:{blocks($0,runtime:runtime[$0.id]!,excluding:[sourceID,destinationID])}) else{return false}
        let active=tiles.filter{NativeSourceEndgameChecker.active($0,runtime:runtime[$0.id]!)}
        return active.count==1 && active[0].id==destinationID && active[0].value==6
    }
    /// Caller has captured a valid canonical grid/roster with the same object
    /// identities and physical alpha/visibility. No finality from a renderer tail.
    public static func finalSnapshot(tiles:[NativeTile],runtime:[String:NativeNoMovesTileRuntime],
        source:NativeTile,destination:NativeTile,effectiveSum:Int,magnetWillPull:Bool=false)->NativeFinalMergeSnapshot? {
        guard source.id != destination.id,Set(tiles.map(\.id)).count==tiles.count,
              Set(runtime.keys)==Set(tiles.map(\.id)),tiles.contains(where:{$0.id==source.id}),
              tiles.contains(where:{$0.id==destination.id}) else{return nil}
        let active=tiles.filter{countsAsActive($0,runtime:runtime[$0.id]!)}
        let pair=active.count==2 && active.contains{$0.id==source.id} && active.contains{$0.id==destination.id}
        let blockers=tiles.contains{blocks($0,runtime:runtime[$0.id]!,excluding:[source.id,destination.id])}
        return .init(activeSnapshotWasOnlyMergePair:pair,activePhysicalTileCount:active.reduce(0){$0+max(1,$1.stackDepth)},
            mergePhysicalTileCount:max(1,source.stackDepth)+max(1,destination.stackDepth),
            isFinalRegularMerge6:pair && !blockers && !source.isWild && !destination.isWild && source.value>0 && destination.value>0 && (source.value+destination.value==6 || effectiveSum==6),
            isFinalWildLastTwo:pair && !blockers && !magnetWillPull && source.isWild != destination.isWild)
    }
}
