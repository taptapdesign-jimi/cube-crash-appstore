import Foundation

/// Genuine non-final Direct Wild replacement entry, distinct from ordinary
/// six and TNT/Special callers. Core cannot mint the app-owned token or Date.
public struct NativeSourceWildSpawnBeginReceipt:Equatable,Sendable {
    public let id:UUID
    public let ownerID:String
    public let generation:UInt64
    init(ownerID:String,generation:UInt64){
        id=UUID();self.ownerID=ownerID;self.generation=generation
    }
}
