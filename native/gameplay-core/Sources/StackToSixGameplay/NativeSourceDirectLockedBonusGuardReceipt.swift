import Foundation

/// The genuine Direct outer locked-bonus helper owns its own awaits, separate
/// from the primary coroutine and from TNT's accepted Special transaction.
public struct NativeSourceDirectLockedBonusGuardReceipt:Equatable,Sendable {
    public enum Stage:Sendable {case preSpawn,singleMergeSix}
    public let id:UUID
    public let ownerID:String
    public let generation:UInt64
    public let stage:Stage
    init(ownerID:String,generation:UInt64,stage:Stage){
        id=UUID();self.ownerID=ownerID;self.generation=generation;self.stage=stage
    }
}
