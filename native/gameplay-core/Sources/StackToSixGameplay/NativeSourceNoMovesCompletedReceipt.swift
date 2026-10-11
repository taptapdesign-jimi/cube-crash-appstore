import Foundation

/// Provenance of the actual confirmedFailFlow board-exit callback, not a
/// presentation clock or a claim that showNoMovesText succeeded. Source catches
/// unavailable text, then still forwards confirmedFailFlow to the final screen.
public struct NativeSourceNoMovesCompletedReceipt: Equatable {
    public let generation: UInt64
    public let planToken: UInt64
    public let resolution: NativeResolution
    public var boardExitCompleted: Bool { true }
    public var noMovesFlowHandled: Bool { true }
    // Core alone constructs this receipt after its accepted exit boundary.
    init(generation: UInt64, planToken: UInt64, resolution: NativeResolution) {
        self.generation=generation;self.planToken=planToken;self.resolution=resolution
    }
    public func admits(generation: UInt64, resolution: NativeResolution) -> Bool {
        self.generation == generation && self.resolution == resolution
    }
}
