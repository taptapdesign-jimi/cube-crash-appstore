import Foundation

/// ensureMinimumActiveTilesAfterSpawn reads tileIsActive, independently of
/// checkLevelEnd, InputGate, global queue permission and canonical save.
/// This capability certifies only an exact current physical tile capture.
public final class NativeSourceOrdinaryMinimumTileAuthority {
    public struct Snapshot {
        public let paint:NativeSourceNoMovesRuntimeSnapshot.PaintedStateReceipt
        public let tiles:[String:NativeNoMovesTileRuntime]
        public init?(paint:NativeSourceNoMovesRuntimeSnapshot.PaintedStateReceipt,
                     tiles:[String:NativeNoMovesTileRuntime]) {
            guard Set(tiles.keys)==Set(paint.canonicalState.tiles.map(\.id)) else{return nil}
            self.paint=paint;self.tiles=tiles
        }
    }
    public let isCurrent:()->Bool
    public let capture:()->Snapshot?
    public init(isCurrent:@escaping()->Bool,capture:@escaping()->Snapshot?) {
        self.isCurrent=isCurrent;self.capture=capture
    }
}
