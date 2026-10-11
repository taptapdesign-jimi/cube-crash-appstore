import Foundation

/// Captured source handoff identity; a future app-owned endgame ledger may read
/// Date at these genuine boundaries. This receipt has no clock and cannot stand
/// in for spawn acquisition or changed physical-signature writer receipts.
struct NativeSourceRegularHandoffMutationReceipt:Equatable {
    enum Phase {case began,released}
    let id=UUID()
    let ownerID:String
    let generation:UInt64
}
