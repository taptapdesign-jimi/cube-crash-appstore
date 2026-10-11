import Foundation

/// The captured post-main single-destination-six clean-board guard. This is
/// neither an entry snapshot nor a fabricated Direct/Special transaction.
public struct NativeSourceLateFinalMergeReceipt:Equatable,Sendable {
    public let ownerID:String,generation:UInt64,revision:UInt64
    public let source,destination:NativeTile
    public let archetype:NativeWildArchetype,variant:String?
}
