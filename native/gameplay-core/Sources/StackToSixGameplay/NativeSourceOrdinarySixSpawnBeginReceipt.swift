import Foundation

/// Minted only when an actual non-final ordinary-six continuation enters its
/// replacement branch AFTER the pre-spawn caller has returned continuation.
/// A request is NOT an acquisition token and cannot stamp Date. The actual
/// Source app-lived owner must accept it and allocate its separate token first.
public struct NativeSourceOrdinarySixSpawnBeginReceipt:Equatable,Sendable {
    public let id:UUID
    public let ownerID:String
    public let generation:UInt64
    public let sequence:UInt64
    init(ownerID:String,generation:UInt64,sequence:UInt64){
        id=UUID();self.ownerID=ownerID;self.generation=generation;self.sequence=sequence
    }
}
