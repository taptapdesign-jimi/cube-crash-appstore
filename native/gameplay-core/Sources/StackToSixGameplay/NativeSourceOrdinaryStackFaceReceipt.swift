import Foundation

/// Captured ordinary setValue callback. Value publishes at contact; physical
/// stackDepth and maximum publish only through its actual frame delivery.
public struct NativeSourceOrdinaryStackFaceReceipt:Equatable,Sendable {
    public let id:String
    public let ordinaryMoveID:String
    public let generation:UInt64
    public let sequence:UInt64
    public let destinationID:String
    public let cell:NativeCell
    public let value:Int
    public let addStack:Int
}

struct NativeSourceOrdinaryStackFaceEntry {
    let receipt:NativeSourceOrdinaryStackFaceReceipt
    let before:NativeBoardState
    let source:NativeTile
    let destination:NativeTile
}
