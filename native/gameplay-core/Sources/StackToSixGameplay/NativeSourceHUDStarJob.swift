import Foundation
/// Runtime-only genuine earned flight batch, not persisted and not a timer.
public struct NativeSourceHUDStarJob:Equatable,Sendable {
    public let id:String
    public let generation:UInt64
    public let receiptIDs:[String]
    init(id:String,generation:UInt64,receiptIDs:[String]){self.id=id;self.generation=generation;self.receiptIDs=receiptIDs}
}
