import Foundation

/// Core-minted actual value:null ordinary assignment, never a Direct/TNT receipt.
public struct NativeSourceOrdinaryFreshConstructorReceipt:Equatable,Sendable {
    public let id:UUID
    public let ownerID:String
    public let generation:UInt64
    public let assignmentID:String
    public let tileID:String
    public let cell:NativeCell
    public let kind:NativeOrdinaryAssignment.Kind
    public let retiredTileIDs:[String]
    init(ownerID:String,generation:UInt64,assignmentID:String,tileID:String,cell:NativeCell,kind:NativeOrdinaryAssignment.Kind,retiredTileIDs:[String]) {
        id=UUID();self.ownerID=ownerID;self.generation=generation
        self.assignmentID=assignmentID;self.tileID=tileID;self.cell=cell
        self.kind=kind;self.retiredTileIDs=retiredTileIDs
    }
}
