import Foundation

/// v9 buildNoMovesBoardSignature fields only. Array ties retain source order.
public struct NativeSourceGameplaySignature: Equatable, Sendable {
    public struct Entry: Equatable, Sendable {
        public let value:Int
        public let special:String?
        public let locked:Bool
        public let stackDepth:Int
        public let gridX:Int
        public let gridY:Int
        public let visible:Bool
    }
    public let entries:[Entry]
    public init(tiles:[NativeTile]) {
        entries=tiles.enumerated().sorted { a,b in
            if a.element.cell.row != b.element.cell.row{return a.element.cell.row<b.element.cell.row}
            if a.element.cell.column != b.element.cell.column{return a.element.cell.column<b.element.cell.column}
            if a.element.value != b.element.value{return a.element.value<b.element.value}
            return a.offset<b.offset
        }.map {_,t in Entry(value:t.value,special:t.gameplayArchetype?.rawValue,locked:t.locked,stackDepth:t.stackDepth==0 ? 1:t.stackDepth,gridX:t.cell.column,gridY:t.cell.row,visible:t.visible)}
    }
    /// Canonical native transport of the typed Source fields, independent of UI/IDs.
    public var key:String { entries.map {e in "\(e.gridY),\(e.gridX),\(e.value),\(e.special ?? "null"),\(e.locked),\(e.stackDepth),\(e.visible)"}.joined(separator:"|") }
}

/// Only exact source markers not represented by NativeTile. Captured tile IDs
/// provide native ownership; they are deliberately absent from board signature.
public struct NativeNoMovesTileRuntime: Equatable, Sendable {
    public enum EventMode:String,Sendable {case normal,none,passive}
    public var destroyed=false
    public var beingRemoved=false
    public var cleanupQueued=false
    public var wildDropping=false
    public var wildHandoff=false
    public var spawnTweenActive=false
    public var eventMode:EventMode = .normal
    public var explicitFinal=false
    public init(){}
}

/// Forced checkEndGame with no src/dst merge context. No debounce/cache/clock.
public enum NativeSourceEndgameChecker {
    static func transient(_ t:NativeTile,_ r:NativeNoMovesTileRuntime)->Bool {
        if r.destroyed{return false}
        if r.wildHandoff{return true}
        if t.archetype == .juice{return false}
        if t.locked && t.value>0 && (t.magnetOwned || r.spawnTweenActive){return true}
        if t.transientSpawn {
            let interactive = !t.locked && (t.value>0 || t.isWild) && t.visible && r.eventMode == .normal
            return !interactive
        }
        return false
    }
    static func presence(_ t:NativeTile,_ r:NativeNoMovesTileRuntime)->Bool {
        !r.destroyed && t.isWild && !t.magnetOwned && !t.pendingRemoval && !r.beingRemoved && !r.cleanupQueued && t.visible && t.alpha>0.01
    }
    static func resolving(_ t:NativeTile)->Bool {(t.gameplayArchetype == .magnet || t.gameplayArchetype == .tnt) && t.alpha>0.35}
    public static func active(_ t:NativeTile,runtime r:NativeNoMovesTileRuntime = .init(),boardPredicate:Bool=false)->Bool {
        if r.destroyed || !t.visible || t.magnetOwned || t.pendingRemoval || r.beingRemoved || r.cleanupQueued{return false}
        if !boardPredicate {
            if transient(t,r){return false}
            if r.wildDropping && !(t.isWild && t.alpha>0.01 && r.eventMode == .normal){return false}
        }
        if t.isWild {
            if t.locked && t.alpha>0.35{return true}
            if r.eventMode != .normal {return resolving(t) || transient(t,r)}
            return t.alpha>0.01
        }
        return !t.locked && t.value>0 // v9 intentionally does not test regular alpha.
    }
    static func direct(_ t:NativeTile)->Bool {t.isWild && t.gameplayArchetype != .magnet}
    static func combinations(_ tiles:[NativeTile])->Bool {
        let regular=tiles.contains{!$0.isWild && (1...6).contains($0.value)}
        let star=tiles.contains(where:direct)
        let magnet=tiles.contains{$0.gameplayArchetype == .magnet}
        return (star && regular) || (magnet && (regular || star))
    }
    static func anyMerge(_ tiles:[NativeTile])->Bool {
        if combinations(tiles){return true}
        for (i,a) in tiles.enumerated() where !a.isWild {
            for b in tiles.dropFirst(i+1) where !b.isWild {
                let sum=a.value+b.value
                if (2...6).contains(sum) || (a.value==6 && (1...5).contains(b.value)) || (b.value==6 && (1...5).contains(a.value)){return true}
            }
        }
        return false
    }
    public static func check(state:NativeBoardState,runtime:[String:NativeNoMovesTileRuntime]=[:],endgameGuard:Bool=false,nonFinalGuard:Bool=false)->NativeResolution {
        if endgameGuard{return .init(.continue,reason:"external_guard_active")}
        if state.tiles.contains(where:{transient($0,runtime[$0.id] ?? .init())}){return .init(.continue,reason:"transient_locked_spawn")}
        let activeTiles=state.tiles.filter{active($0,runtime:runtime[$0.id] ?? .init())}
        if activeTiles.isEmpty{return .init(.complete,reason:"clean_board")}
        if activeTiles.count==1,let t=activeTiles.first,t.value==6 {
            if !(runtime[t.id]?.explicitFinal ?? false) && (nonFinalGuard || t.nonFinalMerge6){return .init(.continue,reason:"non_final_merge6_guard")}
            return .init(.complete,reason:"only_merge6_remains")
        }
        let boardActive=state.tiles.filter{active($0,runtime:runtime[$0.id] ?? .init(),boardPredicate:true)}
        if activeTiles.count>=2 && anyMerge(boardActive){return .init(.continue,reason:"merges_possible")}
        let physical=activeTiles.reduce(0){$0+max(1,$1.stackDepth)}
        if physical>=2 && !(activeTiles.count==1 && !activeTiles[0].isWild) {
            if combinations(activeTiles){return .init(.continue,reason:"merges_possible")}
            let raw=state.tiles.filter{t in
                let r=runtime[t.id] ?? .init()
                if t.isWild{return presence(t,r) && ((t.locked && t.alpha>0.35) || resolving(t) || r.eventMode != .none)}
                return !r.destroyed && (1...6).contains(t.value)
            }
            if combinations(raw){return .init(.continue,reason:"merges_possible")}
        }
        return .init(.fail,reason:activeTiles.count==1 && activeTiles[0].value != 6 ? "single_non_6_tile":"no_merges_possible")
    }
}
