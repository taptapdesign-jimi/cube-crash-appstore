import Foundation
import StackToSixGameplay

/// Source-only snapshot capability. Every field must come from its genuine
/// owner; absent lifecycle/spawn flags are reported, never defaulted false.
/// Core's conservative coherence refusal is additional Native protection,
/// separate from literal Source's transient flags.
struct NativeSourceCanonicalSaveCapture {
    /// Build the canonical adapter from one retained physical roster. This
    /// deliberately does not call any transient hook (in particular Date).
    /// Admission and Source's early save vetoes must remain read-only.
    @MainActor static func physical(
        canonicalState:NativeBoardState,physicalState:NativeBoardState,
        eventModes:[String:String],guardFields:NativeSourceCanonicalSaveGuard,
        transient:NativeSourceCanonicalSaveTransient.Hooks,
        missingOwners:[String],physicalStillMatches:@escaping()->Bool
    )->NativeSourceCanonicalSaveCapture? {
        guard transient.current(),canonicalState.generation==physicalState.generation,
              canonicalState.mode==physicalState.mode,canonicalState.board==physicalState.board,
              canonicalState.columns==physicalState.columns,canonicalState.rows==physicalState.rows,
              Set(canonicalState.tiles.map(\.id))==Set(physicalState.tiles.map(\.id)),
              Set(physicalState.tiles.map(\.id)).count==physicalState.tiles.count,
              Set(eventModes.keys)==Set(physicalState.tiles.map(\.id)),
              eventModes.values.allSatisfy({!$0.isEmpty}),transient.current() else{return nil}
        guard let receipt=NativeSourceNoMovesRuntimeSnapshot.PaintedStateReceipt(
            canonicalState:canonicalState,paintedState:physicalState) else{return nil}
        guard physicalStillMatches(),transient.current() else{return nil}
        return .init(guardFields:guardFields,transient:transient,
            missingOwners:missingOwners,physicalState:physicalState,
            paintedStateReceipt:receipt,physicalEventModes:eventModes,
            physicalStillMatches:physicalStillMatches)
    }
    let guardFields:NativeSourceCanonicalSaveGuard
    /// Construct lazy hooks only; do not query Date registries during capture.
    let transient:NativeSourceCanonicalSaveTransient.Hooks
    let missingOwners:[String]
    /// Actual same-object physical model observations. A divergent Core/physical
    /// board cannot be serialized via this Native schema until its receipt lands.
    let physicalState:NativeBoardState
    let paintedStateReceipt:NativeSourceNoMovesRuntimeSnapshot.PaintedStateReceipt?
    let physicalEventModes:[String:String]?
    let physicalStillMatches:(()->Bool)?
    init(guardFields:NativeSourceCanonicalSaveGuard,transient:NativeSourceCanonicalSaveTransient.Hooks,
         missingOwners:[String],physicalState:NativeBoardState,
         paintedStateReceipt:NativeSourceNoMovesRuntimeSnapshot.PaintedStateReceipt?=nil,
         physicalEventModes:[String:String]?=nil,physicalStillMatches:(()->Bool)?=nil) {
        self.guardFields=guardFields;self.transient=transient;self.missingOwners=missingOwners
        self.physicalState=physicalState;self.paintedStateReceipt=paintedStateReceipt
        self.physicalEventModes=physicalEventModes
        self.physicalStillMatches=physicalStillMatches
    }
    /// Save keeps canonical logical state. A genuine parent-paint receipt can
    /// authenticate only cosmetic differences, never missing transient owners.
    func matchesCanonicalState(_ state:NativeBoardState)->Bool {
        guard let receipt=paintedStateReceipt else{return physicalState==state}
        return receipt.canonicalState==state && receipt.paintedState==physicalState
    }
    var hasCompletePhysicalEventModes:Bool {
        guard let modes=physicalEventModes,Set(modes.keys)==Set(physicalState.tiles.map(\.id)) else{return false}
        return modes.values.allSatisfy{!$0.isEmpty}
    }
    /// Literal original snapshot rejects passive playable objects even though
    /// alpha/visibility are not serialized. Prepared entry bypasses visibility
    /// alone, never zero-alpha or passive input. Pose proof cannot bypass this.
    func hasSerializablePaint(allowPreparedHidden:Bool)->Bool {
        guard paintedStateReceipt != nil else{return true} // existing exact-Core path
        return Self.hasSerializablePaint(physicalState,eventModes:physicalEventModes,allowPreparedHidden:allowPreparedHidden)
    }
    /// Shared literal paint gate for whole-save and genuine one-shot entry.
    static func hasSerializablePaint(_ state:NativeBoardState,eventModes:[String:String]?,allowPreparedHidden:Bool)->Bool {
        guard let modes=eventModes,Set(modes.keys)==Set(state.tiles.map(\.id)),
              modes.values.allSatisfy({!$0.isEmpty}) else{return false}
        return state.tiles.allSatisfy {tile in
            guard !tile.locked && (tile.value>0 || tile.isWild) else{return true}
            return (allowPreparedHidden || tile.visible) && tile.alpha>0.01 &&
                modes[tile.id] != "none" && modes[tile.id] != "passive"
        }
    }
}
