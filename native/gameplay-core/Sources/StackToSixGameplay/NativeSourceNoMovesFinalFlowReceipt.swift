import Foundation
/// Genuine confirmed-lock entry to showFinalScreen. Separate from board-exit
/// completion: its actual coroutine finally also runs on pre-exit abort.
public struct NativeSourceNoMovesFinalFlowReceipt:Equatable {
    public let generation:UInt64
    public let planToken:UInt64
    public let resolution:NativeResolution
    init(generation:UInt64,planToken:UInt64,resolution:NativeResolution){self.generation=generation;self.planToken=planToken;self.resolution=resolution}
}
