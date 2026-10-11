import Foundation

/// Lazy, literal Source save-only order. No InputGate/endgame registry reads.
/// Unknown mandatory owners are an admission refusal, never a false marker.
@MainActor struct NativeSourceCanonicalSaveTransient {
    nonisolated enum Result:Equatable {case known(Bool),missing(String),obsolete}
    struct Hooks {
        let current:()->Bool
        let busyEnding:()->Bool?
        let spawningOrPulling:()->Bool?
        let specialActive:()->Bool?
        let regularHandoff:()->Bool?
        let cleanupClaim:()->Bool?
        let livingDrag:()->Bool?
        let foregroundDrop:()->Bool?
        let livingTileMarker:()->Bool?
    }
    static func capture(_ hooks:Hooks)->Result {
        let ordered:[(String,()->Bool?)]=[
            ("source-busy-ending",hooks.busyEnding),("source-spawn-or-pull",hooks.spawningOrPulling),
            ("source-special-transaction",hooks.specialActive),("source-regular-handoff",hooks.regularHandoff),
            ("source-merge-six-cleanup",hooks.cleanupClaim),("source-living-drag",hooks.livingDrag),
            ("source-foreground-drop",hooks.foregroundDrop),("source-living-tile-markers",hooks.livingTileMarker)]
        for (name,read) in ordered {
            guard hooks.current() else{return .obsolete}
            let observed=read()
            guard hooks.current() else{return .obsolete}
            guard let observed else{return .missing(name)}
            if observed{return .known(true)}
        }
        return .known(false)
    }
}
