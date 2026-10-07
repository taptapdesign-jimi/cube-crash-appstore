import Foundation
public struct NativeOrdinaryMovePlan:Equatable,Sendable {
    public let id:String,generation:UInt64,revision:UInt64,source:NativeTile,destination:NativeTile,startedAt:Double,isFinal:Bool
}
public struct NativeOrdinaryPostcheckReceipt:Equatable,Sendable {
    public let id:String,generation:UInt64,delayMilliseconds:Int
}

public struct NativeOrdinaryAssignment:Equatable,Sendable {
    public enum Kind:Sendable {case locked,forcedLocked,endgamePrimary,remainderPrimary}
    public let id:String,generation:UInt64,cell:NativeCell,tileID:String?,kind:Kind,delayMilliseconds:Int
    public var awaitsBounce:Bool {kind == .endgamePrimary || kind == .remainderPrimary}
}
