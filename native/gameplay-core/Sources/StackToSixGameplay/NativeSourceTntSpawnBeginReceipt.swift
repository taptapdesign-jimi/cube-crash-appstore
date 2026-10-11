import Foundation

/// Actual TNT main's shared spawn entry. It cannot impersonate the Direct
/// receipt or allocate the app-owned merge-six token/Date itself.
public struct NativeSourceTntSpawnBeginReceipt:Equatable,Sendable {
    public let id:UUID
    public let ownerID:String
    public let generation:UInt64
    init(ownerID:String,generation:UInt64){id=UUID();self.ownerID=ownerID;self.generation=generation}
}

/// A separate outer locked-bonus Promise reaction. The primary spawn coroutine
/// never impersonates this receipt or consumes its captured await boundary.
public struct NativeSourceTntLockedBonusGuardReceipt:Equatable,Sendable {
    public enum Stage:Equatable,Sendable {case preSpawn,singleMergeSix}
    public let id:UUID
    public let ownerID:String
    public let generation:UInt64
    public let stage:Stage
    init(ownerID:String,generation:UInt64,stage:Stage){id=UUID();self.ownerID=ownerID;self.generation=generation;self.stage=stage}
}
