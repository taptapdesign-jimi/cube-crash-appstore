import Foundation

/// Actual native Source owners must publish the complete physical/runtime
/// capture. These are capability receipts, not inferred pending-plan flags.
public struct NativeSourceNoMovesRuntimeSnapshot:Equatable {
    public enum Capability:String,CaseIterable,Hashable,Sendable {
        case physicalRoster,tileLifecycle,spawnMarkers,wildContinuation
        case specialTransaction,regularHandoff,livingDrag,endgameGuard,sourceFreshCheck
    }
    public let state:NativeBoardState
    public let tiles:[String:NativeNoMovesTileRuntime]
    public let wildContinuationPending:Bool
    public let gameplayTransactionActive:Bool
    public let livingDragActive:Bool
    public let endgameGuardActive:Bool
    public let nonFinalMergeSixGuardActive:Bool
    /// Actual forced checkEndGame of this same physical capture, not resolve().
    public let freshResult:NativeResolution
    public let capabilities:Set<Capability>
    public init(state:NativeBoardState,tiles:[String:NativeNoMovesTileRuntime],
        wildContinuationPending:Bool,gameplayTransactionActive:Bool,livingDragActive:Bool,
        endgameGuardActive:Bool,nonFinalMergeSixGuardActive:Bool,freshResult:NativeResolution,
        capabilities:Set<Capability>) {
        self.state=state;self.tiles=tiles;self.wildContinuationPending=wildContinuationPending
        self.gameplayTransactionActive=gameplayTransactionActive;self.livingDragActive=livingDragActive
        self.endgameGuardActive=endgameGuardActive;self.nonFinalMergeSixGuardActive=nonFinalMergeSixGuardActive
        self.freshResult=freshResult;self.capabilities=capabilities
    }
    var complete:Bool {
        capabilities==Set(Capability.allCases) && Set(tiles.keys)==Set(state.tiles.map(\.id)) &&
        state.validationIssues().isEmpty && [.fail,.continue,.complete].contains(freshResult.kind)
    }
    var signature:NativeSourceGameplaySignature {
        .init(tiles:state.tiles.filter{!(tiles[$0.id]?.destroyed ?? false)})
    }
}

/// Optional captured native Source authority. No clock, timer or hidden query.
/// The owner must run literal getNoMovesCommitBlockReason ordered reads; missing
/// marker/registry endpoints refuse the whole capture. nil keeps Raw safeguards.
public final class NativeSourceNoMovesRuntimeAuthority {
    public let isCurrent:()->Bool
    public let capture:()->NativeSourceNoMovesRuntimeSnapshot?
    public init(isCurrent:@escaping()->Bool,capture:@escaping()->NativeSourceNoMovesRuntimeSnapshot?) {
        self.isCurrent=isCurrent;self.capture=capture
    }
}

extension NativeSourceNoMovesRuntimeAuthority {
    public struct PhysicalCapture {
        public let state:NativeBoardState,tiles:[String:NativeNoMovesTileRuntime]
        public let nonFinalMergeSixGuardActive:Bool
        public init(state:NativeBoardState,tiles:[String:NativeNoMovesTileRuntime],nonFinalMergeSixGuardActive:Bool) {
            self.state=state;self.tiles=tiles;self.nonFinalMergeSixGuardActive=nonFinalMergeSixGuardActive
        }
    }
    public struct OrderedCaptureHooks {
        public let current:()->Bool
        public let livingDrag:()->Bool?
        public let endgameGuard:()->Bool?
        public let physical:()->PhysicalCapture?
        public let fresh:(PhysicalCapture,Bool)->NativeResolution?
        public let wildContinuation:()->Bool?
        public let spawningOrPulling:()->Bool?
        public let specialActive:()->Bool?
        public let regularHandoff:()->Bool?
        public let capabilities:Set<NativeSourceNoMovesRuntimeSnapshot.Capability>
        public init(current:@escaping()->Bool,livingDrag:@escaping()->Bool?,endgameGuard:@escaping()->Bool?,
            physical:@escaping()->PhysicalCapture?,fresh:@escaping(PhysicalCapture,Bool)->NativeResolution?,
            wildContinuation:@escaping()->Bool?,spawningOrPulling:@escaping()->Bool?,
            specialActive:@escaping()->Bool?,regularHandoff:@escaping()->Bool?,
            capabilities:Set<NativeSourceNoMovesRuntimeSnapshot.Capability>) {
            self.current=current;self.livingDrag=livingDrag;self.endgameGuard=endgameGuard
            self.physical=physical;self.fresh=fresh;self.wildContinuation=wildContinuation
            self.spawningOrPulling=spawningOrPulling;self.specialActive=specialActive
            self.regularHandoff=regularHandoff;self.capabilities=capabilities
        }
    }
    /// Executes literal getNoMovesCommitBlockReason order and OR short-circuit.
    /// Caller physical capture already borrows actual Source roster/marker owners;
    /// no additional InputGate/save queries or pending-plan inference are made.
    public static func captureSourceOrdered(_ h:OrderedCaptureHooks)->NativeSourceNoMovesRuntimeSnapshot? {
        guard h.capabilities==Set(NativeSourceNoMovesRuntimeSnapshot.Capability.allCases) else{return nil}
        guard h.current(),let dragging=h.livingDrag(),h.current(),let guardActive=h.endgameGuard(),h.current(),
            let physical=h.physical(),h.current() else{return nil}
        // Original builds its signature BEFORE forced checker. Snapshot signature
        // is derived from these immutable same-physical fields, never a revision.
        let signature=NativeSourceGameplaySignature(tiles:physical.state.tiles.filter{!(physical.tiles[$0.id]?.destroyed ?? false)})
        guard h.current(),let fresh=h.fresh(physical,guardActive),h.current(),
            let wild=h.wildContinuation(),h.current(),let spawning=h.spawningOrPulling(),h.current() else{return nil}
        var transaction=spawning
        if !transaction {
            guard let special=h.specialActive(),h.current() else{return nil};transaction=special
        }
        if !transaction {
            guard let handoff=h.regularHandoff(),h.current() else{return nil};transaction=handoff
        }
        let result=NativeSourceNoMovesRuntimeSnapshot(state:physical.state,tiles:physical.tiles,
            wildContinuationPending:wild,gameplayTransactionActive:transaction,livingDragActive:dragging,
            endgameGuardActive:guardActive,nonFinalMergeSixGuardActive:physical.nonFinalMergeSixGuardActive,
            freshResult:fresh,capabilities:h.capabilities)
        guard h.current(),result.signature==signature,result.complete else{return nil}
        return result
    }
}
