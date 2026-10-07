import Foundation
public struct NativeOrdinaryMovePlan:Equatable,Sendable {
    public let id:String,generation:UInt64,revision:UInt64,source:NativeTile,destination:NativeTile,startedAt:Double,isFinal:Bool
}
public struct NativeOrdinaryPostcheckReceipt:Equatable,Sendable {
    public let id:String,generation:UInt64,delayMilliseconds:Int
}
