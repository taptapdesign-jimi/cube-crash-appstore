import Foundation

/// Literal live final-merge predicates read retained Source objects, including
/// temporary face/cleanup markers. This is not a save/minimum paint receipt and
/// does not certify global/endgame/queue capability or a clean-board handoff.
public final class NativeSourceFinalMergePresenceAuthority {
    public struct Snapshot {
        public let canonicalState:NativeBoardState
        public let physicalTiles:[NativeTile]
        public let runtime:[String:NativeNoMovesTileRuntime]
        public init?(canonicalState:NativeBoardState,physicalTiles:[NativeTile],runtime:[String:NativeNoMovesTileRuntime]) {
            guard canonicalState.validationIssues(allowSourceDetachedGridReferences:true).isEmpty,
                  physicalTiles.map(\.id)==canonicalState.tiles.map(\.id),
                  Set(runtime.keys)==Set(physicalTiles.map(\.id)),
                  zip(physicalTiles,canonicalState.tiles).allSatisfy({actual,model in
                      actual.cell==model.cell && (0...6).contains(actual.value) &&
                          (1...4).contains(actual.stackDepth) && actual.alpha.isFinite
                  }) else{return nil}
            self.canonicalState=canonicalState;self.physicalTiles=physicalTiles;self.runtime=runtime
        }
    }
    public let isCurrent:()->Bool
    public let capture:()->Snapshot?
    public init(isCurrent:@escaping()->Bool,capture:@escaping()->Snapshot?) {
        self.isCurrent=isCurrent;self.capture=capture
    }
}
